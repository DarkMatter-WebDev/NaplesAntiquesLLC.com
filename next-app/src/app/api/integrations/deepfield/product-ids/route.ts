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
  const { data, error } = await service
    .from('products')
    .select('id, status, updated_at')
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
      updated_at: row.updated_at as string,
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
