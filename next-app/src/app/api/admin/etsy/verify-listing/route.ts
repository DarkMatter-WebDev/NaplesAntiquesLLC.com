import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { checkListingStatus } from '@/lib/etsy/sync';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Manual reconciliation with Etsy's real listing state — see checkListingStatus for the 404/deleted-draft case. */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : null;
  if (!productId) return NextResponse.json({ error: 'Missing productId.' }, { status: 400 });

  try {
    const result = await checkListingStatus(productId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not check Etsy status.' }, { status: 500 });
  }
}
