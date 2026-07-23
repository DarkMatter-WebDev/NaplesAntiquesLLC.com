import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { checkAllListingStatuses } from '@/lib/etsy/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Bulk "Check Etsy status of all" — reconciles every linked listing's local
 * state to what Etsy actually reports (read-only; no content re-pushed).
 * Clears stale states, incl. leftover 'error' rows. See checkAllListingStatuses.
 */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const rawProductIds = body && typeof body === 'object' && 'productIds' in body
    ? (body as { productIds?: unknown }).productIds
    : undefined;
  if (rawProductIds !== undefined && (
    !Array.isArray(rawProductIds)
    || rawProductIds.some((id) => typeof id !== 'string' || !id.trim())
  )) {
    return NextResponse.json({ error: 'productIds must be an array of non-empty strings.' }, { status: 400 });
  }
  const productIds = rawProductIds === undefined
    ? undefined
    : Array.from(new Set((rawProductIds as string[]).map((id) => id.trim())));
  if (productIds && productIds.length > 250) {
    return NextResponse.json({ error: 'A maximum of 250 products can be checked at once.' }, { status: 400 });
  }

  try {
    const result = await checkAllListingStatuses(productIds);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not check Etsy statuses.' }, { status: 500 });
  }
}
