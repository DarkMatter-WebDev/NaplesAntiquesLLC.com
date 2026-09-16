import { NextResponse } from 'next/server';
import { sweepTextAlerts } from '@/lib/text-alerts/sweep';

/**
 * 15-minute text-alerts sweep (pg_cron `nej-text-alerts-sweep`, see
 * supabase/text-deals-2026-09.sql). Trigger-agnostic, guarded by
 * TEXT_ALERTS_CRON_SECRET in `x-cron-secret`, same shape as the Etsy/eBay
 * reconcile routes.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.TEXT_ALERTS_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'TEXT_ALERTS_CRON_SECRET is not configured.' }, { status: 503 });
  }
  if (req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    return NextResponse.json(await sweepTextAlerts());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Text alerts sweep failed.' },
      { status: 500 },
    );
  }
}
