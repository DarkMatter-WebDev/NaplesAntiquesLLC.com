import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/product';
import { getProductImages } from '@/lib/sales';
import { sanitizeSocialCuration } from '@/lib/social-curation';
import type { SocialPublishChannel } from '@/lib/social-publish-both';
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

const LABELS: Record<SocialPublishChannel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
};

export class SocialCurationCopyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'SocialCurationCopyError';
  }
}

export interface SocialCurationCopyResult {
  copied: true;
  from: SocialPublishChannel;
  to: SocialPublishChannel;
  imageCount: number | null;
  cropCount: number;
  copiedCardSource: boolean;
  copiedCardBackground: boolean;
  droppedImages: number;
  message: string;
}

/**
 * Copy the complete saved photo setup from one social channel to the other.
 * The target is returned to pending and any staged platform uploads are
 * invalidated so its next Prepare always rebuilds the copied lineup.
 */
export async function copySocialCuration(
  service: SupabaseClient,
  productId: string,
  from: SocialPublishChannel,
): Promise<SocialCurationCopyResult> {
  const to: SocialPublishChannel = from === 'instagram' ? 'facebook' : 'instagram';
  const source = from === 'instagram'
    ? await getInstagramPost(service, productId)
    : await getFacebookPost(service, productId);
  if (!source) {
    throw new SocialCurationCopyError(
      `There is no ${LABELS[from]} setup for this product to copy yet.`,
      400,
    );
  }

  const target = to === 'instagram'
    ? await getInstagramPost(service, productId)
    : await getFacebookPost(service, productId);
  if (target?.sync_state === 'published') {
    throw new SocialCurationCopyError(
      `The ${LABELS[to]} post is already live - a published post's images are historical ` +
        'and cannot be changed. Remove that post first if it needs a different setup.',
      400,
    );
  }

  const { data: product } = await service
    .from('products')
    .select('id, images, image_urls')
    .eq('id', productId)
    .maybeSingle();
  if (!product) throw new SocialCurationCopyError('Product not found.', 404);

  const sanitized = sanitizeSocialCuration(
    source,
    getProductImages(product as unknown as Product),
  );
  const copied = {
    image_selection: sanitized.imageSelection,
    image_crops: sanitized.imageCrops,
    card_source_url: sanitized.cardSourceUrl,
    card_background: sanitized.cardBackground,
    sync_state: 'pending' as const,
  };

  try {
    if (to === 'instagram') {
      await upsertInstagramPost(service, productId, {
        ...copied,
        child_container_ids: [],
        carousel_container_id: null,
        container_expires_at: null,
      });
    } else {
      await upsertFacebookPost(service, productId, {
        ...copied,
        photo_ids: [],
        photos_expire_at: null,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not copy the setup.';
    if (/image_selection|image_crops|card_source_url|card_background/i.test(message)) {
      throw new SocialCurationCopyError(
        'A column this copy needs is missing - run the pending social SQL migrations ' +
          '(see project-docs/TASKS.md), then retry.',
        503,
      );
    }
    throw new SocialCurationCopyError(message, 500);
  }

  const cropCount = sanitized.imageCrops ? Object.keys(sanitized.imageCrops).length : 0;
  const parts = [
    sanitized.imageSelection
      ? `${sanitized.imageSelection.length} image(s)`
      : 'product image order',
    ...(cropCount ? [`${cropCount} crop(s)`] : []),
    ...(sanitized.cardSourceUrl ? ['card image'] : []),
    ...(sanitized.cardBackground ? ['card background'] : []),
  ];
  const note = sanitized.droppedImages
    ? ` ${sanitized.droppedImages} image(s) no longer on the product were skipped.`
    : '';
  const message =
    `Copied the ${LABELS[from]} setup to ${LABELS[to]} (${parts.join(', ')}).` + note;
  const log = {
    product_id: productId,
    action: 'image_lineup',
    outcome: 'ok' as const,
    message: `Setup copied from ${LABELS[from]}: ${parts.join(', ')}.${note}`,
  };
  if (to === 'instagram') await insertInstagramSyncLog(service, log);
  else await insertFacebookSyncLog(service, log);

  return {
    copied: true,
    from,
    to,
    imageCount: sanitized.imageSelection?.length ?? null,
    cropCount,
    copiedCardSource: Boolean(sanitized.cardSourceUrl),
    copiedCardBackground: Boolean(sanitized.cardBackground),
    droppedImages: sanitized.droppedImages,
    message,
  };
}
