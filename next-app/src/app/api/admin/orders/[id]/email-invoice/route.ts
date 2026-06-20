import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Order, OrderItem } from '@/types/sales';
import { buildInvoiceEmailContent, withInvoiceLineDiscounts } from '@/lib/order-invoice-email';

interface Props {
  params: Promise<{ id: string }>;
}

const ORDER_INVOICE_COLUMNS = [
  'id',
  'order_number',
  'user_id',
  'customer_name',
  'customer_email',
  'customer_phone',
  'subtotal',
  'tax',
  'shipping_fee',
  'discount',
  'total',
  'payment_status',
  'fulfillment_status',
  'order_status',
  'payment_method',
  'payment_reference',
  'shipping_method',
  'shipping_address',
  'billing_address',
  'internal_notes',
  'customer_notes',
  'created_at',
  'updated_at',
  'order_items(id, order_id, product_id, inventory_number, title_snapshot, item_year_snapshot, metal_snapshot, purity_snapshot, gram_weight_snapshot, price_snapshot, discount, image_snapshot, created_at)',
].join(', ');
const ORDER_INVOICE_COLUMNS_WITHOUT_ITEM_YEAR_SNAPSHOT = ORDER_INVOICE_COLUMNS.replace('item_year_snapshot, ', '');

function isMissingItemYearColumnError(error: { message?: string | null } | null | undefined) {
  return Boolean(error?.message?.toLowerCase().includes('item_year'));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request, { params }: Props) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const recipient = String(body?.recipient ?? '').trim();
  const rawItemDiscounts = body?.itemDiscounts && typeof body.itemDiscounts === 'object'
    ? body.itemDiscounts as Record<string, unknown>
    : {};
  const itemDiscounts = Object.fromEntries(
    Object.entries(rawItemDiscounts).map(([itemId, value]) => [itemId, Number(value) || 0]),
  );

  if (!recipient || !isValidEmail(recipient)) {
    return NextResponse.json({ error: 'A valid recipient email is required.' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'Email sending is not configured. Missing RESEND_API_KEY.' }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const [orderResult, { data: invoices }] = await Promise.all([
    supabase
      .from('orders')
      .select(ORDER_INVOICE_COLUMNS)
      .eq('id', id)
      .single(),
    supabase
      .from('invoices')
      .select('invoice_number')
      .eq('order_id', id)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  let order = orderResult.data;
  let orderError = orderResult.error;
  if (isMissingItemYearColumnError(orderError)) {
    const fallback = await supabase
      .from('orders')
      .select(ORDER_INVOICE_COLUMNS_WITHOUT_ITEM_YEAR_SNAPSHOT)
      .eq('id', id)
      .single();
    order = fallback.data;
    orderError = fallback.error;
  }

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? 'Order not found.' }, { status: 404 });
  }

  const invoiceNumber = invoices?.[0]?.invoice_number ?? null;
  const emailOrder = withInvoiceLineDiscounts(order as unknown as Order & { order_items: OrderItem[] }, itemDiscounts);
  const content = buildInvoiceEmailContent(emailOrder, invoiceNumber);

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: 'Naples Estate Jewelry <noreply@naplesestatejewelry.co>',
      to: recipient,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  } catch (error) {
    console.error('Invoice email error:', error);
    return NextResponse.json({ error: 'Could not send invoice email.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
