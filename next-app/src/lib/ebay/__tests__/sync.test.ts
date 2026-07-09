import { describe, expect, it } from 'vitest';
import { drainQueueCore, shouldPushPrice, type DrainDeps, type SyncStepResult } from '../sync';

describe('shouldPushPrice — Q3 threshold logic', () => {
  it('always pushes when there is no prior pushed price', () => {
    expect(shouldPushPrice(100, null, 1)).toBe(true);
    expect(shouldPushPrice(100, 0, 1)).toBe(true);
  });

  it('pushes when the change meets or exceeds the threshold', () => {
    expect(shouldPushPrice(101, 100, 1)).toBe(true); // exactly 1%
    expect(shouldPushPrice(110, 100, 1)).toBe(true);
    expect(shouldPushPrice(90, 100, 1)).toBe(true); // drops count too
  });

  it('skips when the change is below the threshold', () => {
    expect(shouldPushPrice(100.5, 100, 1)).toBe(false);
    expect(shouldPushPrice(100, 100, 1)).toBe(false);
  });

  it('respects an admin-edited threshold', () => {
    expect(shouldPushPrice(105, 100, 10)).toBe(false);
    expect(shouldPushPrice(111, 100, 10)).toBe(true);
  });
});

function makeResult(overrides: Partial<SyncStepResult> = {}): SyncStepResult {
  return { done: true, syncState: 'published', ...overrides };
}

describe('drainQueueCore — pure orchestration loop', () => {
  it('drains every claimed item until the queue is exhausted', async () => {
    const queue = ['a', 'b', 'c'];
    const processed: string[] = [];
    const deps: DrainDeps = {
      claimNext: async () => queue.shift() ?? null,
      runStep: async (productId) => {
        processed.push(productId);
        return makeResult({ syncState: 'published' });
      },
      now: () => 0,
      budgetMs: 8000,
    };
    const result = await drainQueueCore(deps);
    expect(processed).toEqual(['a', 'b', 'c']);
    expect(result.exhausted).toBe(true);
    expect(result.results).toHaveLength(3);
  });

  it('stops (never loops forever) if the same product is re-claimed in one pass', async () => {
    // Simulates a bug in the claim RPC or a stuck row that keeps being
    // returned — the seen-guard is the safety net that prevents the drain
    // from spinning forever, mirroring the Etsy production runaway fix.
    let calls = 0;
    const deps: DrainDeps = {
      claimNext: async () => {
        calls += 1;
        return 'same-product'; // always returns the same id
      },
      runStep: async () => makeResult({ syncState: 'error' }),
      now: () => 0,
      budgetMs: 8000,
    };
    const result = await drainQueueCore(deps);
    expect(result.exhausted).toBe(false);
    expect(result.results).toHaveLength(1); // processed once, then the seen-guard stopped the loop
    expect(calls).toBe(2); // claimed once, processed, claimed again, seen -> stop
  });

  it('respects the time budget and reports not exhausted', async () => {
    let now = 0;
    const deps: DrainDeps = {
      claimNext: async () => {
        now += 5000; // each claim "takes" 5s of simulated time
        return `product-${now}`;
      },
      runStep: async () => makeResult(),
      now: () => now,
      budgetMs: 8000, // budget blows after the second claim
    };
    const result = await drainQueueCore(deps);
    expect(result.exhausted).toBe(false);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('breaks the loop (but reports not exhausted) when an item is not done, leaving the rest of the queue for the next pass', async () => {
    const queue = ['a', 'b'];
    const deps: DrainDeps = {
      claimNext: async () => queue.shift() ?? null,
      runStep: async (productId) => makeResult({ done: productId !== 'a', syncState: 'item_synced' }),
      now: () => 0,
      budgetMs: 8000,
    };
    const result = await drainQueueCore(deps);
    expect(result.results).toEqual([{ productId: 'a', syncState: 'item_synced' }]);
    expect(result.exhausted).toBe(false);
    expect(queue).toEqual(['b']); // 'b' was never claimed this pass
  });

  it('returns exhausted:true with zero results when the queue starts empty', async () => {
    const deps: DrainDeps = {
      claimNext: async () => null,
      runStep: async () => makeResult(),
      now: () => 0,
      budgetMs: 8000,
    };
    const result = await drainQueueCore(deps);
    expect(result.exhausted).toBe(true);
    expect(result.results).toHaveLength(0);
  });
});
