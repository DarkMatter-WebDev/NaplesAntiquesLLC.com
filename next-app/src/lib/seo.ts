// Shared SEO helpers for canonical + hreflang alternates.
//
// The site serves English at the apex path and Spanish under /es. Every page
// should declare a self-referencing canonical plus en/es/x-default alternates so
// Google treats the two language versions as alternates rather than duplicates.
// `metadataBase` (set in the root layout) resolves these relative paths.

export type AppLocale = 'en' | 'es';

/**
 * Shared social-card constants.
 *
 * These live here rather than in the root layout because **a page-level
 * `openGraph` OVERWRITES the layout's entirely — Next merges metadata shallowly,
 * it does not deep-merge.** So any page that localizes its og:title must also
 * re-declare siteName, type and images, and without one source for them the
 * image path would exist in two files and drift. Losing `og:image` that way is
 * silent: the page still renders, the share card just goes blank.
 */
export const SITE_NAME = 'Naples Estate Jewelry';

export const OG_IMAGE = {
  url: '/assets/images/pages/og-preview.webp',
  width: 1200,
  height: 630,
} as const;

/**
 * Open Graph locale codes. `og:locale` was absent before 2026-08-16, which left
 * Facebook assuming `en_US` on the Spanish pages.
 */
export function ogLocaleFor(locale: string): string {
  return locale === 'es' ? 'es_ES' : 'en_US';
}

/** The one title suffix. `layout.tsx` builds its `title.template` from this. */
export const TITLE_SUFFIX = ` | ${SITE_NAME}`;

export type PageMetadataInput = {
  /** Page title WITHOUT the brand suffix — the template adds it to <title>. */
  title: string;
  description: string;
  /** Locale-agnostic path, leading slash, '/' for home. */
  path: string;
  locale: string;
  /**
   * Set when `title` already carries the brand and must not be suffixed again
   * (the homepage, whose title leads with the brand instead of trailing it).
   */
  brandedTitle?: boolean;
  /** Page-specific share image. Falls back to OG_IMAGE when absent or null. */
  image?: { url: string; width?: number; height?: number } | null;
};

/**
 * Builds a page's complete metadata: title, description, canonical/hreflang, and
 * a full social card.
 *
 * Use this for every public page. Three things it exists to prevent, each of
 * which was a real defect found on 2026-08-16:
 *
 * 1. **`og:title` does not inherit `title`, and the `title.template` does NOT
 *    apply to it** — verified empirically, not assumed: a page declaring
 *    `openGraph.title: 'ZZPROBE'` emitted exactly `ZZPROBE`, unsuffixed. Pages
 *    that set only `title` therefore inherited the ROOT layout's og:title, so
 *    every interior page shared as the homepage. Hence `TITLE_SUFFIX` is
 *    applied here explicitly.
 * 2. **A page-level `openGraph` REPLACES the layout's** rather than merging, so
 *    `type`/`siteName`/`images` must be restated. `/sell` and every
 *    `/sell/[city]` page declared `openGraph` without `images` and were posting
 *    BLANK share cards in production.
 * 3. **An empty `images` array is as blank as none at all.** Product pages used
 *    `images: image ? [{url: image}] : []`, so an image-less product shared as
 *    nothing. `image` here falls back to OG_IMAGE instead.
 */
export function pageMetadata(input: PageMetadataInput) {
  const { title, description, path, locale, brandedTitle = false, image } = input;
  const alternates = alternatesFor(path, locale);
  const socialTitle = brandedTitle ? title : `${title}${TITLE_SUFFIX}`;
  const shareImage = image ?? OG_IMAGE;

  return {
    title: brandedTitle ? { absolute: title } : title,
    description,
    alternates,
    openGraph: {
      type: 'website' as const,
      siteName: SITE_NAME,
      // Same value as the canonical, from the same helper, so they cannot drift.
      url: alternates.canonical,
      locale: ogLocaleFor(locale),
      alternateLocale: ogLocaleFor(locale === 'es' ? 'en' : 'es'),
      title: socialTitle,
      description,
      images: [shareImage],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: socialTitle,
      description,
      images: [shareImage.url],
    },
  };
}

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
