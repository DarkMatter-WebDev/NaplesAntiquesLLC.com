'use server';

import { revalidateTag, revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/admin-auth';
import type { ProductStatus } from '@/types/product';

export async function adminUpdateProductStatus(
  id: string,
  status: ProductStatus,
): Promise<{ success?: true; error?: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: 'Admin access required.' };

  const service = createServiceClient();
  const { error } = await service.from('products').update({ status }).eq('id', id);
  if (error) return { error: error.message };

  await adminRevalidateProduct(id);
  return { success: true };
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
}
