import { notFound, redirect } from 'next/navigation';
import AdminHeader from '@/components/admin/AdminHeader';
import ProductMarketplaceManagerPage, {
  type ProductMarketplaceName,
  type ProductMarketplaceSummary,
} from '@/components/admin/ProductMarketplaceManagerPage';
import { getVerifiedUser } from '@/lib/auth-claims';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

const PRODUCT_MARKETPLACE_COLUMNS = [
  'id',
  'title',
  'inventory_number',
  'status',
  'quantity',
  'images',
  'image_urls',
  'image_padding',
  'image_padding_by_image',
].join(', ');

export async function renderAdminProductMarketplacePage({
  locale,
  productId,
  marketplace,
  returnTo,
}: {
  locale: string;
  productId: string;
  marketplace: ProductMarketplaceName;
  returnTo?: string;
}) {
  const isEs = locale === 'es';
  const adminBasePath = isEs ? '/es/admin' : '/admin';
  const returnToSocialQueues = returnTo === 'social-queues';

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

  const [{ count: unreadMessagesCount }, productResult] = await Promise.all([
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
    createServiceClient()
      .from('products')
      .select(PRODUCT_MARKETPLACE_COLUMNS)
      .eq('id', productId)
      .maybeSingle(),
  ]);

  if (productResult.error || !productResult.data) {
    notFound();
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active={returnToSocialQueues ? 'social-queues' : 'products'}
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <ProductMarketplaceManagerPage
        product={productResult.data as unknown as ProductMarketplaceSummary}
        marketplace={marketplace}
        locale={locale}
        returnTo={returnToSocialQueues ? 'social-queues' : null}
      />
    </div>
  );
}
