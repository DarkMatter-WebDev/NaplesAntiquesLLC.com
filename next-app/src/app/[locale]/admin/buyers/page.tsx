import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import AdminHeader from '@/components/admin/AdminHeader';
import BuyersManager, { type BuyerRow } from '@/components/admin/BuyersManager';

export const metadata: Metadata = { title: 'Admin - Buyers' };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AdminBuyersPage({ params }: Props) {
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

  const [buyersResult, { count: unreadMessagesCount }] = await Promise.all([
    supabase
      .from('buyers')
      .select('email, name, phone, order_count, total_spent, last_order_at')
      .order('last_order_at', { ascending: false }),
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ]);

  const rows: BuyerRow[] = (buyersResult.data ?? []).map((buyer) => ({
    email: buyer.email,
    name: buyer.name,
    phone: buyer.phone,
    orderCount: buyer.order_count ?? 0,
    totalSpent: Number(buyer.total_spent ?? 0),
    lastOrderAt: buyer.last_order_at,
  }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="buyers"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <main className="px-4 md:px-8 py-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p
                className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                Customer Directory
              </p>
              <h1
                className="text-3xl md:text-4xl font-bold"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                Buyers
              </h1>
            </div>
            <div className="border px-4 py-3 text-center" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{rows.length}</p>
              <p className="text-[0.62rem] uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>Buyers</p>
            </div>
          </div>

          {buyersResult.error && (
            <div className="mb-6 border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)', background: 'white' }}>
              Could not load buyers: {buyersResult.error.message}
            </div>
          )}

          <BuyersManager initialRows={rows} />
        </div>
      </main>
    </div>
  );
}
