/**
 * Site-level JSON-LD identity: the `WebSite` entity (homepage only) and the
 * stable `@id`s that tie it to the sitewide `JewelryStore` entity.
 *
 * Why `WebSite` exists: Google prints a site name on its own line above each
 * result, taken from this entity on the domain's home page. Without a name it
 * trusts, it shows the bare domain ("naplesestatejewelry.com"), which is what
 * results still showed on 2026-09-14, a month after the entity first shipped.
 *
 * Shape follows Google's site-name spec
 * (developers.google.com/search/docs/appearance/site-names):
 * - `url` is the canonical home page WITH the trailing slash, as in Google's
 *   own example (`https://example.com/`).
 * - ONE `WebSite` node on the home page; identical on `/` and `/es` (Google
 *   asks for identical data on duplicate home pages).
 * - `publisher` points at the JewelryStore by `@id`, so the site and the
 *   business resolve to one entity with one name.
 *
 * ⛔ The name is "Naples Estate Jewelry". No slogan ("#1 …"), no "Co", no legal
 * entity. Google's guideline is "a concise, commonly-recognized name" and it
 * cross-checks the Google Business Profile, the page title and `og:site_name`.
 *
 * `alternateName: ["NaplesEstateJewelry.com"]` (owner, 2026-09-14). This is the
 * wordmark on the logo and boot splash, so it is a form of the brand the site
 * genuinely shows. Google uses it only when it isn't confident in `name`: its
 * doc says it "strongly considers" alternates in that case, and a
 * descriptive-sounding name on a young domain is exactly that case. Mixed case
 * on purpose: an all-lowercase domain is read as a domain preference, which is
 * the bare-domain display this replaces. This is a SITE-name fallback, not a
 * business alias. The JewelryStore entity keeps its no-alternateName rule.
 */

export const SITE_ORIGIN = 'https://naplesestatejewelry.com';
export const SITE_HOME_URL = `${SITE_ORIGIN}/`;
export const SITE_BRAND_NAME = 'Naples Estate Jewelry';
export const BUSINESS_ENTITY_ID = `${SITE_ORIGIN}/#business`;
export const WEBSITE_ENTITY_ID = `${SITE_ORIGIN}/#website`;
/** Site-name fallback, in order of preference. See the header comment. */
export const SITE_ALTERNATE_NAMES = ['NaplesEstateJewelry.com'];

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ENTITY_ID,
    name: SITE_BRAND_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: SITE_HOME_URL,
    publisher: { '@id': BUSINESS_ENTITY_ID },
  };
}
