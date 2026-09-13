import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { scheduleProductStatusHooks } from '@/lib/product-status-hooks';
import { normalizeProductFieldEdits, type ProductFieldEditSource } from '@/lib/product-field-edits';

export const runtime = 'nodejs';

/**
 * Save a handful of product fields from the marketplace review window
 * (`SelectedMarketplaceReviewFlow`): the admin corrects a length, brand,
 * year, weight, stone, chain type, purity, metal colour, type or quantity
 * right before submitting to Etsy/eBay, and the next preflight reads the
 * corrected row. Allow-listed and normalized by `normalizeProductFieldEdits`.
 *
 * Writes the PRODUCT row (source of truth), then does what every other admin
 * product write does: bust the shop cache and schedule the marketplace
 * out-of-date scan (`lib/product-status-hooks.ts`) — the same chokepoint as
 * `adminRevalidateProduct`, called directly here because this is a route
 * handler, not a server action.
 */
export async function PUT(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : null;
  if (!productId) return NextResponse.json({ error: 'Missing productId.' }, { status: 400 });
  const edits = body?.fields && typeof body.fields === 'object' && !Array.isArray(body.fields) ? body.fields : null;
  if (!edits) return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });

  const service = createServiceClient();
  const { data: current, error: readError } = await service
    .from('products')
    .select('category, metal_variant, product_type, jewelry_type, chain_type, length, tags')
    .eq('id', productId)
    .maybeSingle();
  if (readError || !current) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

  const result = normalizeProductFieldEdits(current as ProductFieldEditSource, edits);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const { error: writeError } = await service.from('products').update(result.patch).eq('id', productId);
  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

  revalidateTag('shop-catalog', { expire: 0 });
  revalidatePath(`/shop/${productId}`);
  revalidatePath(`/es/shop/${productId}`);
  scheduleProductStatusHooks([productId], { scanOutOfDate: true });

  return NextResponse.json({ success: true, patch: result.patch });
}
