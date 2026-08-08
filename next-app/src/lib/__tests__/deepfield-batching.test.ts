import { describe, expect, it } from 'vitest';
import { chunkByImageBudget } from '@/lib/deepfield/sync';
import type { DeepFieldProductPayload } from '@/lib/deepfield/payload';

function p(id: string, images: number): DeepFieldProductPayload {
  return {
    id,
    images: Array.from({ length: images }, (_, i) => `https://example.test/${id}-${i}.webp`),
    image_urls: [],
    nej_price_usd: null,
    nej_price_source: null,
    nej_melt_value_usd: null,
    nej_spot_snapshot: null,
    nej_price_unavailable_reason: null,
  } as unknown as DeepFieldProductPayload;
}

const imagesIn = (batch: DeepFieldProductPayload[]) =>
  batch.reduce((n, x) => n + (x.images?.length ?? 0), 0);

describe('chunkByImageBudget', () => {
  it('keeps every batch inside the image budget when it can', () => {
    const items = [p('a', 7), p('b', 7), p('c', 7), p('d', 7)];
    const batches = chunkByImageBudget(items, 18, 3);
    for (const b of batches) expect(imagesIn(b)).toBeLessThanOrEqual(18);
  });

  it('caps product count even when images are tiny', () => {
    const items = [p('a', 1), p('b', 1), p('c', 1), p('d', 1), p('e', 1)];
    const batches = chunkByImageBudget(items, 18, 3);
    for (const b of batches) expect(b.length).toBeLessThanOrEqual(3);
    expect(batches).toHaveLength(2);
  });

  // The exact shape that broke the bulk import: 3 products, 38 images.
  it('splits the 7+14+17 group that timed out in production', () => {
    const batches = chunkByImageBudget([p('a', 7), p('b', 14), p('c', 17)], 18, 3);
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) {
      // Either within budget, or a single oversized product on its own.
      expect(imagesIn(b) <= 18 || b.length === 1).toBe(true);
    }
  });

  it('never splits a single product, even one over budget', () => {
    const batches = chunkByImageBudget([p('huge', 40)], 18, 3);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
    expect(imagesIn(batches[0])).toBe(40);
  });

  it('places an oversized product alone rather than dragging neighbours over budget', () => {
    const batches = chunkByImageBudget([p('a', 5), p('huge', 30), p('b', 5)], 18, 3);
    const huge = batches.find((b) => b.some((x) => x.id === 'huge'));
    expect(huge).toHaveLength(1);
  });

  it('loses nothing and preserves order', () => {
    const items = [p('a', 3), p('b', 19), p('c', 2), p('d', 11), p('e', 6)];
    const flat = chunkByImageBudget(items, 18, 3).flat();
    expect(flat.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('handles an empty list and products with no images', () => {
    expect(chunkByImageBudget([], 18, 3)).toEqual([]);
    const batches = chunkByImageBudget([p('a', 0), p('b', 0), p('c', 0), p('d', 0)], 18, 3);
    expect(batches.flat()).toHaveLength(4);
    for (const b of batches) expect(b.length).toBeLessThanOrEqual(3);
  });

  // Regression guard against the real catalog's shape.
  it('keeps realistic catalog batches under the gateway-safe ceiling', () => {
    const spread = [2, 19, 7, 14, 17, 3, 9, 6, 11, 5, 8, 13, 4, 10, 7];
    const items = spread.map((n, i) => p(`p${i}`, n));
    const batches = chunkByImageBudget(items, 18, 3);
    for (const b of batches) {
      expect(imagesIn(b) <= 18 || b.length === 1).toBe(true);
      expect(imagesIn(b)).toBeLessThanOrEqual(19); // largest single product
    }
    expect(batches.flat()).toHaveLength(spread.length);
  });
});
