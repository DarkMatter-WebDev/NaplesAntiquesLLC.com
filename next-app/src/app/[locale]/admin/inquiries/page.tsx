import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/auth-claims';
import InquiriesPanel from '@/components/admin/InquiriesPanel';
import AdminHeader from '@/components/admin/AdminHeader';
import type { Inquiry } from '@/components/admin/InquiriesPanel';

export const metadata: Metadata = { title: 'Admin — Inquiries' };

interface Props {
  params: Promise<{ locale: string }>;
}

const INQUIRY_LIST_COLUMNS = [
  'id',
  'item_title',
  'name',
  'phone',
  'email',
  'message',
  'status',
  'created_at',
];
const INQUIRY_LIST_SELECT = INQUIRY_LIST_COLUMNS.join(', ');
const INQUIRY_LIST_SELECT_WITH_IMAGES = [...INQUIRY_LIST_COLUMNS, 'uploaded_image_urls'].join(', ');
// 2026-09-08: location + preferred contact (supabase/inquiries-location-contact-2026-09.sql).
const INQUIRY_LIST_SELECT_FULL = [
  ...INQUIRY_LIST_COLUMNS,
  'uploaded_image_urls',
  'location_area',
  'location_detail',
  'preferred_contact',
].join(', ');

export default async function AdminInquiriesPage({ params }: Props) {
  const { locale } = await params;
  const adminBasePath = locale === 'es' ? '/es/admin' : '/admin';

  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  if (!user) {
    redirect(locale === 'es' ? '/es/account/sign-in' : '/account/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect(locale === 'es' ? '/es/account' : '/account');
  }

  // Prefer the full select (photos + the 2026-09-08 preference columns); fall
  // back step by step if a migration has not been applied yet
  // (inquiries-location-contact-2026-09.sql, then sales-workflow.sql).
  const [full, { count: unreadMessagesCount }] = await Promise.all([
    supabase
      .from('inquiries')
      .select(INQUIRY_LIST_SELECT_FULL)
      .order('created_at', { ascending: false }),
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ]);
  let inquiries = full.data;
  if (full.error) {
    const withImages = await supabase
      .from('inquiries')
      .select(INQUIRY_LIST_SELECT_WITH_IMAGES)
      .order('created_at', { ascending: false });
    inquiries = withImages.error
      ? (await supabase
          .from('inquiries')
          .select(INQUIRY_LIST_SELECT)
          .order('created_at', { ascending: false })).data
      : withImages.data;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="messages"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <InquiriesPanel inquiries={(inquiries ?? []) as unknown as Inquiry[]} />
    </div>
  );
}
