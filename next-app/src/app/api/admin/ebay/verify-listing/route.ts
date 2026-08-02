import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { checkListingStatus } from '@/lib/ebay/sync';

// Manual reconciliation of one listing's local state with eBay's real state.

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { productId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_json', message: 'Invalid JSON body.' } }, { status: 400 });
  }
  if (!body.productId) {
    return NextResponse.json({ error: { code: 'missing_product_id', message: 'productId is required.' } }, { status: 400 });
  }

  const result = await checkListingStatus(body.productId);
  return NextResponse.json(result);
}
