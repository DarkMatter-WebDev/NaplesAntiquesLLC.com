import { describe, it, expect } from 'vitest';
import { composeUnknownErrorMessage, isAvailabilityError } from '@/lib/checkout-error-messages';

describe('isAvailabilityError', () => {
  it('matches the real availability/sold-out server messages', () => {
    expect(isAvailabilityError('Unavailable item: Gold Ring')).toBe(true);
    expect(isAvailabilityError('Not enough stock for: Bracelet (only 1 available)')).toBe(true);
    expect(isAvailabilityError('one or more items in your order were just purchased by another buyer')).toBe(true);
    expect(isAvailabilityError('This item is no longer available')).toBe(true);
  });

  it('does not match generic/unrelated errors', () => {
    expect(isAvailabilityError('Could not start PayPal checkout.')).toBe(false);
    expect(isAvailabilityError('capture failed')).toBe(false);
    expect(isAvailabilityError('')).toBe(false);
    expect(isAvailabilityError(null)).toBe(false);
    expect(isAvailabilityError(undefined)).toBe(false);
  });
});

describe('composeUnknownErrorMessage', () => {
  it('first unknown error suggests re-checking the card number (just in case)', () => {
    const msg = composeUnknownErrorMessage(1, false);
    expect(msg.toLowerCase()).toContain('double-check your card number');
    expect(msg.toLowerCase()).not.toContain('different card');
    // keeps the sold-out possibility visible
    expect(msg.toLowerCase()).toContain('sold out');
  });

  it('second (and later) unknown error escalates to trying a different card', () => {
    for (const attempt of [2, 3, 5]) {
      const msg = composeUnknownErrorMessage(attempt, false);
      expect(msg.toLowerCase()).toContain('different card');
      expect(msg).toContain('(239) 404-8505');
    }
  });

  it('is localized for Spanish', () => {
    expect(composeUnknownErrorMessage(1, true).toLowerCase()).toContain('tarjeta');
    expect(composeUnknownErrorMessage(2, true).toLowerCase()).toContain('tarjeta diferente');
  });
});
