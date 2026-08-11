import { describe, expect, it } from 'vitest';
import { enqueueCandidatePriority, orderEnqueueCandidates } from '../sync';
import type { EbaySyncState } from '../store';

const states = (entries: Record<string, EbaySyncState | null>) =>
  new Map<string, EbaySyncState | null>(Object.entries(entries));

describe('enqueueCandidatePriority', () => {
  it('puts already-current listings last', () => {
    expect(enqueueCandidatePriority('published')).toBe(2);
  });

  it('puts errored listings behind the clean backlog but ahead of current ones', () => {
    expect(enqueueCandidatePriority('error')).toBe(1);
  });

  it('puts everything that needs a write first', () => {
    for (const state of ['out_of_date', 'pending', 'item_synced', 'offer_created', 'review'] as EbaySyncState[]) {
      expect(enqueueCandidatePriority(state)).toBe(0);
    }
  });

  it('treats a never-listed product as needing the write', () => {
    expect(enqueueCandidatePriority(undefined)).toBe(0);
    expect(enqueueCandidatePriority(null)).toBe(0);
  });
});

describe('orderEnqueueCandidates', () => {
  // The regression this exists for: the shipping-tier campaign is run by
  // selecting everything and syncing repeatedly. With a bare slice(0, 25) the
  // second run re-pushed 21 of the same 23 listings and advanced nothing.
  it('advances a backlog across repeated runs', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const map = states({ a: 'published', b: 'out_of_date', c: 'published', d: 'out_of_date' });
    const LIMIT = 2;

    const firstRun = orderEnqueueCandidates(ids, map).slice(0, LIMIT);
    expect(firstRun).toEqual(['b', 'd']);

    // Only b and d were synced, so only they became current. a and c were
    // already published and stay that way — the next run must now reach them
    // rather than redoing b and d.
    const afterFirst = states({ a: 'published', b: 'published', c: 'published', d: 'published' });
    const secondRun = orderEnqueueCandidates(ids, afterFirst).slice(0, LIMIT);
    // Everything is current now, so priority is uniform and caller order stands.
    expect(secondRun).toEqual(['a', 'b']);

    // The load-bearing case: a genuine backlog where the synced items drop to
    // the back and the untouched stale ones come forward.
    const partiallyDone = states({ a: 'out_of_date', b: 'published', c: 'out_of_date', d: 'published' });
    expect(orderEnqueueCandidates(ids, partiallyDone).slice(0, LIMIT)).toEqual(['a', 'c']);
  });

  it('keeps the caller order within a priority group (stable sort)', () => {
    const ids = ['z', 'y', 'x'];
    const map = states({ z: 'out_of_date', y: 'out_of_date', x: 'out_of_date' });
    expect(orderEnqueueCandidates(ids, map)).toEqual(['z', 'y', 'x']);
  });

  it('orders stale, then errored, then current', () => {
    const ids = ['current', 'errored', 'stale'];
    const map = states({ current: 'published', errored: 'error', stale: 'out_of_date' });
    expect(orderEnqueueCandidates(ids, map)).toEqual(['stale', 'errored', 'current']);
  });

  // Ordering, not filtering — an admin selecting live items to deliberately
  // re-push must still get them queued.
  it('still queues an all-published selection, so a force-re-push works', () => {
    const ids = ['a', 'b'];
    const map = states({ a: 'published', b: 'published' });
    expect(orderEnqueueCandidates(ids, map).slice(0, 25)).toEqual(['a', 'b']);
  });

  it('does not add, drop or duplicate ids', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const map = states({ a: 'published', b: 'out_of_date', c: 'error', d: 'published', e: 'out_of_date' });
    const ordered = orderEnqueueCandidates(ids, map);
    expect(ordered).toHaveLength(ids.length);
    expect([...ordered].sort()).toEqual([...ids].sort());
  });

  it('leaves the caller array untouched', () => {
    const ids = ['a', 'b'];
    const map = states({ a: 'published', b: 'out_of_date' });
    orderEnqueueCandidates(ids, map);
    expect(ids).toEqual(['a', 'b']);
  });
});
