import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let buildPayPalOrderRequest: typeof import('@/lib/paypal').buildPayPalOrderRequest;
let payPalCreateRequestId: typeof import('@/lib/paypal').payPalCreateRequestId;

beforeAll(async () => {
  ({ buildPayPalOrderRequest, payPalCreateRequestId } = await import('@/lib/paypal'));
});

const BASE_INPUT = {
  currency: 'USD',
  subtotal: 100,
  tax: 7,
  shipping: 45,
  total: 152,
  items: [{ name: 'Estate ring', quantity: '1', unitAmount: 100, sku: '28' }],
  referenceId: 'order-123',
};

describe('buildPayPalOrderRequest', () => {
  it('locks a shipped order to the merchant-provided checkout address', () => {
    const payload = buildPayPalOrderRequest({
      ...BASE_INPUT,
      shippingAddress: {
        fullName: 'Buyer Name',
        addressLine1: '123 Main St',
        addressLine2: 'Unit 4',
        city: 'Naples',
        state: 'FL',
        postalCode: '34102',
        countryCode: 'US',
      },
    }) as {
      application_context: { shipping_preference: string };
      purchase_units: Array<{ shipping: unknown }>;
    };

    expect(payload.application_context.shipping_preference).toBe('SET_PROVIDED_ADDRESS');
    expect(payload.purchase_units[0].shipping).toEqual({
      name: { full_name: 'Buyer Name' },
      address: {
        address_line_1: '123 Main St',
        address_line_2: 'Unit 4',
        admin_area_2: 'Naples',
        admin_area_1: 'FL',
        postal_code: '34102',
        country_code: 'US',
      },
    });
  });

  it('keeps local pickup on NO_SHIPPING and omits PayPal shipping data', () => {
    const payload = buildPayPalOrderRequest(BASE_INPUT) as {
      application_context: { shipping_preference: string };
      purchase_units: Array<{ shipping?: unknown }>;
    };

    expect(payload.application_context.shipping_preference).toBe('NO_SHIPPING');
    expect(payload.purchase_units[0]).not.toHaveProperty('shipping');
  });

  it('uses a stable, bounded idempotency key for identical order details', () => {
    const first = payPalCreateRequestId(BASE_INPUT);
    const retry = payPalCreateRequestId({ ...BASE_INPUT, items: [...BASE_INPUT.items] });
    const changed = payPalCreateRequestId({ ...BASE_INPUT, shipping: 46, total: 153 });

    expect(retry).toBe(first);
    expect(changed).not.toBe(first);
    expect(first.length).toBeLessThanOrEqual(38);
  });
});
