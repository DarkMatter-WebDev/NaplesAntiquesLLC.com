// Client-safe eBay write guards. Kept out of sync.ts (which is `server-only`)
// so the admin UI can state the same limits it enforces server-side.

/**
 * Maximum listings one bulk enqueue may stage for a write.
 *
 * This is the standing "never blanket re-sync" rule made mechanical: a policy
 * or template change can mark the whole catalog out-of-date at once, and a
 * single unbounded run would rewrite every live listing before anyone could
 * spot-check the first one. Bulk sync therefore hands back a batch at a time.
 */
export const EBAY_BULK_ENQUEUE_LIMIT = 25;

/**
 * Individual products the owner has decided not to list on eBay.
 *
 * PER-ITEM ON PURPOSE, not per-category. The owner's decision (2026-08-11) was
 * about these two watches specifically — other watches may well be listed later
 * — so this must NOT become a `Watch` rule the way Coin/Bullion is a category
 * rule in `isEbayIneligibleProductType`. Adding a watch to the catalog in future
 * should just work; only these ids are held back.
 *
 * Both would otherwise fail publish anyway with "The item specific Department is
 * missing" (eBay category 31387 requires a Men's/Women's/Unisex aspect that
 * `mapAspects` does not send). Listing them here turns that into a clear,
 * intentional "not listed" instead of a red error the bulk queue keeps retrying.
 * If watches are wanted on eBay later, map Department and remove the id — see
 * DECISIONS, "Watches are not listed on eBay".
 *
 * Distinct from EBAY_WRITE_BLOCKED_PRODUCT_IDS, which means "live on eBay but
 * unsafe to write to". These are simply not for sale on that channel.
 */
export const EBAY_EXCLUDED_PRODUCT_IDS: ReadonlySet<string> = new Set([
  'rolex-gmt-master-ii-18k-yellow-gold-watch-ref-116718ln-black-ceramic-bezel-black-dial-83',
  'rolex-yacht-master-18k-yellow-gold-men-s-watch-model-16628-ca-1998-84',
]);

export const EBAY_EXCLUDED_REASON =
  'This item is not listed on eBay per owner decision.';
