/**
 * Per-request time limits for every Etsy and eBay call (2026-09-14).
 *
 * Neither marketplace client had any: `fetch()` with no signal waits as long
 * as the socket stays open. A hung connection could hold a whole sweep until
 * Netlify killed the function, with nothing logged — and the 30-minute
 * reconcile route awaits the Etsy/eBay SALES read first, so one stuck order
 * read would also stall the auto-mark-sold check and the status reconcile
 * behind it (TASKS.md, "Marketplace clients have no request timeout").
 *
 * The limits sit below the budgets that already exist: `SALES_BUDGET_MS`
 * 15 s, `RECONCILE_BUDGET_MS` / scheduled price push 20 s, the 60 s route
 * maximum and Netlify's ~26 s gateway. They apply PER ATTEMPT, so a retried
 * 429/5xx gets its own window; a timeout itself is not retried (the next
 * scheduled run re-reads), which keeps the worst case bounded.
 */
export const MARKETPLACE_TIMEOUT_MS = {
  /** JSON reads and writes, and eBay's Trading GetItem. */
  api: 15_000,
  /** Multipart photo uploads to Etsy, and fetching our own photo bytes first. */
  upload: 30_000,
  /** OAuth token endpoints (refresh and exchange). */
  token: 10_000,
} as const;

/** True for the error `fetch` throws when its `AbortSignal.timeout(...)` fires (or any abort). */
export function isFetchTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('name' in error)) return false;
  const name = (error as { name?: unknown }).name;
  return name === 'TimeoutError' || name === 'AbortError';
}

/** "15 s" style label for operator messages. */
export function timeoutLabel(ms: number): string {
  return `${Math.round(ms / 1000)} s`;
}
