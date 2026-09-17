import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getVerifiedUser } from '@/lib/auth-claims';
import { fetchSpotData } from '@/lib/spot-price';
import AdminHeader from '@/components/admin/AdminHeader';
import InStoreSaleForm, { type InStoreProduct } from '@/components/admin/InStoreSaleForm';

export const metadata: Metadata = { title: 'Admin - In-Store Sale' };

interface Props {
  params: Promise<{ locale: string }>;
}

const PRODUCT_COLUMNS =
  'id, title, status, quantity, inventory_number, category, metal_variant, purity, gram_weight, weight_grams, '
  + 'price_mode, pricing_multiplier, manual_price_label, asking_price, sold_price, image_urls, images';

/**
 * Admin → In-Store Sale (owner mockup 2026-09-16): the card is taken on
 * Zettle; this page records the sale — a listed item by inventory number or
 * an unlisted piece by description — as a paid order, marks a listed item
 * sold and emails the receipt.
 */
export default async function AdminInStoreSalePage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const adminBasePath = isEs ? '/es/admin' : '/admin';

  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);
  if (!user) redirect(isEs ? '/es/account/sign-in' : '/account/sign-in');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect(isEs ? '/es/account' : '/account');

  const service = createServiceClient();
  const [{ count: unreadMessagesCount }, { data: products }, spotData] = await Promise.all([
    supabase.from('admin_notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
    service
      .from('products')
      .select(PRODUCT_COLUMNS)
      .in('status', ['available', 'Available'])
      .order('inventory_number', { ascending: false, nullsFirst: false }),
    fetchSpotData(),
  ]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader adminBasePath={adminBasePath} active="in-store-sale" unreadMessagesCount={unreadMessagesCount ?? 0} userEmail={user.email} />
      <main className="px-4 md:px-8 py-8">
        <div className="ultrawide-page-medium max-w-[1200px] mx-auto">
          <div className="mb-6">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              Sales
            </p>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              In-Store Sale
            </h1>
            <p className="mt-2 text-sm max-w-2xl" style={{ color: 'var(--color-on-surface-variant)' }}>
              Take the card on Zettle, then record the sale here. This creates the order, marks a listed item sold and
              emails the receipt.
            </p>
          </div>
          <InStoreSaleForm
            adminBasePath={adminBasePath}
            products={(products ?? []) as unknown as InStoreProduct[]}
            spotData={spotData}
          />
        </div>
      </main>
    </div>
  );
}
