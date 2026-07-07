import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Called when the buyer abandons the PayPal window (closes it / clicks cancel)
// before approving payment. The order row was already created by create-order
// (as unpaid/pending/open, no product reservation), so without this it lingers
// in the admin as if it were a live, actionable sale. We soft-cancel it here.
//
// This is intentionally NON-destructive and fully reversible: we only flip the
// order/fulfillment status to 'cancelled' and never touch payment_status. If a
// real payment somehow lands afterwards (delayed capture / webhook race), the
// capture RPC still marks it paid and flips order_status back to 'completed',
// so a genuinely-paid order can never be lost by a cancel signal.
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`cancel-order:${ip}`, 60, 3600))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const orderId = body && typeof body.orderId === 'string' && body.orderId ? body.orderId : null;
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const { data: order, error } = await service
    .from('orders')
    .select('id, payment_status, paypal_capture_id')
    .eq('id', orderId)
    .maybeSingle();

  // Unknown/missing order — treat as a no-op so the fire-and-forget client call
  // never surfaces an error to the buyer.
  if (error || !order) {
    return NextResponse.json({ ok: true });
  }

  // Never cancel anything that was paid or has a capture id — that's a real sale
  // (or one under manual review). Leave it exactly as-is.
  if (order.payment_status === 'paid' || order.paypal_capture_id) {
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }

  // Conditional update guards against a capture racing in between the select and
  // the write: if the row became paid/captured, these predicates no longer match
  // and nothing is changed.
  await service
    .from('orders')
    .update({ order_status: 'cancelled', fulfillment_status: 'cancelled' })
    .eq('id', orderId)
    .neq('payment_status', 'paid')
    .is('paypal_capture_id', null);

  return NextResponse.json({ ok: true });
}
