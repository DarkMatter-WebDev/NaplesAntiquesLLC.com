import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const HTML_PAGES = [
  'index',
  'shop',
  'about',
  'contact',
  'free-evaluation',
  'estate-jewelry',
  'gold-services',
  'silver-services',
  'bullion',
  'faq',
  'privacy',
  'estate-services',
] as const;

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  // Dev-only: lets `npm run dev` (which already binds 0.0.0.0) accept requests
  // from this machine's LAN IP too, not just localhost — needed so hot-reload
  // and internal /_next asset requests aren't blocked when testing from a
  // phone/tablet at http://<your-LAN-IP>:3000. No effect on production/builds.
  // If your LAN IP changes (DHCP), update it here or just add another entry.
  allowedDevOrigins: ['192.168.119.224', '192.168.119.*'],
  async rewrites() {
    // Bare /shop and /es/shop (no filter/sort/page query params at all) are
    // rewritten — URL stays the same, only the internal handler changes —
    // to the static/ISR twin at shop-index, so this by-far-most-common visit
    // (nav links, external links, first-time visitors) gets a prerendered
    // response instead of full per-request dynamic SSR. Any request carrying
    // even one of these keys (a real filter, a saved/shared filtered link,
    // or pagination) is left alone and keeps hitting the real dynamic page,
    // whose behavior is completely unchanged. Listed explicitly rather than
    // "any query string" so harmless params (utm_source, etc.) don't
    // needlessly force the slower path. Keep this list in sync with the
    // `Props['searchParams']` keys in shop/(list)/page.tsx.
    const shopFilterKeys = [
      'metal', 'metalColor', 'metalType', 'purity', 'status', 'itemType',
      'chainType', 'length', 'gender', 'brand', 'q', 'sort', 'page',
      'perPage', 'priceMin', 'priceMax', 'yearMin', 'yearMax', 'itemGroup',
      'view',
    ];
    const missingAllFilters = shopFilterKeys.map((key) => ({ type: 'query' as const, key }));
    return {
      beforeFiles: [
        { source: '/shop', destination: '/shop-index', missing: missingAllFilters },
        { source: '/en/shop', destination: '/en/shop-index', missing: missingAllFilters },
        { source: '/es/shop', destination: '/es/shop-index', missing: missingAllFilters },
      ],
    };
  },
  async headers() {
    return [
      {
        source: '/api/metal-prices',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=300',
          },
        ],
      },
    ];
  },
  async redirects() {
    const rules = [];
    for (const page of HTML_PAGES) {
      const dest = page === 'index' ? '/' : `/${page}`;
      rules.push({ source: `/${page}.html`, destination: dest, permanent: true });
      rules.push({ source: `/es/${page}.html`, destination: page === 'index' ? '/es' : `/es/${page}`, permanent: true });
    }
    // The nav "Sell" entry and habitual /cart typing should land somewhere real,
    // not 404. /cart is a drawer (no page), so send it to the shop.
    rules.push({ source: '/sell', destination: '/free-evaluation', permanent: true });
    rules.push({ source: '/es/sell', destination: '/es/free-evaluation', permanent: true });
    rules.push({ source: '/cart', destination: '/shop', permanent: false });
    rules.push({ source: '/es/cart', destination: '/es/shop', permanent: false });
    // Saved items / wishlist are a drawer (no page); keep these URLs off 404.
    for (const p of ['/wishlist', '/saved', '/account/saved']) {
      rules.push({ source: p, destination: '/shop', permanent: false });
      rules.push({ source: `/es${p}`, destination: '/es/shop', permanent: false });
    }
    // Re-slug the six auto-named "new-listing-0X" products to keyword URLs. Pairs
    // with supabase/reslug-new-listing-products-2026-07.sql (run the SQL and deploy
    // this together — the SQL renames the product ids these redirects point to).
    const reslug: Record<string, string> = {
      'new-listing-01': 'italian-14k-two-tone-cuban-link-ring-station-necklace',
      'new-listing-02': '14k-gold-round-box-link-chain-necklace',
      'new-listing-03': '10k-gold-monaco-cuban-link-necklace',
      'new-listing-04': '14k-gold-rope-chain-necklace',
      'new-listing-05': '10k-gold-rope-chain-necklace',
      'new-listing-06': '14k-gold-semi-solid-cuban-link-chain-necklace',
    };
    for (const [oldId, newId] of Object.entries(reslug)) {
      rules.push({ source: `/shop/${oldId}`, destination: `/shop/${newId}`, permanent: true });
      rules.push({ source: `/es/shop/${oldId}`, destination: `/es/shop/${newId}`, permanent: true });
    }
    return rules;
  },
  images: {
    // AVIF first (smaller at the same visual quality), WebP fallback. The
    // browser gets whichever it supports; both are served at the requested
    // display size, so a full-res source is never shipped to a small card.
    formats: ['image/avif', 'image/webp'],
    // Next 16 only honors quality values listed here. 90 = visually lossless
    // for the carousel; 75 is the default used by other <Image> on the site.
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'evzluixourmsefwdsieu.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
