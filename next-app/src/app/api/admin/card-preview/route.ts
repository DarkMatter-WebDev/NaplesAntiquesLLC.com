import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import type { Product } from '@/types/product';
import { fetchSpotData } from '@/lib/spot-price';
import { getProductImages } from '@/lib/sales';
import { getProductPriceValue } from '@/lib/pricing';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import { buildCardSpecs, formatCaptionPrice, formatSpotBasis } from '@/lib/instagram/mapping';
import { renderInstagramCard } from '@/lib/instagram/card';
import { fetchImageBytes } from '@/lib/instagram/images';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Render the generated lead card on demand, from any of a product's images.
 *
 * Channel-agnostic on purpose (the card design is identical on Instagram and
 * Facebook) and READ-ONLY: nothing is stored, nothing touches Storage, and no
 * post state changes. This backs the panels' "Generate card" button so the
 * admin can see exactly what a chosen source image produces before committing
 * it with Save lineup + Prepare.
 *
 * Responds with the JPEG bytes directly — the panel object-URLs them into an
 * <img>. The preview quotes the current resolvable price; the price that
 * actually publishes is still resolved at Prepare time under each channel's
 * own settings.
 */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  const requestedUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : '';
  if (!productId) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }
  let background: string | null = null;
  if (body?.background != null) {
    const hex = String(body.background).trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(hex)) {
      return NextResponse.json(
        { error: 'The card background must be a hex colour like #ffffff.' },
        { status: 400 },
      );
    }
    background = hex;
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

  // Only this product's own images may be rendered, so the endpoint can never
  // be used to make the server fetch an arbitrary URL.
  const productImages = getProductImages(product as unknown as Product)
    .map((url) => normalizeLegacyLocalImageUrl(url))
    .filter((url): url is string => Boolean(url));
  const imageUrl = requestedUrl
    ? normalizeLegacyLocalImageUrl(requestedUrl)
    : productImages[0] ?? null;
  if (!imageUrl || !productImages.includes(imageUrl)) {
    return NextResponse.json(
      { error: 'That image does not belong to this product.' },
      { status: 400 },
    );
  }

  try {
    const spotData = await fetchSpotData();
    const price = getProductPriceValue(product as Product, spotData);

    const spotBasis = formatSpotBasis(product as Product, spotData);
    const source = await fetchImageBytes(imageUrl);
    const { jpeg } = await renderInstagramCard({
      source,
      background,
      content: {
        title: String((product as Product).title ?? '').trim(),
        price: price != null && price > 0 ? formatCaptionPrice(price) : null,
        specs: buildCardSpecs(product as Product),
        priceNote:
          price != null && price > 0
            ? `Price at time of posting${spotBasis ? ` · ${spotBasis}` : ''}`
            : null,
      },
    });

    return new NextResponse(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        // Ephemeral by design: the admin iterates on source images, and a
        // cached stale card would misrepresent what Prepare will build.
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not render the card.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
