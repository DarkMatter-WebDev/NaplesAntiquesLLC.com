import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import OrdersPanel from '@/components/admin/OrdersPanel';
import AdminHeader from '@/components/admin/AdminHeader';
import type { Order } from '@/types/sales';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';

export const metadata: Metadata = { title: 'Admin - Orders' };

const ORDER_LIST_COLUMNS = [
  'id',
  'order_number',
  'user_id',
  'customer_name',
  'customer_email',
  'customer_phone',
  'subtotal',
  'tax',
  'shipping_fee',
  'discount',
  'total',
  'payment_status',
  'fulfillment_status',
  'order_status',
  'payment_method',
  'payment_reference',
  'shipping_method',
  'shipping_address',
  'billing_address',
  'internal_notes',
  'customer_notes',
  'created_at',
  'updated_at',
  'order_items(id, order_id, product_id, inventory_number, title_snapshot, item_year_snapshot, metal_snapshot, purity_snapshot, gram_weight_snapshot, price_snapshot, discount, image_snapshot, created_at)',
].join(', ');
const ORDER_LIST_COLUMNS_WITHOUT_ITEM_YEAR_SNAPSHOT = ORDER_LIST_COLUMNS.replace('item_year_snapshot, ', '');

const ORDER_PRODUCT_COLUMNS = [
  'id',
  'category',
  'metal_type',
  'metal_variant',
  'title',
  'title_es',
  'item_year',
  'price_mode',
  'purity',
  'weight_grams',
  'inventory_number',
  'sku',
  'gram_weight',
  'pricing_multiplier',
  'status',
  'images',
  'image_urls',
  'manual_price_label',
  'asking_price',
].join(', ');
const ORDER_PRODUCT_COLUMNS_WITHOUT_ITEM_YEAR = ORDER_PRODUCT_COLUMNS
  .split(', ')
  .filter((column) => column !== 'item_year')
  .join(', ');

function isMissingItemYearColumnError(error: { message?: string | null } | null | undefined) {
  return Boolean(error?.message?.toLowerCase().includes('item_year'));
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AdminOrdersPage({ params }: Props) {
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

  const [ordersResult, productsResult, spotData, { count: unreadMessagesCount }] = await Promise.all([
    supabase
      .from('orders')
      .select(ORDER_LIST_COLUMNS)
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select(ORDER_PRODUCT_COLUMNS)
      .order('sort_order', { ascending: true }),
    fetchSpotData(),
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ]);
  let orders = ordersResult.data;
  let products: unknown[] | null = productsResult.data as unknown[] | null;
  if (isMissingItemYearColumnError(ordersResult.error)) {
    const fallback = await supabase
      .from('orders')
      .select(ORDER_LIST_COLUMNS_WITHOUT_ITEM_YEAR_SNAPSHOT)
      .order('created_at', { ascending: false });
    orders = fallback.data;
  }
  if (isMissingItemYearColumnError(productsResult.error)) {
    const fallback = await supabase
      .from('products')
      .select(ORDER_PRODUCT_COLUMNS_WITHOUT_ITEM_YEAR)
      .order('sort_order', { ascending: true });
    products = (fallback.data as unknown[] | null)?.map((product) => ({ ...(product as Record<string, unknown>), item_year: null })) ?? null;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #fafaf8)' }}>
      <AdminHeader
        adminBasePath={adminBasePath}
        active="orders"
        unreadMessagesCount={unreadMessagesCount ?? 0}
        userEmail={user.email}
      />

      <OrdersPanel
        initialOrders={(orders ?? []) as unknown as Order[]}
        products={(products ?? []) as unknown as Product[]}
        spotData={spotData}
        locale={locale}
      />
    </div>
  );
}
