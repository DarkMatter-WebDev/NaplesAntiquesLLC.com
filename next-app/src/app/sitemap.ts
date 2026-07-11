import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SERVICE_AREAS } from '@/lib/service-areas';

const BASE = 'https://naplesestatejewelry.co';

// Stable last-modified date for content pages. Using a fixed date (bumped when
// page content is meaningfully updated) avoids sending a churning "modified now"
// signal on every crawl, which dilutes the freshness signal for pages that did
// not actually change.
const CONTENT_LAST_MODIFIED = new Date('2026-07-11');

const STATIC_PAGES = [
  { path: '', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/sell', priority: 0.9, changeFrequency: 'monthly' },
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
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/cookie-preferences', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/accessibility', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/returns-refunds', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/shipping', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/auction-terms', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/vendor-terms', priority: 0.1, changeFrequency: 'yearly' },
] as const;

// One entry per page carrying en/es hreflang alternates (Google reads the
// alternates rather than needing a separate /es row), plus a lastModified so the
// shop and products get recrawled when they change.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const { path, priority, changeFrequency } of STATIC_PAGES) {
    // The shop reprices daily, so it genuinely changes often; other static
    // pages use the stable content date rather than "now".
    const lastModified = path === '/shop' ? now : CONTENT_LAST_MODIFIED;
    entries.push({
      url: `${BASE}${path}`,
      lastModified,
      priority,
      changeFrequency,
      alternates: { languages: { en: `${BASE}${path}`, es: `${BASE}/es${path}` } },
    });
  }

  // Buy-side local landing pages (/sell/[city]).
  for (const area of SERVICE_AREAS) {
    const path = `/sell/${area.slug}`;
    entries.push({
      url: `${BASE}${path}`,
      lastModified: CONTENT_LAST_MODIFIED,
      priority: 0.8,
      changeFrequency: 'monthly',
      alternates: { languages: { en: `${BASE}${path}`, es: `${BASE}/es${path}` } },
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
      .select('id, status, updated_at')
      .in('status', ['available', 'Available']);

    if (products) {
      for (const { id, updated_at } of products) {
        entries.push({
          url: `${BASE}/shop/${id}`,
          lastModified: updated_at ? new Date(updated_at as string) : now,
          priority: 0.6,
          changeFrequency: 'weekly',
          alternates: { languages: { en: `${BASE}/shop/${id}`, es: `${BASE}/es/shop/${id}` } },
        });
      }
    }
  } catch {
    // Supabase unavailable at build time — static pages only
  }

  return entries;
}
