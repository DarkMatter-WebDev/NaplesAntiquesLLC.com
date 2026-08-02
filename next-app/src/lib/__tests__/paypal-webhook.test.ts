import { describe, expect, it } from 'vitest';
import { payPalCumulativeRefund, relatedPayPalCaptureId } from '@/lib/paypal-webhook';

describe('relatedPayPalCaptureId', () => {
  it('uses the capture resource id for capture events', () => {
    expect(relatedPayPalCaptureId('PAYMENT.CAPTURE.REFUNDED', { id: 'CAPTURE-123' }))
      .toBe('CAPTURE-123');
  });

  it('finds capture ids in refund links and dispute transactions', () => {
    expect(relatedPayPalCaptureId('PAYMENT.REFUND.PENDING', {
      id: 'REFUND-123',
      links: [{ rel: 'up', href: 'https://api-m.paypal.com/v2/payments/captures/CAPTURE-456' }],
    })).toBe('CAPTURE-456');

    expect(relatedPayPalCaptureId('CUSTOMER.DISPUTE.CREATED', {
      disputed_transactions: [{ seller_transaction_id: 'CAPTURE-789' }],
    })).toBe('CAPTURE-789');
  });
});

describe('payPalCumulativeRefund', () => {
  it('reads the cumulative refund from a capture resource', () => {
    expect(payPalCumulativeRefund({
      amount: { value: '100.00', currency_code: 'USD' },
      seller_receivable_breakdown: {
        total_refunded_amount: { value: '25.50', currency_code: 'USD' },
      },
    })).toEqual({ amount: 25.5, currency: 'USD' });
  });

  it('does not mistake the original capture amount for a refund amount', () => {
    expect(payPalCumulativeRefund({
      amount: { value: '100.00', currency_code: 'USD' },
    })).toBeNull();
  });
});
