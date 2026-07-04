import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import OrderDetailPanel from '@/components/admin/OrderDetailPanel';
import AdminHeader from '@/components/admin/AdminHeader';
import type { Order, OrderItem } from '@/types/sales';

export const metadata: Metadata = { title: 'Admin - Order Detail' };

const ORDER_DETAIL_COLUMNS = [
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
  'refund_amount',
  'created_at',
  'updated_at',
  'order_items(id, order_id, product_id, inventory_number, title_snapshot, item_year_snapshot, metal_snapshot, purity_snapshot, gram_weight_snapshot, price_snapshot, discount, image_snapshot, created_at)',
].join(', ');
const ORDER_DETAIL_COLUMNS_WITHOUT_ITEM_YEAR_SNAPSHOT = ORDER_DETAIL_COLUMNS.replace('item_year_snapshot, ', '');
const ORDER_DETAIL_COLUMNS_WITHOUT_REFUND_AMOUNT = ORDER_DETAIL_COLUMNS.replace('refund_amount, ', '');
const ORDER_DETAIL_COLUMNS_WITHOUT_BOTH = ORDER_DETAIL_COLUMNS_WITHOUT_ITEM_YEAR_SNAPSHOT.replace('refund_amount, ', '');

function isMissingItemYearColumnError(error: { message?: string | null } | null | undefined) {
  return Boolean(error?.message?.toLowerCase().includes('item_year'));
}

function isMissingRefundAmountError(error: { message?: string | null } | null | undefined) {
  return Boolean(error?.message?.toLowerCase().includes('refund_amount'));
}

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  created_at: string;
};

type OrderEmail = {
  id: string;
  email_type: string;
  recipient: string;
  subject: string | null;
  status: string | null;
  sent_by_email: string | null;
  created_at: string;
};

export default async function AdminOrderDetailPage({ params }: Props) {
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

  const [orderResult, { data: invoices }, { count: unreadMessagesCount }, orderEmailsResult] = await Promise.all([
    supabase
      .from('orders')
      .select(ORDER_DETAIL_COLUMNS)
      .eq('id', id)
      .single(),
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
    // Email history for this order. Degrades to [] if the table isn't migrated yet.
    supabase
      .from('order_emails')
      .select('id, email_type, recipient, subject, status, sent_by_email, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false }),
  ]);
  const orderEmails = (orderEmailsResult?.data ?? []) as OrderEmail[];
  let order = orderResult.data;
  if (isMissingItemYearColumnError(orderResult.error)) {
    const fallback = await supabase
      .from('orders')
      .select(ORDER_DETAIL_COLUMNS_WITHOUT_ITEM_YEAR_SNAPSHOT)
      .eq('id', id)
      .single();
    order = fallback.data;
    if (isMissingRefundAmountError(fallback.error)) {
      const fallback2 = await supabase
        .from('orders')
        .select(ORDER_DETAIL_COLUMNS_WITHOUT_BOTH)
        .eq('id', id)
        .single();
      order = fallback2.data;
    }
  } else if (isMissingRefundAmountError(orderResult.error)) {
    const fallback = await supabase
      .from('orders')
      .select(ORDER_DETAIL_COLUMNS_WITHOUT_REFUND_AMOUNT)
      .eq('id', id)
      .single();
    order = fallback.data;
  }

  if (!order) notFound();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="orders"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <OrderDetailPanel
        initialOrder={order as unknown as Order & { order_items: OrderItem[] }}
        initialInvoices={(invoices ?? []) as Invoice[]}
        initialOrderEmails={orderEmails}
        adminEmail={user.email ?? null}
        locale={locale}
      />
    </div>
  );
}
