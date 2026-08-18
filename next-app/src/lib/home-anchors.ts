/**
 * In-page anchor ids on the homepage.
 *
 * One constant per anchor because the id and the `href="#..."` that targets it
 * live in different files — the hero overlay links to a block rendered by the
 * page itself. A hardcoded string in each would break silently: the browser
 * simply does nothing for an unknown hash, so a typo produces a dead button
 * with no error anywhere.
 */

/**
 * The "Call or Visit Us Today" block at the foot of the homepage — phone,
 * invitation, address, hours and map.
 *
 * ⚠️ The element carrying this id must also carry
 * `scroll-margin-top: var(--site-header-height)`, or the fixed header covers
 * the top of the block on arrival.
 */
export const VISIT_ANCHOR_ID = 'visit-us';
