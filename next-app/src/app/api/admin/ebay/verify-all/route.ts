import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { checkAllListingStatuses } from '@/lib/ebay/sync';

// Bulk reconciliation — the "Check eBay statuses" button.

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;
  const result = await checkAllListingStatuses();
  return NextResponse.json(result);
}
