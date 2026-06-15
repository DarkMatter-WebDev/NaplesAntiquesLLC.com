import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import AdminHeader from '@/components/admin/AdminHeader';

export const metadata: Metadata = { title: 'Admin - Subscribers' };

interface Props {
  params: Promise<{ locale: string }>;
}

type Subscriber = {
  id: string;
  email: string;
  full_name: string | null;
  source: string | null;
  locale: string | null;
  subscribed_at: string;
  updated_at: string;
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

export default async function AdminSubscribersPage({ params }: Props) {
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

  const [{ data: subscribers, error }, { count: unreadMessagesCount }] = await Promise.all([
    supabase
      .from('homepage_subscribers')
      .select('id, email, full_name, source, locale, subscribed_at, updated_at')
      .order('subscribed_at', { ascending: false }),
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ]);

  const rows = (subscribers ?? []) as Subscriber[];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="subscribers"
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
                Homepage Subscribers
              </p>
              <h1
                className="text-3xl md:text-4xl font-bold"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                Subscriber List
              </h1>
            </div>
            <div className="border px-4 py-3 text-center" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{rows.length}</p>
              <p className="text-[0.62rem] uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>Subscribers</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)', background: 'white' }}>
              Could not load subscribers. Run `supabase/homepage-subscribers.sql` in Supabase first.
            </div>
          )}

          <div className="overflow-x-auto border" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead style={{ background: 'var(--color-surface-container-low)' }}>
                <tr>
                  {['Name', 'Email', 'Source', 'Locale', 'Subscribed', 'Updated'].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-[0.68rem] uppercase tracking-widest font-bold"
                      style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((subscriber) => (
                  <tr key={subscriber.id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                      {subscriber.full_name || '-'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-on-surface)' }}>
                      {subscriber.email}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {subscriber.source || '-'}
                    </td>
                    <td className="px-4 py-3 uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {subscriber.locale || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {formatDate(subscriber.subscribed_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {formatDate(subscriber.updated_at)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                      No homepage subscribers yet.
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
