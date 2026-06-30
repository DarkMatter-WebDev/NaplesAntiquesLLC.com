import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { capturePayPalOrder, paypalConfigured } from '@/lib/paypal';

export const runtime = 'nodejs';

const CURRENCY = 'USD';
const AMOUNT_TOLERANCE = 0.01;

export async function POST(req: Request) {
  if (!paypalConfigured()) {
    return NextResponse.json({ error: 'PayPal is not configured.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const paypalOrderId = body && typeof body.paypalOrderId === 'string' ? body.paypalOrderId : null;
  if (!paypalOrderId) {
    return NextResponse.json({ error: 'Missing paypalOrderId' }, { status: 400 });
  }

  const service = createServiceClient();

  // Find the internal order this PayPal order belongs to.
  const { data: order, error: orderError } = await service
    .from('orders')
    .select('id, order_number, total, payment_status, paypal_capture_id')
    .eq('paypal_order_id', paypalOrderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found for this payment.' }, { status: 404 });
  }

  // Idempotent: already paid — return success without recapturing. We key only on
  // payment_status='paid' (the final state); a non-paid order that happens to carry
  // a capture id is a prior mismatch/manual-review case and must not report success.
  if (order.payment_status === 'paid') {
    return NextResponse.json({ success: true, orderId: order.id, orderNumber: order.order_number, alreadyPaid: true });
  }

  // Capture server-side.
  let capture;
  try {
    capture = await capturePayPalOrder(paypalOrderId);
  } catch (err) {
    console.error('PayPal capture error:', err);
    return NextResponse.json({ error: 'Payment could not be captured.' }, { status: 502 });
  }

  if (capture.status !== 'COMPLETED' || !capture.captureId) {
    return NextResponse.json(
      { error: 'Payment was not completed.', status: capture.status },
      { status: 402 },
    );
  }

  // Verify the captured amount + currency match our authoritative order total.
  const expectedTotal = Number(order.total);
  const amountOk =
    capture.capturedAmount != null && Math.abs(capture.capturedAmount - expectedTotal) <= AMOUNT_TOLERANCE;
  const currencyOk = capture.capturedCurrency === CURRENCY;

  if (!amountOk || !currencyOk) {
    // Money was captured but does not match the order. Do NOT auto-fulfill —
    // record the capture details and flag for manual review.
    await service
      .from('orders')
      .update({
        payment_status: 'pending',
        payment_reference: capture.captureId,
        paypal_capture_id: capture.captureId,
        payment_response: capture.raw as object,
        internal_notes:
          `PayPal amount/currency mismatch — captured ` +
          `${capture.capturedAmount} ${capture.capturedCurrency}, expected ${expectedTotal} ${CURRENCY}. Manual review required.`,
      })
      .eq('id', order.id);

    await service.from('admin_notifications').insert({
      type: 'order',
      title: `PayPal amount mismatch on ${order.order_number}`,
      body: `Captured ${capture.capturedAmount} ${capture.capturedCurrency}, expected ${expectedTotal} ${CURRENCY}. Capture ${capture.captureId}. Review before fulfilling.`,
      order_id: order.id,
    });

    return NextResponse.json({ error: 'Payment amount did not match the order. Our team will follow up.' }, { status: 409 });
  }

  // All good — mark paid, sell the items, notify admin (atomic + idempotent).
  const { data: rpcData, error: rpcError } = await service.rpc('capture_paypal_order', {
    p_order_id: order.id,
    p_capture_id: capture.captureId,
    p_payment_response: capture.raw as object,
  });

  if (rpcError) {
    console.error('capture_paypal_order RPC error:', rpcError);
    return NextResponse.json({ error: 'Payment captured but order update failed. Our team will follow up.' }, { status: 500 });
  }

  revalidateTag('shop-catalog', 'max'); // purchased items are now 'sold' in the gallery

  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  return NextResponse.json({
    success: true,
    orderId: order.id,
    orderNumber: (result?.order_number as string | undefined) ?? order.order_number,
  });
}
