import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import type { Product } from '@/types/product';
import { getProductImages } from '@/lib/sales';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import { analyzeImage } from '@/lib/instagram/backdrop';
import { fetchImageBytes } from '@/lib/instagram/images';

export const runtime = 'nodejs';

/**
 * Propose a crop for one product image.
 *
 * Read-only: nothing is stored. The operator can accept the suggestion, adjust
 * it, or ignore it — saving happens through the images route.
 *
 * Although namespaced under /instagram/ for historical reasons, this endpoint
 * is channel-agnostic (it only analyzes a product photo's backdrop), and the
 * Facebook lineup editor calls it too via the shared InstagramCropEditor.
 *
 * The suggestion is only as good as the backdrop. On a cream sweep the box
 * frames everything that is not backdrop, which is already tight because the
 * piece is the only thing in frame. On a black sweep it frames only what is
 * more saturated than the background, which excludes the neutral velvet bust
 * the chains hang on — that is the case this exists for, since a bust-inclusive
 * box leaves a fine chain small in a lot of dead space.
 */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  const requestedUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : '';
  if (!productId || !requestedUrl) {
    return NextResponse.json(
      { error: 'A productId and imageUrl are required.' },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: product } = await service
    .from('products')
    .select('id, images, image_urls')
    .eq('id', productId)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  }

  // Only this product's own images may be analyzed, so the endpoint can never
  // be used to make the server fetch an arbitrary URL.
  const imageUrl = normalizeLegacyLocalImageUrl(requestedUrl);
  const owned = new Set(
    getProductImages(product as unknown as Product).map((url) => normalizeLegacyLocalImageUrl(url)),
  );
  if (!imageUrl || !owned.has(imageUrl)) {
    return NextResponse.json(
      { error: 'That image does not belong to this product.' },
      { status: 400 },
    );
  }

  try {
    const bytes = await fetchImageBytes(imageUrl);
    const { backdrop, mode, rect } = await analyzeImage(bytes);
    return NextResponse.json({
      rect,
      mode,
      backdrop: {
        rgb: backdrop.rgb,
        spread: backdrop.spread,
        uniform: backdrop.uniform,
        isDark: backdrop.isDark,
      },
      // Nothing detected, or a frame with no single backdrop to measure from.
      reason: rect
        ? null
        : backdrop.uniform
          ? 'Nothing stood out from the backdrop in this photo.'
          : 'This photo has no uniform studio backdrop, so an automatic crop would be a guess.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not analyze the image.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
