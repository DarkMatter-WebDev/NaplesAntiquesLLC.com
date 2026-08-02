import { describe, expect, it } from 'vitest';
import { carouselImageLoading, productThumbnailLoading } from '@/lib/storefront-image-loading';

describe('storefront image loading', () => {
  it('eager-loads visible carousel cards while prioritizing only the front slot', () => {
    expect(carouselImageLoading(0)).toEqual({ loading: 'eager', fetchPriority: 'high' });
    expect(carouselImageLoading(1)).toEqual({ loading: 'eager', fetchPriority: 'auto' });
  });

  it('eager-loads only the thumbnail that duplicates the initial product hero', () => {
    expect(productThumbnailLoading(0)).toBe('eager');
    expect(productThumbnailLoading(1)).toBe('lazy');
  });
});
