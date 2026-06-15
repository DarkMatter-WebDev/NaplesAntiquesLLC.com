import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AdminHeader from '@/components/admin/AdminHeader';
import { formatCurrency } from '@/types/sales';

export const metadata: Metadata = { title: 'Admin - Users' };

interface Props {
  params: Promise<{ locale: string }>;
}

type SiteUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  alternate_phone: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  marketing_opt_in: boolean | null;
  is_vip: boolean | null;
  is_admin: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type UserOrderSummary = {
  count: number;
  total: number;
  latest: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function displayName(user: SiteUser) {
  const fromParts = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return user.full_name || fromParts || '-';
}

function displayLocation(user: SiteUser) {
  return [user.city, user.state, user.postal_code, user.country]
    .filter(Boolean)
    .join(', ') || '-';
}

export default async function AdminUsersPage({ params }: Props) {
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

  const [{ data: users, error }, { count: unreadMessagesCount }, { data: orders }, { data: invoices }] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        full_name,
        email,
        phone,
        alternate_phone,
        city,
        state,
        postal_code,
        country,
        marketing_opt_in,
        is_vip,
        is_admin,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
    supabase
      .from('orders')
      .select('id, user_id, total, created_at')
      .not('user_id', 'is', null),
    supabase
      .from('invoices')
      .select('id, user_id')
      .not('user_id', 'is', null),
  ]);

  const siteUsers = (users ?? []) as SiteUser[];
  const orderSummaryByUser = new Map<string, UserOrderSummary>();
  for (const order of orders ?? []) {
    if (!order.user_id) continue;
    const current = orderSummaryByUser.get(order.user_id) ?? { count: 0, total: 0, latest: null };
    const createdAt = order.created_at as string | null;
    orderSummaryByUser.set(order.user_id, {
      count: current.count + 1,
      total: current.total + Number(order.total ?? 0),
      latest: !current.latest || (createdAt && createdAt > current.latest) ? createdAt : current.latest,
    });
  }
  const invoiceCountByUser = new Map<string, number>();
  for (const invoice of invoices ?? []) {
    if (!invoice.user_id) continue;
    invoiceCountByUser.set(invoice.user_id, (invoiceCountByUser.get(invoice.user_id) ?? 0) + 1);
  }
  const marketingCount = siteUsers.filter((siteUser) => siteUser.marketing_opt_in).length;
  const adminCount = siteUsers.filter((siteUser) => siteUser.is_admin).length;
  const enrichedUsers = siteUsers.map((siteUser) => ({
    ...siteUser,
    orderSummary: orderSummaryByUser.get(siteUser.id) ?? null,
    invoiceCount: invoiceCountByUser.get(siteUser.id) ?? 0,
  }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="users"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <main className="px-4 md:px-8 py-8">
        <div className="max-w-[1500px] mx-auto">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                Account Users
              </p>
              <h1 className="text-3xl md:text-4xl font-bold"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                Active Site Accounts
              </h1>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="border px-4 py-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{siteUsers.length}</p>
                <p className="text-[0.62rem] uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>Accounts</p>
              </div>
              <div className="border px-4 py-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{marketingCount}</p>
                <p className="text-[0.62rem] uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>Opt-ins</p>
              </div>
              <div className="border px-4 py-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{adminCount}</p>
                <p className="text-[0.62rem] uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>Admins</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 border px-4 py-3 text-sm"
              style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)', background: 'white' }}>
              Could not load the full user table: {error.message}
            </div>
          )}

          <div className="overflow-x-auto border" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead style={{ background: 'var(--color-surface-container-low)' }}>
                <tr>
                  {['Name', 'Email', 'Phone', 'Alternate Phone', 'Location', 'Orders', 'Invoices', 'Marketing', 'Flags', 'Created', 'Updated'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-[0.68rem] uppercase tracking-widest font-bold"
                      style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enrichedUsers.map((siteUser) => (
                      <tr key={siteUser.id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                          {displayName(siteUser)}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface)' }}>
                          {siteUser.email || '-'}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {siteUser.phone || '-'}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {siteUser.alternate_phone || '-'}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {displayLocation(siteUser)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {siteUser.orderSummary ? (
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                                {siteUser.orderSummary.count} order{siteUser.orderSummary.count === 1 ? '' : 's'}
                              </span>
                              <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                                {formatCurrency(siteUser.orderSummary.total)}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-on-surface-variant)' }}>No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {siteUser.orderSummary ? (
                            <Link href={`${adminBasePath}/users/${siteUser.id}/invoices`} className="gold-button text-xs">
                              Invoices{siteUser.invoiceCount > 0 ? ` (${siteUser.invoiceCount})` : ''}
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--color-on-surface-variant)' }}>-</span>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ color: siteUser.marketing_opt_in ? '#2f6b3f' : 'var(--color-on-surface-variant)' }}>
                          {siteUser.marketing_opt_in ? 'Yes' : 'No'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {siteUser.is_admin && <span className="px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wide" style={{ background: '#735c00', color: 'white' }}>Admin</span>}
                            {siteUser.is_vip && <span className="px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wide" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-primary)' }}>VIP</span>}
                            {!siteUser.is_admin && !siteUser.is_vip && <span style={{ color: 'var(--color-on-surface-variant)' }}>-</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {formatDate(siteUser.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {formatDate(siteUser.updated_at)}
                        </td>
                      </tr>
                ))}
                {siteUsers.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                      No account profiles were found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
