import 'server-only';
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ETSY_API_BASE, ETSY_OAUTH_BASE, EtsyApiError, etsyFetch, requireEtsyApiKey, requireEtsyApiKeyHeader } from './client';
import { getConnection, updateConnection, type EtsyConnectionRow } from './store';

// OAuth 2.0 + PKCE. See etsy-sync-plan/04-oauth-and-secrets.md.
//
// listings_d is requested from the start (delist/relist + image replacement
// can need delete calls) — one consent screen, not two.
export const ETSY_OAUTH_SCOPES = 'listings_r listings_w listings_d shops_r shops_w';

const ACCESS_TOKEN_SKEW_MS = 2 * 60 * 1000; // refresh 2 minutes before expiry

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateOauthState(): string {
  return base64url(crypto.randomBytes(24));
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function requireRedirectUri(): string {
  const uri = process.env.ETSY_REDIRECT_URI;
  if (!uri) throw new Error('ETSY_REDIRECT_URI is not configured.');
  return uri;
}

export function buildAuthorizeUrl(params: { state: string; codeChallenge: string }): string {
  const clientId = requireEtsyApiKey();
  const url = new URL('/oauth/connect', ETSY_OAUTH_BASE);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', requireRedirectUri());
  url.searchParams.set('scope', ETSY_OAUTH_SCOPES);
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

// ---------------------------------------------------------------------------
// Token encryption at rest (AES-256-GCM). ETSY_TOKEN_ENC_KEY can be any
// non-empty string the owner puts in Netlify (see OWNER-SETUP.md for how to
// generate one) — we SHA-256 it down to a stable 32-byte key so the operator
// never has to worry about exact byte lengths/encodings.
// ---------------------------------------------------------------------------
function encryptionKey(): Buffer {
  const raw = process.env.ETSY_TOKEN_ENC_KEY;
  if (!raw) throw new Error('ETSY_TOKEN_ENC_KEY is not configured.');
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
  refresh_token: string;
  expires_in: number;
  token_type?: string;
}

async function postTokenEndpoint(body: Record<string, string>): Promise<TokenResponse> {
  // The spec's securitySchemes description says "every request to a v3 API
  // endpoint" needs x-api-key in keystring:shared_secret form — sent here too
  // even though this is the "public" token endpoint, since nothing in the
  // spec exempts it and an extra correct header is harmless either way.
  const res = await fetch(`${ETSY_API_BASE}/v3/public/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': requireEtsyApiKeyHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => null)) as (TokenResponse & { error?: string; error_description?: string }) | null;
  if (!res.ok || !data?.access_token) {
    throw new EtsyApiError({
      status: res.status,
      code: res.status === 400 && /invalid_grant/i.test(data?.error ?? '') ? 'invalid_grant' : 'oauth_token_failed',
      operatorMessage: data?.error_description ?? 'Etsy rejected the OAuth token request.',
      retryable: false,
      detail: data ? { error: data.error } : null,
    });
  }
  return data;
}

/** Step 3 of the OAuth flow (etsy-sync-plan/04-oauth-and-secrets.md): code -> tokens -> resolve shop -> persist. */
export async function completeOauthExchange(
  service: SupabaseClient,
  params: { code: string; codeVerifier: string },
): Promise<void> {
  const clientId = requireEtsyApiKey();
  const tokens = await postTokenEndpoint({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: requireRedirectUri(),
    code: params.code,
    code_verifier: params.codeVerifier,
  });

  const accessToken = tokens.access_token;
  const me = await etsyFetch<{ user_id: number; shop_id?: number }>({
    path: '/v3/application/users/me',
    accessToken,
  });
  let shopId = me.data.shop_id ?? null;
  let shopName: string | null = null;
  if (shopId) {
    const shop = await etsyFetch<{ shop_id: number; shop_name: string }>({
      path: `/v3/application/shops/${shopId}`,
      accessToken,
    });
    shopName = shop.data.shop_name ?? null;
  } else {
    // user_id doubles as the numeric prefix on access tokens; resolve shop_id
    // via getMe's user_id if the shop_id field is ever absent from /users/me.
    shopId = me.data.user_id ?? null;
  }

  await updateConnection(service, {
    status: 'connected',
    etsy_user_id: me.data.user_id,
    shop_id: shopId,
    shop_name: shopName,
    scopes: ETSY_OAUTH_SCOPES.split(' '),
    access_token_enc: encryptToken(accessToken),
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    refresh_token_enc: encryptToken(tokens.refresh_token),
    refresh_token_updated_at: new Date().toISOString(),
    connected_at: new Date().toISOString(),
  });
}

/**
 * Returns a valid bearer access token, refreshing first if within the skew
 * window. Etsy rotates refresh tokens on every use — the new one is persisted
 * immediately with a conditional update (last-write-wins on the row; two
 * concurrent refreshes each still get a token that is valid for a window).
 * On `invalid_grant` the connection is marked `needs_reauth` and this throws.
 */
export async function ensureFreshAccessToken(service: SupabaseClient): Promise<{ accessToken: string; shopId: number }> {
  const connection = await getConnection(service);
  if (!connection || connection.status === 'disconnected' || !connection.access_token_enc || !connection.refresh_token_enc) {
    throw new Error('Etsy is not connected. Connect it from Admin Settings first.');
  }
  if (!connection.shop_id) throw new Error('Etsy connection is missing a shop id. Reconnect Etsy.');

  const expiresAt = connection.access_token_expires_at ? new Date(connection.access_token_expires_at).getTime() : 0;
  if (expiresAt - ACCESS_TOKEN_SKEW_MS > Date.now()) {
    return { accessToken: decryptToken(connection.access_token_enc), shopId: connection.shop_id };
  }

  return refreshAccessToken(service, connection);
}

export async function refreshAccessToken(
  service: SupabaseClient,
  connection: EtsyConnectionRow,
): Promise<{ accessToken: string; shopId: number }> {
  if (!connection.refresh_token_enc || !connection.shop_id) {
    throw new Error('Etsy connection has no refresh token. Reconnect Etsy.');
  }
  const clientId = requireEtsyApiKey();
  const oldRefreshEnc = connection.refresh_token_enc;

  let tokens: TokenResponse;
  try {
    tokens = await postTokenEndpoint({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: decryptToken(oldRefreshEnc),
    });
  } catch (err) {
    if (err instanceof EtsyApiError && err.code === 'invalid_grant') {
      await updateConnection(service, { status: 'needs_reauth' });
    }
    throw err;
  }

  const patch = {
    status: 'connected' as const,
    access_token_enc: encryptToken(tokens.access_token),
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    refresh_token_enc: encryptToken(tokens.refresh_token),
    refresh_token_updated_at: new Date().toISOString(),
  };

  // Conditional update: only the winner of a concurrent-refresh race persists
  // its result; the loser re-reads and uses the winner's tokens instead of
  // clobbering them with an already-stale refresh token.
  const { data, error } = await service
    .from('etsy_connection')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .eq('refresh_token_enc', oldRefreshEnc)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    // Someone else refreshed first — use whatever is on the row now.
    const fresh = await getConnection(service);
    if (!fresh?.access_token_enc || !fresh.shop_id) throw new Error('Etsy reconnect required.');
    return { accessToken: decryptToken(fresh.access_token_enc), shopId: fresh.shop_id };
  }

  return { accessToken: tokens.access_token, shopId: connection.shop_id };
}

export async function disconnectEtsy(service: SupabaseClient): Promise<void> {
  // Etsy has no token-revocation endpoint to call (documented in
  // 04-oauth-and-secrets.md) — clear our stored grant. Listings on Etsy are
  // left untouched. The owner can also remove the app grant at
  // etsy.com -> Security -> Apps.
  await updateConnection(service, {
    status: 'disconnected',
    access_token_enc: null,
    access_token_expires_at: null,
    refresh_token_enc: null,
    refresh_token_updated_at: null,
    connected_at: null,
  });
}
