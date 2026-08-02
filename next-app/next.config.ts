import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://evzluixourmsefwdsieu.supabase.co https://s3.tradingview.com https://*.tradingview.com https://*.paypal.com https://*.paypalobjects.com https://*.cloudflarestream.com https://*.videodelivery.net",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://s3.tradingview.com https://www.paypal.com https://*.paypalobjects.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://evzluixourmsefwdsieu.supabase.co https://api.gold-api.com https://s3.tradingview.com https://*.tradingview.com https://*.tradingview-widget.com https://*.paypal.com https://*.cloudflarestream.com https://*.videodelivery.net",
  "frame-src https://*.tradingview.com https://*.tradingview-widget.com https://*.paypal.com https://*.cloudflarestream.com https://*.videodelivery.net",
  "media-src 'self' blob: https://*.cloudflarestream.com https://*.videodelivery.net",
  "worker-src 'self' blob:",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
] as const;

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
  // The Instagram card renders its type with Satori, which needs the actual
  // font bytes at runtime. Nothing imports these files, so tracing cannot infer
  // them and the serverless bundle would ship without them — every card render
  // would then fail with ENOENT. Keep this in sync with FONT_DIR in
  // src/lib/instagram/card.ts.
  outputFileTracingIncludes: {
    '/api/admin/instagram/**': ['./src/assets/fonts/**'],
    // Facebook prepare renders the same generated card, so it needs the same
    // font files in its serverless bundle.
    '/api/admin/facebook/**': ['./src/assets/fonts/**'],
    // On-demand card rendering for the panels' "Generate card" button.
    '/api/admin/card-preview': ['./src/assets/fonts/**'],
  },
  // Dev-only: lets `npm run dev` (which already binds 0.0.0.0) accept requests
  // from this machine's LAN IP too, not just localhost — needed so hot-reload
  // and internal /_next asset requests aren't blocked when testing from a
  // phone/tablet at http://<your-LAN-IP>:3000. No effect on production/builds.
  // If your LAN IP changes (DHCP), update it here or just add another entry.
  allowedDevOrigins: ['192.168.119.224', '192.168.119.*', '10.0.0.208', '10.0.0.*'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [...SECURITY_HEADERS],
      },
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
    // Habitual /cart typing should land somewhere real, not 404. /cart is a
    // drawer (no page), so send it to the shop. (`/sell` is now a real hub page
    // — the buy-side local landing pages live at /sell and /sell/[city].)
    rules.push({ source: '/cart', destination: '/shop', permanent: false });
    rules.push({ source: '/es/cart', destination: '/es/shop', permanent: false });
    // Saved items / wishlist are a drawer (no page); keep these URLs off 404.
    for (const p of ['/wishlist', '/saved', '/account/saved']) {
      rules.push({ source: p, destination: '/shop', permanent: false });
      rules.push({ source: `/es${p}`, destination: '/es/shop', permanent: false });
    }
    // Retired pages (2026-08-01): the auctions page and the two aspirational
    // legal pages. These MUST live here rather than in netlify.toml — the
    // next-intl proxy handles locale-less paths (`/auctions`) inside the
    // framework before Netlify's redirect engine sees them, so even a forced
    // Netlify rule never fires for the English URLs (the `/es/*` ones did
    // work, which is what exposed the split). Config redirects run ahead of
    // the proxy, so these catch both locales. The netlify.toml rules stay as
    // a defense-in-depth fallback.
    for (const [retired, dest] of Object.entries({
      '/auctions': '/shop',
      '/auction-terms': '/terms',
      '/vendor-terms': '/terms',
    })) {
      rules.push({ source: retired, destination: dest, permanent: true });
      rules.push({ source: `/es${retired}`, destination: `/es${dest}`, permanent: true });
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
