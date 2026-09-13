import { NextResponse } from 'next/server';
import { reconcileEbayStatusDrift } from '@/lib/ebay/sync';
import { sweepEbaySales } from '@/lib/marketplace-sales-sweep';

/**
 * Scheduled status-drift reconcile — the safety net under the auto-delist hook.
 *
 * Trigger-agnostic and secret-header-guarded like the price-push twin, so any
 * external cron can call it. Driven every 30 minutes by Supabase pg_cron
 * (supabase/scheduled-jobs-pg-cron-2026-09.sql) — the ONLY scheduler since
 * 2026-09-13; .github/workflows/scheduled-jobs.yml keeps a manual run button.
 *
 * WHY IT EXISTS: `handleProductStatusChange` runs post-response via `after()`,
 * which on Netlify is best-effort by design — work still in flight when the
 * response flushes is frozen with the container, and lost if that container is
 * reclaimed while cold. This route asks the question no scheduling primitive
 * can answer for us: "is anything sold still live right now?"
 *
 * Reuses EBAY_CRON_SECRET rather than adding a new variable. Rotating a cron
 * secret means updating four places (Netlify, Supabase Vault, the GitHub repo
 * secret, and .env.local) and a mismatch fails silently as a 401 — so a new secret is a new
 * way for this to break. Etsy has its own route guarded by its own secret,
 * matching the standing "Etsy and eBay remain independent channels" decision.
 *
 * Since 2026-09-12 the same 30-minute tick first reads paid eBay orders and
 * marks the sold products sold on the site (lib/marketplace-sales-sweep.ts),
 * which ends them on Etsy through the existing status hook; the drift
 * reconcile then runs as before.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.EBAY_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: 'not_configured', message: 'EBAY_CRON_SECRET is not configured.' } },
      { status: 503 },
    );
  }
  if (req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Invalid cron secret.' } },
      { status: 401 },
    );
  }

  try {
    // Sales first — a product sold on eBay is already 'sold' when the drift
    // pass looks at its listing; the sweep never throws (it logs and returns).
    const sales = await sweepEbaySales();
    const reconcile = await reconcileEbayStatusDrift();
    return NextResponse.json({ ...reconcile, sales });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'eBay status reconcile failed.';
    return NextResponse.json({ error: { code: 'reconcile_failed', message } }, { status: 500 });
  }
}
