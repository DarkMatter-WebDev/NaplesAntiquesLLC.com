import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pushPricesBatch } from '@/lib/etsy/sync';

export const runtime = 'nodejs';

/**
 * Manual "Push prices now" — one bounded batch of the price-only push across
 * live listings whose price drifted from what Etsy last saw (ignores the daily
 * threshold). The client polls this until `done`. See pushPricesBatch.
 */
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  const result = await pushPricesBatch();
  return NextResponse.json(result);
}
