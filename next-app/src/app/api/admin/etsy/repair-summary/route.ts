import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getEtsyRepairSummary } from '@/lib/etsy/sync';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    return NextResponse.json(await getEtsyRepairSummary());
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : 'Could not inspect Etsy sync issues.' },
      { status: 500 },
    );
  }
}
