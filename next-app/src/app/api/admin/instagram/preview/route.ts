import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { buildInstagramPost, resolveImageLineup } from '@/lib/instagram/mapping';
import { getConnection, getPost } from '@/lib/instagram/store';
import { getLineupSquareImageFraming, isCardRenditionPath } from '@/lib/instagram/images';
import { getProductImages } from '@/lib/sales';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import {
  extractSocialCaptionOpening,
  fallbackSocialCaptionOpening,
  generateSocialCaptionOpening,
  getPreparedSocialCaption,
  normalizeSocialCaptionDirection,
  validateEditedSocialCaptionOpening,
} from '@/lib/social-caption-opening';

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
  const requestedOpening = typeof body?.captionOpening === 'string' ? body.captionOpening : undefined;
  const generateOpening = body?.generateCaptionOpening === true;
  const requestedDirection = typeof body?.captionOpeningDirection === 'string'
    ? body.captionOpeningDirection
    : '';
  const captionDirection = normalizeSocialCaptionDirection(requestedDirection);
  if (!productId) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }
  if (requestedDirection.trim() && !captionDirection) {
    return NextResponse.json({ error: 'AI direction must be 400 characters or fewer.' }, { status: 400 });
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
  const typedProduct = product as Product;
  const storedPreparedCaption = getPreparedSocialCaption(
    existing?.posted_caption,
    existing?.rendition_paths,
  );
  const hasPreparedCaption = Boolean(storedPreparedCaption);
  const storedReviewOpening = storedPreparedCaption
    ? extractSocialCaptionOpening(storedPreparedCaption, typedProduct)
    : null;
  const fallbackOpening = fallbackSocialCaptionOpening(typedProduct);
  const editedOpening = requestedOpening === undefined
    ? null
    : validateEditedSocialCaptionOpening(requestedOpening, typedProduct);
  if (requestedOpening !== undefined && !editedOpening) {
    return NextResponse.json({
      error: 'The opening must be one short sentence without “our,” links, hashtags, inventory numbers, quotes, or an unavailable-item claim.',
    }, { status: 400 });
  }
  const opening = generateOpening
    ? await generateSocialCaptionOpening(typedProduct, captionDirection)
    : {
        opening: editedOpening ?? storedReviewOpening ?? fallbackOpening,
        warning: null,
        generatedByAi: false,
      };

  const post = buildInstagramPost({
    product: typedProduct,
    spotData,
    captionOpening: opening.opening,
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
    productImages: getProductImages(typedProduct)
      .map((url) => normalizeLegacyLocalImageUrl(url))
      .filter((url): url is string => Boolean(url)),
    selection: existing?.image_selection ?? null,
  });
  // This is deliberately calculated with the same post-crop image pipeline as
  // Prepare. The editable lineup must reveal any letterboxing and its sampled
  // canvas colour before the owner commits the upload.
  const imageFraming = await getLineupSquareImageFraming(lineup, existing?.image_crops);

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
    imageFraming,
    notIncluded,
    hasCustomLineup: Boolean(existing?.image_selection?.length),
    crops: existing?.image_crops ?? {},
    cardSourceUrl: existing?.card_source_url ?? null,
    cardBackground: existing?.card_background ?? null,
    // Every carousel leads with a card. This is the copy it will carry; the
    // rendered card itself is renditionUrls[0] after a Prepare.
    cardContent: post.cardContent,
    // A prepared review always displays the exact stored text that Publish
    // will use. Before Prepare, the generated opener is passed back by the UI
    // so the reviewed sentence becomes the stored sentence byte-for-byte.
    caption: storedPreparedCaption
      && !generateOpening && requestedOpening === undefined
      ? storedPreparedCaption
      : post.caption,
    captionLength: (storedPreparedCaption
      && !generateOpening && requestedOpening === undefined
      ? storedPreparedCaption
      : post.caption).length,
    captionOpening: opening.opening,
    captionOpeningGeneratedByAi: opening.generatedByAi,
    captionOpeningIsDefault: opening.opening === fallbackOpening,
    captionOpeningPrepared: hasPreparedCaption
      && Boolean(storedPreparedCaption)
      && storedReviewOpening === opening.opening,
    imageCount: post.imageUrls.length,
    imageUrls: post.imageUrls,
    altText: post.altText,
    quotedPrice: post.quotedPrice,
    warnings: opening.warning ? [opening.warning, ...post.warnings] : post.warnings,
    blockedReason: post.blockedReason,
    spotSource: spotData?.source ?? null,
    current: existing
      ? {
          syncState: existing.sync_state,
          permalink: existing.permalink,
          postedAt: existing.posted_at,
          queuedAt: existing.queued_at,
          scheduledFor: existing.scheduled_for,
        }
      : null,
  });
}
