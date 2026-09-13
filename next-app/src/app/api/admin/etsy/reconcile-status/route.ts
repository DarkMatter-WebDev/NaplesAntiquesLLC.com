import { NextResponse } from 'next/server';
import { reconcileEtsyStatusDrift } from '@/lib/etsy/sync';
import { sweepEtsySales } from '@/lib/marketplace-sales-sweep';

/**
 * Scheduled status-drift reconcile — the safety net under the auto-delist hook.
 * Twin of /api/admin/ebay/reconcile-status; see that file for the full
 * rationale. Trigger-agnostic and guarded by ETSY_CRON_SECRET, the same
 * variable the Etsy price push already uses.
 *
 * Since 2026-09-12 the same 30-minute tick first reads paid Etsy receipts and
 * marks the sold products sold on the site (lib/marketplace-sales-sweep.ts),
 * which ends them on eBay through the existing status hook; the drift
 * reconcile then runs as before.
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
    // Sales first, so a product sold on Etsy is already 'sold' when the drift
    // pass looks at its listing; the sweep never throws (it logs and returns).
    const sales = await sweepEtsySales();
    const reconcile = await reconcileEtsyStatusDrift();
    return NextResponse.json({ ...reconcile, sales });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Etsy status reconcile failed.' },
      { status: 500 },
    );
  }
}
