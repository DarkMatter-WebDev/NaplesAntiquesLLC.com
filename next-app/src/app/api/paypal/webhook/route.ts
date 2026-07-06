import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyPayPalWebhook } from '@/lib/paypal';
import { finalizePaidOrder, notifyItemConflict } from '@/lib/order-finalize';

export const runtime = 'nodejs';
export const maxDuration = 60;

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
};

function uuidLike(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(req: Request) {
  const raw = await req.text();

  // Verify the signature with PayPal before trusting anything in the body.
  const verified = await verifyPayPalWebhook(req.headers, raw);
  if (!verified) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(raw || '{}');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const eventId = event.id;
  const eventType = event.event_type ?? '';
  if (!eventId) {
    return NextResponse.json({ error: 'Missing event id.' }, { status: 400 });
  }

  const resource = event.resource ?? {};
  const customId = resource.custom_id ?? resource.invoice_id;
  const relatedIds = (resource.supplementary_data as { related_ids?: { order_id?: string } } | undefined)?.related_ids;
  const paypalOrderId =
    relatedIds?.order_id ?? (eventType.startsWith('CHECKOUT.ORDER') ? (resource.id as string | undefined) : undefined);
  const captureId = eventType.startsWith('PAYMENT.CAPTURE') ? (resource.id as string | undefined) : undefined;

  const service = createServiceClient();

  // Resolve the internal order id (custom_id is our reference; fall back to the
  // PayPal order id we stored on create).
  let internalOrderId: string | null = uuidLike(customId) ? customId : null;
  if (!internalOrderId && paypalOrderId) {
    const { data } = await service.from('orders').select('id').eq('paypal_order_id', paypalOrderId).maybeSingle();
    internalOrderId = data?.id ?? null;
  }

  // Idempotency: the unique (provider, event_id) constraint rejects duplicates.
  const { error: insertError } = await service.from('webhook_events').insert({
    provider: 'paypal',
    event_id: eventId,
    event_type: eventType,
    resource_id: (resource.id as string | undefined) ?? null,
    order_id: internalOrderId,
    payload: event,
    status: 'received',
  });

  if (insertError) {
    if (insertError.code === '23505') {
      // Already processed this event — acknowledge so PayPal stops retrying.
      return NextResponse.json({ success: true, duplicate: true });
    }
    console.error('webhook_events insert error:', insertError);
    return NextResponse.json({ error: 'Could not record event.' }, { status: 500 });
  }

  // Act on the event. Capture confirmation is a backstop for the client capture;
  // the rest cover out-of-band money movement.
  try {
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && internalOrderId && captureId) {
      // Verify the captured amount + currency against our authoritative order total
      // BEFORE marking anything paid. The client capture path (capture-order) does
      // this and quarantines mismatches for manual review; without the same guard
      // here, a mismatched capture that the client correctly held back would be
      // silently marked paid + products sold when its webhook lands.
      const amount = resource.amount as { value?: string; currency_code?: string } | undefined;
      const { data: orderRow } = await service
        .from('orders')
        .select('order_number, total, payment_status')
        .eq('id', internalOrderId)
        .maybeSingle();

      const capturedAmount = amount?.value != null ? Number(amount.value) : NaN;
      const expectedTotal = orderRow ? Number(orderRow.total) : NaN;
      const amountOk =
        Number.isFinite(capturedAmount) &&
        Number.isFinite(expectedTotal) &&
        Math.abs(capturedAmount - expectedTotal) <= 0.01;
      const currencyOk = amount?.currency_code === 'USD';

      if (orderRow && orderRow.payment_status !== 'paid' && (!amountOk || !currencyOk)) {
        await service
          .from('orders')
          .update({
            payment_status: 'pending',
            internal_notes:
              `PayPal webhook amount/currency mismatch — captured ${amount?.value} ${amount?.currency_code}, ` +
              `expected ${expectedTotal} USD. Manual review required.`,
          })
          .eq('id', internalOrderId);
        await service.from('admin_notifications').insert({
          type: 'order',
          title: `PayPal amount mismatch on ${orderRow.order_number ?? internalOrderId}`,
          body: `Webhook capture ${captureId}: captured ${amount?.value} ${amount?.currency_code}, expected ${expectedTotal} USD. Review before fulfilling.`,
          order_id: internalOrderId,
        });
      } else {
        const { data: capData } = await service.rpc('capture_paypal_order', {
          p_order_id: internalOrderId,
          p_capture_id: captureId,
          p_payment_response: event as object,
        });
        const capResult = Array.isArray(capData) ? capData[0] : capData;
        if (capResult?.item_conflict) {
          // Losing capture of a one-of-one race — alert an admin for the refund.
          await notifyItemConflict(service, {
            id: internalOrderId,
            orderNumber: (capResult?.order_number as string | undefined) ?? internalOrderId,
          });
        } else if (!capResult?.already_paid) {
          // This webhook (not the client) completed the sale — invoice + receipt.
          await finalizePaidOrder(service, internalOrderId);
        }
      }
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED') {
      await service.rpc('apply_paypal_order_event', {
        p_order_id: internalOrderId,
        p_event: 'denied',
        p_payment_response: event as object,
      });
    } else if (eventType === 'PAYMENT.CAPTURE.REFUNDED' || eventType === 'PAYMENT.CAPTURE.REVERSED') {
      await service.rpc('apply_paypal_order_event', {
        p_order_id: internalOrderId,
        p_event: 'refunded',
        p_payment_response: event as object,
      });
    } else if (eventType.startsWith('CUSTOMER.DISPUTE')) {
      await service.rpc('apply_paypal_order_event', {
        p_order_id: internalOrderId,
        p_event: 'dispute',
        p_payment_response: event as object,
      });
    }
  } catch (err) {
    console.error('PayPal webhook processing error:', err);
    await service.from('webhook_events').update({ status: 'error' }).eq('provider', 'paypal').eq('event_id', eventId);
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 });
  }

  // Capture/denial/refund all change product availability — refresh the gallery.
  // { expire: 0 } forces immediate expiration (see capture-order/route.ts for why
  // 'max' stale-while-revalidate semantics leave the sold item visible once more).
  if (eventType.startsWith('PAYMENT.CAPTURE')) {
    revalidateTag('shop-catalog', { expire: 0 });
  }

  await service
    .from('webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('provider', 'paypal')
    .eq('event_id', eventId);

  return NextResponse.json({ success: true });
}
