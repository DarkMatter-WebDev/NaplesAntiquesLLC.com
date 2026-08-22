import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyPayPalWebhook } from '@/lib/paypal';
import { finalizePaidOrder, notifyItemConflict } from '@/lib/order-finalize';
import { payPalCumulativeRefund, relatedPayPalCaptureId } from '@/lib/paypal-webhook';
import { scheduleProductStatusHooks } from '@/lib/product-status-hooks';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
};

type WebhookClaim = 'claimed' | 'processed' | 'busy';

function uuidLike(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function claimWebhookEvent(
  service: ReturnType<typeof createServiceClient>,
  event: PayPalWebhookEvent,
  internalOrderId: string | null,
): Promise<WebhookClaim> {
  const resource = event.resource ?? {};
  const eventId = event.id as string;
  const eventType = event.event_type ?? '';
  const { error: insertError } = await service.from('webhook_events').insert({
    provider: 'paypal',
    event_id: eventId,
    event_type: eventType,
    resource_id: (resource.id as string | undefined) ?? null,
    order_id: internalOrderId,
    payload: event,
    status: 'processing',
    processed_at: new Date().toISOString(),
  });

  if (!insertError) return 'claimed';
  if (insertError.code !== '23505') {
    throw new Error(`Could not record webhook event: ${insertError.message}`);
  }

  const { data: existing, error: existingError } = await service
    .from('webhook_events')
    .select('status, created_at, processed_at')
    .eq('provider', 'paypal')
    .eq('event_id', eventId)
    .maybeSingle();
  if (existingError || !existing) {
    throw new Error(`Could not inspect duplicate webhook event: ${existingError?.message ?? 'missing row'}`);
  }
  if (existing.status === 'processed') return 'processed';
  if (existing.status === 'processing') {
    const attemptTime = new Date(existing.processed_at ?? existing.created_at).getTime();
    if (Number.isFinite(attemptTime) && Date.now() - attemptTime < 120_000) return 'busy';
  }

  let claimQuery = service
    .from('webhook_events')
    .update({
      status: 'processing',
      order_id: internalOrderId,
      payload: event,
      processed_at: new Date().toISOString(),
    })
    .eq('provider', 'paypal')
    .eq('event_id', eventId)
    .eq('status', existing.status);
  if (existing.status === 'processing') {
    claimQuery = existing.processed_at
      ? claimQuery.eq('processed_at', existing.processed_at)
      : claimQuery.is('processed_at', null);
  }
  const { data: claimed, error: claimError } = await claimQuery
    .select('id')
    .maybeSingle();
  if (claimError) throw new Error(`Could not retry webhook event: ${claimError.message}`);
  return claimed ? 'claimed' : 'busy';
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`paypal-webhook:${ip}`, 300, 60))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const raw = await req.text();

  // Verify the signature with PayPal before trusting anything in the body.
  const verified = await verifyPayPalWebhook(req.headers, raw).catch(() => false);
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
  const relatedIds = (resource.supplementary_data as {
    related_ids?: { order_id?: string; capture_id?: string };
  } | undefined)?.related_ids;
  const paypalOrderId =
    relatedIds?.order_id ?? (eventType.startsWith('CHECKOUT.ORDER') ? (resource.id as string | undefined) : undefined);
  const captureId = eventType.startsWith('PAYMENT.CAPTURE') ? (resource.id as string | undefined) : undefined;
  const relatedCaptureId = relatedPayPalCaptureId(eventType, resource);

  const service = createServiceClient();

  // Resolve the internal order id (custom_id is our reference; fall back to the
  // PayPal order id we stored on create).
  let internalOrderId: string | null = uuidLike(customId) ? customId : null;
  if (!internalOrderId && paypalOrderId) {
    const { data, error } = await service.from('orders').select('id').eq('paypal_order_id', paypalOrderId).maybeSingle();
    if (error) {
      console.error('PayPal webhook order-id resolution error:', error);
      return NextResponse.json({ error: 'Could not resolve event order.' }, { status: 500 });
    }
    internalOrderId = data?.id ?? null;
  }

  if (!internalOrderId && relatedCaptureId) {
    const { data, error } = await service
      .from('orders')
      .select('id')
      .eq('paypal_capture_id', relatedCaptureId)
      .maybeSingle();
    if (error) {
      console.error('PayPal webhook capture-id resolution error:', error);
      return NextResponse.json({ error: 'Could not resolve event capture.' }, { status: 500 });
    }
    internalOrderId = data?.id ?? null;
  }

  let claim: WebhookClaim;
  try {
    claim = await claimWebhookEvent(service, event, internalOrderId);
  } catch (err) {
    console.error('PayPal webhook claim error:', err);
    return NextResponse.json({ error: 'Could not record event.' }, { status: 500 });
  }
  if (claim === 'processed') return NextResponse.json({ success: true, duplicate: true });
  if (claim === 'busy') return NextResponse.json({ error: 'Event is already being processed.' }, { status: 503 });

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
      const { data: orderRow, error: orderLookupError } = await service
        .from('orders')
        .select('order_number, total, payment_status, paypal_capture_id')
        .eq('id', internalOrderId)
        .maybeSingle();
      if (orderLookupError || !orderRow) {
        throw orderLookupError ?? new Error('Captured payment has no matching order.');
      }

      const capturedAmount = amount?.value != null ? Number(amount.value) : NaN;
      const expectedTotal = Number(orderRow.total);
      const amountOk =
        Number.isFinite(capturedAmount) &&
        Number.isFinite(expectedTotal) &&
        Math.abs(capturedAmount - expectedTotal) <= 0.01;
      const currencyOk = amount?.currency_code === 'USD';
      const capturedState = orderRow.payment_status === 'paid'
        || orderRow.payment_status === 'partially_refunded'
        || orderRow.payment_status === 'refunded';

      if (!capturedState && (!amountOk || !currencyOk)) {
        const { data: mismatchOrder, error: mismatchError } = await service
          .from('orders')
          .update({
            payment_status: 'pending',
            payment_reference: captureId,
            paypal_capture_id: captureId,
            payment_response: event as object,
            internal_notes:
              `PayPal webhook amount/currency mismatch — captured ${amount?.value} ${amount?.currency_code}, ` +
              `expected ${expectedTotal} USD. Manual review required.`,
          })
          .eq('id', internalOrderId)
          .select('id')
          .maybeSingle();
        if (mismatchError || !mismatchOrder) {
          throw mismatchError ?? new Error('Captured-payment mismatch row was not updated.');
        }
        await service.from('admin_notifications').insert({
          type: 'order',
          title: `PayPal amount mismatch on ${orderRow.order_number ?? internalOrderId}`,
          body: `Webhook capture ${captureId}: captured ${amount?.value} ${amount?.currency_code}, expected ${expectedTotal} USD. Review before fulfilling.`,
          order_id: internalOrderId,
        });
      } else {
        const { data: captureOrder, error: captureRecordError } = await service
          .from('orders')
          .update({
            payment_status: capturedState ? orderRow.payment_status : 'pending',
            payment_reference: captureId,
            paypal_capture_id: captureId,
            payment_response: event as object,
          })
          .eq('id', internalOrderId)
          .select('id')
          .maybeSingle();
        if (captureRecordError || !captureOrder) {
          throw captureRecordError ?? new Error('Captured-payment evidence row was not updated.');
        }

        const { data: capData, error: capError } = await service.rpc('capture_paypal_order', {
          p_order_id: internalOrderId,
          p_capture_id: captureId,
          p_payment_response: event as object,
        });
        if (capError) throw capError;
        const capResult = Array.isArray(capData) ? capData[0] : capData;
        if (capResult?.item_conflict) {
          // Losing capture of a one-of-one race — alert an admin for the refund.
          await notifyItemConflict(service, {
            id: internalOrderId,
            orderNumber: (capResult?.order_number as string | undefined) ?? internalOrderId,
            captureId,
          });
        } else {
          // Safe to repeat: invoice creation is an upsert and automatic receipt
          // delivery is de-duplicated by finalizePaidOrder.
          const finalized = await finalizePaidOrder(service, internalOrderId);
          if (!finalized) throw new Error('Paid-order invoice or receipt finalization is incomplete.');
          if (!capResult?.already_paid) {
            // Phase 2 auto-delist. Backstop for a capture the browser never
            // confirmed — same sold flip, so Deep Field needs it from here too.
            // Scheduled with after() rather than floated; see
            // lib/product-status-hooks.ts for what floating cost us.
            const { data: capturedItems } = await service.from('order_items').select('product_id').eq('order_id', internalOrderId);
            const capturedProductIds = (capturedItems ?? []).map((item) => item.product_id).filter((id): id is string => Boolean(id));
            scheduleProductStatusHooks(capturedProductIds);
          }
        }
      }
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.DECLINED') {
      const { error: deniedError } = await service.rpc('apply_paypal_order_event', {
        p_order_id: internalOrderId,
        p_event: 'denied',
        p_payment_response: event as object,
      });
      if (deniedError) throw deniedError;
    } else if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      const cumulativeRefund = payPalCumulativeRefund(resource);
      const captureStatus = String(resource.status ?? '').toUpperCase();
      const { data: refundOrder, error: refundOrderError } = await service
        .from('orders')
        .select('total, refund_amount')
        .eq('id', internalOrderId)
        .maybeSingle();
      if (refundOrderError || !refundOrder) {
        throw refundOrderError ?? new Error('Refunded capture has no matching order.');
      }

      const alreadyRefunded = Number(refundOrder.refund_amount ?? 0);
      if (!cumulativeRefund && captureStatus !== 'REFUNDED') {
        throw new Error('Partial PayPal refund event is missing its cumulative refunded amount.');
      }

      // THIS refund's own amount, read straight from the payload rather than
      // derived as `cumulative - alreadyRefunded`. The derived figure is only
      // correct when every earlier refund was already recorded, and PayPal does
      // not guarantee webhook ORDER — so deriving it is what let a $0.50 refund
      // get logged as $0.56. See DECISIONS, "paypal_refunds.amount is this
      // refund's own amount".
      const ownAmountRaw = Number((resource.amount as { value?: unknown } | undefined)?.value);
      const ownAmount = Number.isFinite(ownAmountRaw) && ownAmountRaw > 0
        ? Math.round(ownAmountRaw * 100) / 100
        // Fall back to the increment only if PayPal omitted the amount, which
        // has not been observed on a real event.
        : cumulativeRefund
          ? Math.max(0, Math.round((cumulativeRefund.amount - alreadyRefunded) * 100) / 100)
          : null;

      if (ownAmount == null || ownAmount > 0) {
        // `resource.id` on a refund event IS the PayPal refund id — the same id
        // the admin refund route stores. Keying the ledger by it means a
        // redelivered webhook lands on the SAME row (idempotent by
        // construction) and an admin-initiated PENDING row is completed in
        // place. That replaces the old `event:<id>` key plus fuzzy
        // amount-matching against pending rows, which could attach to the wrong
        // refund on a second partial because the two sides compared different
        // quantities.
        const refundLedgerId = String(resource.id ?? '').trim() || `event:${eventId}`;

        const { error: refundError } = await service.rpc('apply_paypal_refund', {
          p_order_id: internalOrderId,
          p_refund_id: refundLedgerId,
          p_capture_id: relatedCaptureId,
          p_amount: ownAmount,
          p_currency: cumulativeRefund?.currency ?? 'USD',
          p_status: 'COMPLETED',
          p_request_key: null,
          p_payload: event as object,
          // Authoritative running total. The RPC SETS the order's refund_amount
          // from this rather than accumulating, so a missed or out-of-order
          // event self-corrects on the next one.
          p_cumulative_refunded: cumulativeRefund?.amount ?? null,
        });
        if (refundError) {
          // Compatibility while the hardening migration is being deployed. Admin
          // refunds are blocked before calling PayPal until this RPC exists.
          if (refundError.code !== '42883' && !/apply_paypal_refund/i.test(refundError.message ?? '')) {
            throw refundError;
          }
          const { error: legacyRefundError } = await service.rpc('apply_paypal_order_event', {
            p_order_id: internalOrderId,
            p_event: 'refunded',
            p_payment_response: cumulativeRefund
              ? {
                  ...event,
                  resource: {
                    ...resource,
                    amount: {
                      value: ownAmount?.toFixed(2),
                      currency_code: cumulativeRefund.currency,
                    },
                  },
                }
              : event as object,
          });
          if (legacyRefundError) throw legacyRefundError;
        }
      }
    } else if (eventType === 'PAYMENT.REFUND.PENDING' || eventType === 'PAYMENT.REFUND.FAILED') {
      const amount = resource.amount as { value?: string; currency_code?: string } | undefined;
      const refundAmount = Number(amount?.value);
      const { error: refundStateError } = await service.rpc('apply_paypal_refund', {
        p_order_id: internalOrderId,
        p_refund_id: String(resource.id ?? `event:${eventId}`),
        p_capture_id: relatedCaptureId,
        p_amount: Number.isFinite(refundAmount) ? refundAmount : null,
        p_currency: amount?.currency_code ?? 'USD',
        p_status: eventType === 'PAYMENT.REFUND.FAILED' ? 'FAILED' : 'PENDING',
        p_request_key: null,
        p_payload: event as object,
      });
      if (refundStateError) throw refundStateError;

      if (eventType === 'PAYMENT.REFUND.FAILED') {
        const { error: notificationError } = await service.from('admin_notifications').insert({
          type: 'order',
          title: 'PayPal refund failed',
          body: `PayPal refund ${String(resource.id ?? eventId)} failed and needs review.`,
          order_id: internalOrderId,
        });
        if (notificationError) console.error('PayPal refund failure notification error:', notificationError);
      }
    } else if (eventType === 'PAYMENT.CAPTURE.REVERSED') {
      const { error: reversalError } = await service.rpc('apply_paypal_order_event', {
        p_order_id: internalOrderId,
        p_event: 'refunded',
        p_payment_response: event as object,
      });
      if (reversalError) throw reversalError;
    } else if (eventType.startsWith('CUSTOMER.DISPUTE')) {
      const { error: disputeError } = await service.rpc('apply_paypal_order_event', {
        p_order_id: internalOrderId,
        p_event: 'dispute',
        p_payment_response: event as object,
      });
      if (disputeError) throw disputeError;
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

  const { data: processedEvent, error: processedError } = await service
    .from('webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('provider', 'paypal')
    .eq('event_id', eventId)
    .select('id')
    .maybeSingle();
  if (processedError || !processedEvent) {
    console.error('PayPal webhook completion update failed:', processedError);
    return NextResponse.json({ error: 'Could not finalize event record.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
