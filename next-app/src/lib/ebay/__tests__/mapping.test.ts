import { describe, expect, it } from 'vitest';
import type { Product, SpotData } from '@/types/product';
import {
  EBAY_CONDITION_DESCRIPTION,
  EBAY_CONDITION_ID,
  EBAY_FORBIDDEN_PRODUCT_FIELDS,
  buildMappedPayload,
  buildPreflightChecks,
  computeContentHash,
  computeEbayPrice,
  isEbayIneligibleProductType,
  isPreflightPassing,
  mapAspects,
  mapDescription,
  mapSku,
  mapTitle,
  resolveCategory,
  resolveEbayImageUrl,
  resolveFulfillmentPolicyId,
  resolveImageUrls,
  type EbayConnectionDefaults,
} from '../mapping';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-product-id',
    category: 'Gold',
    metal_type: 'Gold',
    metal_variant: 'yellow_gold',
    title: '14K Yellow Gold Necklace',
    title_es: null,
    price_label: null,
    manual_price_label: null,
    price_mode: 'spot-multiplier',
    purity: 14,
    weight_grams: 10,
    inventory_number: 42,
    sku: null,
    slug: 'test-product',
    metal: 'gold',
    gram_weight: 10,
    stone_details: null,
    brand: null,
    product_type: 'Necklace',
    jewelry_type: 'Necklace',
    chain_type: null,
    length: '20 in',
    pricing_multiplier: 2,
    show_spot_price: true,
    special_price_override_enabled: false,
    special_price_override_amount: null,
    special_price_override_mode: 'amount',
    special_price_override_percent: null,
    quantity: 1,
    status: 'available',
    location: null,
    images: [],
    image_urls: ['https://example.supabase.co/storage/v1/object/public/product-images/products/a.webp'],
    image_padding: 'none',
    image_padding_by_image: null,
    description: 'A lovely test necklace.',
    description_es: null,
    details: [],
    details_es: [],
    tags: ['jt:Necklace', 'estate jewelry'],
    tags_es: [],
    private_price_label: 'SECRET-PRIVATE-LABEL',
    gender: null,
    item_year: 1985,
    cost_basis: 999999,
    melt_value: 888888,
    asking_price: null,
    minimum_price: 777777,
    live_spot_snapshot: { secret: 'do-not-leak' },
    acquisition_date: '2020-01-01',
    acquisition_source: 'SECRET-SOURCE',
    internal_notes: 'SECRET-INTERNAL-NOTE',
    public_notes: null,
    public_notes_es: null,
    featured: false,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeConnection(overrides: Partial<EbayConnectionDefaults> = {}): EbayConnectionDefaults {
  return {
    fulfillment_policy_id: 'std-policy-1',
    express_fulfillment_policy_id: 'express-policy-1',
    high_value_shipping_threshold: 1000,
    payment_policy_id: 'pay-policy-1',
    return_policy_id: 'return-policy-1',
    merchant_location_key: 'nej-naples-fl',
    price_markup_pct: 15,
    marketplace_id: 'EBAY_US',
    ...overrides,
  };
}

describe('mapTitle', () => {
  it('leaves short titles untouched', () => {
    expect(mapTitle('14K Gold Cuban Link Chain')).toBe('14K Gold Cuban Link Chain');
  });

  it('collapses internal whitespace', () => {
    expect(mapTitle('  Gold   Ring  ')).toBe('Gold Ring');
  });

  it('leaves an exactly-80-char title untouched', () => {
    const exact = 'A'.repeat(80);
    expect(mapTitle(exact)).toBe(exact);
    expect(mapTitle(exact).length).toBe(80);
  });

  it('truncates an 81-char title to a word boundary, never exceeding 80', () => {
    const long = `${'A'.repeat(79)} B`; // 81 chars total, one space before the last char
    const result = mapTitle(long);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.endsWith(' ')).toBe(false);
    expect(long.startsWith(result)).toBe(true);
  });

  it('truncates a long space-separated title at a word boundary', () => {
    const long = `${'Word '.repeat(20)}`.trim(); // > 80 chars
    const result = mapTitle(long);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.endsWith(' ')).toBe(false);
    expect(long.startsWith(result)).toBe(true);
    // The char right after the cut (if any) is a word boundary, not a mid-word chop.
    if (long.length > result.length) {
      expect(long[result.length]).toBe(' ');
    }
  });

  it('hard-cuts a single unbroken 90-char word (no space to break on)', () => {
    const long = 'A'.repeat(90);
    const result = mapTitle(long);
    expect(result.length).toBe(80);
  });
});

describe('mapSku', () => {
  it('is products.id verbatim (Q11)', () => {
    expect(mapSku({ id: 'abc-123' })).toBe('abc-123');
  });
});

describe('condition (Q5)', () => {
  it('is a fixed id and one standard template', () => {
    expect(EBAY_CONDITION_ID).toBe('3000');
    expect(EBAY_CONDITION_DESCRIPTION.length).toBeGreaterThan(0);
    expect(EBAY_CONDITION_DESCRIPTION.length).toBeLessThanOrEqual(1000);
  });
});

describe('mapDescription', () => {
  it('includes a spec block with purity, weight, length, and era', () => {
    const html = mapDescription(makeProduct());
    expect(html).toContain('Purity: 14');
    expect(html).toContain('Weight: 10g');
    expect(html).toContain('Length: 20 in');
    expect(html).toContain('Era: 1985');
  });

  it('shows "Ring size" instead of "Length" for a Ring', () => {
    const html = mapDescription(makeProduct({ product_type: 'Ring', jewelry_type: 'Ring', length: '7.5' }));
    expect(html).toContain('Ring size: 7.5');
    expect(html).not.toContain('Length: 7.5');
  });

  it('escapes HTML-significant characters from free text', () => {
    const html = mapDescription(makeProduct({ description: '<script>alert(1)</script>' }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('never exceeds 4000 chars', () => {
    const html = mapDescription(makeProduct({ description: 'A'.repeat(5000) }));
    expect(html.length).toBeLessThanOrEqual(4000);
  });
});

describe('mapAspects', () => {
  it('maps metal, purity, type, and brand fallback', () => {
    const aspects = mapAspects(makeProduct());
    expect(aspects.Metal).toEqual(['Yellow Gold']);
    expect(aspects['Metal Purity']).toEqual(['14k']);
    expect(aspects.Type).toEqual(['Necklace']);
    expect(aspects.Brand).toEqual(['Unbranded']);
  });

  it('uses the real brand when present', () => {
    const aspects = mapAspects(makeProduct({ brand: 'David Yurman' }));
    expect(aspects.Brand).toEqual(['David Yurman']);
  });

  it('maps a Ring to "Ring Size", not "Chain Length"', () => {
    const aspects = mapAspects(makeProduct({ product_type: 'Ring', jewelry_type: 'Ring', length: '7.5' }));
    expect(aspects['Ring Size']).toEqual(['7.5']);
    expect(aspects['Chain Length']).toBeUndefined();
  });

  it('maps a Necklace length to "Chain Length" in inches', () => {
    const aspects = mapAspects(makeProduct({ length: '20 in' }));
    expect(aspects['Chain Length']).toEqual(['20 in']);
  });

  it('never fabricates a stone/gemstone aspect (no verified-safe source)', () => {
    const aspects = mapAspects(makeProduct({ stone_details: 'Blue sapphire, 2ct' }));
    expect(Object.keys(aspects)).not.toContain('Gemstone');
    expect(Object.keys(aspects)).not.toContain('Main Stone');
  });
});

describe('resolveCategory — Fine vs Fashion routing (Q4) and Coin/Bullion exclusion (Q6)', () => {
  it('routes a solid-gold Necklace to the Fine Jewelry leaf', () => {
    const category = resolveCategory(makeProduct({ metal_variant: 'yellow_gold', product_type: 'Necklace' }));
    expect(category?.categoryId).toBe('261993');
    expect(category?.path).toMatch(/Fine Jewelry/);
  });

  it('routes vermeil to Fashion Jewelry (no Fine Jewelry leaf) — currently unpinned, so resolves to null', () => {
    const category = resolveCategory(makeProduct({ metal_variant: 'vermeil', product_type: 'Necklace' }));
    // No Fashion Jewelry leaf id is pinned in this build (TODO(ebay-verify));
    // the important guarantee is that vermeil NEVER resolves to a Fine leaf.
    expect(category).toBeNull();
  });

  it('never routes vermeil to a Fine Jewelry category id', () => {
    for (const type of ['Necklace', 'Ring', 'Earrings', 'Bracelet']) {
      const category = resolveCategory(makeProduct({ metal_variant: 'vermeil', product_type: type, jewelry_type: type }));
      const fineCategory = resolveCategory(makeProduct({ metal_variant: 'yellow_gold', product_type: type, jewelry_type: type }));
      if (fineCategory) {
        expect(category?.categoryId).not.toBe(fineCategory.categoryId);
      }
    }
  });

  it('returns null for Coin and Bullion — never a category, never a guess', () => {
    expect(resolveCategory(makeProduct({ product_type: 'Coin', jewelry_type: 'Coin' }))).toBeNull();
    expect(resolveCategory(makeProduct({ product_type: 'Bullion', jewelry_type: 'Bullion' }))).toBeNull();
  });

  it('isEbayIneligibleProductType flags exactly Coin and Bullion', () => {
    expect(isEbayIneligibleProductType('Coin')).toBe(true);
    expect(isEbayIneligibleProductType('Bullion')).toBe(true);
    expect(isEbayIneligibleProductType('Silverware')).toBe(false);
    expect(isEbayIneligibleProductType('Necklace')).toBe(false);
  });

  it('Silverware IS eligible and maps to a category (Q6b)', () => {
    const category = resolveCategory(makeProduct({ product_type: 'Silverware', jewelry_type: 'Silverware', metal_variant: 'silver' }));
    expect(category).not.toBeNull();
  });

  it('an explicit override always wins', () => {
    const category = resolveCategory(makeProduct({ product_type: 'Coin' }), { id: '999', path: 'Custom > Path' });
    expect(category).toEqual({ categoryId: '999', path: 'Custom > Path' });
  });
});

describe('computeEbayPrice', () => {
  it('applies the markup percentage on top of the manual price', () => {
    const product = makeProduct({ price_mode: 'manual', manual_price_label: '$100' });
    const result = computeEbayPrice(product, null, 15);
    expect(result.basePrice).toBe(100);
    expect(result.price).toBe(115);
    expect(result.rejectedReason).toBeNull();
  });

  it('applies the markup on top of the spot-computed price', () => {
    const product = makeProduct({ price_mode: 'spot-multiplier', purity: 14, gram_weight: 10, pricing_multiplier: 2 });
    const spotData: SpotData = { goldPerTroyOz: 3110.34768, silverPerTroyOz: null, fetchedAt: Date.now(), source: 'api' };
    // melt = 10 * (14/24) * (3110.34768/31.1034768) = 10 * 0.58333 * 100 = ~583.33;
    // calcSpotPriceValue already multiplies by pricing_multiplier (2) = ~1166.67
    const result = computeEbayPrice(product, spotData, 0);
    expect(result.basePrice).toBeCloseTo(1166.67, 1);
    expect(result.price).toBe(result.basePrice);
  });

  it('has no platform price floor (unlike Etsy) — a low price still computes', () => {
    const product = makeProduct({ price_mode: 'manual', manual_price_label: '$0.10' });
    const result = computeEbayPrice(product, null, 0);
    expect(result.price).toBe(0.1);
    expect(result.rejectedReason).toBeNull();
  });

  it('returns null with a reason when no price can be computed', () => {
    const product = makeProduct({ price_mode: 'manual', manual_price_label: null, asking_price: null });
    const result = computeEbayPrice(product, null, 15);
    expect(result.price).toBeNull();
    expect(result.rejectedReason).toBeTruthy();
  });
});

describe('resolveFulfillmentPolicyId — Q16 price-tiered express shipping', () => {
  it('uses the standard policy at or below the threshold', () => {
    expect(resolveFulfillmentPolicyId(1000, makeConnection())).toEqual({ policyId: 'std-policy-1', tier: 'standard' });
    expect(resolveFulfillmentPolicyId(500, makeConnection())).toEqual({ policyId: 'std-policy-1', tier: 'standard' });
  });

  it('uses the express policy strictly above the threshold', () => {
    expect(resolveFulfillmentPolicyId(1000.01, makeConnection())).toEqual({ policyId: 'express-policy-1', tier: 'express' });
    expect(resolveFulfillmentPolicyId(5000, makeConnection())).toEqual({ policyId: 'express-policy-1', tier: 'express' });
  });

  it('respects an admin-edited threshold', () => {
    const connection = makeConnection({ high_value_shipping_threshold: 200 });
    expect(resolveFulfillmentPolicyId(250, connection)).toEqual({ policyId: 'express-policy-1', tier: 'express' });
  });

  it('falls back to standard if no express policy id is configured', () => {
    const connection = makeConnection({ express_fulfillment_policy_id: null });
    expect(resolveFulfillmentPolicyId(5000, connection)).toEqual({ policyId: 'std-policy-1', tier: 'standard' });
  });

  it('returns nulls when not connected', () => {
    expect(resolveFulfillmentPolicyId(5000, null)).toEqual({ policyId: null, tier: 'standard' });
  });
});

describe('resolveImageUrls / resolveEbayImageUrl — both URL shapes', () => {
  it('leaves an already-absolute Supabase Storage URL untouched', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/product-images/products/a.webp';
    expect(resolveEbayImageUrl(url)).toBe(url);
  });

  it('absolutizes a legacy /assets/... path against the site URL', () => {
    expect(resolveEbayImageUrl('/assets/images/shop/a.png')).toBe('https://naplesestatejewelry.co/assets/images/shop/a.png');
  });

  it('caps at 24 images and prefers image_urls over the legacy images[] mirror', () => {
    const urls = Array.from({ length: 30 }, (_, i) => `https://example.com/img-${i}.webp`);
    const result = resolveImageUrls(makeProduct({ image_urls: urls, images: ['/assets/legacy.png'] }));
    expect(result).toHaveLength(24);
    expect(result[0]).toBe('https://example.com/img-0.webp');
  });

  it('falls back to images[] when image_urls is empty', () => {
    const result = resolveImageUrls(makeProduct({ image_urls: [], images: ['/assets/legacy.png'] }));
    expect(result).toEqual(['https://naplesestatejewelry.co/assets/legacy.png']);
  });
});

describe('buildPreflightChecks', () => {
  it('passes for a well-formed, connected, eligible product', () => {
    const checks = buildPreflightChecks(makeProduct(), makeConnection(), null);
    expect(isPreflightPassing(checks)).toBe(true);
  });

  it('blocks (never errors) a Coin/Bullion item with the owner-decision message', () => {
    const checks = buildPreflightChecks(makeProduct({ product_type: 'Coin', jewelry_type: 'Coin' }), makeConnection(), null);
    const eligibility = checks.find((c) => c.check === 'eligibility');
    expect(eligibility?.ok).toBe(false);
    expect(eligibility?.message).toMatch(/not synced to eBay per owner decision/i);
    expect(isPreflightPassing(checks)).toBe(false);
  });

  it('blocks when not connected', () => {
    const checks = buildPreflightChecks(makeProduct(), null, null);
    expect(checks.find((c) => c.check === 'connected')?.ok).toBe(false);
  });

  it('blocks a vermeil item because the Fashion Jewelry category is unpinned', () => {
    const checks = buildPreflightChecks(makeProduct({ metal_variant: 'vermeil' }), makeConnection(), null);
    const categoryCheck = checks.find((c) => c.check === 'category');
    expect(categoryCheck?.ok).toBe(false);
    expect(categoryCheck?.message).toMatch(/Fashion Jewelry/i);
  });

  it('blocks a zero-quantity item', () => {
    const checks = buildPreflightChecks(makeProduct({ quantity: 0 }), makeConnection(), null);
    expect(checks.find((c) => c.check === 'quantity')?.ok).toBe(false);
  });

  it('blocks an item with no images', () => {
    const checks = buildPreflightChecks(makeProduct({ image_urls: [], images: [] }), makeConnection(), null);
    expect(checks.find((c) => c.check === 'images')?.ok).toBe(false);
  });
});

describe('buildMappedPayload — private-field allowlist guarantee', () => {
  it('never leaks cost_basis, minimum_price, internal_notes, or other private fields', () => {
    const product = makeProduct();
    const payload = buildMappedPayload(product, makeConnection(), null);
    const serialized = JSON.stringify(payload);

    for (const field of EBAY_FORBIDDEN_PRODUCT_FIELDS) {
      const value = product[field as keyof Product];
      if (typeof value === 'string' && value) {
        expect(serialized).not.toContain(value);
      }
    }
    for (const field of EBAY_FORBIDDEN_PRODUCT_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(payload, field)).toBe(false);
    }
  });

  it('resolves the fulfillment policy tier consistently with the computed price', () => {
    const highValueProduct = makeProduct({ price_mode: 'manual', manual_price_label: '$5000' });
    const payload = buildMappedPayload(highValueProduct, makeConnection(), null);
    expect(payload.shippingTier).toBe('express');
    expect(payload.fulfillmentPolicyId).toBe('express-policy-1');
  });

  it('caps images at 24', () => {
    const urls = Array.from({ length: 30 }, (_, i) => `https://example.com/img-${i}.webp`);
    const payload = buildMappedPayload(makeProduct({ image_urls: urls }), makeConnection(), null);
    expect(payload.images).toHaveLength(24);
  });
});

describe('computeContentHash', () => {
  it('is stable for identical payloads', () => {
    const payload = buildMappedPayload(makeProduct(), makeConnection(), null);
    expect(computeContentHash(payload)).toBe(computeContentHash({ ...payload }));
  });

  it('changes when the price changes', () => {
    const a = buildMappedPayload(makeProduct({ manual_price_label: '$100', price_mode: 'manual' }), makeConnection(), null);
    const b = buildMappedPayload(makeProduct({ manual_price_label: '$200', price_mode: 'manual' }), makeConnection(), null);
    expect(computeContentHash(a)).not.toBe(computeContentHash(b));
  });

  it('changes when a price crossing the Q16 threshold flips the resolved shipping policy', () => {
    // makeConnection()'s 15% markup means the pushed price is base * 1.15 —
    // pick bases that land clearly on each side of the $1000 threshold.
    const belowThreshold = buildMappedPayload(
      makeProduct({ manual_price_label: '$800', price_mode: 'manual' }), // 800 * 1.15 = 920
      makeConnection(),
      null,
    );
    const aboveThreshold = buildMappedPayload(
      makeProduct({ manual_price_label: '$1900', price_mode: 'manual' }), // 1900 * 1.15 = 2185
      makeConnection(),
      null,
    );
    expect(belowThreshold.fulfillmentPolicyId).toBe('std-policy-1');
    expect(aboveThreshold.fulfillmentPolicyId).toBe('express-policy-1');
    expect(computeContentHash(belowThreshold)).not.toBe(computeContentHash(aboveThreshold));
  });
});
