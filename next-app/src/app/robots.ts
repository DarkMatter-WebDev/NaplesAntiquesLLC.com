import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin', '/account', '/api', '/checkout', '/shop-modern',
        '/en/admin', '/en/account', '/en/checkout',
        '/es/admin', '/es/account', '/es/checkout',
      ],
    },
    sitemap: 'https://naplesestatejewelry.com/sitemap.xml',
  };
}
