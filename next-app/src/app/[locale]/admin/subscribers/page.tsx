import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/auth-claims';
import AdminHeader from '@/components/admin/AdminHeader';
import SubscribersManager, { type SubscriberRow } from '@/components/admin/SubscribersManager';
import { buildMarketingAudience } from '@/lib/marketing';

export const metadata: Metadata = { title: 'Admin - Subscribers' };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AdminSubscribersPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const adminBasePath = isEs ? '/es/admin' : '/admin';

  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

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

  const [audienceResult, { count: unreadMessagesCount }] = await Promise.all([
    Promise.resolve().then(async () => {
      try {
        return { data: await buildMarketingAudience('all', supabase), error: null };
      } catch (err) {
        console.error('Admin marketing audience load failed:', err);
        return { data: [], error: err instanceof Error ? err : new Error('Could not load marketing audience.') };
      }
    }),
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ]);

  const rows: SubscriberRow[] = audienceResult.data.map((recipient) => ({
    email: recipient.email,
    name: recipient.name,
    source: recipient.source,
    subscriberSource: recipient.subscriberSource,
    subscriberEmail: recipient.subscriberEmail,
  }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="subscribers"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <main className="px-4 md:px-8 py-8">
        <div className="ultrawide-page-medium max-w-[1200px] mx-auto">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p
                className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                Marketing Audience
              </p>
              <h1
                className="text-3xl md:text-4xl font-bold"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                Reachable Recipients
              </h1>
            </div>
            <div className="border px-4 py-3 text-center" style={{ borderColor: 'var(--color-outline-variant)', background: 'white' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{rows.length}</p>
              <p className="text-[0.62rem] uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>Reachable</p>
            </div>
          </div>

          {audienceResult.error && (
            <div className="mb-6 border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)', background: 'white' }}>
              Could not load the marketing audience: {audienceResult.error.message}
            </div>
          )}

          <SubscribersManager initialRows={rows} />
        </div>
      </main>
    </div>
  );
}
