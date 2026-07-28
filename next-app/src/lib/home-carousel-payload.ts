import type { CarouselItem, CarouselSettings } from '../../carousel/lib/carouselData';
import { DEFAULT_BG, DEFAULT_VISIBLE_COUNT } from '../../carousel/lib/carouselConfig';

export type HomeCarouselQueryResult = {
  items: CarouselItem[];
  settings: CarouselSettings;
};

export type HomeCarouselPayload = HomeCarouselQueryResult & {
  source: 'curated' | 'fallback';
};

export const HOME_CAROUSEL_FALLBACK_SETTINGS: CarouselSettings = {
  showPrice: false,
  bgColor: DEFAULT_BG,
  visibleCountDesktop: DEFAULT_VISIBLE_COUNT,
  visibleCountMobile: 4,
};

/**
 * Resolve the one carousel payload that will be rendered into the initial HTML.
 * A missing/empty server result uses local assets; the browser never swaps
 * between the two sources after hydration.
 */
export function resolveHomeCarouselPayload(
  result: HomeCarouselQueryResult | null,
  fallbackItems: CarouselItem[],
): HomeCarouselPayload {
  if (!result || result.items.length === 0) {
    return {
      items: fallbackItems,
      settings: result?.settings ?? HOME_CAROUSEL_FALLBACK_SETTINGS,
      source: 'fallback',
    };
  }

  return {
    ...result,
    source: 'curated',
  };
}
