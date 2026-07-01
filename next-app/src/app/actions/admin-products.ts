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
export async function adminRevalidateProduct(id: string): Promise<void> {
  revalidateTag('shop-catalog', 'max');
  // localePrefix is 'as-needed': default locale (en) has no prefix.
  revalidatePath(`/shop/${id}`);
  revalidatePath(`/es/shop/${id}`);
}
