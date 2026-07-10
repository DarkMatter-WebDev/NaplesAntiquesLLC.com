import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { getSiteUrl } from '@/lib/order-email-branding';
import { EBAY_API_BASE, getApplicationToken } from '@/lib/ebay/client';
import { insertSyncLog } from '@/lib/ebay/store';

// Phase 0 compliance endpoint (ebay-sync-plan/09-api-routes.md,
// ebay-sync-plan/15-compliance.md). The production keyset stays disabled
// until this is deployed and subscribed to in the Developer Portal (Q10) —
// see ebay-sync-plan/OWNER-SETUP.md step 5. GET answers eBay's challenge
// during subscription setup; POST verifies and acknowledges deletion/closure
// notifications. We store no eBay buyer data (no Phase 3 order ingest is
// built), so there is nothing to delete on our side — this handler is close
// to a no-op by design.
//
// CONFIRMED LIVE 2026-07-09 (session 14, owner's real production keyset,
// "Send Test Notification" succeeded end to end): eBay's getPublicKey
// response is { key, algorithm: "ECDSA", digest: "SHA1" } — the digest is
// SHA1, NOT SHA256 (this build's original guess). The "key" field arrives as
// "-----BEGIN PUBLIC KEY-----<base64><NO line breaks>-----END PUBLIC
// KEY-----" — markers present but not valid PEM as-is; buildPemFromRawKey()
// below always strips whatever markers/whitespace are present and rebuilds
// the PEM itself rather than trusting the raw string's shape. See
// project-docs/DECISIONS.md 2026-07-09 (session 14, second addendum) for the
// full debugging trail.

export const runtime = 'nodejs';
export const maxDuration = 30;

const WEBHOOK_PATH = '/api/webhooks/ebay-account-deletion';

function endpointUrl(): string {
  return `${getSiteUrl()}${WEBHOOK_PATH}`;
}

// Exact, load-bearing algorithm: hex(sha256(challengeCode + verificationToken
// + endpointUrl)), concatenated in that order (09-api-routes.md:96,
// 15-compliance.md:12). Exported for the unit test.
export function computeChallengeResponse(challengeCode: string, verificationToken: string, endpoint: string): string {
  return crypto.createHash('sha256').update(challengeCode + verificationToken + endpoint).digest('hex');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const challengeCode = url.searchParams.get('challenge_code');
  if (!challengeCode) {
    return NextResponse.json({ error: { code: 'missing_challenge_code', message: 'Missing challenge_code query parameter.' } }, { status: 400 });
  }

  const verificationToken = process.env.EBAY_VERIFICATION_TOKEN;
  if (!verificationToken) {
    return NextResponse.json({ error: { code: 'not_configured', message: 'EBAY_VERIFICATION_TOKEN is not configured.' } }, { status: 503 });
  }

  const challengeResponse = computeChallengeResponse(challengeCode, verificationToken, endpointUrl());
  return NextResponse.json({ challengeResponse }, { status: 200 });
}

// ---------------------------------------------------------------------------
// Signature verification for the POST notification. CONFIRMED LIVE
// 2026-07-09 (session 14) against the owner's real production keyset's
// "Send Test Notification": the X-EBAY-SIGNATURE header is base64 JSON
// carrying { kid, signature } as originally assumed; the actual digest is
// SHA1 (from getPublicKey's own "digest" field, not hardcoded) over the raw
// request body, verified with the EC public key from
// /commerce/notification/v1/public_key/{kid} (see buildPemFromRawKey below
// for the response's actual, initially-surprising key format).
// ---------------------------------------------------------------------------
interface EbaySignatureHeader {
  alg?: string;
  kid?: string;
  signature?: string;
}

function parseSignatureHeader(header: string | null): EbaySignatureHeader | null {
  if (!header) {
    console.error('ebay-account-deletion: POST had no X-EBAY-SIGNATURE header at all.');
    return null;
  }
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as EbaySignatureHeader;
    if (!parsed?.kid || !parsed?.signature) {
      console.error(
        'ebay-account-deletion: X-EBAY-SIGNATURE decoded but is missing kid/signature. Decoded keys:',
        Object.keys(parsed ?? {}),
      );
      return null;
    }
    return parsed;
  } catch (err) {
    // Log the raw header (not a secret — it's eBay's own signature metadata,
    // not one of our tokens) so we can see its actual shape if it doesn't
    // match the assumed base64-JSON format.
    console.error('ebay-account-deletion: could not parse X-EBAY-SIGNATURE as base64 JSON. Raw header:', header, 'Error:', err);
    return null;
  }
}

interface EbayPublicKey {
  pem: string;
  digest: string;
}

const publicKeyCache = new Map<string, EbayPublicKey & { fetchedAt: number }>();
const PUBLIC_KEY_TTL_MS = 60 * 60 * 1000; // cached ~1h per ebay-sync-plan/09-api-routes.md

// Confirmed live 2026-07-09: eBay's getPublicKey response is
// { key, algorithm: "ECDSA", digest: "SHA1" } — the digest is NOT SHA256 (a
// wrong assumption this build originally made). The "key" field itself
// arrives as "-----BEGIN PUBLIC KEY-----<base64, no line breaks>-----END
// PUBLIC KEY-----" — markers present, but not valid PEM as-is (OpenSSL
// requires the base64 body wrapped onto its own lines). Always strip
// whatever markers/whitespace are present and rebuild the PEM ourselves
// rather than trusting the raw string's shape.
function buildPemFromRawKey(raw: string): string {
  const base64Body = raw
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  return `-----BEGIN PUBLIC KEY-----\n${base64Body.match(/.{1,64}/g)?.join('\n') ?? base64Body}\n-----END PUBLIC KEY-----\n`;
}

async function fetchPublicKey(keyId: string): Promise<EbayPublicKey> {
  const cached = publicKeyCache.get(keyId);
  if (cached && Date.now() - cached.fetchedAt < PUBLIC_KEY_TTL_MS) return cached;

  let token: string;
  try {
    token = await getApplicationToken();
  } catch (err) {
    console.error('ebay-account-deletion: getApplicationToken() failed while fetching the notification public key:', err);
    throw err;
  }

  const res = await fetch(`${EBAY_API_BASE}/commerce/notification/v1/public_key/${encodeURIComponent(keyId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`ebay-account-deletion: getPublicKey failed (HTTP ${res.status}) for kid=${keyId}. Body:`, body.slice(0, 500));
    throw new Error(`Could not fetch eBay notification public key (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { key?: string; algorithm?: string; digest?: string };
  const raw = String(data.key ?? '').trim();
  if (!raw) {
    console.error('ebay-account-deletion: getPublicKey response had no usable "key" field. Full response:', JSON.stringify(data).slice(0, 1000));
  }
  const result: EbayPublicKey = { pem: buildPemFromRawKey(raw), digest: data.digest || 'SHA256' };
  publicKeyCache.set(keyId, { ...result, fetchedAt: Date.now() });
  return result;
}

async function verifyEbaySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;
  try {
    const { pem: publicKeyPem, digest } = await fetchPublicKey(parsed.kid!);
    const verifier = crypto.createVerify(digest);
    verifier.update(rawBody);
    verifier.end();
    const result = verifier.verify(publicKeyPem, Buffer.from(parsed.signature!, 'base64'));
    if (!result) {
      console.error(
        'ebay-account-deletion: signature cryptographically did not verify. kid=',
        parsed.kid,
        'alg=',
        parsed.alg,
        'signature length (base64 chars)=',
        parsed.signature?.length,
        'body length=',
        rawBody.length,
      );
    }
    return result;
  } catch (err) {
    console.error('ebay-account-deletion: verifyEbaySignature threw:', err);
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = await verifyEbaySignature(rawBody, req.headers.get('x-ebay-signature'));
  if (!verified) {
    return NextResponse.json({ error: { code: 'invalid_signature', message: 'Signature verification failed.' } }, { status: 412 });
  }

  let event: { notification?: { notificationId?: string } } = {};
  try {
    event = JSON.parse(rawBody || '{}');
  } catch {
    return NextResponse.json({ error: { code: 'invalid_json', message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const notificationId = event.notification?.notificationId;
  if (!notificationId) {
    return NextResponse.json({ error: { code: 'missing_notification_id', message: 'Missing notification id.' } }, { status: 400 });
  }

  const service = createServiceClient();

  // Idempotency: the unique (provider, event_id) constraint rejects duplicates.
  const { error: insertError } = await service.from('webhook_events').insert({
    provider: 'ebay',
    event_id: notificationId,
    event_type: 'MARKETPLACE_ACCOUNT_DELETION',
    payload: event,
    status: 'received',
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ success: true, duplicate: true });
    }
    console.error('webhook_events insert error:', insertError.message);
    return NextResponse.json({ error: { code: 'log_failed', message: 'Could not record event.' } }, { status: 500 });
  }

  // Nothing to delete on our side (no eBay buyer PII stored — see
  // ebay-sync-plan/15-compliance.md). No eBay username/user-id is resolved by
  // this build's OAuth flow (see lib/ebay/auth.ts), so we cannot positively
  // match the deleted account to our own connection — just log for owner
  // review rather than guessing at a connection reset.
  try {
    await insertSyncLog(service, {
      action: 'account_deletion',
      outcome: 'ok',
      message: `Received eBay account-deletion notification ${notificationId}.`,
      detail: { notificationId },
    });
  } catch (err) {
    console.error('eBay account-deletion logging error:', err);
  }

  await service
    .from('webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('provider', 'ebay')
    .eq('event_id', notificationId);

  return NextResponse.json({ success: true });
}
