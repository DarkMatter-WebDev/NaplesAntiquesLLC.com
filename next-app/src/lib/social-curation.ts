import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import type { NormalizedRect } from '@/lib/instagram/backdrop';

export interface SocialCurationSource {
  image_selection: string[] | null;
  image_crops: Record<string, NormalizedRect> | null;
  card_source_url: string | null;
  card_background: string | null;
}

export interface SanitizedSocialCuration {
  imageSelection: string[] | null;
  imageCrops: Record<string, NormalizedRect> | null;
  cardSourceUrl: string | null;
  cardBackground: string | null;
  droppedImages: number;
}

/**
 * Revalidate saved social-photo choices against the product's current images.
 * This lets either channel safely reuse the other channel's curation even if
 * product photos were removed after the source setup was saved.
 */
export function sanitizeSocialCuration(
  source: SocialCurationSource,
  currentProductImageUrls: string[],
): SanitizedSocialCuration {
  const productImages = new Set(
    currentProductImageUrls
      .map((url) => normalizeLegacyLocalImageUrl(url))
      .filter(Boolean),
  );

  let imageSelection: string[] | null = null;
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
    imageSelection = kept.length ? kept : null;
  }

  let imageCrops: Record<string, NormalizedRect> | null = null;
  if (source.image_crops && typeof source.image_crops === 'object') {
    const allowed = imageSelection ? new Set(imageSelection) : productImages;
    const entries = Object.entries(source.image_crops).filter(
      ([rawUrl, rect]) => {
        const url = normalizeLegacyLocalImageUrl(rawUrl);
        return allowed.has(url) && rect && typeof rect === 'object';
      },
    ).map(([rawUrl, rect]) => [normalizeLegacyLocalImageUrl(rawUrl), rect] as const);
    imageCrops = Object.fromEntries(entries);
  }

  let cardSourceUrl: string | null = null;
  if (source.card_source_url) {
    const url = normalizeLegacyLocalImageUrl(String(source.card_source_url));
    cardSourceUrl = url && productImages.has(url) ? url : null;
  }

  const cardBackground =
    typeof source.card_background === 'string' && /^#[0-9a-f]{6}$/i.test(source.card_background)
      ? source.card_background.toLowerCase()
      : null;

  return {
    imageSelection,
    imageCrops,
    cardSourceUrl,
    cardBackground,
    droppedImages,
  };
}
