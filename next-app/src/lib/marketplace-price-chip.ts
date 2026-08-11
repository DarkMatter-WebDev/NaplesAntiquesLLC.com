/**
 * Price-push health for the Product Admin table, separate from listing
 * freshness. Client-safe (no `server-only` imports) so the table can render it.
 *
 * WHY THIS IS ITS OWN SIGNAL (2026-08-11)
 * ---------------------------------------
 * The owner asked for the out-of-date flag to be driven by price-push failures:
 * "if we always have the price push go through successfully, then it should
 * never be out of date." The two are structurally unrelated, so folding one into
 * the other would have been actively misleading:
 *
 *   - `out_of_date` means the CONTENT hash drifted. `computeContentHash` covers
 *     title, description, aspects, condition, category, quantity, images and the
 *     fulfillment/payment/return policies.
 *   - the daily price push sends `sku`, `shipToLocationAvailability.quantity`
 *     and `offers[].price` — nothing else — and its success path writes only
 *     `last_pushed_price`, `error_count` and `last_error`. It never touches
 *     `content_hash`.
 *
 * A successful price push therefore CANNOT clear `out_of_date`, by construction.
 * When this was raised, 84 available eBay listings were flagged because the
 * 2026-08-01/02 tier shipping policies entered the content hash — while that
 * same night's price push succeeded on 56 of them with zero failures. Driving
 * the flag off price success would have shown all 84 as healthy while they still
 * charged the old shipping on live eBay listings.
 *
 * So the signals are split instead: the existing chip keeps reporting content
 * freshness, and this one reports whether the money actually moved.
 */

/**
 * Consecutive price-push failures before a listing stops being retried.
 *
 * Single source of truth, re-exported by `ebay/sync.ts` and `etsy/sync.ts` (both
 * `server-only`, so the constant cannot live there and still reach the table).
 * Same reasoning as `ebay/guards.ts`: the UI must state the exact bound the
 * server enforces, and two copies of a number always drift.
 */
export const MAX_PRICE_PUSH_ATTEMPTS = 3;

export type PriceChipState =
  /** Nothing to report — not listed, or every push has landed. */
  | 'none'
  /** At least one consecutive failure, still inside the retry budget. */
  | 'failing'
  /** At/over the retry ceiling: the planner now skips it entirely. */
  | 'stalled';

/** The subset of a listing row this needs; both providers satisfy it. */
export interface PriceChipInput {
  error_count?: number | null;
  last_error?: string | null;
}

export function resolvePriceChipState(listing: PriceChipInput | null | undefined): PriceChipState {
  if (!listing) return 'none';
  const errors = listing.error_count ?? 0;
  if (errors >= MAX_PRICE_PUSH_ATTEMPTS) return 'stalled';
  if (errors > 0) return 'failing';
  return 'none';
}

export interface PriceChipView {
  label: string;
  /** Full sentence for the row's `title` tooltip, including the stored cause. */
  tooltip: string;
  bg: string;
  fg: string;
}

/**
 * Returns null when there is nothing worth showing. The chip is deliberately
 * ABSENT rather than green on the happy path: this column already carries a
 * status chip per marketplace, and a second permanent chip on all 131 rows would
 * cost more attention than it pays back. A price chip appearing at all means
 * something needs looking at.
 */
export function resolvePriceChip(listing: PriceChipInput | null | undefined): PriceChipView | null {
  const state = resolvePriceChipState(listing);
  if (state === 'none') return null;

  const cause = listing?.last_error ? ` Last error: ${listing.last_error}` : '';
  if (state === 'stalled') {
    return {
      label: 'Price stalled',
      tooltip:
        `Price pushes have failed ${MAX_PRICE_PUSH_ATTEMPTS} times in a row, so this listing is now `
        + `skipped by the daily push. A successful push resets it.${cause}`,
      bg: 'color-mix(in srgb, var(--color-error) 20%, transparent)',
      fg: 'var(--color-error)',
    };
  }
  const attempts = listing?.error_count ?? 0;
  return {
    label: 'Price failed',
    tooltip:
      `The last price push failed (${attempts} of ${MAX_PRICE_PUSH_ATTEMPTS} attempts before it is `
      + `skipped). It will be retried on the next run.${cause}`,
    bg: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
    fg: 'var(--color-error)',
  };
}
