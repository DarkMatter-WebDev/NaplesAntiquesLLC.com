import 'server-only';
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EBAY_AUTH_BASE, EBAY_TOKEN_URL, EbayApiError, basicAuthHeader, ebayFetch, requireEbayClientId } from './client';
import { getConnection, updateConnection, type EbayConnectionRow } from './store';

// OAuth 2.0 authorization-code flow (NO PKCE — eBay requires a confidential
// client, i.e. HTTP Basic auth on every token call, so the exchange is
// server-side only). Mirrors next-app/src/lib/etsy/auth.ts's shape (state
// handling, AES-GCM token encryption, refresh-on-demand); never imports from
// it. See ebay-sync-plan/04-oauth-and-secrets.md.

// Phase 1-2 scopes only. Phase 3 (order ingest, not built — Q15) would add
// https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly.
export const EBAY_OAUTH_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
].join(' ');

export function requireRuName(): string {
  const value = process.env.EBAY_RUNAME;
  if (!value) throw new Error('EBAY_RUNAME is not configured.');
  return value;
}

export function generateOauthState(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function buildAuthorizeUrl(params: { state: string }): string {
  const url = new URL(`${EBAY_AUTH_BASE}/oauth2/authorize`);
  url.searchParams.set('client_id', requireEbayClientId());
  url.searchParams.set('redirect_uri', requireRuName());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', EBAY_OAUTH_SCOPES);
  url.searchParams.set('state', params.state);
  return url.toString();
}

// ---------------------------------------------------------------------------
// Token encryption at rest — identical scheme to etsy/auth.ts (AES-256-GCM,
// SHA-256-derived key so any non-empty env string works, iv.tag.ciphertext
// base64 storage format). Copied rather than imported, per BUILD-PROMPT.md
// hard rule 9 (never modify/couple to the Etsy integration).
// ---------------------------------------------------------------------------
function encryptionKey(): Buffer {
  const raw = process.env.EBAY_TOKEN_ENC_KEY;
  if (!raw) throw new Error('EBAY_TOKEN_ENC_KEY is not configured.');
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

export function decryptToken(enc: string): string {
  const [ivB64, tagB64, dataB64] = enc.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted token.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  token_type?: string;
}

async function postTokenEndpoint(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
    cache: 'no-store',
  });
  const parsed = (await res.json().catch(() => null)) as (TokenResponse & { error?: string; error_description?: string }) | null;
  if (!res.ok || !parsed?.access_token) {
    const isInvalidGrant = parsed?.error === 'invalid_grant';
    throw new EbayApiError({
      status: res.status,
      code: isInvalidGrant ? 'auth_expired' : 'oauth_token_failed',
      operatorMessage: parsed?.error_description || 'eBay did not accept the authorization request.',
      retryable: !isInvalidGrant && res.status >= 500,
    });
  }
  return parsed;
}

interface EbayPrivilegesResponse {
  sellingLimit?: { amount?: { value?: string }; quantity?: number };
}

// code is single-use, ~299s TTL — exchange immediately, never persist it.
export async function completeOauthExchange(service: SupabaseClient, params: { code: string }): Promise<void> {
  const tokens = await postTokenEndpoint({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: requireRuName(),
  });

  const patch: Partial<EbayConnectionRow> = {
    status: 'connected',
    marketplace_id: 'EBAY_US',
    scopes: EBAY_OAUTH_SCOPES.split(' '),
    access_token_enc: encryptToken(tokens.access_token),
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    refresh_token_enc: encryptToken(tokens.refresh_token ?? ''),
    refresh_token_expires_at: tokens.refresh_token_expires_in
      ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
      : null,
    connected_at: new Date().toISOString(),
  };

  // Best-effort identity/limit snapshot (Q14 safety net) — never block
  // connecting on this; the settings panel can refresh it later.
  // NOTE: the plan's OAuth scope list has no identity-lookup scope, so no
  // eBay username is resolved here (see project-docs/features/ebay-sync.md).
  try {
    const privileges = await ebayFetch<EbayPrivilegesResponse>({
      method: 'GET',
      path: '/sell/account/v1/privilege',
      accessToken: tokens.access_token,
    });
    const limit = privileges.data?.sellingLimit;
    if (limit) {
      patch.selling_limit_amount = limit.amount?.value != null ? Number(limit.amount.value) : null;
      patch.selling_limit_quantity = limit.quantity ?? null;
      patch.selling_limit_checked_at = new Date().toISOString();
    }
  } catch {
    // Non-fatal.
  }

  // Best-effort one-time program opt-in (06-account-prerequisites.md step 6,
  // Q7): OUT_OF_STOCK_CONTROL needs no location/address data, so it's safe
  // to attempt automatically on every connect (idempotent — opting in twice
  // is a no-op). Never blocks connecting.
  // NOTE: the OTHER one-time setup item, createInventoryLocation, is NOT
  // attempted here — it requires the business's real postal code/country,
  // which isn't available anywhere in this codebase, and guessing one would
  // risk submitting wrong shipping-origin data to eBay. That step stays a
  // manual OWNER-SETUP.md action (see step 8).
  try {
    await ebayFetch({
      method: 'POST',
      path: '/sell/account/v1/program/opt_in',
      accessToken: tokens.access_token,
      json: { programType: 'OUT_OF_STOCK_CONTROL' },
    });
  } catch {
    // Non-fatal — surfaced via the prerequisite checklist, not a hard failure.
  }

  await updateConnection(service, patch);
}

const ACCESS_TOKEN_SKEW_MS = 2 * 60 * 1000; // refresh 2 minutes before expiry

export async function ensureFreshAccessToken(service: SupabaseClient): Promise<{ accessToken: string }> {
  const connection = await getConnection(service);
  if (!connection || connection.status === 'disconnected' || !connection.access_token_enc || !connection.refresh_token_enc) {
    throw new Error('eBay is not connected.');
  }
  const expiresAtMs = connection.access_token_expires_at ? new Date(connection.access_token_expires_at).getTime() : 0;
  if (expiresAtMs - ACCESS_TOKEN_SKEW_MS > Date.now()) {
    return { accessToken: decryptToken(connection.access_token_enc) };
  }
  return refreshAccessToken(service, connection);
}

// eBay refresh tokens do NOT rotate (unlike Etsy's), so there is no
// compare-and-set race on the refresh token itself. A cheap single-flight
// guard on access_token_expires_at still avoids two concurrent refreshers
// both minting a fresh token (eBay caps refresh-grant calls at 50,000/day —
// a non-issue at this catalog's scale, but free to avoid).
export async function refreshAccessToken(
  service: SupabaseClient,
  connection: EbayConnectionRow,
): Promise<{ accessToken: string }> {
  if (!connection.refresh_token_enc) throw new Error('eBay reconnect required.');
  const oldExpiresAt = connection.access_token_expires_at;

  let tokens: TokenResponse;
  try {
    tokens = await postTokenEndpoint({
      grant_type: 'refresh_token',
      refresh_token: decryptToken(connection.refresh_token_enc),
      scope: EBAY_OAUTH_SCOPES,
    });
  } catch (err) {
    if (err instanceof EbayApiError && err.code === 'auth_expired') {
      await updateConnection(service, { status: 'needs_reauth' });
    }
    throw err;
  }

  const patch: Partial<EbayConnectionRow> = {
    status: 'connected',
    access_token_enc: encryptToken(tokens.access_token),
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
  // Non-rotating, but eBay's response is allowed to include a fresh one — persist it if present.
  if (tokens.refresh_token) patch.refresh_token_enc = encryptToken(tokens.refresh_token);
  if (tokens.refresh_token_expires_in) {
    patch.refresh_token_expires_at = new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString();
  }

  if (!oldExpiresAt) {
    await updateConnection(service, patch);
    return { accessToken: tokens.access_token };
  }

  const { data, error } = await service
    .from('ebay_connection')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .eq('access_token_expires_at', oldExpiresAt)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    // Someone else refreshed first — use whatever is on the row now.
    const fresh = await getConnection(service);
    if (!fresh?.access_token_enc) throw new Error('eBay reconnect required.');
    return { accessToken: decryptToken(fresh.access_token_enc) };
  }
  return { accessToken: tokens.access_token };
}

// eBay has no OAuth revoke endpoint — clears the local row only; document
// that the grant can also be pulled at ebay.com > Account > third-party app
// permissions. Listings already published on eBay are left untouched.
export async function disconnectEbay(service: SupabaseClient): Promise<void> {
  await updateConnection(service, {
    status: 'disconnected',
    access_token_enc: null,
    access_token_expires_at: null,
    refresh_token_enc: null,
    refresh_token_expires_at: null,
    connected_at: null,
  });
}
