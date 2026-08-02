import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { runSyncStep, type SyncMode } from '@/lib/etsy/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Runs one bounded sync-step invocation for a single product. The admin
 * drawer keeps POSTing while `done: false` — see etsy-sync-plan/09-api-routes.md.
 */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : null;
  const mode: SyncMode = body?.mode === 'update' || body?.mode === 'price-only' ? body.mode : 'publish';
  if (!productId) return NextResponse.json({ error: 'Missing productId.' }, { status: 400 });

  try {
    const result = await runSyncStep(productId, mode);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Sync failed.' }, { status: 500 });
  }
}
