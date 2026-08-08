import { describe, expect, it } from 'vitest';
import { MAX_PRICE_PUSH_ATTEMPTS, planEbayPricePush } from '@/lib/ebay/sync';
import type { Product, SpotData } from '@/types/product';

const SPOT: SpotData = {
  goldPerTroyOz: 4343.299805,
  silverPerTroyOz: 63.707001,
  fetchedAt: 1786146956481,
  source: 'api',
};

function listing(overrides: Record<string, unknown> = {}) {
  return {
    product_id: 'p1',
    ebay_sku: 'SKU1',
    ebay_offer_id: 'offer-1',
    ebay_listing_id: 'listing-1',
    sync_state: 'out_of_date',
    last_pushed_price: 100,
    last_pushed_qty: 1,
    error_count: 0,
    last_error: null,
    ...overrides,
  } as never;
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    status: 'available',
    quantity: 1,
    category: 'Silver',
    price_mode: 'spot-multiplier',
    pricing_multiplier: 1.25,
    purity: 925,
    gram_weight: 50,
    weight_grams: 50,
    manual_price_label: null,
    sold_price: null,
    ...overrides,
  } as Product;
}

const plan = (l: unknown[], p: Product[]) =>
  planEbayPricePush(l as never, new Map(p.map((x) => [x.id, x])), SPOT, 15, null);

describe('eBay price-push eligibility', () => {
  it('pushes an available product', () => {
    const r = plan([listing()], [product()]);
    expect(r.candidates).toHaveLength(1);
  });

  // The 2026-08-08 root cause: sold products stay `out_of_date` forever, are
  // already withdrawn on eBay (qty 0), and every push returns HTTP 400.
  it('never pushes a SOLD product, even though its listing is out_of_date', () => {
    const r = plan(
      [listing({ sync_state: 'out_of_date', last_pushed_qty: 0 })],
      [product({ status: 'sold' })],
    );
    expect(r.candidates).toHaveLength(0);
    expect(r.skipped).toBe(1);
    // Not "blocked" — blocked marks the whole run as a warning, and a sold item
    // is a normal, expected non-candidate, not a fault needing attention.
    expect(r.blocked).toBe(0);
  });

  it.each(['sold', 'archived', 'draft', 'pending_payment'])(
    'never pushes a %s product', (status) => {
      const r = plan([listing()], [product({ status })]);
      expect(r.candidates).toHaveLength(0);
    },
  );

  it('accepts legacy title-case Available', () => {
    const r = plan([listing()], [product({ status: 'Available' })]);
    expect(r.candidates).toHaveLength(1);
  });

  // Keyed on live product status, so relisting revives it with no manual repair.
  it('resumes pushing when a sold product returns to available', () => {
    const l = listing({ last_pushed_qty: 0 });
    expect(plan([l], [product({ status: 'sold' })]).candidates).toHaveLength(0);
    expect(plan([l], [product({ status: 'available' })]).candidates).toHaveLength(1);
  });

  it('stops retrying a listing that has failed too many times', () => {
    const r = plan([listing({ error_count: MAX_PRICE_PUSH_ATTEMPTS })], [product()]);
    expect(r.candidates).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });

  it('still retries below the attempt ceiling', () => {
    const r = plan([listing({ error_count: MAX_PRICE_PUSH_ATTEMPTS - 1 })], [product()]);
    expect(r.candidates).toHaveLength(1);
  });

  it('treats a missing error_count as zero', () => {
    const r = plan([listing({ error_count: null })], [product()]);
    expect(r.candidates).toHaveLength(1);
  });

  it('still blocks a listing with no offer id', () => {
    const r = plan([listing({ ebay_offer_id: null })], [product()]);
    expect(r.candidates).toHaveLength(0);
    expect(r.blocked).toBe(1);
  });

  it('mixed batch: only the eligible one is pushed', () => {
    const r = plan(
      [
        listing({ product_id: 'ok' }),
        listing({ product_id: 'soldone' }),
        listing({ product_id: 'burned', error_count: 9 }),
      ],
      [
        product({ id: 'ok' }),
        product({ id: 'soldone', status: 'sold' }),
        product({ id: 'burned' }),
      ],
    );
    expect(r.candidates.map((c) => c.listing.product_id)).toEqual(['ok']);
    expect(r.skipped).toBe(2);
  });
});
