import { NextResponse } from 'next/server';
import { runScheduledPricePush } from '@/lib/ebay/sync';

// Scheduled daily price push (Q3), trigger-agnostic like the Etsy twin — a
// Netlify Scheduled Function or external cron calls this with the shared
// secret header. See ebay-sync-plan/OWNER-SETUP.md step 10.

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.EBAY_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: { code: 'not_configured', message: 'EBAY_CRON_SECRET is not configured.' } }, { status: 503 });
  }
  if (req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Invalid cron secret.' } }, { status: 401 });
  }

  const result = await runScheduledPricePush();
  return NextResponse.json(result);
}
