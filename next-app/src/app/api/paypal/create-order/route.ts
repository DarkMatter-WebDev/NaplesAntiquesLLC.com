import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { buildAddressObject, generateOrderNumber } from '@/lib/sales';
import { buildOrderDraft, isOrderDraftError, shippingMethodForDb } from '@/lib/checkout-pricing';
import { createPayPalOrder, paypalConfigured, type PayPalLineItem } from '@/lib/paypal';

export const runtime = 'nodejs';

const CURRENCY = 'USD';
const RESERVE_MINUTES = 30;

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

    const items = (orderItems ?? []).map((item) => ({
      title_snapshot: item.title_snapshot,
      price_snapshot: Number(item.price_snapshot),
      inventory_number: item.inventory_number ?? '',
    }));

    // Re-assert the hold on this order's products (same buyer/order only).
    const reuseProductIds = (orderItems ?? [])
      .map((item) => item.product_id)
      .filter((id): id is string => Boolean(id));
    const holdUntil = new Date(Date.now() + RESERVE_MINUTES * 60_000).toISOString();
    if (reuseProductIds.length > 0) {
      const { data: products } = await service
        .from('products')
        .select('id, status, reserved_order_id, title')
        .in('id', reuseProductIds);
      const blocked = (products ?? []).filter((p) => {
        const normalized = String(p.status ?? '').toLowerCase().replace(/\s+/g, '_');
        const heldByThisOrder = p.reserved_order_id === reuseOrderId;
        return normalized !== 'available' && !heldByThisOrder;
      });
      if (blocked.length > 0) {
        return NextResponse.json(
          { error: `Unavailable item: ${blocked.map((p) => p.title).join(', ')}` },
          { status: 409 },
        );
      }
      await service
        .from('products')
        .update({ status: 'reserved', reserved_until: holdUntil, reserved_order_id: reuseOrderId })
        .in('id', reuseProductIds);
      await service.from('orders').update({ reserved_until: holdUntil }).eq('id', reuseOrderId);
    }

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
      revalidateTag('shop-catalog', 'max'); // reserved items drop out of the shop gallery now
      return NextResponse.json({ paypalOrderId: paypalOrder.id, orderId: order.id });
    } catch (err) {
      console.error('PayPal create-order (reuse) error:', err);
      return NextResponse.json({ error: 'Could not start PayPal checkout.' }, { status: 502 });
    }
  }

  // ---- New order path.
  if (!customer.name || !customer.email || !customer.phone) {
    return NextResponse.json({ error: 'Name, email, and phone are required' }, { status: 400 });
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
    internal_notes: 'PayPal checkout — awaiting payment capture.',
    customer_notes: customer.notes ? String(customer.notes).trim() : null,
  };

  // Every item must carry a product_id or the capture RPC will silently update 0 rows.
  if (draft.items.some((item) => !item.product_id)) {
    return NextResponse.json({ error: 'Cart item is missing a product reference. Please refresh and try again.' }, { status: 500 });
  }

  // Atomic reserve + order creation (row-locks the products against concurrent buyers).
  const { data: rpcData, error: rpcError } = await supabase.rpc('reserve_paypal_order', {
    order_payload: orderPayload,
    items_payload: draft.items,
    reserve_minutes: RESERVE_MINUTES,
  });

  if (rpcError) {
    // The reserve RPC raises a clear message when an item is no longer available.
    const message = rpcError.message ?? 'Could not reserve items.';
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

    revalidateTag('shop-catalog', 'max'); // reserved items drop out of the shop gallery now
    return NextResponse.json({ paypalOrderId: paypalOrder.id, orderId });
  } catch (err) {
    console.error('PayPal create-order error:', err);
    // Release the hold we just took so the items return to the shop immediately.
    await service
      .from('products')
      .update({ status: 'available', reserved_until: null, reserved_order_id: null })
      .eq('reserved_order_id', orderId);
    await service
      .from('orders')
      .update({ order_status: 'cancelled', reserved_until: null })
      .eq('id', orderId);
    revalidateTag('shop-catalog', 'max'); // released items return to the gallery
    return NextResponse.json({ error: 'Could not start PayPal checkout.' }, { status: 502 });
  }
}
