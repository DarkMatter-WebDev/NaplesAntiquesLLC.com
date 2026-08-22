import { NextResponse } from 'next/server';
import { reconcileEtsyStatusDrift } from '@/lib/etsy/sync';

/**
 * Scheduled status-drift reconcile — the safety net under the auto-delist hook.
 * Twin of /api/admin/ebay/reconcile-status; see that file for the full
 * rationale. Trigger-agnostic and guarded by ETSY_CRON_SECRET, the same
 * variable the Etsy price push already uses.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.ETSY_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'ETSY_CRON_SECRET is not configured.' }, { status: 503 });
  }
  if (req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    return NextResponse.json(await reconcileEtsyStatusDrift());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Etsy status reconcile failed.' },
      { status: 500 },
    );
  }
}
