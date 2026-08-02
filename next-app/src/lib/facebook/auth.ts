import 'server-only';

import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FacebookApiError, fetchPageProfile } from './client';

/**
 * Facebook Page token lifecycle — dramatically simpler than Instagram's.
 *
 * The owner pastes a PAGE access token (generated in the Graph API Explorer or
 * from a Business system user). A page token derived from a long-lived user
 * token DOES NOT EXPIRE, so there is no refresh window, no minimum refresh age,
 * and no scheduled refresh function. The only failure mode is invalidation
 * (password change, permission revocation, app removal), which surfaces as an
 * invalid_token API error at call time; callers then mark the connection
 * needs_reauth and the owner pastes a fresh token.
 */

// ---------------------------------------------------------------------------
// Token encryption at rest (AES-256-GCM), identical scheme to Instagram/Etsy/
// eBay. FACEBOOK_TOKEN_ENC_KEY can be any non-empty string — we SHA-256 it to
// a stable 32-byte key. Local and production share one Supabase database, so
// the key MUST be byte-identical in .env.local and Netlify.
// ---------------------------------------------------------------------------
function encryptionKey(): Buffer {
  const raw = process.env.FACEBOOK_TOKEN_ENC_KEY;
  if (!raw) throw new Error('FACEBOOK_TOKEN_ENC_KEY is not configured.');
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

export function facebookTokenEncryptionConfigured(): boolean {
  return Boolean(process.env.FACEBOOK_TOKEN_ENC_KEY);
}

// ---------------------------------------------------------------------------
// Connection-aware helpers
// ---------------------------------------------------------------------------

/**
 * Validate a token the owner just pasted and resolve the Page it belongs to.
 * Never persists anything: callers decide what to store.
 *
 * The most likely operator mistake is pasting a USER token instead of a PAGE
 * token — both start with "EAA" and both pass a bare /me probe. Page nodes
 * carry a `category` field and user nodes do not, so that distinction is the
 * check, and the error says exactly what to go back and copy.
 */
export async function verifyPastedPageToken(token: string): Promise<{
  pageId: string;
  pageName: string | null;
}> {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Paste the Facebook Page access token before saving.');

  const profile = await fetchPageProfile(trimmed);
  if (!profile?.id) {
    throw new FacebookApiError({
      status: 0,
      code: 'invalid_token',
      operatorMessage: 'That token did not resolve to a Facebook account.',
      retryable: false,
    });
  }

  if (!profile.category) {
    throw new FacebookApiError({
      status: 0,
      code: 'invalid_token',
      operatorMessage:
        'That is a User token, not a Page token. In the Graph API Explorer, switch "User or Page" to your Page and copy that token instead.',
      retryable: false,
    });
  }

  return {
    pageId: String(profile.id),
    pageName: profile.name ?? null,
  };
}

/**
 * Decrypt the stored token for use in an API call. Returns null when there is
 * nothing usable, so callers fail closed rather than attempting an
 * unauthenticated write. No refresh step: page tokens do not expire.
 */
export async function ensurePageAccessToken(
  service: SupabaseClient,
): Promise<{ accessToken: string; pageId: string } | null> {
  const { data: connection } = await service
    .from('facebook_connection')
    .select('status, page_id, access_token_enc')
    .eq('id', 1)
    .maybeSingle();

  if (!connection?.access_token_enc || !connection.page_id) return null;

  let accessToken: string;
  try {
    accessToken = decryptToken(connection.access_token_enc);
  } catch {
    return null;
  }

  return { accessToken, pageId: String(connection.page_id) };
}

/**
 * Mark the connection as needing a fresh paste. Called by sync paths when
 * Facebook rejects the stored token — the page-token equivalent of Instagram's
 * expiry handling, except it only ever happens on explicit invalidation.
 */
export async function markNeedsReauth(service: SupabaseClient): Promise<void> {
  await service
    .from('facebook_connection')
    .update({ status: 'needs_reauth', updated_at: new Date().toISOString() })
    .eq('id', 1);
}
