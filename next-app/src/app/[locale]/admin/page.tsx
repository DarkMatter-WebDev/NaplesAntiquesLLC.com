import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/auth-claims';
import { createServiceClient } from '@/lib/supabase/service';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import AdminShell from '@/components/admin/AdminShell';
import {
  ADMIN_PRODUCT_SUMMARY_COLUMNS,
  ADMIN_PRODUCT_SUMMARY_COLUMNS_WITHOUT_SOLD_PRICE,
  isMissingSoldPriceColumnError,
  toAdminProductSummary,
} from '@/lib/admin-product-summary';

export const metadata: Metadata = { title: 'Admin - Products' };

interface Props {
  params: Promise<{ locale: string }>;
}

let soldPriceColumnSupported: boolean | null = null;

async function fetchAdminProductSummaries(service: ReturnType<typeof createServiceClient>) {
  const includeSoldPrice = soldPriceColumnSupported !== false;
  let result = await service
    .from('products')
    .select(includeSoldPrice ? ADMIN_PRODUCT_SUMMARY_COLUMNS : ADMIN_PRODUCT_SUMMARY_COLUMNS_WITHOUT_SOLD_PRICE)
    .order('sort_order', { ascending: true });

  if (includeSoldPrice && isMissingSoldPriceColumnError(result.error)) {
    soldPriceColumnSupported = false;
    result = await service
      .from('products')
      .select(ADMIN_PRODUCT_SUMMARY_COLUMNS_WITHOUT_SOLD_PRICE)
      .order('sort_order', { ascending: true });
  } else if (!result.error) {
    soldPriceColumnSupported = true;
  }

  return {
    data: (result.data ?? []).map((product) => toAdminProductSummary(product as unknown as Partial<Product>)),
    error: result.error,
  };
}

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;

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

  // Read table/filter fields with the service role (not the admin's authenticated session).
  // This is gated behind the is_admin check above, and it lets us revoke SELECT
  // on internal product columns (cost_basis, minimum_price, internal_notes, etc.)
  // from the `authenticated` role so signed-up non-admins can't read them — the
  // Full private/editor fields are fetched on demand when an admin opens a
  // product action. (CODE-D04 residual)
  const service = createServiceClient();
  const [{ data: products }, spotData, { count: unreadMessagesCount }] = await Promise.all([
    fetchAdminProductSummaries(service),
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
