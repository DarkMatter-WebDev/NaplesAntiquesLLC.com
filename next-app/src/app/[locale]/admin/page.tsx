import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import AdminShell from '@/components/admin/AdminShell';

export const metadata: Metadata = { title: 'Admin - Products' };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;

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

  // Read products with the service role (not the admin's authenticated session).
  // This is gated behind the is_admin check above, and it lets us revoke SELECT
  // on internal product columns (cost_basis, minimum_price, internal_notes, etc.)
  // from the `authenticated` role so signed-up non-admins can't read them — the
  // admin editor still gets every column here. (CODE-D04 residual)
  const service = createServiceClient();
  const [{ data: products }, spotData, { count: unreadMessagesCount }] = await Promise.all([
    service.from('products').select('*').order('sort_order', { ascending: true }),
    fetchSpotData(),
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ]);

  return (
    <AdminShell
      initialProducts={(products ?? []) as Product[]}
      userEmail={user.email ?? ''}
      spotData={spotData}
      locale={locale}
      unreadMessagesCount={unreadMessagesCount ?? 0}
    />
  );
}
