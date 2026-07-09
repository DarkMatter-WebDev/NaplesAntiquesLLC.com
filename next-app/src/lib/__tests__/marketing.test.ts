import { describe, it, expect } from 'vitest';
import { combineSource } from '@/lib/marketing';

describe('combineSource', () => {
  it('combines two distinct sources into a sorted, +-joined string', () => {
    expect(combineSource('subscriber', 'account')).toBe('account+subscriber');
    expect(combineSource('account', 'buyer')).toBe('account+buyer');
    expect(combineSource('subscriber', 'buyer')).toBe('buyer+subscriber');
  });

  it('produces the same result regardless of merge order', () => {
    expect(combineSource('account', 'subscriber')).toBe(combineSource('subscriber', 'account'));
  });

  it('combines a third source into an already-combined value', () => {
    expect(combineSource('account+subscriber', 'buyer')).toBe('account+buyer+subscriber');
  });

  it('is idempotent when the incoming source is already present', () => {
    expect(combineSource('buyer', 'buyer')).toBe('buyer');
    expect(combineSource('account+buyer', 'buyer')).toBe('account+buyer');
  });
});
