import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/auth-claims';
import { createServiceClient } from '@/lib/supabase/service';
import AdminHeader from '@/components/admin/AdminHeader';
import CampaignDeleteButton from '@/components/admin/CampaignDeleteButton';
import MarketingComposer from '@/components/admin/MarketingComposer';

export const metadata: Metadata = { title: 'Admin - Email Campaigns' };

interface Props {
  params: Promise<{ locale: string }>;
}

type CampaignRow = {
  id: string;
  subject: string;
  audience_scope: string;
  from_address: string | null;
  reply_to: string | null;
  sender_profile: string | null;
  transport: string;
  status: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at: string | null;
};

type CampaignEventRow = {
  campaign_id: string;
  email: string;
  type: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';
  url: string | null;
  created_at: string;
};

type CampaignAnalytics = {
  bounced: number;
  clicked: number;
  complained: number;
  delivered: number;
  latestEventAt: string | null;
  opened: number;
  uniqueClickUrls: number;
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

function emptyAnalytics(): CampaignAnalytics {
  return {
    bounced: 0,
    clicked: 0,
    complained: 0,
    delivered: 0,
    latestEventAt: null,
    opened: 0,
    uniqueClickUrls: 0,
  };
}

function formatRate(count: number, total: number) {
  if (total <= 0) return '-';
  return `${Math.round((count / total) * 100)}%`;
}

export default async function AdminMarketingPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const adminBasePath = isEs ? '/es/admin' : '/admin';

  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  if (!user) redirect(isEs ? '/es/account/sign-in' : '/account/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) redirect(isEs ? '/es/account' : '/account');

  const [{ count: unreadMessagesCount }, campaignResult] = await Promise.all([
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
    Promise.resolve().then(async () => {
      try {
        const serviceClient = createServiceClient();
        const result = await serviceClient
          .from('email_campaigns')
          .select('id, subject, audience_scope, sender_profile, from_address, reply_to, transport, status, total_count, sent_count, failed_count, created_at, sent_at')
          .order('created_at', { ascending: false })
          .limit(25);

        if (result.error?.code === '42703') {
          return await serviceClient
            .from('email_campaigns')
            .select('id, subject, audience_scope, transport, status, total_count, sent_count, failed_count, created_at, sent_at')
            .order('created_at', { ascending: false })
            .limit(25);
        }

        return result;
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error('Could not load campaign history.') };
      }
    }),
  ]);

  const campaigns = (campaignResult.data ?? []) as CampaignRow[];
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const analyticsByCampaign = new Map<string, CampaignAnalytics>();

  if (campaignIds.length > 0 && !campaignResult.error) {
    try {
      const { data: eventRows, error: eventsError } = await createServiceClient()
        .from('email_campaign_events')
        .select('campaign_id, email, type, url, created_at')
        .in('campaign_id', campaignIds)
        .order('created_at', { ascending: false });

      if (eventsError) throw eventsError;

      const buckets = new Map<string, {
        bounced: Set<string>;
        clicked: Set<string>;
        complained: Set<string>;
        delivered: Set<string>;
        latestEventAt: string | null;
        opened: Set<string>;
        urls: Set<string>;
      }>();

      for (const event of (eventRows ?? []) as CampaignEventRow[]) {
        const current = buckets.get(event.campaign_id) ?? {
          bounced: new Set<string>(),
          clicked: new Set<string>(),
          complained: new Set<string>(),
          delivered: new Set<string>(),
          latestEventAt: null,
          opened: new Set<string>(),
          urls: new Set<string>(),
        };
        current[event.type].add(event.email);
        if (event.type === 'clicked' && event.url) current.urls.add(event.url);
        if (!current.latestEventAt || event.created_at > current.latestEventAt) {
          current.latestEventAt = event.created_at;
        }
        buckets.set(event.campaign_id, current);
      }

      for (const [campaignId, bucket] of buckets) {
        analyticsByCampaign.set(campaignId, {
          bounced: bucket.bounced.size,
          clicked: bucket.clicked.size,
          complained: bucket.complained.size,
          delivered: bucket.delivered.size,
          latestEventAt: bucket.latestEventAt,
          opened: bucket.opened.size,
          uniqueClickUrls: bucket.urls.size,
        });
      }
    } catch (err) {
      console.error('Could not load campaign analytics:', err);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="marketing"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <main className="px-4 md:px-8 py-8">
        <div className="ultrawide-page-wide mx-auto max-w-[1800px]">
          <div className="mb-8">
            <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.35em]" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              Marketing
            </p>
            <h1 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              Email Campaigns
            </h1>
          </div>

          <MarketingComposer />

          <section className="mt-8 rounded-[1.25rem] border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                Campaign History
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                Analytics populate from Resend webhook events recorded by the site.
              </p>
            </div>
            {campaignResult.error && (
              <div className="m-5 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
                Could not load campaign history. Run `supabase/email-marketing.sql` first.
              </div>
            )}
            <div className="responsive-table-wrap">
              <table className="w-full min-w-[1650px] text-left text-sm">
                <thead style={{ background: 'var(--color-surface-container-low)' }}>
                  <tr>
                    {['Subject', 'Audience', 'Sender', 'Status', 'Sent', 'Delivered', 'Opens', 'Clicks', 'Bounces', 'Complaints', 'Latest Event', 'Transport', 'Created', 'Sent At', 'Actions'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-[0.68rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => {
                    const analytics = analyticsByCampaign.get(campaign.id) ?? emptyAnalytics();
                    return (
                      <tr key={campaign.id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-on-surface)' }}>{campaign.subject}</td>
                        <td className="px-4 py-3 capitalize" style={{ color: 'var(--color-on-surface-variant)' }}>{campaign.audience_scope}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface)' }}>
                          <span className="font-semibold">{campaign.sender_profile === 'no_reply' ? 'No-reply' : 'Chris'}</span>
                          <span className="block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {campaign.reply_to ? `Replies to ${campaign.reply_to}` : (campaign.from_address ?? '-')}
                          </span>
                        </td>
                        <td className="px-4 py-3 capitalize" style={{ color: 'var(--color-on-surface-variant)' }}>{campaign.status}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface)' }}>
                          <span className="font-semibold">{campaign.sent_count}</span>
                          <span style={{ color: 'var(--color-on-surface-variant)' }}> / {campaign.total_count}</span>
                          {campaign.failed_count > 0 && (
                            <span className="block text-xs" style={{ color: 'var(--color-error)' }}>
                              {campaign.failed_count} failed
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface)' }}>
                          <span className="font-semibold">{analytics.delivered}</span>
                          <span className="block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {formatRate(analytics.delivered, campaign.sent_count)} delivered
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface)' }}>
                          <span className="font-semibold">{analytics.opened}</span>
                          <span className="block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {formatRate(analytics.opened, campaign.sent_count)} open rate
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface)' }}>
                          <span className="font-semibold">{analytics.clicked}</span>
                          <span className="block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {analytics.uniqueClickUrls} URL{analytics.uniqueClickUrls === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: analytics.bounced ? 'var(--color-error)' : 'var(--color-on-surface-variant)' }}>
                          {analytics.bounced}
                        </td>
                        <td className="px-4 py-3" style={{ color: analytics.complained ? 'var(--color-error)' : 'var(--color-on-surface-variant)' }}>
                          {analytics.complained}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{formatDate(analytics.latestEventAt)}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{campaign.transport}</td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{formatDate(campaign.created_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{formatDate(campaign.sent_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <CampaignDeleteButton campaignId={campaign.id} subject={campaign.subject} />
                        </td>
                      </tr>
                    );
                  })}
                  {campaigns.length === 0 && !campaignResult.error && (
                    <tr>
                      <td colSpan={15} className="px-4 py-12 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                        No email campaigns have been sent yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
