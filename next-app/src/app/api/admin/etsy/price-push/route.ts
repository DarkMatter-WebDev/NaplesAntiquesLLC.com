import { NextResponse } from 'next/server';
import { runScheduledPricePush } from '@/lib/etsy/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Phase 2 scheduled daily price push (etsy-sync-plan/03-sync-lifecycle.md,
 * 13-open-questions.md Q4). Trigger-agnostic by design — the plan explicitly
 * leaves "Netlify Scheduled Function vs. an external cron hitting a
 * secret-token-guarded internal route" as a build-time choice
 * (etsy-sync-plan/09-api-routes.md). This build ships the guarded route only;
 * wiring an actual daily trigger (a Netlify Scheduled Function, or any
 * external cron hitting this route with the secret header) is on the owner
 * checklist — see OWNER-SETUP.md.
 *
 * No admin browser session exists when a cron calls this, so it is gated by a
 * shared secret header instead of requireAdmin().
 */
export async function POST(req: Request) {
  const secret = process.env.ETSY_CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'ETSY_CRON_SECRET is not configured.' }, { status: 503 });
  if (req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await runScheduledPricePush();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Price push failed.' }, { status: 500 });
  }
}
