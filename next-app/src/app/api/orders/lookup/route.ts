import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { contactMatches, normalizeOrderNumber, toPublicOrderView } from '@/lib/order-lookup';
import type { Order, OrderItem } from '@/types/sales';

/**
 * POST { orderNumber, contact } → the customer's own order, or one generic
 * "not found" (never "right number, wrong email" — that would confirm the
 * number exists). Guest-safe: no sign-in, no account. Two rate limits so a
 * list of order numbers cannot be walked: per IP and per order number.
 */
export const runtime = 'nodejs';

const NOT_FOUND = { error: 'We could not find an order with that number and email or phone. Check the receipt email and try again.' };

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`order-lookup:${ip}`, 20, 3600))) {
    return NextResponse.json({ error: 'Too many lookups. Please try again in an hour, or call (239) 404-8505.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const orderNumber = normalizeOrderNumber(body?.orderNumber);
  const contact = String(body?.contact ?? '').trim();
  if (!orderNumber) {
    return NextResponse.json({ error: 'Enter the order number from your receipt, e.g. NEJ-20260917-ABCDE.' }, { status: 400 });
  }
  if (!contact) {
    return NextResponse.json({ error: 'Enter the email address or phone number you used on the order.' }, { status: 400 });
  }
  if (!(await checkRateLimit(`order-lookup:${orderNumber}`, 10, 3600))) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_number', orderNumber)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    console.error('order lookup error:', error.message);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
  const order = data as (Order & { order_items?: OrderItem[] | null; created_at: string }) | null;
  if (!order || !contactMatches(order, contact)) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  return NextResponse.json({ order: toPublicOrderView(order) }, { headers: { 'Cache-Control': 'no-store' } });
}
