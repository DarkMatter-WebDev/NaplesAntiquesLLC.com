import { describe, expect, it } from 'vitest';
import {
  buildCircularThumbnailItems,
  getThumbnailLoopDirection,
  getWholeThumbnailScrollLeft,
  getWholeThumbnailTrackLayout,
} from '@/lib/product-gallery-thumbnails';

describe('buildCircularThumbnailItems', () => {
  it('keeps a single item uncloned', () => {
    expect(buildCircularThumbnailItems(['a'])).toEqual([
      { item: 'a', logicalIndex: 0, copy: 'original' },
    ]);
  });

  it('adds two thumbnails on both sides for a seamless circular viewport', () => {
    expect(buildCircularThumbnailItems(['a', 'b', 'c'])).toEqual([
      { item: 'b', logicalIndex: 1, copy: 'before' },
      { item: 'c', logicalIndex: 2, copy: 'before' },
      { item: 'a', logicalIndex: 0, copy: 'original' },
      { item: 'b', logicalIndex: 1, copy: 'original' },
      { item: 'c', logicalIndex: 2, copy: 'original' },
      { item: 'a', logicalIndex: 0, copy: 'after' },
      { item: 'b', logicalIndex: 1, copy: 'after' },
    ]);
  });
});

describe('getThumbnailLoopDirection', () => {
  it('recognizes forward and backward boundary wraps', () => {
    expect(getThumbnailLoopDirection(4, 0, 5)).toBe('forward');
    expect(getThumbnailLoopDirection(0, 4, 5)).toBe('backward');
  });

  it('does not treat ordinary navigation as a loop', () => {
    expect(getThumbnailLoopDirection(1, 2, 5)).toBeNull();
    expect(getThumbnailLoopDirection(2, 1, 5)).toBeNull();
    expect(getThumbnailLoopDirection(0, 0, 1)).toBeNull();
  });
});

describe('whole thumbnail track geometry', () => {
  it('snaps the available width down to complete 64px cards', () => {
    expect(getWholeThumbnailTrackLayout(169, 64, 8)).toEqual({
      visibleCount: 2,
      trackWidth: 136,
    });
    expect(getWholeThumbnailTrackLayout(439, 64, 8)).toEqual({
      visibleCount: 6,
      trackWidth: 424,
    });
  });

  it('accounts for inline padding and caps very wide tracks', () => {
    expect(getWholeThumbnailTrackLayout(1440, 64, 8, 8)).toEqual({
      visibleCount: 6,
      trackWidth: 440,
    });
  });

  it('aligns scrolling to card boundaries while keeping active and next visible', () => {
    expect(getWholeThumbnailScrollLeft(288, 2, 64, 8)).toBe(288);
    expect(getWholeThumbnailScrollLeft(288, 4, 64, 8)).toBe(216);
    expect(getWholeThumbnailScrollLeft(296, 6, 64, 8, 8)).toBe(144);
  });
});
