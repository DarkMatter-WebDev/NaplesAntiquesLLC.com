// Guest order lookup — the pure half (owner ask, 2026-09-17).
//
// Most buyers never create an account, yet every order email pointed them at
// /account. `/order-lookup` lets anyone open their order with the ORDER NUMBER
// plus the email or phone that is on the order. Two facts, not one: order
// numbers travel in subject lines and receipts, and an order page shows a
// name, a home address and what was bought — one guessable token must not be
// enough to read that. The route also rate-limits by IP and by order number.
//
// `toPublicOrderView` is the only thing the route returns: no internal notes,
// no payment references, no cost data, no user id.
import { describeShippingService } from '@/lib/shipping-service';
import { normalizeUsPhone } from '@/lib/subscriber-phone';
import { formatOrderAddress, type Order, type OrderItem } from '@/types/sales';

const ORDER_NUMBER_RE = /^NEJ-\d{8}-[A-Z0-9]{5}$/;

/** "nej 20260917 zizci" / " NEJ-20260917-ZIZCI " → "NEJ-20260917-ZIZCI"; anything else → null. */
export function normalizeOrderNumber(raw: unknown): string | null {
  const text = String(raw ?? '').trim().toUpperCase().replace(/[\s_]+/g, '-');
  const compact = text.replace(/-+/g, '-');
  // Allow the dashes to be missing entirely ("NEJ20260917ZIZCI").
  const bare = compact.replace(/-/g, '');
  const m = /^NEJ(\d{8})([A-Z0-9]{5})$/.exec(bare);
  if (!m) return null;
  const candidate = `NEJ-${m[1]}-${m[2]}`;
  return ORDER_NUMBER_RE.test(candidate) ? candidate : null;
}

/** The email or phone typed by the customer matches what is on the order. */
export function contactMatches(
  order: Pick<Order, 'customer_email' | 'customer_phone'>,
  contact: unknown,
): boolean {
  const text = String(contact ?? '').trim();
  if (!text) return false;
  const email = (order.customer_email ?? '').trim().toLowerCase();
  if (email && text.toLowerCase() === email) return true;
  const typedPhone = normalizeUsPhone(text);
  const orderPhone = normalizeUsPhone(order.customer_phone);
  return Boolean(typedPhone && orderPhone && typedPhone === orderPhone);
}

export function trackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  const number = String(trackingNumber ?? '').trim();
  if (!number) return null;
  const c = String(carrier ?? '').toLowerCase();
  const n = encodeURIComponent(number);
  if (c.includes('usps')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${n}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  if (c.includes('dhl')) return `https://www.dhl.com/en/express/tracking.html?AWB=${n}`;
  return null;
}

export type PublicOrderItem = {
  title: string;
  quantity: number;
  unitPrice: number;
  image: string | null;
  inventory: string | null;
  metal: string | null;
  purity: string | null;
  grams: number | null;
};

export type PublicOrderView = {
  orderNumber: string;
  placedAt: string;
  firstName: string | null;
  paymentStatus: string;
  fulfillmentStatus: string;
  orderStatus: string;
  /** 'pickup' | 'local_delivery' | 'express' | 'priority' | 'registered' | 'unknown' */
  deliveryKind: string;
  items: PublicOrderItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
  shippingAddress: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  customerNotes: string | null;
};

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

/** Everything a customer may see about their own order — and nothing else. */
export function toPublicOrderView(order: Order & { order_items?: OrderItem[] | null; created_at: string }): PublicOrderView {
  const service = describeShippingService(order);
  return {
    orderNumber: order.order_number,
    placedAt: order.created_at,
    firstName: (order.customer_name ?? '').trim().split(/\s+/)[0] || null,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    orderStatus: order.order_status,
    deliveryKind: service.kind,
    items: (order.order_items ?? []).map((item) => ({
      title: item.title_snapshot,
      quantity: Math.max(1, Math.floor(Number(item.quantity ?? 1))),
      unitPrice: money(item.price_snapshot),
      image: item.image_snapshot ?? null,
      inventory: item.inventory_number ?? null,
      metal: item.metal_snapshot ?? null,
      purity: item.purity_snapshot ?? null,
      grams: item.gram_weight_snapshot ?? null,
    })),
    subtotal: money(order.subtotal),
    discount: money(order.discount),
    shippingFee: money(order.shipping_fee),
    tax: money(order.tax),
    total: money(order.total),
    shippingAddress: order.shipping_method === 'pickup' ? null : formatOrderAddress(order.shipping_address),
    carrier: order.shipping_carrier?.trim() || null,
    trackingNumber: order.tracking_number?.trim() || null,
    trackingUrl: trackingUrl(order.shipping_carrier, order.tracking_number),
    customerNotes: order.customer_notes?.trim() || null,
  };
}
