import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const BASE = 'https://naplesestatejewelry.co';

const STATIC_PAGES = [
  { path: '', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/shop', priority: 0.9, changeFrequency: 'daily' },
  { path: '/auctions', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/services', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/free-evaluation', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/estate-jewelry', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/gold-services', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/silver-services', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/bullion', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/estate-services', priority: 0.8, changeFrequency: 'monthly' },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Static pages — EN (no prefix) + ES (/es prefix)
  for (const { path, priority, changeFrequency } of STATIC_PAGES) {
    entries.push({
      url: `${BASE}${path}`,
      priority,
      changeFrequency,
    });
    entries.push({
      url: `${BASE}/es${path}`,
      priority: priority * 0.9,
      changeFrequency,
    });
  }

  // Dynamic product pages from Supabase (anon read — no cookies needed)
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: products } = await supabase
      .from('products')
      .select('id, status')
      .eq('status', 'Available');

    if (products) {
      for (const { id } of products) {
        entries.push({ url: `${BASE}/shop/${id}`, priority: 0.6, changeFrequency: 'weekly' });
        entries.push({ url: `${BASE}/es/shop/${id}`, priority: 0.5, changeFrequency: 'weekly' });
      }
    }
  } catch {
    // Supabase unavailable at build time — static pages only
  }

  return entries;
}
