import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { drainQueue, enqueueAllEligible, enqueueProducts } from '@/lib/etsy/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Phase 2 bulk sync: enqueue selected/all-eligible products, then drain the queue in time-budgeted calls. */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const action = body?.action;

  try {
    if (action === 'enqueue') {
      const productIds = Array.isArray(body?.productIds) ? body.productIds.filter((id: unknown): id is string => typeof id === 'string') : [];
      const queued = await enqueueProducts(productIds);
      return NextResponse.json({ queued });
    }
    if (action === 'enqueue-all-eligible') {
      const queued = await enqueueAllEligible();
      return NextResponse.json({ queued });
    }
    if (action === 'drain') {
      const result = await drainQueue();
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'Unknown action. Use enqueue, enqueue-all-eligible, or drain.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Batch sync failed.' }, { status: 500 });
  }
}
