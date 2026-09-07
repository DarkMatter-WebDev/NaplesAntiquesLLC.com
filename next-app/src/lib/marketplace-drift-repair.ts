/**
 * Shared, PURE bookkeeping for the marketplace status-drift sweeps (Etsy and
 * eBay each keep their own sweep — the channels stay independent — but they
 * must count a repair the same way).
 *
 * Why this exists (2026-09-07): both sweeps counted every repair ATTEMPT as
 * "repaired". When a product is marked sold on the site after it already sold
 * on the marketplace, the marketplace has closed the listing itself and
 * refuses our delist (Etsy: a sold single-quantity listing sits in `edit`,
 * quantity 0; eBay: the listing is `Completed`). The refusal was swallowed and
 * the local row stayed "live", so the same listing was "repaired" every 30
 * minutes for weeks while the summary row read `1 drifted, 1 repaired`.
 *
 * A repair counts only when the local state actually changed:
 *   - `repaired`   — the direct delist/relist succeeded and the drift is gone.
 *   - `reconciled` — the marketplace refused, but a read-only status check
 *                    found it already closed there and pulled the local row
 *                    in line. Also a real state change, reached another way.
 *   - `failed`     — the drift is still there after everything we can do.
 *   - `noop`       — there was nothing to repair by the time we looked.
 */

export type DriftRepairOutcome = 'repaired' | 'reconciled' | 'failed' | 'noop';

export interface DriftRepairCounts {
  repaired: number;
  reconciled: number;
  failed: number;
  noop: number;
}

export interface DriftRepairSummary {
  scanned: number;
  drifted: number;
  repaired: number;
  reconciled: number;
  failed: number;
  /** Drifted listings the sweep did not get to inside its time budget. */
  remaining: number;
}

/**
 * Decide what one repair attempt achieved from three facts: was there drift
 * to begin with, did the direct marketplace write throw, and is there still
 * drift after the (re-read) local state. Nothing here trusts the write's own
 * return value — only the state that followed it.
 */
export function classifyDriftRepair(input: {
  driftBefore: string | null;
  directError: boolean;
  driftAfter: string | null;
}): DriftRepairOutcome {
  if (input.driftBefore === null) return 'noop';
  if (input.driftAfter !== null) return 'failed';
  return input.directError ? 'reconciled' : 'repaired';
}

export function countDriftRepairs(outcomes: readonly DriftRepairOutcome[]): DriftRepairCounts {
  const counts: DriftRepairCounts = { repaired: 0, reconciled: 0, failed: 0, noop: 0 };
  for (const outcome of outcomes) counts[outcome] += 1;
  return counts;
}

/** The one-line summary written to the channel's sync log on every run. */
export function formatDriftRepairSummary(channel: string, summary: DriftRepairSummary): string {
  return (
    `${channel} status reconcile: ${summary.scanned} scanned, ${summary.drifted} drifted, ` +
    `${summary.repaired} repaired, ${summary.reconciled} reconciled, ${summary.failed} failed, ` +
    `${summary.remaining} deferred.`
  );
}

/** A run is only clean when nothing failed and nothing was left over. */
export function driftRepairOutcomeLevel(summary: Pick<DriftRepairSummary, 'failed' | 'remaining'>): 'ok' | 'warning' {
  return summary.failed > 0 || summary.remaining > 0 ? 'warning' : 'ok';
}
