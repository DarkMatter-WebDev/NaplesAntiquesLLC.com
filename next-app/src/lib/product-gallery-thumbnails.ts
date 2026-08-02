export type ThumbnailCopy = 'before' | 'original' | 'after';
export type ThumbnailLoopDirection = 'forward' | 'backward' | null;

export interface WholeThumbnailTrackLayout {
  visibleCount: number;
  trackWidth: number;
}

export interface CircularThumbnailItem<T> {
  item: T;
  logicalIndex: number;
  copy: ThumbnailCopy;
}

export function buildCircularThumbnailItems<T>(items: readonly T[]): CircularThumbnailItem<T>[] {
  const originals = items.map((item, logicalIndex) => ({
    item,
    logicalIndex,
    copy: 'original' as const,
  }));

  if (items.length < 2) return originals;

  const before = items.slice(-2).map((item, offset) => ({
    item,
    logicalIndex: items.length - 2 + offset,
    copy: 'before' as const,
  }));
  const after = items.slice(0, 2).map((item, logicalIndex) => ({
    item,
    logicalIndex,
    copy: 'after' as const,
  }));

  return [...before, ...originals, ...after];
}

export function getThumbnailLoopDirection(
  currentIndex: number,
  targetIndex: number,
  itemCount: number,
): ThumbnailLoopDirection {
  if (itemCount < 2) return null;
  if (currentIndex === itemCount - 1 && targetIndex === 0) return 'forward';
  if (currentIndex === 0 && targetIndex === itemCount - 1) return 'backward';
  return null;
}

export function getWholeThumbnailTrackLayout(
  availableWidth: number,
  itemWidth: number,
  gap: number,
  inlinePadding = 0,
  maxVisibleCards = 6,
): WholeThumbnailTrackLayout {
  const safeItemWidth = Math.max(1, itemWidth);
  const safeGap = Math.max(0, gap);
  const safePadding = Math.max(0, inlinePadding);
  const usableWidth = Math.max(safeItemWidth, availableWidth - safePadding * 2);
  const visibleCount = Math.max(
    1,
    Math.min(maxVisibleCards, Math.floor((usableWidth + safeGap) / (safeItemWidth + safeGap))),
  );

  return {
    visibleCount,
    trackWidth: safePadding * 2
      + visibleCount * safeItemWidth
      + Math.max(0, visibleCount - 1) * safeGap,
  };
}

export function getWholeThumbnailScrollLeft(
  targetContentLeft: number,
  visibleCount: number,
  itemWidth: number,
  gap: number,
  inlinePadding = 0,
): number {
  const leadingCardCount = Math.max(0, Math.floor((visibleCount - 2) / 2));
  return targetContentLeft - inlinePadding - leadingCardCount * (itemWidth + gap);
}
