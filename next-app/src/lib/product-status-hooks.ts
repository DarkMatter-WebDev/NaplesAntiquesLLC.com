import 'server-only';
import { after } from 'next/server';
import {
  handleProductStatusChange as handleEtsyProductStatusChange,
  scanAndMarkOutOfDate as scanEtsyOutOfDate,
} from '@/lib/etsy/sync';
import {
  handleProductStatusChange as handleEbayProductStatusChange,
  scanAndMarkOutOfDate as scanEbayOutOfDate,
} from '@/lib/ebay/sync';
import { syncProductsToDeepField } from '@/lib/deepfield/sync';

/**
 * The one place a product write tells the marketplaces about itself.
 *
 * WHY THIS EXISTS — a sold item stayed buyable for 12 days
 * -------------------------------------------------------
 * These hooks used to be launched as bare floating promises at six call sites:
 *
 *     void handleEbayProductStatusChange(ids).catch(() => {});
 *
 * On Netlify the Lambda freezes the moment the response flushes, so an eBay or
 * Etsy request still in flight is killed where it stands. Nothing awaits the
 * promise, so nothing knows to wait for it. Next registers `after()` callbacks
 * as pending work and drains them before exit — a bare `void promise` is not
 * registered at all.
 *
 * Measured 2026-08-21: 39 of 41 sold products delisted correctly on each
 * channel, and 2 did not. `10k-gold-monaco-cuban-link-necklace` (sold
 * 2026-08-09) and `10k-gold-rope-chain-necklace` (sold 2026-08-10) were left
 * `published`/`active` on both marketplaces. It is a RACE, not a broken code
 * path — the same hook succeeded on 2026-08-12, after both failures.
 *
 * ⛔ The tell that this was a kill and not an error: `handleProductStatusChange`
 * writes a `status_change_hook` error row for ANY throw, and that path works
 * (it fired twice for the Monaco on 2026-07-29). The August failures left **no
 * row of any kind** and no partial write — `sync_state` never moved off
 * `out_of_date`, `last_pushed_qty` never moved off 1. Execution simply stopped.
 *
 * ⚠️ Both August misses happened to be items that had sold ON eBay, so the
 * marketplace decremented its own quantity and covered for us. A website or
 * in-store sale has no such safety net: the item stays live and purchasable on
 * both channels until a human notices. That is why the PayPal capture and
 * webhook routes matter most here.
 *
 * ⛔ Do NOT "simplify" this back to `void promise.catch(() => {})`. It will look
 * identical in every test and in local dev, where the process does not freeze,
 * and it will silently drop roughly one sale in twenty in production.
 */
export interface ProductStatusHookOptions {
  /**
   * Also re-hash content and flag drifted listings `out_of_date`. Admin product
   * writes want this (a price or copy edit changes the mapped payload); the
   * PayPal paths do not — a sale changes status, not listing content.
   */
  scanOutOfDate?: boolean;
}

/**
 * Schedule the marketplace + Deep Field side effects for a product write.
 *
 * Returns immediately: the work runs after the response is sent, exactly as
 * before, but as work the runtime knows about. Failures are logged rather than
 * swallowed — a silent `.catch(() => {})` is what let the August misses go
 * unnoticed for twelve days.
 */
export function scheduleProductStatusHooks(
  productIds: string[],
  options: ProductStatusHookOptions = {},
): void {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return;

  after(async () => {
    // allSettled, not all: one marketplace being down must not cancel the
    // other, and must not skip the Deep Field push.
    const results = await Promise.allSettled([
      handleEtsyProductStatusChange(ids),
      handleEbayProductStatusChange(ids),
      syncProductsToDeepField(ids),
      ...(options.scanOutOfDate ? [scanEtsyOutOfDate(ids), scanEbayOutOfDate(ids)] : []),
    ]);

    const labels = [
      'etsy:status-change',
      'ebay:status-change',
      'deepfield:sync',
      ...(options.scanOutOfDate ? ['etsy:scan-out-of-date', 'ebay:scan-out-of-date'] : []),
    ];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        // Visible on purpose. These are best-effort side effects and must never
        // fail the caller, but "best-effort" is not a reason to be silent about
        // a sold item that did not come down.
        console.error(
          `[product-status-hooks] ${labels[index]} failed for ${ids.join(', ')}:`,
          result.reason,
        );
      }
    });
  });
}
