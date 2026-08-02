import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import type { Product } from '@/types/product';
import { getProductImages } from '@/lib/sales';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import type { NormalizedRect } from '@/lib/instagram/backdrop';
import {
  getPost as getInstagramPost,
  upsertPost as upsertInstagramPost,
  insertSyncLog as insertInstagramSyncLog,
} from '@/lib/instagram/store';
import {
  getPost as getFacebookPost,
  upsertPost as upsertFacebookPost,
  insertSyncLog as insertFacebookSyncLog,
} from '@/lib/facebook/store';

export const runtime = 'nodejs';

/**
 * Copy one channel's saved curation — lineup order, exclusions, crops, card
 * source, and card background — onto the other channel for the same product.
 *
 * Exists because that state is deliberately stored per channel (separate
 * lineups mean one channel's re-prepare can never invalidate the other's
 * files), which otherwise forces the operator to curate everything twice when
 * they simply want both channels to post the same thing.
 *
 * The copy is verbatim including nulls: "copy" means "make the other channel
 * match this one", so a null lineup (product order) or null background (auto)
 * carries over as-is. Everything is re-validated against the product's CURRENT
 * images — the source was validated when saved, but photos may have been
 * removed since. Like a lineup save, the copy invalidates the target's
 * prepared renditions (back to 'pending'), so publishing always goes through a
 * fresh Prepare.
 */

type Channel = 'instagram' | 'facebook';
const LABELS: Record<Channel, string> = { instagram: 'Instagram', facebook: 'Facebook' };

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  const from = body?.from as Channel;
  if (!productId) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }
  if (from !== 'instagram' && from !== 'facebook') {
    return NextResponse.json({ error: 'from must be "instagram" or "facebook".' }, { status: 400 });
  }
  const to: Channel = from === 'instagram' ? 'facebook' : 'instagram';

  const service = createServiceClient();

  const source =
    from === 'instagram'
      ? await getInstagramPost(service, productId)
      : await getFacebookPost(service, productId);
  if (!source) {
    return NextResponse.json(
      { error: `There is no ${LABELS[from]} setup for this product to copy yet.` },
      { status: 400 },
    );
  }

  const target =
    to === 'instagram'
      ? await getInstagramPost(service, productId)
      : await getFacebookPost(service, productId);
  if (target?.sync_state === 'published') {
    return NextResponse.json(
      {
        error:
          `The ${LABELS[to]} post is already live — a published post's images are historical ` +
          'and cannot be changed. Remove that post first if it needs a different setup.',
      },
      { status: 400 },
    );
  }

  const { data: product } = await service
    .from('products')
    .select('id, images, image_urls')
    .eq('id', productId)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  }
  const productImages = new Set(
    getProductImages(product as unknown as Product).map((url) => normalizeLegacyLocalImageUrl(url)),
  );

  // Lineup: filter to images that still exist; an emptied-out selection falls
  // back to null (product order) rather than saving an unpublishable lineup.
  let selection: string[] | null = null;
  let droppedImages = 0;
  if (Array.isArray(source.image_selection)) {
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const raw of source.image_selection) {
      const url = normalizeLegacyLocalImageUrl(String(raw ?? ''));
      if (!url || seen.has(url)) continue;
      seen.add(url);
      if (productImages.has(url)) kept.push(url);
      else droppedImages += 1;
    }
    selection = kept.length ? kept : null;
  }

  // Crops ride along only for images that survive into the copied lineup
  // (or any product image when the lineup is product order) — the same
  // no-orphans rule the lineup-save routes enforce.
  let crops: Record<string, NormalizedRect> | null = null;
  if (source.image_crops && typeof source.image_crops === 'object') {
    const allowed = selection ? new Set(selection) : productImages;
    const entries = Object.entries(source.image_crops as Record<string, NormalizedRect>).filter(
      ([url, rect]) => allowed.has(url) && rect && typeof rect === 'object',
    );
    crops = Object.fromEntries(entries);
  }

  let cardSourceUrl: string | null = null;
  if (source.card_source_url) {
    const url = normalizeLegacyLocalImageUrl(String(source.card_source_url));
    cardSourceUrl = url && productImages.has(url) ? url : null;
  }

  const cardBackground =
    typeof source.card_background === 'string' && /^#[0-9a-f]{6}$/.test(source.card_background)
      ? source.card_background
      : null;

  const copied = {
    image_selection: selection,
    image_crops: crops,
    card_source_url: cardSourceUrl,
    card_background: cardBackground,
    sync_state: 'pending' as const,
  };

  try {
    if (to === 'instagram') {
      await upsertInstagramPost(service, productId, {
        ...copied,
        // Same invalidation as an Instagram lineup save: staged containers are
        // for the old images.
        child_container_ids: [],
        carousel_container_id: null,
        container_expires_at: null,
      });
    } else {
      await upsertFacebookPost(service, productId, {
        ...copied,
        // Same invalidation as a Facebook lineup save.
        photo_ids: [],
        photos_expire_at: null,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not copy the setup.';
    if (/image_selection|image_crops|card_source_url|card_background/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'A column this copy needs is missing — run the pending social SQL migrations ' +
            '(see project-docs/TASKS.md), then retry.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const cropCount = crops ? Object.keys(crops).length : 0;
  const parts = [
    selection ? `${selection.length} image(s)` : 'product image order',
    ...(cropCount ? [`${cropCount} crop(s)`] : []),
    ...(cardSourceUrl ? ['card image'] : []),
    ...(cardBackground ? ['card background'] : []),
  ];
  const note = droppedImages
    ? ` ${droppedImages} image(s) no longer on the product were skipped.`
    : '';
  const message =
    `Copied the ${LABELS[from]} setup to ${LABELS[to]} (${parts.join(', ')}).` +
    `${note} Open Manage ${LABELS[to]} and Prepare to rebuild its slides.`;

  const log = {
    product_id: productId,
    action: 'image_lineup',
    outcome: 'ok' as const,
    message: `Setup copied from ${LABELS[from]}: ${parts.join(', ')}.${note}`,
  };
  if (to === 'instagram') await insertInstagramSyncLog(service, log);
  else await insertFacebookSyncLog(service, log);

  return NextResponse.json({ copied: true, message });
}
