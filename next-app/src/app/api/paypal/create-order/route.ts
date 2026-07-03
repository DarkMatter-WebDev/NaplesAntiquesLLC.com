import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { buildAddressObject, generateOrderNumber } from '@/lib/sales';
import { buildOrderDraft, isOrderDraftError, shippingMethodForDb } from '@/lib/checkout-pricing';
import { createPayPalOrder, paypalConfigured, type PayPalLineItem } from '@/lib/paypal';

export const runtime = 'nodejs';

const CURRENCY = 'USD';

function lineItems(items: { title_snapshot: string; price_snapshot: number; inventory_number: string }[]): PayPalLineItem[] {
  return items.map((item) => ({
    name: item.title_snapshot,
    quantity: '1',
    unitAmount: item.price_snapshot,
    sku: item.inventory_number,
  }));
}

export async function POST(req: Request) {
  if (!paypalConfigured()) {
    return NextResponse.json({ error: 'PayPal is not configured.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const reuseOrderId = typeof body.orderId === 'string' && body.orderId ? body.orderId : null;
  const productIds = Array.isArray(body.productIds)
    ? (Array.from(new Set(body.productIds.map(String).filter(Boolean))) as string[])
    : [];
  const customer = body.customer ?? {};
  const shippingMethod = String(body.shippingMethod ?? 'local-pickup');

  const supabase = await createClient();
  const service = createServiceClient();

  // ---- Retry path: reuse an existing unpaid order, re-create its PayPal order.
  // Only reuse when the stored order still matches what the buyer is paying for
  // NOW — same product set and same recomputed totals. The buyer may have edited
  // the cart or switched shipping method after cancelling the PayPal window;
  // reusing the old rows then would charge the wrong amount. On any mismatch the
  // stale order is cancelled and we fall through to the new-order path below.
  if (reuseOrderId) {
    const { data: order, error } = await service
      .from('orders')
      .select('id, order_number, total, subtotal, tax, shipping_fee, payment_status, paypal_capture_id')
      .eq('id', reuseOrderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.payment_status === 'paid' || order.paypal_capture_id) {
      return NextResponse.json({ error: 'This order has already been paid.' }, { status: 409 });
    }

    const { data: orderItems } = await service
      .from('order_items')
      .select('product_id, title_snapshot, price_snapshot, inventory_number')
      .eq('order_id', reuseOrderId);

    const storedProductIds = new Set((orderItems ?? []).map((item) => String(item.product_id)));
    const sameProducts =
      productIds.length > 0 &&
      productIds.length === storedProductIds.size &&
      productIds.every((id) => storedProductIds.has(id));

    let sameTotals = false;
    if (sameProducts) {
      // Recompute totals from the live cart payload; catches shipping-method
      // switches (express vs priority both store as 'shipping') and price drift.
      const draft = await buildOrderDraft(supabase, productIds, shippingMethod);
      sameTotals =
        !isOrderDraftError(draft) &&
        draft.subtotal === Number(order.subtotal) &&
        draft.shippingFee === Number(order.shipping_fee) &&
        draft.total === Number(order.total);
    }

    if (sameProducts && sameTotals) {
      const items = (orderItems ?? []).map((item) => ({
        title_snapshot: item.title_snapshot,
        price_snapshot: Number(item.price_snapshot),
        inventory_number: item.inventory_number ?? '',
      }));

      try {
        const paypalOrder = await createPayPalOrder({
          currency: CURRENCY,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          shipping: Number(order.shipping_fee),
          total: Number(order.total),
          items: lineItems(items),
          referenceId: order.id,
        });
        await service.from('orders').update({ paypal_order_id: paypalOrder.id }).eq('id', order.id);
        return NextResponse.json({ paypalOrderId: paypalOrder.id, orderId: order.id });
      } catch (err) {
        console.error('PayPal create-order (reuse) error:', err);
        return NextResponse.json({ error: 'Could not start PayPal checkout.' }, { status: 502 });
      }
    }

    // Stale order — cancel it and create a fresh one from the current payload.
    await service.from('orders').update({ order_status: 'cancelled' }).eq('id', order.id);
  }

  // ---- New order path.
  if (!customer.name || !customer.email || !customer.phone) {
    return NextResponse.json({ error: 'Name, email, and phone are required' }, { status: 400 });
  }

  const needsShipping = shippingMethod !== 'local-pickup';
  if (needsShipping && (
    !String(customer.address_line1 ?? '').trim() ||
    !String(customer.city ?? '').trim() ||
    !String(customer.state ?? '').trim() ||
    !String(customer.postal_code ?? '').trim()
  )) {
    return NextResponse.json(
      { error: 'A complete shipping address (street, city, state, and ZIP) is required for the selected delivery method.' },
      { status: 400 },
    );
  }

  const draft = await buildOrderDraft(supabase, productIds, shippingMethod);
  if (isOrderDraftError(draft)) {
    return NextResponse.json({ error: draft.error }, { status: draft.status });
  }
  if (draft.total <= 0) {
    return NextResponse.json({ error: 'Order total must be greater than zero.' }, { status: 400 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  const orderNumber = generateOrderNumber();
  const orderPayload = {
    order_number: orderNumber,
    user_id: user?.id ?? null,
    customer_name: String(customer.name).trim(),
    customer_email: String(customer.email).trim(),
    customer_phone: String(customer.phone).trim(),
    subtotal: draft.subtotal,
    tax: draft.tax,
    shipping_fee: draft.shippingFee,
    discount: 0,
    total: draft.total,
    payment_method: 'paypal',
    shipping_method: shippingMethodForDb(shippingMethod),
    shipping_address: buildAddressObject({
      line1: customer.address_line1,
      line2: customer.address_line2,
      city: customer.city,
      state: customer.state,
      postalCode: customer.postal_code,
      country: customer.country,
    }),
    billing_address: null,
    internal_notes: null,
    customer_notes: customer.notes ? String(customer.notes).trim() : null,
  };

  // Every item must carry a product_id or the capture RPC will silently update 0 rows.
  if (draft.items.some((item) => !item.product_id)) {
    return NextResponse.json({ error: 'Cart item is missing a product reference. Please refresh and try again.' }, { status: 500 });
  }

  // Create order + order_items without reserving products. Items remain 'available'
  // so concurrent buyers can proceed; the capture RPC resolves any race atomically.
  const { data: rpcData, error: rpcError } = await service.rpc('create_paypal_order', {
    order_payload: orderPayload,
    items_payload: draft.items,
  });

  if (rpcError) {
    console.error('create_paypal_order RPC error:', rpcError);
    const message = rpcError.message ?? 'Could not create order.';
    const status = /no longer available|not available/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const orderId = result?.order_id as string | undefined;
  if (!orderId) {
    return NextResponse.json({ error: 'Could not create order.' }, { status: 500 });
  }

  try {
    const paypalOrder = await createPayPalOrder({
      currency: CURRENCY,
      subtotal: draft.subtotal,
      tax: draft.tax,
      shipping: draft.shippingFee,
      total: draft.total,
      items: lineItems(draft.items),
      referenceId: orderId,
    });

    await service.from('orders').update({ paypal_order_id: paypalOrder.id }).eq('id', orderId);

    return NextResponse.json({ paypalOrderId: paypalOrder.id, orderId });
  } catch (err) {
    console.error('PayPal create-order error:', err);
    // Cancel the order record so it does not appear as an open, orderless entry.
    await service
      .from('orders')
      .update({ order_status: 'cancelled' })
      .eq('id', orderId);
    return NextResponse.json({ error: 'Could not start PayPal checkout.' }, { status: 502 });
  }
}
