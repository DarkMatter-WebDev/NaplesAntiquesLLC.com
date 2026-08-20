import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { runScheduledDrip } from '@/lib/instagram/sync';

export const runtime = 'nodejs';
// ⚠️ NOT 60. `maxDuration` is a VERCEL contract and Netlify ignores it; the real
// ceiling for a synchronous function here is 26 seconds. This said 60 until
// 2026-08-19, when the Facebook drip ran 25s, Netlify cut the connection
// mid-response, and GitHub Actions reported `curl (56) Failure when receiving
// data from the peer`. The number was never doing anything.
//
// Raising it does not buy time. What keeps a run inside the ceiling is the
// wall-clock budget in `runScheduledDrip` — see SOCIAL_DRIP_TIME_BUDGET_MS.
export const maxDuration = 26;

/**
 * Scheduled worker: publish the next bounded batch of due posts.
 *
 * Only products an admin explicitly queued are eligible, so this can never
 * surprise the feed with something unreviewed.
 *
 * No admin browser session exists when a cron calls this, so it is gated by a
 * shared secret header instead of requireAdmin().
 */
export async function POST(req: Request) {
  const secret = process.env.INSTAGRAM_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'INSTAGRAM_CRON_SECRET is not configured.' }, { status: 503 });
  }
  if (req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const service = createServiceClient();
    const result = await runScheduledDrip(service);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Instagram drip run failed.' },
      { status: 500 },
    );
  }
}
