import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/auth-claims';
import AdminHeader from '@/components/admin/AdminHeader';
import TextDealsManager from '@/components/admin/TextDealsManager';
import { twilioConfigured, inboundWebhookUrl } from '@/lib/text-alerts/config';
import { DEFAULT_FORWARD_TO } from '@/lib/text-alerts/config';
import { formatUsPhone } from '@/lib/subscriber-phone';

export const metadata: Metadata = { title: 'Admin - Text Deals' };

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Admin → Text Deals (owner mockup v2, 2026-09-15): a phone photo, a price,
 * one line, the owner's message → a picture message to every confirmed
 * number; replies in clock order with the first flagged; Mark sold.
 */
export default async function AdminTextDealsPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const adminBasePath = isEs ? '/es/admin' : '/admin';

  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);
  if (!user) redirect(isEs ? '/es/account/sign-in' : '/account/sign-in');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect(isEs ? '/es/account' : '/account');

  const { count: unreadMessagesCount } = await supabase
    .from('admin_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);

  const configured = twilioConfigured();
  const forwardTo = process.env.TWILIO_FORWARD_TO?.trim() || DEFAULT_FORWARD_TO;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader adminBasePath={adminBasePath} active="text-deals" unreadMessagesCount={unreadMessagesCount ?? 0} userEmail={user.email} />
      <main className="px-4 md:px-8 py-8">
        <div className="ultrawide-page-medium max-w-[1200px] mx-auto">
          <div className="mb-8">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              Text alerts
            </p>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              Text Deals
            </h1>
            <p className="mt-2 text-sm max-w-2xl" style={{ color: 'var(--color-on-surface-variant)' }}>
              A photo, a price and one line go out as a picture message to everyone who replied YES. The first reply
              takes it. Every reply is forwarded to {formatUsPhone(forwardTo)}.
            </p>
            {!configured && (
              <div className="mt-4 border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-primary-container)', background: '#fffbe8', color: 'var(--color-on-surface)' }}>
                Twilio is not configured on this deployment yet (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).
                Deals can be drafted and previewed; nothing is texted until those are set and the number&apos;s
                &quot;A message comes in&quot; webhook points at <code>{inboundWebhookUrl()}</code>.
              </div>
            )}
          </div>
          <TextDealsManager configured={configured} forwardTo={forwardTo} />
        </div>
      </main>
    </div>
  );
}
