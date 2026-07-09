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
// Signature verification for the POST notification. TODO(ebay-verify): the
// exact X-EBAY-SIGNATURE decoding shape and the getPublicKey response field
// names are pinned from the commonly-documented eBay Notification API
// pattern (base64 JSON header carrying {kid, signature}; ECDSA/SHA-256 over
// the raw request body; PEM-ish public key from
// /commerce/notification/v1/public_key/{kid}) — this build environment has
// no network access to confirm the live contract (see
// next-app/src/lib/ebay/client.ts's header note). Spot check against a real
// "Send Test Notification" payload before relying on this in production.
// ---------------------------------------------------------------------------
interface EbaySignatureHeader {
  alg?: string;
  kid?: string;
  signature?: string;
}

function parseSignatureHeader(header: string | null): EbaySignatureHeader | null {
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as EbaySignatureHeader;
    return parsed?.kid && parsed?.signature ? parsed : null;
  } catch {
    return null;
  }
}

const publicKeyCache = new Map<string, { pem: string; fetchedAt: number }>();
const PUBLIC_KEY_TTL_MS = 60 * 60 * 1000; // cached ~1h per ebay-sync-plan/09-api-routes.md

async function fetchPublicKeyPem(keyId: string): Promise<string> {
  const cached = publicKeyCache.get(keyId);
  if (cached && Date.now() - cached.fetchedAt < PUBLIC_KEY_TTL_MS) return cached.pem;

  const token = await getApplicationToken();
  const res = await fetch(`${EBAY_API_BASE}/commerce/notification/v1/public_key/${encodeURIComponent(keyId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Could not fetch eBay notification public key (HTTP ${res.status}).`);
  const data = (await res.json()) as { key?: string };
  const raw = (data.key ?? '').trim();
  const pem = raw.includes('BEGIN PUBLIC KEY') ? raw : `-----BEGIN PUBLIC KEY-----\n${raw.match(/.{1,64}/g)?.join('\n') ?? raw}\n-----END PUBLIC KEY-----`;
  publicKeyCache.set(keyId, { pem, fetchedAt: Date.now() });
  return pem;
}

async function verifyEbaySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;
  try {
    const publicKeyPem = await fetchPublicKeyPem(parsed.kid!);
    const verifier = crypto.createVerify('SHA256');
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(publicKeyPem, Buffer.from(parsed.signature!, 'base64'));
  } catch {
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
