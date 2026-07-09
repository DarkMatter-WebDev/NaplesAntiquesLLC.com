import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { capturePayPalOrder, paypalConfigured } from '@/lib/paypal';
import { finalizePaidOrder, notifyItemConflict } from '@/lib/order-finalize';
import { handleProductStatusChange as handleEtsyProductStatusChange } from '@/lib/etsy/sync';
import { handleProductStatusChange as handleEbayProductStatusChange } from '@/lib/ebay/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    .select('id, order_number, total, payment_status, paypal_capture_id, user_id, customer_name, customer_email, subtotal, tax, shipping_fee, discount')
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

  // Mark paid and sell the items (atomic + idempotent). The RPC also locks product
  // rows so concurrent captures for the same item serialize here — the second caller
  // sees item_conflict=true if the first already sold the item.
  const { data: rpcData, error: rpcError } = await service.rpc('capture_paypal_order', {
    p_order_id: order.id,
    p_capture_id: capture.captureId,
    p_payment_response: capture.raw as object,
  });

  if (rpcError) {
    console.error('capture_paypal_order RPC error:', rpcError);
    return NextResponse.json({ error: 'Payment captured but order update failed. Our team will follow up.' }, { status: 500 });
  }

  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;

  if (result?.item_conflict) {
    // Another buyer completed payment first. The order is flagged in the DB for
    // manual refund — alert an admin (the buyer's money was captured) and surface
    // a clear message to this buyer.
    await notifyItemConflict(service, {
      id: order.id,
      orderNumber: (result?.order_number as string | undefined) ?? order.order_number,
    });
    return NextResponse.json(
      { error: 'Sorry, one or more items in your order were just purchased by another buyer. Our team will contact you to process a full refund.' },
      { status: 409 },
    );
  }

  // { expire: 0 } forces immediate expiration — 'max' uses stale-while-revalidate,
  // which would serve the buyer their own just-sold item as available on the very
  // next /shop visit (only revalidating in the background for the visit after that).
  revalidateTag('shop-catalog', { expire: 0 }); // purchased items are now 'sold' in the gallery

  // Phase 2 auto-delist (etsy-sync-plan/03-sync-lifecycle.md Flow 3 and
  // ebay-sync-plan/03-sync-lifecycle.md Flow 3): fire-and-forget, best-effort
  // — never block the buyer's confirmation on Etsy or eBay.
  const { data: capturedItems } = await service.from('order_items').select('product_id').eq('order_id', order.id);
  const capturedProductIds = (capturedItems ?? []).map((item) => item.product_id).filter((id): id is string => Boolean(id));
  void handleEtsyProductStatusChange(capturedProductIds).catch(() => {});
  void handleEbayProductStatusChange(capturedProductIds).catch(() => {});

  // Invoice upsert (idempotent) + auto receipt email. Shared with the webhook
  // backstop so a browser-death capture still produces both. Best-effort — the
  // payment already succeeded, so a failure here must not fail the capture. Only
  // runs on this fresh capture (an already-paid order returns earlier).
  await finalizePaidOrder(service, order.id);

  return NextResponse.json({
    success: true,
    orderId: order.id,
    orderNumber: (result?.order_number as string | undefined) ?? order.order_number,
  });
}
