import { describe, expect, it } from 'vitest';
import {
  EDITABLE_PRODUCT_FIELDS,
  normalizeProductFieldEdits,
  rebuildInternalTags,
  reviewProductFields,
  type ProductFieldEditSource,
} from '../product-field-edits';
import type { Product } from '@/types/product';

// The review window's inline editors (SelectedMarketplaceReviewFlow) save
// through PUT /api/admin/products/fields, which validates every body with
// normalizeProductFieldEdits before touching the row. These tests pin the
// allow-list, the normalizers (shared with the listing editor) and the tag
// rebuild that keeps the shop filters honest.

function makeCurrent(overrides: Partial<ProductFieldEditSource> = {}): ProductFieldEditSource {
  return {
    category: 'Gold',
    metal_variant: 'yellow_gold',
    product_type: 'Necklace',
    jewelry_type: 'Necklace',
    chain_type: 'Cuban link',
    length: '20',
    tags: ['jt:Necklace', 'ct:Cuban link', 'len:20', 'estate jewelry'],
    ...overrides,
  };
}

function expectOk(result: ReturnType<typeof normalizeProductFieldEdits>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.patch;
}

describe('normalizeProductFieldEdits', () => {
  it('refuses fields outside the allow-list', () => {
    const result = normalizeProductFieldEdits(makeCurrent(), { cost_basis: 5 } as Record<string, unknown>);
    expect(result).toEqual({ ok: false, error: '"cost_basis" cannot be edited here.' });
    expect(EDITABLE_PRODUCT_FIELDS).not.toContain('cost_basis');
    expect(EDITABLE_PRODUCT_FIELDS).not.toContain('price_mode');
  });

  it('refuses an empty edit', () => {
    expect(normalizeProductFieldEdits(makeCurrent(), {})).toEqual({ ok: false, error: 'Nothing to save.' });
  });

  it('converts a millimetre length to inches and rewrites the len: tag', () => {
    const patch = expectOk(normalizeProductFieldEdits(makeCurrent(), { length: '470 mm' }));
    expect(patch.length).toBe('18.5');
    expect(patch.tags).toEqual(['estate jewelry', 'jt:Necklace', 'ct:Cuban link', 'len:18.5']);
  });

  it('clears a length and drops its tag', () => {
    const patch = expectOk(normalizeProductFieldEdits(makeCurrent(), { length: '' }));
    expect(patch.length).toBeNull();
    expect(patch.tags).toEqual(['estate jewelry', 'jt:Necklace', 'ct:Cuban link']);
  });

  it('mirrors weight into the legacy gram_weight column like the editor does', () => {
    const patch = expectOk(normalizeProductFieldEdits(makeCurrent(), { weight_grams: '13.849' }));
    expect(patch).toEqual({ weight_grams: 13.85, gram_weight: 13.85 });
    expect(normalizeProductFieldEdits(makeCurrent(), { weight_grams: -1 }).ok).toBe(false);
  });

  it('validates the year and quantity', () => {
    expect(expectOk(normalizeProductFieldEdits(makeCurrent(), { item_year: '1925' }))).toEqual({ item_year: 1925 });
    expect(expectOk(normalizeProductFieldEdits(makeCurrent(), { item_year: '' }))).toEqual({ item_year: null });
    expect(normalizeProductFieldEdits(makeCurrent(), { item_year: 'circa' }).ok).toBe(false);
    expect(expectOk(normalizeProductFieldEdits(makeCurrent(), { quantity: '2' }))).toEqual({ quantity: 2 });
    expect(normalizeProductFieldEdits(makeCurrent(), { quantity: 1.5 }).ok).toBe(false);
    expect(normalizeProductFieldEdits(makeCurrent(), { quantity: '' }).ok).toBe(false);
  });

  it('checks purity against the metal family', () => {
    expect(expectOk(normalizeProductFieldEdits(makeCurrent(), { purity: '14' }))).toEqual({ purity: 14 });
    expect(normalizeProductFieldEdits(makeCurrent(), { purity: '925' }).ok).toBe(false);
    const silver = makeCurrent({ category: 'Silver', metal_variant: 'silver' });
    expect(expectOk(normalizeProductFieldEdits(silver, { purity: '925' }))).toEqual({ purity: 925 });
    expect(normalizeProductFieldEdits(silver, { purity: '14' }).ok).toBe(false);
  });

  it('only accepts a metal colour from the product\'s own family', () => {
    expect(expectOk(normalizeProductFieldEdits(makeCurrent(), { metal_variant: 'rose_gold' }))).toEqual({ metal_variant: 'rose_gold' });
    expect(normalizeProductFieldEdits(makeCurrent(), { metal_variant: 'silver' }).ok).toBe(false);
    expect(normalizeProductFieldEdits(makeCurrent(), { metal_variant: 'brass' }).ok).toBe(false);
  });

  it('saves metal and purity together for the Materials row', () => {
    const patch = expectOk(normalizeProductFieldEdits(makeCurrent(), { metal_variant: 'white_gold', purity: '18' }));
    expect(patch).toEqual({ metal_variant: 'white_gold', purity: 18 });
  });

  it('trims free text and turns blanks into null', () => {
    expect(expectOk(normalizeProductFieldEdits(makeCurrent(), { brand: '  Tiffany & Co.  ' }))).toEqual({ brand: 'Tiffany & Co.' });
    expect(expectOk(normalizeProductFieldEdits(makeCurrent(), { brand: '   ' }))).toEqual({ brand: null });
    expect(expectOk(normalizeProductFieldEdits(makeCurrent(), { stone_details: 'Diamond, 0.25 ct' }))).toEqual({ stone_details: 'Diamond, 0.25 ct' });
  });

  it('changing the type to one without chains clears the chain type and rewrites both tags', () => {
    const patch = expectOk(normalizeProductFieldEdits(makeCurrent(), { product_type: 'Pendant' }));
    expect(patch.product_type).toBe('Pendant');
    expect(patch.jewelry_type).toBe('Pendant');
    expect(patch.chain_type).toBeNull();
    expect(patch.tags).toEqual(['estate jewelry', 'jt:Pendant', 'len:20']);
    expect(normalizeProductFieldEdits(makeCurrent(), { product_type: 'Tiara' }).ok).toBe(false);
  });

  it('keeps a chain type when the type still supports it', () => {
    const patch = expectOk(normalizeProductFieldEdits(makeCurrent(), { product_type: 'Bracelet', chain_type: 'Rope chain' }));
    expect(patch.chain_type).toBe('Rope chain');
    expect(patch.tags).toEqual(['estate jewelry', 'jt:Bracelet', 'ct:Rope chain', 'len:20']);
  });

  it('ignores a chain type on a product that cannot have one', () => {
    const ring = makeCurrent({ product_type: 'Ring', jewelry_type: 'Ring', chain_type: null, tags: ['jt:Ring'] });
    expect(expectOk(normalizeProductFieldEdits(ring, { chain_type: 'Cuban link' }))).toEqual({ chain_type: null, tags: ['jt:Ring', 'len:20'] });
  });
});

describe('rebuildInternalTags', () => {
  it('keeps the free tags and rewrites only the jt:/ct:/len: entries', () => {
    expect(rebuildInternalTags(['gift', 'jt:Ring', 'len:7'], 'Ring', null, '7.5')).toEqual(['gift', 'jt:Ring', 'len:7.5']);
    expect(rebuildInternalTags(null, 'Necklace', 'Cuban link', null)).toEqual(['jt:Necklace', 'ct:Cuban link']);
  });
});

describe('reviewProductFields', () => {
  it('returns the stored values the review window prefills its editors with', () => {
    const product = {
      category: 'Silver',
      quantity: null,
      length: '470 mm',
      brand: 'Tiffany & Co.',
      item_year: 2000,
      weight_grams: null,
      gram_weight: 51.91,
      stone_details: null,
      chain_type: 'Bead',
      purity: 925,
      metal_variant: 'silver',
      product_type: 'necklaces',
      jewelry_type: null,
    } as unknown as Product;
    expect(reviewProductFields(product)).toEqual({
      category: 'Silver',
      quantity: 1,
      length: '470 mm',
      brand: 'Tiffany & Co.',
      item_year: 2000,
      weight_grams: 51.91,
      stone_details: null,
      chain_type: 'Bead',
      purity: 925,
      metal_variant: 'silver',
      product_type: 'Necklace',
    });
  });
});
