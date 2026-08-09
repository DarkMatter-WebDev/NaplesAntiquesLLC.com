/**
 * Carousel dot indicators for shop gallery cards.
 *
 * A dot per photo is only workable while the photos are few. Cards run 3-12
 * images today and the upload path allows 20, against a 166px card on a 375px
 * phone — twenty dots plus gaps do not fit, and shrinking them all to fit turns
 * the row into specks. So the row is WINDOWED: at most `maxVisible` dots are
 * rendered, centred on the active photo, and the outermost dot on any side that
 * still has photos beyond it is drawn smaller. That taper is the only thing
 * telling the viewer the strip continues, so it must never be dropped for
 * being decorative.
 */

export const SHOP_CARD_MAX_VISIBLE_DOTS = 7;

export type ShopCardDotSize = 'full' | 'medium' | 'small';

export interface ShopCardDot {
  /** Index of the photo this dot represents. Stable across renders. */
  index: number;
  isActive: boolean;
  size: ShopCardDotSize;
}

const SIZE_BY_RANK: readonly ShopCardDotSize[] = ['small', 'medium', 'full'];

/** Rank a dot by how far it sits from a truncated edge of the window. */
function rankFromTruncatedEdge(distance: number): number {
  if (distance <= 0) return 0;
  if (distance === 1) return 1;
  return 2;
}

export function getShopCardDots(
  imageCount: number,
  activeIndex: number,
  maxVisible: number = SHOP_CARD_MAX_VISIBLE_DOTS,
): ShopCardDot[] {
  const count = Math.trunc(imageCount);
  // One photo needs no indicator at all — a lone dot reads as a smudge.
  if (!Number.isFinite(count) || count <= 1) return [];

  const active = Math.min(Math.max(0, Math.trunc(activeIndex) || 0), count - 1);
  // Below three the window cannot show a centre plus both tapers, so the taper
  // would claim photos that are actually reachable.
  const visible = Math.min(count, Math.max(3, Math.trunc(maxVisible) || 0));

  if (count <= visible) {
    return Array.from({ length: count }, (_, index) => ({
      index,
      isActive: index === active,
      size: 'full' as const,
    }));
  }

  const start = Math.min(Math.max(0, active - Math.floor(visible / 2)), count - visible);
  const end = start + visible - 1;
  const truncatedLeft = start > 0;
  const truncatedRight = end < count - 1;

  return Array.from({ length: visible }, (_, offset) => {
    const index = start + offset;
    const rank = Math.min(
      truncatedLeft ? rankFromTruncatedEdge(index - start) : 2,
      truncatedRight ? rankFromTruncatedEdge(end - index) : 2,
    );
    const isActive = index === active;
    return {
      index,
      isActive,
      // The active dot is never tapered. Clamping the window keeps it off a
      // truncated edge already, so this only guards a future maxVisible change.
      size: isActive ? ('full' as const) : SIZE_BY_RANK[rank],
    };
  });
}
