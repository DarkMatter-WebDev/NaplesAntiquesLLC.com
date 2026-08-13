import { describe, expect, it } from 'vitest';
import { EBAY_EXCLUDED_PRODUCT_IDS, EBAY_EXCLUDED_REASON } from '../guards';
import { buildPreflightChecks } from '../mapping';
import type { Product } from '@/types/product';

const ROLEX_GMT = 'rolex-gmt-master-ii-18k-yellow-gold-watch-ref-116718ln-black-ceramic-bezel-black-dial-83';
const ROLEX_YACHT = 'rolex-yacht-master-18k-yellow-gold-men-s-watch-model-16628-ca-1998-84';

const connection = {
  fulfillment_policy_id: 'f',
  express_fulfillment_policy_id: 'e',
  high_value_shipping_threshold: 1000,
  payment_policy_id: 'p',
  return_policy_id: 'r',
  merchant_location_key: 'm',
  price_markup_pct: 15,
} as unknown as Parameters<typeof buildPreflightChecks>[1];

const watch = (id: string, overrides: Partial<Product> = {}): Product => ({
  id,
  title: 'A watch',
  status: 'available',
  quantity: 1,
  jewelry_type: 'Watch',
  product_type: 'Watch',
  images: ['https://example.com/a.jpg'],
  price_mode: 'manual',
  price_label: '$1,000',
  ...overrides,
} as unknown as Product);

const eligibility = (product: Product) =>
  buildPreflightChecks(product, connection, null).find((c) => c.check === 'eligibility');

describe('EBAY_EXCLUDED_PRODUCT_IDS', () => {
  it('holds exactly the two watches the owner named', () => {
    expect([...EBAY_EXCLUDED_PRODUCT_IDS].sort()).toEqual([ROLEX_GMT, ROLEX_YACHT].sort());
  });

  // The whole point of the owner's instruction: "just those two items, other
  // watches maybe in the future". If this ever becomes a Watch-type rule, a
  // future watch silently stops syncing and nobody knows why.
  it('is per-item, so another watch is NOT excluded', () => {
    const other = watch('vintage-omega-seamaster-99');
    expect(EBAY_EXCLUDED_PRODUCT_IDS.has(other.id)).toBe(false);
    expect(eligibility(other)?.ok).toBe(true);
  });
});

describe('pre-flight eligibility for excluded products', () => {
  it('fails for each excluded id', () => {
    for (const id of [ROLEX_GMT, ROLEX_YACHT]) {
      const check = eligibility(watch(id));
      expect(check?.ok).toBe(false);
      expect(check?.message).toBe(EBAY_EXCLUDED_REASON);
    }
  });

  it('explains it as an owner decision, not a failure', () => {
    expect(EBAY_EXCLUDED_REASON).toMatch(/owner decision/i);
    // Must not read like the eBay error it replaces.
    expect(EBAY_EXCLUDED_REASON).not.toMatch(/Department|error/i);
  });

  it('leaves a normal product eligible', () => {
    const ring = watch('plain-ring-01', { jewelry_type: 'Ring', product_type: 'Ring' });
    expect(eligibility(ring)?.ok).toBe(true);
  });

  // The per-item message is the more specific one, so it must win over the
  // category message if a product ever matched both.
  it('prefers the per-item reason over the category reason', () => {
    const check = eligibility(watch(ROLEX_GMT, { jewelry_type: 'Coin', product_type: 'Coin' }));
    expect(check?.message).toBe(EBAY_EXCLUDED_REASON);
  });
});
