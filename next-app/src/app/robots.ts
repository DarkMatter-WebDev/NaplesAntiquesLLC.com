import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/api', '/es/admin', '/es/account'],
    },
    sitemap: 'https://naplesestatejewelry.co/sitemap.xml',
  };
}
