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
