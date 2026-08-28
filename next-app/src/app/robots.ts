import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Only paths that cannot express their own `noindex` belong here.
      // `/admin` renders real metadata when an admin is signed in, `/api`
      // serves no HTML, and `/shop-modern` is not linked anywhere — so a
      // crawl block is the only control available for them.
      //
      // ⛔ Do NOT re-add `/account` or `/checkout`. Every one of those routes
      // emits `robots: { index: false, follow: false }` (account via
      // `getAccountMetadata()` in `src/lib/account-metadata.ts`, checkout in
      // its own page). Blocking them here PREVENTS Googlebot from fetching
      // the page, so it can never read that `noindex` — which left the tag
      // unreachable and the URLs indexable-by-link. Letting Google crawl and
      // obey `noindex` is the directive that actually removes them.
      disallow: [
        '/admin', '/api', '/shop-modern',
        '/en/admin', '/es/admin',
      ],
    },
    sitemap: 'https://naplesestatejewelry.com/sitemap.xml',
  };
}
