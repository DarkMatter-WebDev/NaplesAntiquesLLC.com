import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import AdminShell from '@/components/admin/AdminShell';

export const metadata: Metadata = { title: 'Product Admin' };

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

  const [{ data: products }, spotData] = await Promise.all([
    supabase.from('products').select('*').order('sort_order', { ascending: true }),
    fetchSpotData(),
  ]);

  return (
    <AdminShell
      initialProducts={(products ?? []) as Product[]}
      userEmail={user.email ?? ''}
      spotData={spotData}
    />
  );
}
