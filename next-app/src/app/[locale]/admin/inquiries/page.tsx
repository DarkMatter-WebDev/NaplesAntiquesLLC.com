import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
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
].join(', ');

export default async function AdminInquiriesPage({ params }: Props) {
  const { locale } = await params;
  const adminBasePath = locale === 'es' ? '/es/admin' : '/admin';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  const [{ data: inquiries }, { count: unreadMessagesCount }] = await Promise.all([
    supabase
      .from('inquiries')
      .select(INQUIRY_LIST_COLUMNS)
      .order('created_at', { ascending: false }),
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="inquiries"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <InquiriesPanel inquiries={(inquiries ?? []) as unknown as Inquiry[]} />
    </div>
  );
}
