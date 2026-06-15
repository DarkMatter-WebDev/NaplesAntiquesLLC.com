import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import OrdersPanel from '@/components/admin/OrdersPanel';
import AdminHeader from '@/components/admin/AdminHeader';
import type { Order } from '@/types/sales';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';

export const metadata: Metadata = { title: 'Admin - Orders' };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AdminOrdersPage({ params }: Props) {
  const { locale } = await params;
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

  const [{ data: orders }, { data: products }, spotData, { count: unreadMessagesCount }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true }),
    fetchSpotData(),
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="orders"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <OrdersPanel
        initialOrders={(orders ?? []) as Order[]}
        products={(products ?? []) as Product[]}
        spotData={spotData}
        locale={locale}
      />
    </div>
  );
}
