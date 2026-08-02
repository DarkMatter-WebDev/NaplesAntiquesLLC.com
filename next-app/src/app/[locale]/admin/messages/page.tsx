import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/auth-claims';
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
const ADMIN_NOTIFICATION_SELECT_FULL = [...ADMIN_NOTIFICATION_COLUMNS, 'image_urls', 'deleted_at'].join(', ');

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function AdminMessagesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { view } = await searchParams;
  const isTrash = view === 'trash';
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

  // Preferred query: includes photos AND the soft-delete column, filtered to the
  // active view. Falls back gracefully if deleted_at (recycle-bin migration) or
  // image_urls aren't present yet.
  const fullQuery = supabase
    .from('admin_notifications')
    .select(ADMIN_NOTIFICATION_SELECT_FULL)
    .order('created_at', { ascending: false })
    .limit(200);
  const full = await (isTrash
    ? fullQuery.not('deleted_at', 'is', null)
    : fullQuery.is('deleted_at', null));

  let notifications: unknown[] | null = full.data;
  let recycleBinSupported = !full.error;

  if (full.error) {
    // deleted_at column not present yet — fall back to the legacy queries.
    recycleBinSupported = false;
    const withImages = await supabase
      .from('admin_notifications')
      .select(ADMIN_NOTIFICATION_SELECT_WITH_IMAGES)
      .order('created_at', { ascending: false })
      .limit(200);
    notifications = withImages.error
      ? (await supabase
          .from('admin_notifications')
          .select(ADMIN_NOTIFICATION_SELECT)
          .order('created_at', { ascending: false })
          .limit(200)).data
      : withImages.data;
    // Without the column there is no real recycle bin; trash view shows nothing.
    if (isTrash) notifications = [];
  }

  // Count items currently in the recycle bin (for the inbox's "Recycle Bin (N)"
  // link). Only meaningful once the column exists.
  let trashCount = 0;
  if (recycleBinSupported) {
    const { count } = await supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .not('deleted_at', 'is', null);
    trashCount = count ?? 0;
  }

  const list = (notifications ?? []) as unknown as AdminNotification[];
  const unreadMessagesCount = list.filter((item) => !item.is_read).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="messages"
        unreadMessagesCount={isTrash ? 0 : unreadMessagesCount}
        userEmail={user.email}
      />

      <MessagesPanel
        notifications={list}
        locale={locale}
        view={isTrash ? 'trash' : 'inbox'}
        trashCount={trashCount}
        recycleBinSupported={recycleBinSupported}
      />
    </div>
  );
}
