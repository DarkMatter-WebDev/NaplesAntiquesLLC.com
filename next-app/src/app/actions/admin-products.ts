'use server';

import { revalidateTag, revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/admin-auth';
import { scheduleProductStatusHooks } from '@/lib/product-status-hooks';
import { normalizeProductStatus, type Product, type ProductStatus } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { getProductPriceValue } from '@/lib/pricing';
import {
  ADMIN_PRODUCT_SUMMARY_COLUMNS_WITHOUT_SOLD_PRICE,
  toAdminProductSummary,
} from '@/lib/admin-product-summary';

function isMissingSoldPriceColumnError(error: { message?: string | null } | null | undefined) {
  return Boolean(error?.message?.toLowerCase().includes('sold_price'));
}

function validPrice(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round((parsed + Number.EPSILON) * 100) / 100
    : null;
}

export async function adminUpdateProductsStatus(
  ids: string[],
  status: ProductStatus,
  soldPricesByProductId: Record<string, number> = {},
): Promise<{ success?: true; error?: string; soldPrices?: Record<string, number | null> }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: 'Admin access required.' };

  const productIds = Array.from(new Set(ids.filter(Boolean)));
  if (productIds.length === 0) return { success: true };

  const service = createServiceClient();
  const normalizedStatus = normalizeProductStatus(status);
  const appliedSoldPrices: Record<string, number | null> = {};

  if (normalizedStatus === 'sold') {
    const [{ data, error: productsError }, spotData] = await Promise.all([
      service.from('products').select('*').in('id', productIds),
      fetchSpotData(),
    ]);
    if (productsError) return { error: productsError.message };

    const pendingUpdates: { product: Product; soldPrice: number | null }[] = [];
    for (const product of (data ?? []) as Product[]) {
      const suppliedSoldPrice = validPrice(soldPricesByProductId[product.id]);
      const existingSoldPrice = validPrice(product.sold_price);
      if (
        suppliedSoldPrice == null
        && existingSoldPrice == null
        && product.price_mode === 'spot-multiplier'
        && spotData.source === 'fallback'
      ) {
        return { error: `Live metal pricing is unavailable, so ${product.title} cannot be marked Sold with a reliable locked price.` };
      }
      const soldPrice = suppliedSoldPrice ?? validPrice(getProductPriceValue(product, spotData));
      pendingUpdates.push({ product, soldPrice });
    }

    for (const { product, soldPrice } of pendingUpdates) {
      const updates = soldPrice == null ? { status } : { status, sold_price: soldPrice };
      let { error } = await service.from('products').update(updates).eq('id', product.id);
      if (isMissingSoldPriceColumnError(error)) {
        const fallback = await service.from('products').update({ status }).eq('id', product.id);
        error = fallback.error;
      }
      if (error) return { error: error.message };
      if (soldPrice != null) appliedSoldPrices[product.id] = soldPrice;
    }
  } else {
    const updates = normalizedStatus === 'available'
      ? { status, sold_price: null }
      : { status };
    let { error } = await service.from('products').update(updates).in('id', productIds);
    if (isMissingSoldPriceColumnError(error)) {
      const fallback = await service.from('products').update({ status }).in('id', productIds);
      error = fallback.error;
    }
    if (error) return { error: error.message };
    if (normalizedStatus === 'available') {
      for (const id of productIds) appliedSoldPrices[id] = null;
    }
  }

  await adminRevalidateProducts(productIds);
  return { success: true, soldPrices: appliedSoldPrices };
}

export async function adminUpdateProductStatus(
  id: string,
  status: ProductStatus,
): Promise<{ success?: true; error?: string; soldPrices?: Record<string, number | null> }> {
  return adminUpdateProductsStatus([id], status);
}

export async function adminGetProduct(
  id: string,
): Promise<{ product?: Product; error?: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: 'Admin access required.' };

  const { data, error } = await createServiceClient()
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return { error: error?.message ?? 'Product not found.' };
  return { product: data as Product };
}

export async function adminGetManualOrderProducts(): Promise<{
  products?: Product[];
  spotData?: Awaited<ReturnType<typeof fetchSpotData>>;
  error?: string;
}> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: 'Admin access required.' };

  const service = createServiceClient();
  const legacyColumns = ADMIN_PRODUCT_SUMMARY_COLUMNS_WITHOUT_SOLD_PRICE
    .split(', ')
    .filter((column) => column !== 'item_year' && column !== 'quantity')
    .join(', ');
  const [initialProductsResult, spotData] = await Promise.all([
    service
      .from('products')
      .select(ADMIN_PRODUCT_SUMMARY_COLUMNS_WITHOUT_SOLD_PRICE)
      .order('sort_order', { ascending: true }),
    fetchSpotData(),
  ]);
  const productsResult = initialProductsResult.error && /item_year|quantity/i.test(initialProductsResult.error.message)
    ? await service.from('products').select(legacyColumns).order('sort_order', { ascending: true })
    : initialProductsResult;

  if (productsResult.error) return { error: productsResult.error.message };
  return {
    products: (productsResult.data ?? []).map((product) => toAdminProductSummary(product as unknown as Partial<Product>)),
    spotData,
  };
}

/**
 * Purge all Next.js caches that reference a product: the shop gallery (tag) and
 * both locale variants of the individual product page (path). Call this after any
 * admin write that should be immediately visible in the public-facing shop.
 */
/** Bulk variant of adminRevalidateProduct for order flows that flip several
 *  products at once (cancel/reopen/mark-paid/delete-order). One tag purge
 *  refreshes the gallery; per-product paths refresh the detail pages. */
export async function adminRevalidateProducts(ids: string[]): Promise<void> {
  // Gate: these are 'use server' actions whose ids ship in public JS bundles, so
  // any visitor could POST them to thrash the shop cache. Fail silently for non-admins.
  const { error: authError } = await requireAdmin();
  if (authError) return;

  revalidateTag('shop-catalog', { expire: 0 });
  for (const id of ids) {
    revalidatePath(`/shop/${id}`);
    revalidatePath(`/es/shop/${id}`);
  }
  // Phase 2: auto-delist/relist piggybacks on this existing chokepoint (every
  // products-write path already calls this) rather than a new "where do
  // status changes happen" audit — see etsy-sync-plan/03-sync-lifecycle.md
  // Flow 3 and ebay-sync-plan/03-sync-lifecycle.md Flow 3.
  //
  // `scanOutOfDate` is on here and off in the PayPal paths: an admin write can
  // change a listing's CONTENT (price, copy, photos), a sale only changes its
  // status. Scoped to these ids, so a single-product save stays cheap instead
  // of re-hashing the whole catalog.
  //
  // ⛔ These were six bare `void promise.catch(() => {})` calls until
  // 2026-08-21, and that dropped ~1 sale in 20 on Netlify. See
  // lib/product-status-hooks.ts.
  scheduleProductStatusHooks(ids, { scanOutOfDate: true });
}

export async function adminRevalidateProduct(id: string): Promise<void> {
  const { error: authError } = await requireAdmin();
  if (authError) return;

  // { expire: 0 } forces immediate expiration — 'max' uses stale-while-revalidate,
  // which would show the old status once more before ever refreshing.
  revalidateTag('shop-catalog', { expire: 0 });
  // localePrefix is 'as-needed': default locale (en) has no prefix.
  revalidatePath(`/shop/${id}`);
  revalidatePath(`/es/shop/${id}`);
  scheduleProductStatusHooks([id], { scanOutOfDate: true });
}
