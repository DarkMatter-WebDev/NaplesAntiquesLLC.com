import { describe, expect, it, vi } from 'vitest';
import { drainQueueCore, reconcileSyncStateFromEtsy, resolveUpdatedListingSyncState, shouldPushPrice, type SyncStepResult } from '../sync';

describe('resolveUpdatedListingSyncState — re-syncing an EXISTING listing must never silently demote it', () => {
  it('keeps a genuinely-active listing active, regardless of auto_activate — an update never calls setListingState', () => {
    expect(resolveUpdatedListingSyncState('active', false)).toBe('active');
    expect(resolveUpdatedListingSyncState('active', true)).toBe('active');
  });

  it('a genuinely-still-draft listing follows the auto_activate policy, same as first-publish', () => {
    expect(resolveUpdatedListingSyncState('draft', false)).toBe('draft_review');
    expect(resolveUpdatedListingSyncState('draft', true)).toBe('active');
  });

  it('regression: confirmed live 2026-07-10 — 63 already-active listings were demoted to draft_review after one bulk price sync because this used to key off auto_activate alone, ignoring whether the listing was actually live', () => {
    // The exact bug: an active listing, connection auto_activate off (the
    // default) — old logic: `connection.auto_activate ? 'active' : 'draft_review'`
    // would incorrectly return 'draft_review' here.
    expect(resolveUpdatedListingSyncState('active', false)).not.toBe('draft_review');
    expect(resolveUpdatedListingSyncState('active', false)).toBe('active');
  });
});

describe('reconcileSyncStateFromEtsy — mapping Etsy state onto our sync_state', () => {
  it('maps active/inactive/expired/sold_out', () => {
    expect(reconcileSyncStateFromEtsy('draft_review', 'active')).toEqual({ sync_state: 'active', listing_state: 'active' });
    expect(reconcileSyncStateFromEtsy('active', 'inactive')).toEqual({ sync_state: 'delisted', listing_state: 'inactive' });
    expect(reconcileSyncStateFromEtsy('active', 'sold_out')).toEqual({ sync_state: 'delisted', listing_state: 'inactive' });
    expect(reconcileSyncStateFromEtsy('active', 'expired')).toEqual({ sync_state: 'delisted', listing_state: 'ended' });
  });

  it('clears a stale error when the item is actually a draft on Etsy (the missing-key recovery)', () => {
    expect(reconcileSyncStateFromEtsy('error', 'draft')).toEqual({ sync_state: 'draft_review', listing_state: 'draft' });
    expect(reconcileSyncStateFromEtsy('active', 'draft')).toEqual({ sync_state: 'draft_review', listing_state: 'draft' });
    expect(reconcileSyncStateFromEtsy('delisted', 'draft')).toEqual({ sync_state: 'draft_review', listing_state: 'draft' });
  });

  it('keeps a finer in-pipeline draft state (only sets listing_state) when Etsy says draft', () => {
    expect(reconcileSyncStateFromEtsy('draft_created', 'draft')).toEqual({ listing_state: 'draft' });
    expect(reconcileSyncStateFromEtsy('inventory_synced', 'draft')).toEqual({ listing_state: 'draft' });
    expect(reconcileSyncStateFromEtsy('draft_review', 'draft')).toEqual({ listing_state: 'draft' });
  });

  it('treats "edit" as delisted — a real Etsy state for a listing pulled back after selling, confirmed live 2026-07-10 (inv #61)', () => {
    expect(reconcileSyncStateFromEtsy('active', 'edit')).toEqual({ sync_state: 'delisted', listing_state: 'inactive' });
  });

  it('returns an empty patch for a genuinely unrecognized Etsy state (report only, never guess)', () => {
    expect(reconcileSyncStateFromEtsy('draft_review', 'unavailable')).toEqual({});
  });
});

describe('shouldPushPrice — Q4 threshold logic', () => {
  it('always pushes when there is no prior pushed price', () => {
    expect(shouldPushPrice(100, null, 1)).toBe(true);
  });

  it('pushes when the change meets the threshold exactly', () => {
    expect(shouldPushPrice(101, 100, 1)).toBe(true); // exactly 1%
  });

  it('skips when the change is below the threshold', () => {
    expect(shouldPushPrice(100.5, 100, 1)).toBe(false); // 0.5%
  });

  it('is symmetric for price drops', () => {
    expect(shouldPushPrice(98, 100, 1)).toBe(true); // -2%
  });

  it('a quiet-market day (no change) never pushes', () => {
    expect(shouldPushPrice(100, 100, 1)).toBe(false);
  });
});

describe('drainQueueCore — queue orchestration (pure, injected deps)', () => {
  it('claims until the queue is empty', async () => {
    const ids = ['a', 'b', 'c'];
    const claimNext = vi.fn(async () => ids.shift() ?? null);
    const runStep = vi.fn(async (): Promise<SyncStepResult> => ({ done: true, syncState: 'active' }));

    const result = await drainQueueCore({ claimNext, runStep, now: () => 0, budgetMs: 10_000 });

    expect(result.exhausted).toBe(true);
    expect(result.results).toEqual([
      { productId: 'a', syncState: 'active' },
      { productId: 'b', syncState: 'active' },
      { productId: 'c', syncState: 'active' },
    ]);
    expect(claimNext).toHaveBeenCalledTimes(4); // 3 real claims + 1 empty
  });

  it('stops once the time budget is exceeded, without claiming past it', async () => {
    // now() sequence: start=0; first budget check=0 (OK, proceed); second budget
    // check=100 (0->100 > 5ms budget, stop) — so exactly one product is claimed.
    const times = [0, 0, 100];
    let call = 0;
    const now = () => times[Math.min(call++, times.length - 1)];
    const claimNext = vi.fn(async () => 'p1');
    const runStep = vi.fn(async (): Promise<SyncStepResult> => ({ done: true, syncState: 'active' }));

    const result = await drainQueueCore({ claimNext, runStep, now, budgetMs: 5 });

    expect(result.exhausted).toBe(false);
    expect(claimNext).toHaveBeenCalledTimes(1);
    expect(result.results).toEqual([{ productId: 'p1', syncState: 'active' }]);
  });

  it('stops after a product that is still mid-progress (done:false) instead of claiming the next one', async () => {
    const claimNext = vi.fn(async () => 'p1');
    const runStep = vi.fn(
      async (): Promise<SyncStepResult> => ({ done: false, syncState: 'draft_created', progress: { step: 'images', uploaded: 1, total: 5 } }),
    );

    const result = await drainQueueCore({ claimNext, runStep, now: () => 0, budgetMs: 10_000 });

    expect(result.results).toEqual([{ productId: 'p1', syncState: 'draft_created' }]);
    expect(claimNext).toHaveBeenCalledTimes(1);
  });

  it('stops the pass if a processed item is re-claimed, instead of cycling forever (2026-07-08 runaway guard)', async () => {
    // Simulates an item that finishes a step (done:true) but stays claimable —
    // e.g. a bug that leaves it 'pending'. claimNext keeps returning it; the
    // seen-guard must stop rather than re-process it every iteration.
    const claimNext = vi.fn(async () => 'stuck');
    const runStep = vi.fn(async (): Promise<SyncStepResult> => ({ done: true, syncState: 'pending' }));

    const result = await drainQueueCore({ claimNext, runStep, now: () => 0, budgetMs: 10_000 });

    expect(result.exhausted).toBe(false); // never drained
    expect(runStep).toHaveBeenCalledTimes(1); // processed the stuck item exactly once
    expect(claimNext).toHaveBeenCalledTimes(2); // claim #1 processes it, claim #2 sees the repeat and stops
    expect(result.results).toEqual([{ productId: 'stuck', syncState: 'pending' }]);
  });

  it('an empty queue returns immediately with exhausted:true and no results', async () => {
    const claimNext = vi.fn(async () => null);
    const runStep = vi.fn(async (): Promise<SyncStepResult> => ({ done: true, syncState: 'active' }));

    const result = await drainQueueCore({ claimNext, runStep, now: () => 0, budgetMs: 10_000 });

    expect(result.exhausted).toBe(true);
    expect(result.results).toEqual([]);
    expect(runStep).not.toHaveBeenCalled();
  });
});
