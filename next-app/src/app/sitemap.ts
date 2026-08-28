import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SERVICE_AREAS } from '@/lib/service-areas';
import { LEGAL_NOINDEX_PATHS } from '@/lib/legal-metadata';

const BASE = 'https://naplesestatejewelry.com';

// Stable last-modified date for content pages. Using a fixed date (bumped when
// page content is meaningfully updated) avoids sending a churning "modified now"
// signal on every crawl, which dilutes the freshness signal for pages that did
// not actually change.
const CONTENT_LAST_MODIFIED = new Date('2026-08-17');

// Both locale prefixes the app serves. EVERY public page exists in both, so each
// language version gets its OWN <url> entry — Google's documented pattern —
// rather than the Spanish page appearing only as an alternate inside the English
// entry. Before 2026-08-27 no /es URL was ever submitted, despite the Spanish
// pages consistently outranking their English twins.
// ⛔ Do not add an '/en' prefix here: /en/* is not a route, it 307-redirects to
// the bare path, and those redirects are already crawl noise.
const LOCALE_PREFIXES = ['', '/es'] as const;

// The same alternate set is attached to every language version of a page, which
// is what makes the annotations bidirectional. `x-default` points at English.
function languageAlternates(path: string) {
  return {
    languages: {
      en: `${BASE}${path}`,
      es: `${BASE}/es${path}`,
      'x-default': `${BASE}${path}`,
    },
  };
}

const STATIC_PAGES = [
  { path: '', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/sell', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/shop', priority: 0.9, changeFrequency: 'daily' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/services', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/free-evaluation', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/estate-jewelry', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/gold-services', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/silver-services', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/bullion', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/trade-in', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/estate-services', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/cookie-preferences', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/accessibility', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/returns-refunds', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/shipping', priority: 0.3, changeFrequency: 'yearly' },
] as const;

// One entry per language version per page, each carrying en/es/x-default
// alternates, plus a lastModified so the shop and products get recrawled when
// they change.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Emits the English and Spanish URL for one path. Callers must already have
  // excluded anything that is `noindex` — this helper does not re-check, and it
  // would otherwise duplicate the contradiction across both locales.
  const pushLocalized = (
    path: string,
    lastModified: Date,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  ) => {
    for (const prefix of LOCALE_PREFIXES) {
      entries.push({
        url: `${BASE}${prefix}${path}`,
        lastModified,
        priority,
        changeFrequency,
        alternates: languageAlternates(path),
      });
    }
  };

  for (const { path, priority, changeFrequency } of STATIC_PAGES) {
    // A `noindex` page must never be submitted here — the sitemap would be
    // asking Google to index what the page header forbids. Filtered from the
    // single source in legal-metadata.ts rather than by pruning STATIC_PAGES,
    // so re-adding one of these paths above cannot silently reintroduce the
    // contradiction. ⚠️ The `continue` skips BOTH locales, which is required:
    // the Spanish legal pages carry the same `noindex` as the English ones.
    if (LEGAL_NOINDEX_PATHS.includes(path)) continue;

    // The shop reprices daily, so it genuinely changes often; other static
    // pages use the stable content date rather than "now".
    const lastModified = path === '/shop' ? now : CONTENT_LAST_MODIFIED;
    pushLocalized(path, lastModified, priority, changeFrequency);
  }

  // Buy-side local landing pages (/sell/[city]).
  for (const area of SERVICE_AREAS) {
    pushLocalized(`/sell/${area.slug}`, CONTENT_LAST_MODIFIED, 0.8, 'monthly');
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
        // Same availability filter governs both locales, so a sold item leaves
        // the English and Spanish sitemaps together.
        pushLocalized(
          `/shop/${id}`,
          updated_at ? new Date(updated_at as string) : now,
          0.6,
          'weekly',
        );
      }
    }
  } catch {
    // Supabase unavailable at build time — static pages only
  }

  return entries;
}
