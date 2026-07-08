import { describe, expect, it } from 'vitest';
import { resolveAdvertisedTradeInPrice } from '../product';

type OverrideFields = Parameters<typeof resolveAdvertisedTradeInPrice>[0];

const noOverride: OverrideFields = {
  special_price_override_enabled: false,
  special_price_override_amount: null,
  special_price_override_mode: null,
  special_price_override_percent: null,
};

describe('resolveAdvertisedTradeInPrice', () => {
  it('falls back to the plain melt value when nothing is set', () => {
    expect(resolveAdvertisedTradeInPrice(noOverride, 1000, null)).toBe(1000);
    expect(resolveAdvertisedTradeInPrice(noOverride, 1000, { enabled: false, percent: 10 })).toBe(1000);
  });

  it('applies the site-wide default percent over melt when enabled (positive, negative, zero)', () => {
    expect(resolveAdvertisedTradeInPrice(noOverride, 1000, { enabled: true, percent: 10 })).toBe(1100);
    expect(resolveAdvertisedTradeInPrice(noOverride, 1000, { enabled: true, percent: -10 })).toBe(900);
    expect(resolveAdvertisedTradeInPrice(noOverride, 1000, { enabled: true, percent: 0 })).toBe(1000);
  });

  it('the site-wide default needs a computable melt value', () => {
    expect(resolveAdvertisedTradeInPrice(noOverride, null, { enabled: true, percent: 10 })).toBeNull();
  });

  it('ignores an absent/invalid site percent (falls back to melt)', () => {
    expect(resolveAdvertisedTradeInPrice(noOverride, 1000, { enabled: true, percent: null })).toBe(1000);
  });

  it('the per-item override ALWAYS wins over the site-wide default', () => {
    const flat: OverrideFields = {
      special_price_override_enabled: true,
      special_price_override_mode: 'amount',
      special_price_override_amount: 777,
      special_price_override_percent: null,
    };
    expect(resolveAdvertisedTradeInPrice(flat, 1000, { enabled: true, percent: 10 })).toBe(777);

    const pct: OverrideFields = {
      special_price_override_enabled: true,
      special_price_override_mode: 'percent',
      special_price_override_amount: null,
      special_price_override_percent: 25,
    };
    expect(resolveAdvertisedTradeInPrice(pct, 1000, { enabled: true, percent: 10 })).toBe(1250);
  });
});
