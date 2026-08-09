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
  // NOTE: there is deliberately no `redirects()` here. On Netlify the
  // next-intl proxy runs as an edge function ahead of the Next.js server and
  // rewrites locale-less paths to `/en/...`, so config redirects NEVER fire
  // for English URLs — only the `/es/*` twins ever reached them, which hid
  // 22 dead redirects in production until 2026-08-02. Every legacy/retired
  // path now lives in src/lib/legacy-redirects.ts and is served by
  // src/proxy.ts before the locale rewrite. Do not re-add rules here.
  images: {
    // AVIF first (smaller at the same visual quality), WebP fallback. The
    // browser gets whichever it supports; both are served at the requested
    // display size, so a full-res source is never shipped to a small card.
    formats: ['image/avif', 'image/webp'],
    // Next 16 only honors quality values listed here — a value not in this list
    // is served as an error, not silently clamped. 75 is the default used by
    // other <Image> on the site; 82 is the hero carousel (see below); 90 is
    // retained so any remaining caller keeps working.
    //
    // The carousel moved 90 -> 82 on 2026-08-09. Its cards only ever request
    // w=640 (measured), so the source is already downscaled hard before quality
    // is applied, and 90 was buying detail at a size that cannot show it.
    // Measured on three representative hero photos through this optimizer:
    // 23.3/39.6/98.1 KB at q90 against 13.0/21.8/50.6 KB at q75 — i.e. quality
    // is worth roughly half the payload here, which is the single largest
    // mobile cost in the hero.
    qualities: [75, 82, 90],
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
