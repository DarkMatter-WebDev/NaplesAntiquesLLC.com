import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyPayPalWebhook } from '@/lib/paypal';

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
      await service.rpc('capture_paypal_order', {
        p_order_id: internalOrderId,
        p_capture_id: captureId,
        p_payment_response: event as object,
      });
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
  if (eventType.startsWith('PAYMENT.CAPTURE')) {
    revalidateTag('shop-catalog', 'max');
  }

  await service
    .from('webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('provider', 'paypal')
    .eq('event_id', eventId);

  return NextResponse.json({ success: true });
}
