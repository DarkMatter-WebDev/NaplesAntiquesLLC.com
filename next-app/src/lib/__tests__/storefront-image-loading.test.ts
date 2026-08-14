import { describe, expect, it } from 'vitest';
import { carouselImageLoading, productThumbnailLoading } from '@/lib/storefront-image-loading';

describe('storefront image loading', () => {
  it('eager-loads visible carousel cards while prioritizing only the front slot', () => {
    expect(carouselImageLoading(0)).toEqual({ loading: 'eager', fetchPriority: 'high' });
    expect(carouselImageLoading(1)).toEqual({ loading: 'eager', fetchPriority: 'low' });
  });

  it('never lets a parked slideshow claim the LCP priority lane', () => {
    // Hero panes B and C mount offscreen. They must still load eagerly — a card
    // decoding as it rotates in is the pop-in the hero exists to avoid — but
    // their front slot must not compete with the visible hero image.
    expect(carouselImageLoading(0, true)).toEqual({ loading: 'eager', fetchPriority: 'low' });
    expect(carouselImageLoading(1, true)).toEqual({ loading: 'eager', fetchPriority: 'low' });
  });

  // REGRESSION 2026-08-14. These two cases previously asserted `auto`, which let
  // NINE carousel images (157KB) compete for bandwidth with the 21KB stylesheet
  // that is the only resource actually blocking the first pixel — measured at
  // 533KB across 30 requests before FCP on production. `low` keeps them eager
  // (no pop-in) while making them yield.
  //
  // The two invariants the original tests protected are unchanged and asserted
  // below: exactly one image may claim `high`, and it is never a parked pane.
  it('lets exactly one image claim the high-priority lane, and never a parked one', () => {
    const visible = [0, 1, 2, 3, 4, 5].map((s) => carouselImageLoading(s, false));
    const parked = [0, 1, 2, 3, 4, 5].map((s) => carouselImageLoading(s, true));

    expect(visible.filter((v) => v.fetchPriority === 'high')).toHaveLength(1);
    expect(visible[0].fetchPriority).toBe('high');
    expect(parked.filter((v) => v.fetchPriority === 'high')).toHaveLength(0);

    // (A runtime check for `auto` would be dead code — the return type is
    // `'high' | 'low'`, so tsc rejects reintroducing it outright, which is a
    // stronger guarantee than a test.)
    // Every card still downloads — `lazy` here would reintroduce pop-in.
    expect([...visible, ...parked].every((v) => v.loading === 'eager')).toBe(true);
  });

  it('eager-loads only the thumbnail that duplicates the initial product hero', () => {
    expect(productThumbnailLoading(0)).toBe('eager');
    expect(productThumbnailLoading(1)).toBe('lazy');
  });
});
