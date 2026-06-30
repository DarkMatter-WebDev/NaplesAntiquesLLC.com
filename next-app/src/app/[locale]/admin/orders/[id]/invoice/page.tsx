import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { buildInvoiceEmailContent } from '@/lib/order-invoice-email';
import type { Order, OrderItem } from '@/types/sales';
import PrintInvoiceClient from './PrintInvoiceClient';

export const metadata: Metadata = { title: 'Print Invoice' };

const INVOICE_COLUMNS = [
  'id',
  'order_number',
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
  'shipping_method',
  'shipping_address',
  'created_at',
  'order_items(id, order_id, inventory_number, title_snapshot, item_year_snapshot, metal_snapshot, purity_snapshot, gram_weight_snapshot, price_snapshot, discount, image_snapshot)',
].join(', ');

const INVOICE_COLUMNS_WITHOUT_ITEM_YEAR = INVOICE_COLUMNS.replace('item_year_snapshot, ', '');

function isMissingItemYearColumnError(error: { message?: string | null } | null | undefined) {
  return Boolean(error?.message?.toLowerCase().includes('item_year'));
}

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AdminOrderInvoicePrintPage({ params }: Props) {
  const { locale, id } = await params;
  const isEs = locale === 'es';
  const adminBasePath = isEs ? '/es/admin' : '/admin';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(isEs ? '/es/account/sign-in' : '/account/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect(isEs ? '/es/account' : '/account');
  }

  const [orderResult, { data: invoices }] = await Promise.all([
    supabase.from('orders').select(INVOICE_COLUMNS).eq('id', id).single(),
    supabase
      .from('invoices')
      .select('invoice_number')
      .eq('order_id', id)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  let order = orderResult.data;
  if (isMissingItemYearColumnError(orderResult.error)) {
    const fallback = await supabase
      .from('orders')
      .select(INVOICE_COLUMNS_WITHOUT_ITEM_YEAR)
      .eq('id', id)
      .single();
    order = fallback.data;
  }

  if (!order) notFound();

  const typedOrder = order as unknown as Order & { order_items: OrderItem[] };
  const latestInvoiceNumber = invoices?.[0]?.invoice_number ?? null;
  const invoiceContent = buildInvoiceEmailContent(typedOrder, latestInvoiceNumber);

  return (
    <PrintInvoiceClient
      invoiceHtml={invoiceContent.html}
      invoiceNumber={invoiceContent.invoiceNumber}
      orderNumber={typedOrder.order_number}
      backHref={`${adminBasePath}/orders/${id}`}
    />
  );
}
