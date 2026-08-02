import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { discardPrepared, runSyncStep, type FacebookSyncMode } from '@/lib/facebook/sync';
import { queueProduct, unqueueProduct } from '@/lib/facebook/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODES: FacebookSyncMode[] = ['prepare', 'publish'];

/**
 * One bounded step of the Facebook state machine, plus queue management.
 * The client re-POSTs while `done` is false so a long publish stays inside the
 * serverless time limit.
 */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  const action = typeof body?.action === 'string' ? body.action : 'prepare';

  if (!productId) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }

  const service = createServiceClient();

  if (action === 'queue') {
    const row = await queueProduct(service, productId);
    return NextResponse.json({ queued: true, syncState: row?.sync_state ?? 'pending' });
  }

  if (action === 'unqueue') {
    await unqueueProduct(service, productId);
    return NextResponse.json({ queued: false });
  }

  if (action === 'discard') {
    const result = await discardPrepared(service, productId);
    return NextResponse.json(result, { status: result.discarded ? 200 : 400 });
  }

  if (!MODES.includes(action as FacebookSyncMode)) {
    return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
  }

  const result = await runSyncStep(service, productId, action as FacebookSyncMode);
  return NextResponse.json(result, { status: result.state === 'error' ? 422 : 200 });
}
