import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPayPalOrder, paypalConfigured } from '@/lib/paypal';

export const runtime = 'nodejs';

/**
 * Resume support for the PayPal popup round-trip. If the buyer's tab was
 * reloaded or evicted while they were approving in the PayPal window, the
 * client's onApprove callback never fires and its state is gone. The checkout
 * page calls this on load (with the internal order id it persisted before the
 * hand-off) to learn where the payment actually stands:
 *
 *   { state: 'paid', orderNumber }                     — already captured; show success
 *   { state: 'approved', paypalOrderId, payerEmail }   — buyer approved; show the confirm screen
 *   { state: 'pending' }                               — created, not approved; keep the form (order id reusable)
 *   { state: 'none' }                                  — unknown/expired; forget the record
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: order, error } = await service
    .from('orders')
    .select('id, order_number, payment_status, paypal_order_id, paypal_capture_id')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ state: 'none' });
  }
  if (order.payment_status === 'paid' || order.paypal_capture_id) {
    return NextResponse.json({ state: 'paid', orderNumber: order.order_number });
  }
  if (!order.paypal_order_id || !paypalConfigured()) {
    return NextResponse.json({ state: 'none' });
  }

  try {
    const paypalOrder = await getPayPalOrder(order.paypal_order_id);
    if (paypalOrder.status === 'APPROVED') {
      return NextResponse.json({
        state: 'approved',
        paypalOrderId: order.paypal_order_id,
        payerEmail: paypalOrder.payerEmail,
      });
    }
    if (paypalOrder.status === 'COMPLETED') {
      // Captured at PayPal but our row isn't marked paid yet (webhook will
      // reconcile). From the buyer's perspective the purchase went through.
      return NextResponse.json({ state: 'paid', orderNumber: order.order_number });
    }
    if (paypalOrder.status === 'CREATED' || paypalOrder.status === 'PAYER_ACTION_REQUIRED') {
      return NextResponse.json({ state: 'pending' });
    }
    return NextResponse.json({ state: 'none' });
  } catch (err) {
    console.error('PayPal order-status error:', err);
    return NextResponse.json({ state: 'none' });
  }
}
