import { describe, expect, it } from 'vitest';
import {
  CHECKOUT_SHIPPING_OPTIONS,
  DEFAULT_SHIPPING_METHOD,
  getCheckoutShippingFee,
  isCheckoutShippingMethod,
  shippingMethodForDb,
} from '@/lib/checkout-shipping';

describe('checkout shipping catalog', () => {
  it('keeps labels, fees, validation, and the default in one definition', () => {
    expect(CHECKOUT_SHIPPING_OPTIONS).toEqual([
      expect.objectContaining({ value: 'local-pickup', price: 0 }),
      expect.objectContaining({ value: 'express-overnight-insured', price: 75 }),
      expect.objectContaining({ value: 'priority-insured', price: 45 }),
    ]);
    expect(DEFAULT_SHIPPING_METHOD).toBe('priority-insured');
    expect(getCheckoutShippingFee(DEFAULT_SHIPPING_METHOD)).toBe(45);
  });

  it('rejects unknown methods instead of converting them to free shipping', () => {
    expect(isCheckoutShippingMethod('priority-insured')).toBe(true);
    expect(isCheckoutShippingMethod('free-international')).toBe(false);
    expect(getCheckoutShippingFee('free-international')).toBeNull();
  });

  it('maps checkout methods to the existing database fulfillment values', () => {
    expect(shippingMethodForDb('local-pickup')).toBe('pickup');
    expect(shippingMethodForDb('priority-insured')).toBe('shipping');
    expect(shippingMethodForDb('express-overnight-insured')).toBe('shipping');
  });
});
