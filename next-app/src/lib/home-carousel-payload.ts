import type { CarouselItem, CarouselSettings } from '../../carousel/lib/carouselData';
import { DEFAULT_BG, DEFAULT_VISIBLE_COUNT } from '../../carousel/lib/carouselConfig';

export type HomeCarouselQueryResult = {
  items: CarouselItem[];
  /**
   * Curated lineup for the SECOND slideshow revealed by the scroll parallax.
   * Empty (unmigrated table, no curation yet, or fallback) means the second
   * slideshow reuses `items`.
   */
  altItems: CarouselItem[];
  /** Same contract as `altItems`, for the THIRD slideshow. */
  thirdItems: CarouselItem[];
  settings: CarouselSettings;
};

export type HomeCarouselPayload = HomeCarouselQueryResult & {
  source: 'curated' | 'fallback';
};

export const HOME_CAROUSEL_FALLBACK_SETTINGS: CarouselSettings = {
  showPrice: false,
  bgColor: DEFAULT_BG,
  bgColorAlt: DEFAULT_BG,
  bgColorThird: DEFAULT_BG,
  visibleCountDesktop: DEFAULT_VISIBLE_COUNT,
  visibleCountMobile: 4,
  selectionModePrimary: 'manual',
  selectionModeAlt: 'manual',
  selectionModeThird: 'manual',
};

/**
 * Resolve the one carousel payload that will be rendered into the initial HTML.
 * A missing/empty server result uses local assets; the browser never swaps
 * between the two sources after hydration. The later lineups never have their
 * own fallback assets: when the primary is falling back, the second and third
 * slideshows mirror it (their item lists stay empty).
 */
export function resolveHomeCarouselPayload(
  result: HomeCarouselQueryResult | null,
  fallbackItems: CarouselItem[],
): HomeCarouselPayload {
  if (!result || result.items.length === 0) {
    return {
      items: fallbackItems,
      altItems: [],
      thirdItems: [],
      settings: result?.settings ?? HOME_CAROUSEL_FALLBACK_SETTINGS,
      source: 'fallback',
    };
  }

  return {
    ...result,
    source: 'curated',
  };
}
