import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { getSiteUrl } from '@/lib/order-email-branding';
import { buildFacebookPost } from '@/lib/facebook/mapping';
import { resolveImageLineup } from '@/lib/instagram/mapping';
import { getConnection, getPost } from '@/lib/facebook/store';
import { isCardRenditionPath } from '@/lib/facebook/images';
import { getProductImages } from '@/lib/sales';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';

export const runtime = 'nodejs';

/**
 * Byte-for-byte preview of the post text that would be published, plus any
 * blocking reason or warning. Read-only: nothing is uploaded or sent to
 * Facebook. Facebook posts CAN be edited after the fact, but review-first is
 * still the policy — publishing is a public act either way.
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

  const post = buildFacebookPost({
    product: product as Product,
    spotData,
    siteUrl: getSiteUrl(),
    imageSelection: existing?.image_selection ?? null,
    settings: {
      includePrice: connection?.caption_include_price ?? true,
      spanishLine: connection?.caption_spanish_line ?? true,
      cta: connection?.caption_cta ?? undefined,
      baseHashtags: connection?.base_hashtags?.length ? connection.base_hashtags : undefined,
    },
  });

  // Everything the lineup editor needs: what is in the post, in order, and
  // which of the product's other photos could be added back.
  const { lineup, notIncluded } = resolveImageLineup({
    productImages: getProductImages(product as unknown as Product)
      .map((url) => normalizeLegacyLocalImageUrl(url))
      .filter((url): url is string => Boolean(url)),
    selection: existing?.image_selection ?? null,
  });

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
    cardContent: post.cardContent,
    message: post.message,
    messageLength: post.message.length,
    imageCount: post.imageUrls.length,
    imageUrls: post.imageUrls,
    productUrl: post.productUrl,
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
