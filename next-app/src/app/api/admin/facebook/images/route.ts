import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import type { Product } from '@/types/product';
import { getProductImages } from '@/lib/sales';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import { FACEBOOK_MAX_PHOTO_ITEMS } from '@/lib/facebook/client';
import { getPost, insertSyncLog, upsertPost } from '@/lib/facebook/store';
import type { NormalizedRect } from '@/lib/instagram/backdrop';

export const runtime = 'nodejs';

/**
 * Save the operator's Facebook-only image lineup for a product: which photos
 * appear in the post, in what order, and how each is cropped. Mirrors the
 * Instagram images route; the two lineups are stored independently so curating
 * one channel never disturbs the other (or the storefront/Etsy/eBay order).
 *
 * Saving invalidates any prepared renditions: the images changed, so the post
 * drops back to needing a fresh Prepare before it can be published.
 */

/** Coerce one crop rect from an untrusted payload (same rules as Instagram's). */
function parseCropRect(value: unknown): NormalizedRect | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const nums = (['x', 'y', 'w', 'h'] as const).map((key) => Number(raw[key]));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [x, y, w, h] = nums;
  if (w <= 0 || h <= 0) return null;
  if (x < 0 || y < 0 || x + w > 1.0001 || y + h > 1.0001) return null;
  if (w * h < 0.0001) return null;
  if (x <= 0.0001 && y <= 0.0001 && w >= 0.9999 && h >= 0.9999) return null;
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  if (!productId) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }
  if (!Array.isArray(body?.imageUrls)) {
    return NextResponse.json({ error: 'imageUrls must be an array.' }, { status: 400 });
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

  // Only images that genuinely belong to this product may be selected, so a
  // tampered or stale payload can never point Facebook at an arbitrary URL.
  const productImages = new Set(
    getProductImages(product as unknown as Product).map((url) => normalizeLegacyLocalImageUrl(url)),
  );

  const seen = new Set<string>();
  const selection: string[] = [];
  for (const raw of body.imageUrls as unknown[]) {
    const url = normalizeLegacyLocalImageUrl(String(raw ?? ''));
    if (!url || seen.has(url) || !productImages.has(url)) continue;
    seen.add(url);
    selection.push(url);
  }

  if (selection.length === 0) {
    return NextResponse.json(
      { error: 'Keep at least one image in the lineup.' },
      { status: 400 },
    );
  }
  if (selection.length > FACEBOOK_MAX_PHOTO_ITEMS) {
    return NextResponse.json(
      {
        error:
          `The generated card leads every post, so keep at most ${FACEBOOK_MAX_PHOTO_ITEMS} photos.`,
      },
      { status: 400 },
    );
  }

  let crops: Record<string, NormalizedRect> | null = null;
  if (body?.crops && typeof body.crops === 'object') {
    const entries: Array<[string, NormalizedRect]> = [];
    for (const [rawUrl, rawRect] of Object.entries(body.crops as Record<string, unknown>)) {
      const url = normalizeLegacyLocalImageUrl(String(rawUrl ?? ''));
      if (!url || !seen.has(url)) continue;
      const rect = parseCropRect(rawRect);
      if (rect) entries.push([url, rect]);
    }
    crops = entries.length ? Object.fromEntries(entries) : {};
  }

  // Optional card source: a URL to set, null to clear, omitted to leave
  // unchanged. Same contract as the Instagram images route.
  const cardSourceProvided = body !== null && typeof body === 'object' && 'cardSourceUrl' in body;
  let cardSourceUrl: string | null = null;
  if (cardSourceProvided && body.cardSourceUrl != null) {
    const url = normalizeLegacyLocalImageUrl(String(body.cardSourceUrl));
    if (!url || !productImages.has(url)) {
      return NextResponse.json(
        { error: 'That card image does not belong to this product.' },
        { status: 400 },
      );
    }
    cardSourceUrl = url;
  }

  // Optional card background: a hex to set, null for auto, omitted to leave
  // unchanged.
  const cardBgProvided = body !== null && typeof body === 'object' && 'cardBackground' in body;
  let cardBackground: string | null = null;
  if (cardBgProvided && body.cardBackground != null) {
    const hex = String(body.cardBackground).trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(hex)) {
      return NextResponse.json(
        { error: 'The card background must be a hex colour like #ffffff.' },
        { status: 400 },
      );
    }
    cardBackground = hex;
  }

  const existing = await getPost(service, productId);
  const nextState =
    existing?.sync_state === 'published' ? existing.sync_state : 'pending';

  try {
    await upsertPost(service, productId, {
      image_selection: selection,
      ...(crops ? { image_crops: crops } : {}),
      ...(cardSourceProvided ? { card_source_url: cardSourceUrl } : {}),
      ...(cardBgProvided ? { card_background: cardBackground } : {}),
      sync_state: nextState,
      photo_ids: [],
      photos_expire_at: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save the image lineup.';
    if (/card_background/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Run supabase/social-card-background-2026-08.sql in the Supabase SQL Editor to enable choosing the card background.',
        },
        { status: 503 },
      );
    }
    if (/card_source_url/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Run supabase/social-card-source-2026-08.sql in the Supabase SQL Editor to enable choosing the card image.',
        },
        { status: 503 },
      );
    }
    if (/facebook_posts/i.test(message) || /relation .* does not exist/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Run supabase/facebook-sync.sql in the Supabase SQL Editor to enable Facebook posting.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const croppedCount = crops ? Object.keys(crops).length : 0;
  await insertSyncLog(service, {
    product_id: productId,
    action: 'image_lineup',
    outcome: 'ok',
    message:
      `Facebook image lineup set to ${selection.length} image(s)` +
      (croppedCount ? `, ${croppedCount} cropped.` : '.'),
  });

  return NextResponse.json({ imageUrls: selection, crops: crops ?? undefined, syncState: nextState });
}
