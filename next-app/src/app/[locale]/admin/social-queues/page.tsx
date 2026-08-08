import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AdminHeader from '@/components/admin/AdminHeader';
import SocialQueuesDashboard, {
  type SocialQueueChannelSummary,
  type SocialLatestPostSummary,
  type SocialQueueProductSummary,
  type SocialQueueRowSummary,
} from '@/components/admin/SocialQueuesDashboard';
import { getVerifiedUser } from '@/lib/auth-claims';
import { getConnection as getInstagramConnection, getRecentSyncLog as getInstagramLog } from '@/lib/instagram/store';
import { getConnection as getFacebookConnection, getRecentSyncLog as getFacebookLog } from '@/lib/facebook/store';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Admin - Social Media Queues' };

const QUEUE_COLUMNS = 'product_id, sync_state, queued_at, scheduled_for, posted_caption, rendition_paths';
const LATEST_POST_COLUMNS = 'product_id, posted_at, permalink';
const PRODUCT_COLUMNS = 'id, title, inventory_number, status, images, image_urls';

interface Props {
  params: Promise<{ locale: string }>;
}

function errorMessage(error: { message?: string | null } | null): string | null {
  return error?.message ?? null;
}

export default async function AdminSocialQueuesPage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const adminBasePath = isEs ? '/es/admin' : '/admin';
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1_000).toISOString();

  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);
  if (!user) redirect(isEs ? '/es/account/sign-in' : '/account/sign-in');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect(isEs ? '/es/account' : '/account');

  const service = createServiceClient();
  const [
    { count: unreadMessagesCount },
    instagramConnection,
    facebookConnection,
    instagramQueue,
    facebookQueue,
    instagramLatest,
    facebookLatest,
    instagramPublished,
    facebookPublished,
    instagramLog,
    facebookLog,
  ] = await Promise.all([
    supabase.from('admin_notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
    getInstagramConnection(service),
    getFacebookConnection(service),
    service.from('instagram_posts').select(QUEUE_COLUMNS).in('sync_state', ['pending', 'review']).not('queued_at', 'is', null).order('scheduled_for', { ascending: true, nullsFirst: false }).order('queued_at', { ascending: true }).limit(200),
    service.from('facebook_posts').select(QUEUE_COLUMNS).in('sync_state', ['pending', 'review']).not('queued_at', 'is', null).order('scheduled_for', { ascending: true, nullsFirst: false }).order('queued_at', { ascending: true }).limit(200),
    service.from('instagram_posts').select(LATEST_POST_COLUMNS).eq('sync_state', 'published').not('posted_at', 'is', null).order('posted_at', { ascending: false }).limit(12),
    service.from('facebook_posts').select(LATEST_POST_COLUMNS).eq('sync_state', 'published').not('posted_at', 'is', null).order('posted_at', { ascending: false }).limit(12),
    service.from('instagram_posts').select('posted_at').eq('sync_state', 'published').gte('posted_at', since),
    service.from('facebook_posts').select('posted_at').eq('sync_state', 'published').gte('posted_at', since),
    getInstagramLog(service, 100),
    getFacebookLog(service, 100),
  ]);

  const instagramRows = (instagramQueue.data ?? []) as unknown as SocialQueueRowSummary[];
  const facebookRows = (facebookQueue.data ?? []) as unknown as SocialQueueRowSummary[];
  const instagramLatestRows = (instagramLatest.data ?? []) as unknown as SocialLatestPostSummary[];
  const facebookLatestRows = (facebookLatest.data ?? []) as unknown as SocialLatestPostSummary[];
  const productIds = Array.from(new Set([
    ...instagramRows,
    ...facebookRows,
    ...instagramLatestRows,
    ...facebookLatestRows,
  ].map((row) => row.product_id)));
  const productsResult = productIds.length
    ? await service.from('products').select(PRODUCT_COLUMNS).in('id', productIds)
    : { data: [], error: null };

  const instagramLastRun = instagramLog.find((row) => row.action === 'scheduled_drip') ?? null;
  const facebookLastRun = facebookLog.find((row) => row.action === 'scheduled_drip') ?? null;
  const channels: SocialQueueChannelSummary[] = [
    {
      channel: 'instagram',
      connected: instagramConnection?.status === 'connected',
      accountName: instagramConnection?.username ? `@${instagramConnection.username}` : null,
      cronConfigured: Boolean(process.env.INSTAGRAM_CRON_SECRET),
      recentPublishedAt: (instagramPublished.data ?? []).flatMap((row) => row.posted_at ? [String(row.posted_at)] : []),
      lastScheduledRunAt: instagramLastRun?.created_at ?? null,
      lastScheduledRunMessage: instagramLastRun?.message ?? null,
      rows: instagramRows,
      latestPosts: instagramLatestRows,
      loadError: errorMessage(instagramQueue.error) ?? errorMessage(instagramLatest.error) ?? errorMessage(instagramPublished.error),
    },
    {
      channel: 'facebook',
      connected: facebookConnection?.status === 'connected',
      accountName: facebookConnection?.page_name ?? null,
      cronConfigured: Boolean(process.env.FACEBOOK_CRON_SECRET),
      recentPublishedAt: (facebookPublished.data ?? []).flatMap((row) => row.posted_at ? [String(row.posted_at)] : []),
      lastScheduledRunAt: facebookLastRun?.created_at ?? null,
      lastScheduledRunMessage: facebookLastRun?.message ?? null,
      rows: facebookRows,
      latestPosts: facebookLatestRows,
      loadError: errorMessage(facebookQueue.error) ?? errorMessage(facebookLatest.error) ?? errorMessage(facebookPublished.error),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="social-queues"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />
      <SocialQueuesDashboard
        adminBasePath={adminBasePath}
        channels={channels}
        products={(productsResult.data ?? []) as unknown as SocialQueueProductSummary[]}
        nowIso={now.toISOString()}
      />
    </div>
  );
}
