import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { buildInstagramPost, resolveImageLineup } from '@/lib/instagram/mapping';
import { getConnection, getPost } from '@/lib/instagram/store';
import { isCardRenditionPath } from '@/lib/instagram/images';
import { getProductImages } from '@/lib/sales';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';

export const runtime = 'nodejs';

/**
 * Byte-for-byte preview of the caption that would be published, plus any
 * blocking reason or warning. Read-only: nothing is uploaded or sent to
 * Instagram. This is the review surface that makes review-first meaningful,
 * and it matters more here than for Etsy/eBay because captions cannot be
 * edited after publishing.
 */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  if (!productId) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: product } = await service
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  }

  const connection = await getConnection(service);
  const spotData = await fetchSpotData();
  const existing = await getPost(service, productId);

  const post = buildInstagramPost({
    product: product as Product,
    spotData,
    imageSelection: existing?.image_selection ?? null,
    settings: {
      includePrice: connection?.caption_include_price ?? true,
      spanishLine: connection?.caption_spanish_line ?? true,
      cta: connection?.caption_cta ?? undefined,
      baseHashtags: connection?.base_hashtags?.length ? connection.base_hashtags : undefined,
    },
  });

  // Everything the lineup editor needs: what is in the carousel, in order, and
  // which of the product's other photos could be added back.
  const { lineup, notIncluded } = resolveImageLineup({
    productImages: getProductImages(product as unknown as Product)
      .map((url) => normalizeLegacyLocalImageUrl(url))
      .filter((url): url is string => Boolean(url)),
    selection: existing?.image_selection ?? null,
  });

  // Once prepared, show the actual square JPEG renditions Instagram will fetch
  // rather than the WebP source images — the review screen should show exactly
  // what gets posted, including the white padding.
  const renditionUrls = (existing?.rendition_paths ?? []).map((path) => {
    const { data } = service.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  });
  // Derived from the object name rather than assumed from position: a card
  // render can fail without failing the post, in which case slide 0 is an
  // ordinary photo and must not be labelled as the card.
  const renditionIsCard = (existing?.rendition_paths ?? []).map(isCardRenditionPath);

  return NextResponse.json({
    renditionUrls,
    renditionIsCard,
    lineup,
    notIncluded,
    hasCustomLineup: Boolean(existing?.image_selection?.length),
    crops: existing?.image_crops ?? {},
    cardSourceUrl: existing?.card_source_url ?? null,
    cardBackground: existing?.card_background ?? null,
    // Every carousel leads with a card. This is the copy it will carry; the
    // rendered card itself is renditionUrls[0] after a Prepare.
    cardContent: post.cardContent,
    caption: post.caption,
    captionLength: post.caption.length,
    imageCount: post.imageUrls.length,
    imageUrls: post.imageUrls,
    altText: post.altText,
    quotedPrice: post.quotedPrice,
    warnings: post.warnings,
    blockedReason: post.blockedReason,
    spotSource: spotData?.source ?? null,
    current: existing
      ? {
          syncState: existing.sync_state,
          permalink: existing.permalink,
          postedAt: existing.posted_at,
          queuedAt: existing.queued_at,
        }
      : null,
  });
}
