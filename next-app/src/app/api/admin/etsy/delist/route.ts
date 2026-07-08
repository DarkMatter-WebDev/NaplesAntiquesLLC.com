import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { runDelist, runReactivate } from '@/lib/etsy/sync';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Deactivate (or reactivate) a linked listing. Deactivate only — deleteListing stays a separate, explicit, admin-confirmed action (Q9). */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : null;
  const action = body?.action === 'reactivate' ? 'reactivate' : 'delist';
  if (!productId) return NextResponse.json({ error: 'Missing productId.' }, { status: 400 });

  try {
    const result = action === 'reactivate' ? await runReactivate(productId) : await runDelist(productId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Action failed.' }, { status: 500 });
  }
}
