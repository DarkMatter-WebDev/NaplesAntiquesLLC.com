import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { runScheduledDrip } from '@/lib/facebook/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Scheduled drip: publish up to the owner's configured daily limit from the
 * approved queue, oldest first. Only products an admin explicitly queued are
 * eligible, so this can never surprise the Page with something unreviewed.
 *
 * No admin browser session exists when a cron calls this, so it is gated by a
 * shared secret header instead of requireAdmin().
 */
export async function POST(req: Request) {
  const secret = process.env.FACEBOOK_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'FACEBOOK_CRON_SECRET is not configured.' }, { status: 503 });
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
      { error: err instanceof Error ? err.message : 'Facebook drip run failed.' },
      { status: 500 },
    );
  }
}
