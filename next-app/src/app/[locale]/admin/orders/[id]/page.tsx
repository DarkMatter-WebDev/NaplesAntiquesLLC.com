import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import OrderDetailPanel from '@/components/admin/OrderDetailPanel';
import AdminHeader from '@/components/admin/AdminHeader';
import type { Order, OrderItem } from '@/types/sales';

export const metadata: Metadata = { title: 'Admin - Order Detail' };

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

  const [{ data: order }, { data: invoices }, { count: unreadMessagesCount }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, order_items(*)')
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
  ]);

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
        initialOrder={order as Order & { order_items: OrderItem[] }}
        initialInvoices={(invoices ?? []) as Invoice[]}
        locale={locale}
      />
    </div>
  );
}
