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
