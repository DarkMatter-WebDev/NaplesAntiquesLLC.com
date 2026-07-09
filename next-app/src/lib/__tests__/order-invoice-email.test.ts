import { describe, it, expect } from 'vitest';
import { buildInvoiceEmailContent, type InvoiceEmailOrder } from '@/lib/order-invoice-email';

const BASE_ORDER: InvoiceEmailOrder = {
  id: 'order-1',
  order_number: 'NEJ-20260101-TEST',
  user_id: null,
  customer_name: 'Jane Buyer',
  customer_email: 'jane@example.com',
  customer_phone: '2395551234',
  subtotal: 100,
  tax: 6,
  shipping_fee: 0,
  discount: 0,
  total: 106,
  payment_status: 'paid',
  fulfillment_status: 'pending',
  order_status: 'open',
  payment_method: 'paypal',
  payment_reference: 'PAYID-TEST',
  shipping_method: 'pickup',
  shipping_address: {
    line1: '123 Main St',
    line2: '',
    city: 'Naples',
    state: 'FL',
    postal_code: '34102',
    country: 'United States',
  },
  billing_address: null,
  internal_notes: null,
  customer_notes: null,
  refund_amount: null,
  created_at: '2026-07-08T12:00:00.000Z',
  updated_at: '2026-07-08T12:00:00.000Z',
  order_items: [],
};

describe('buildInvoiceEmailContent - ship-to label', () => {
  it('labels the address block "Address" (not "Ship to") for local pickup orders', () => {
    const content = buildInvoiceEmailContent({ ...BASE_ORDER, shipping_method: 'pickup' });
    expect(content.text).toContain('Address:');
    expect(content.text).not.toContain('Ship to:');
    expect(content.html).toContain('>Address<');
    expect(content.html).not.toContain('>Ship to<');
  });

  it('keeps the "Ship to" label unchanged for real shipping methods', () => {
    const content = buildInvoiceEmailContent({ ...BASE_ORDER, shipping_method: 'shipping' });
    expect(content.text).toContain('Ship to:');
    expect(content.text).not.toContain('Address:');
    expect(content.html).toContain('>Ship to<');
    expect(content.html).not.toContain('>Address<');
  });

  it('shows no address block at all when no address is on file, regardless of method', () => {
    const content = buildInvoiceEmailContent({ ...BASE_ORDER, shipping_method: 'pickup', shipping_address: null });
    expect(content.text).not.toContain('Address:');
    expect(content.text).not.toContain('Ship to:');
    expect(content.html).not.toContain('>Address<');
    expect(content.html).not.toContain('>Ship to<');
  });
});
