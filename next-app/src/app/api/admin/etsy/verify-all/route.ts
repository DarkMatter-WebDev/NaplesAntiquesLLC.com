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
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const result = await checkAllListingStatuses();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not check Etsy statuses.' }, { status: 500 });
  }
}
