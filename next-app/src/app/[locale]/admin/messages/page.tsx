import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import MessagesPanel, { type AdminNotification } from '@/components/admin/MessagesPanel';
import AdminHeader from '@/components/admin/AdminHeader';

export const metadata: Metadata = { title: 'Admin - Messages' };

const ADMIN_NOTIFICATION_COLUMNS = [
  'id',
  'type',
  'title',
  'body',
  'order_id',
  'customer_name',
  'customer_email',
  'is_read',
  'created_at',
];
const ADMIN_NOTIFICATION_SELECT = ADMIN_NOTIFICATION_COLUMNS.join(', ');
const ADMIN_NOTIFICATION_SELECT_WITH_IMAGES = [...ADMIN_NOTIFICATION_COLUMNS, 'image_urls'].join(', ');

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AdminMessagesPage({ params }: Props) {
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

  // Prefer the select that includes customer-attached photos; fall back without it
  // if the image_urls column isn't present yet (admin-notifications-image-urls.sql).
  const withImages = await supabase
    .from('admin_notifications')
    .select(ADMIN_NOTIFICATION_SELECT_WITH_IMAGES)
    .order('created_at', { ascending: false })
    .limit(100);
  const notifications = withImages.error
    ? (await supabase
        .from('admin_notifications')
        .select(ADMIN_NOTIFICATION_SELECT)
        .order('created_at', { ascending: false })
        .limit(100)).data
    : withImages.data;
  const unreadMessagesCount = ((notifications ?? []) as unknown as AdminNotification[]).filter((item) => !item.is_read).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="messages"
        unreadMessagesCount={unreadMessagesCount}
        userEmail={user.email}
      />

      <MessagesPanel notifications={(notifications ?? []) as unknown as AdminNotification[]} locale={locale} />
    </div>
  );
}
