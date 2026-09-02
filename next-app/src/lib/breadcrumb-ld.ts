// BreadcrumbList JSON-LD for every public page.
//
// Why one helper (2026-09-02): Google names a clear, consistent page hierarchy
// as the main input to sitelinks and to the "site name" shown above a result,
// and only the newer SEO pages carried breadcrumb schema — each with its own
// hand-written object. This builds the identical shape those pages emit
// (Home → parent → page, absolute URLs, the locale prefix applied once) so a
// page cannot get the locale or the position numbering wrong.
//
// Schema only, no visible trail: the ten pages that already had breadcrumbs
// were built the same way, and a visible breadcrumb bar is a layout change
// that needs its own mockup + approval.

const SITE_ORIGIN = 'https://naplesestatejewelry.com';

export type Crumb = {
  /** Visible page name in the active locale — match the page's title/h1. */
  name: string;
  /** Locale-agnostic path with a leading slash, e.g. '/gold-services'. */
  path: string;
};

export type BreadcrumbListLd = {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: { '@type': 'ListItem'; position: number; name: string; item: string }[];
};

/**
 * Home → …crumbs, positions 1..n, absolute `item` URLs. The home item is the
 * bare origin for English (`https://naplesestatejewelry.com`, no trailing
 * slash — identical to what the guide pages already publish) and
 * `/es` for Spanish.
 */
export function breadcrumbLd(locale: string, crumbs: readonly Crumb[]): BreadcrumbListLd {
  if (crumbs.length === 0) {
    throw new Error('breadcrumbLd: at least one crumb below Home is required');
  }
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';
  const items = crumbs.map((crumb, index) => {
    if (!crumb.path.startsWith('/') || crumb.path === '/') {
      throw new Error(`breadcrumbLd: crumb path must be a non-root path with a leading slash, got "${crumb.path}"`);
    }
    return {
      '@type': 'ListItem' as const,
      position: index + 2,
      name: crumb.name,
      item: `${SITE_ORIGIN}${prefix}${crumb.path}`,
    };
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: isEs ? 'Inicio' : 'Home', item: `${SITE_ORIGIN}${prefix}` },
      ...items,
    ],
  };
}
