import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin', '/account', '/api', '/checkout', '/payment', '/shop-modern',
        '/en/admin', '/en/account', '/en/checkout', '/en/payment',
        '/es/admin', '/es/account', '/es/checkout', '/es/payment',
      ],
    },
    sitemap: 'https://naplesestatejewelry.co/sitemap.xml',
  };
}
