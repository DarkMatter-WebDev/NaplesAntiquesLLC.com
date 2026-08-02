import { describe, expect, it } from 'vitest';
import {
  marketplaceShippingTierLabel,
  resolveTierExternalId,
  shippingTierProvisionSummary,
} from '@/lib/marketplace-shipping';
import { MARKETPLACE_SHIPPING_TIERS } from '@/lib/checkout-shipping';

describe('marketplace shipping tier resolution', () => {
  const map = {
    'fee-19': '101',
    'fee-99': 'policy-99',
  };

  it('resolves a provisioned tier for a listing price', () => {
    expect(resolveTierExternalId(map, 49)).toEqual({ externalId: '101', tier: { key: 'fee-19', fee: 19 } });
    expect(resolveTierExternalId(map, 8203)).toEqual({ externalId: 'policy-99', tier: { key: 'fee-99', fee: 99 } });
  });

  it('returns null (use the legacy default) for unprovisioned tiers and bad prices', () => {
    expect(resolveTierExternalId(map, 599)).toBeNull(); // fee-29 not provisioned
    expect(resolveTierExternalId(map, null)).toBeNull();
    expect(resolveTierExternalId(map, 0)).toBeNull();
    expect(resolveTierExternalId({}, 49)).toBeNull();
  });

  it('labels tiers canonically and stably — the provisioning idempotency key', () => {
    expect(marketplaceShippingTierLabel({ key: 'fee-19', fee: 19 })).toBe('NEJ Insured Shipping $19');
    expect(marketplaceShippingTierLabel({ key: 'fee-165', fee: 165 })).toBe('NEJ Insured Shipping $165');
  });

  it('summarizes provisioning progress for the settings panels', () => {
    expect(shippingTierProvisionSummary({})).toEqual({ provisioned: 0, total: MARKETPLACE_SHIPPING_TIERS.length, complete: false });
    const full = Object.fromEntries(MARKETPLACE_SHIPPING_TIERS.map((tier) => [tier.key, `x-${tier.fee}`]));
    expect(shippingTierProvisionSummary(full)).toEqual({ provisioned: MARKETPLACE_SHIPPING_TIERS.length, total: MARKETPLACE_SHIPPING_TIERS.length, complete: true });
  });
});
