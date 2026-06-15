import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/types/product';
import { isProductPurchasable } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { formatCurrency } from '@/types/sales';
import { buildAddressObject, generateOrderNumber, getProductImages, getProductMetal, getProductWeight, getSnapshotPrice } from '@/lib/sales';

const FL_TAX_RATE = 0.07;
const SHIPPING_FEES: Record<string, number> = {
  'local-pickup': 0,
  'express-overnight-insured': 75,
  'priority-insured': 45,
};

function shippingMethodForDb(value: string) {
  if (value === 'local-pickup') return 'pickup';
  return 'shipping';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const productIds = Array.isArray(body.productIds)
    ? Array.from(new Set(body.productIds.map(String).filter(Boolean)))
    : [];
  const customer = body.customer ?? {};
  const shippingMethod = String(body.shippingMethod ?? 'local-pickup');

  if (productIds.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }
  if (!customer.name || !customer.email || !customer.phone) {
    return NextResponse.json({ error: 'Name, email, and phone are required' }, { status: 400 });
  }

  const supabase = await createClient();
  const [{ data: { user } }, { data: products, error: productsError }, spotData] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('products').select('*').in('id', productIds),
    fetchSpotData(),
  ]);

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 });
  }

  const typedProducts = (products ?? []) as Product[];
  if (typedProducts.length !== productIds.length) {
    return NextResponse.json({ error: 'One or more cart items could not be found' }, { status: 400 });
  }

  const unavailable = typedProducts.filter((product) => !isProductPurchasable(product.status));
  if (unavailable.length > 0) {
    return NextResponse.json({
      error: `Unavailable item: ${unavailable.map((product) => product.title).join(', ')}`,
    }, { status: 409 });
  }

  const items = typedProducts.map((product) => ({
    product_id: product.id,
    inventory_number: product.inventory_number != null ? String(product.inventory_number) : product.sku ?? product.id,
    title_snapshot: product.title,
    metal_snapshot: getProductMetal(product),
    purity_snapshot: product.purity ? String(product.purity) : null,
    gram_weight_snapshot: getProductWeight(product),
    price_snapshot: getSnapshotPrice(product, spotData),
    image_snapshot: getProductImages(product)[0] ?? null,
  }));

  const subtotal = items.reduce((sum, item) => sum + item.price_snapshot, 0);
  const shippingFee = SHIPPING_FEES[shippingMethod] ?? 0;
  const tax = subtotal * FL_TAX_RATE;
  const total = subtotal + tax + shippingFee;
  const orderNumber = generateOrderNumber();

  const orderPayload = {
    order_number: orderNumber,
    user_id: user?.id ?? null,
    customer_name: String(customer.name).trim(),
    customer_email: String(customer.email).trim(),
    customer_phone: String(customer.phone).trim(),
    subtotal,
    tax,
    shipping_fee: shippingFee,
    discount: 0,
    total,
    payment_status: 'unpaid',
    fulfillment_status: 'pending',
    order_status: 'open',
    payment_method: 'manual_checkout',
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
    internal_notes: 'Created from public checkout. Admin follow-up required.',
    customer_notes: customer.notes ? String(customer.notes).trim() : null,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc('create_checkout_order', {
    order_payload: orderPayload,
    items_payload: items,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const createdOrderId = result?.order_id as string | undefined;
  const createdOrderNumber = (result?.order_number as string | undefined) ?? orderNumber;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);
      const notifyEmail = process.env.ORDER_NOTIFY_EMAIL || 'rcman12589@gmail.com';
      const itemRows = items.map((item) =>
        `<li><strong>${escapeHtml(item.title_snapshot)}</strong> (${escapeHtml(item.inventory_number ?? 'No inv #')}) - ${formatCurrency(item.price_snapshot)}</li>`
      ).join('');

      await resend.emails.send({
        from: 'Naples Estate Jewelry <noreply@naplesestatejewelry.co>',
        to: notifyEmail,
        subject: `New checkout order ${createdOrderNumber}`,
        html: `
          <h2>New checkout order ${escapeHtml(createdOrderNumber)}</h2>
          <p><strong>Customer:</strong> ${escapeHtml(orderPayload.customer_name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(orderPayload.customer_email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(orderPayload.customer_phone)}</p>
          <ul>${itemRows}</ul>
          <p><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
          <p><strong>Tax:</strong> ${formatCurrency(tax)}</p>
          <p><strong>Shipping:</strong> ${formatCurrency(shippingFee)}</p>
          <p><strong>Total:</strong> ${formatCurrency(total)}</p>
          ${createdOrderId ? `<p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://naplesestatejewelry.co'}/admin/orders/${createdOrderId}">Open order in admin</a></p>` : ''}
        `,
      });
    } catch (emailError) {
      console.error('Checkout order email error:', emailError);
    }
  }

  return NextResponse.json({
    success: true,
    orderId: createdOrderId,
    orderNumber: createdOrderNumber,
    total,
  });
}
