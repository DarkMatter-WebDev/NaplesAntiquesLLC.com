import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pushPricesBatch } from '@/lib/ebay/sync';

// Manual "Push prices to eBay now" — one bounded batch; the client polls
// until done (Etsy twin).

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;
  const result = await pushPricesBatch();
  return NextResponse.json(result);
}
