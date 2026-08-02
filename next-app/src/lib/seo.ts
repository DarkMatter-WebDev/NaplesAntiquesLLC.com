// Shared SEO helpers for canonical + hreflang alternates.
//
// The site serves English at the apex path and Spanish under /es. Every page
// should declare a self-referencing canonical plus en/es/x-default alternates so
// Google treats the two language versions as alternates rather than duplicates.
// `metadataBase` (set in the root layout) resolves these relative paths.

export type AppLocale = 'en' | 'es';

/**
 * Build `alternates` for a page. Pass the locale-agnostic path (no locale
 * prefix, leading slash, '' for home) and the current locale.
 *   alternatesFor('/free-evaluation', 'es')
 *     → canonical '/es/free-evaluation', languages { en, es, x-default }
 */
export function alternatesFor(path: string, locale: string) {
  const clean = path === '/' ? '' : path;
  const en = clean === '' ? '/' : clean;
  const es = `/es${clean}`;
  return {
    canonical: locale === 'es' ? es : en,
    languages: {
      en,
      es,
      'x-default': en,
    },
  };
}
