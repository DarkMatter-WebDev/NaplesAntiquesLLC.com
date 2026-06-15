import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import MessagesPanel, { type AdminNotification } from '@/components/admin/MessagesPanel';
import AdminHeader from '@/components/admin/AdminHeader';

export const metadata: Metadata = { title: 'Admin - Messages' };

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

  const { data: notifications } = await supabase
    .from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  const unreadMessagesCount = ((notifications ?? []) as AdminNotification[]).filter((item) => !item.is_read).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="messages"
        unreadMessagesCount={unreadMessagesCount}
        userEmail={user.email}
      />

      <MessagesPanel notifications={(notifications ?? []) as AdminNotification[]} locale={locale} />
    </div>
  );
}
