import { describe, expect, it, vi } from 'vitest';
import { drainQueueCore, shouldPushPrice, type SyncStepResult } from '../sync';

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
