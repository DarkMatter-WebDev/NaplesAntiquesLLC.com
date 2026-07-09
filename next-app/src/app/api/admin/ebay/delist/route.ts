import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { runDelist } from '@/lib/ebay/sync';

// Manual delist verbs (Q7): hide (quantity-zero, Out-of-Stock Control),
// withdraw (archived/deleted), restore.

export const runtime = 'nodejs';
export const maxDuration = 30;

const VALID_ACTIONS = ['hide', 'withdraw', 'restore'] as const;

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { productId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_json', message: 'Invalid JSON body.' } }, { status: 400 });
  }
  if (!body.productId) {
    return NextResponse.json({ error: { code: 'missing_product_id', message: 'productId is required.' } }, { status: 400 });
  }
  const action = (body.action ?? 'hide') as (typeof VALID_ACTIONS)[number];
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: { code: 'invalid_action', message: `action must be one of ${VALID_ACTIONS.join(', ')}.` } }, { status: 400 });
  }

  const result = await runDelist(body.productId, action);
  return NextResponse.json(result);
}
