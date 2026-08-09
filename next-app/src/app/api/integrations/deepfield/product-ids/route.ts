import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { normalizeProductStatus } from '@/types/product';

/**
 * Reconciliation endpoint for the Deep Field product sync.
 *
 * WHY THIS EXISTS: the push is fire-and-forget with no durable queue, and NEJ
 * supports a HARD DELETE that leaves no tombstone. Neither gap is visible from
 * the push alone — a product deleted here, or a change that failed to deliver
 * during a partner outage, simply never arrives. This endpoint gives Deep Field
 * the authoritative id set so it can diff and self-heal:
 *
 *   - id present here but missing there  -> re-request / was never delivered
 *   - id present there but missing here  -> deleted or archived on NEJ
 *   - `updated_at` newer than theirs     -> stale, needs a refresh
 *
 * READ-ONLY. No writes, no side effects, safe to poll.
 *
 * Auth is the SAME shared bearer token the push uses (`DEEPFIELD_SYNC_TOKEN`),
 * so the integration stays a single credential in both directions rather than
 * inventing a second one to manage and rotate.
 *
 * Returns 503 when unconfigured, exactly like Deep Field's own receiver does —
 * so an unconfigured endpoint is never mistaken for an empty catalog. Returning
 * an empty list there would read as "delete everything", which is the worst
 * possible failure mode for a reconciliation feed.
 */

export const dynamic = 'force-dynamic';

/** Mirrors the push: archived is NEJ's soft-delete and is never shared. */
const EXCLUDED_STATUSES = new Set(['archived']);

function timingSafeEqual(a: string, b: string): boolean {
  // Length is not secret; content comparison is constant-time over the shorter
  // string so a mismatch does not leak position via timing.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(request: NextRequest) {
  const expected = process.env.DEEPFIELD_SYNC_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: { code: 'not_configured', message: 'Deep Field sync is not configured.' } },
      { status: 503 },
    );
  }

  const header = request.headers.get('authorization') ?? '';
  const presented = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : '';
  if (!presented || !timingSafeEqual(presented, expected)) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Invalid Deep Field sync token.' } },
      { status: 401 },
    );
  }

  const service = createServiceClient();
  // `images` is selected only to derive a COUNT — the array itself is never
  // emitted. The count lets the partner detect image drift (a partial copy),
  // which neither presence nor `updated_at` can see: a product whose images
  // failed to copy has an identical id and watermark on both sides.
  const { data, error } = await service
    .from('products')
    .select('id, status, updated_at, images')
    .order('id', { ascending: true });

  if (error) {
    console.error('[deepfield] product-ids read failed:', error.message);
    return NextResponse.json(
      { error: { code: 'read_failed', message: 'Could not read products.' } },
      { status: 502 },
    );
  }

  const products = (data ?? [])
    .filter((row) => !EXCLUDED_STATUSES.has(normalizeProductStatus(row.status)))
    .map((row) => ({
      id: row.id as string,
      status: normalizeProductStatus(row.status),
      // Emitted RAW from Postgres — microsecond precision with a +00:00 offset
      // (e.g. "2026-08-07T13:00:55.669721+00:00"), NOT millisecond ISO.
      //
      // Do not "tidy" this to `new Date(...).toISOString()`. Consumers compare
      // this as their staleness watermark, and the Deep Field reconciler
      // persists a millisecond copy — so the comparison depends on Date.parse
      // TRUNCATING the surplus digits rather than rounding. Truncation is what
      // every engine does, but ECMAScript specifies only three fractional
      // digits and leaves more implementation-defined. Silently changing the
      // precision here, in either direction, moves that boundary for every
      // consumer at once; a rounding runtime would make roughly half the
      // catalog compare as permanently stale and drown real drift in false
      // positives. Their side pins this with tests (2026-08-08).
      updated_at: row.updated_at as string,
      // Always a number, never omitted — the partner treats an absent field as
      // "not comparable", so emitting it conditionally would silently disable
      // their drift check for exactly the rows most likely to be broken.
      image_count: Array.isArray(row.images) ? row.images.length : 0,
    }));

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      count: products.length,
      products,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
