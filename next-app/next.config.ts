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
