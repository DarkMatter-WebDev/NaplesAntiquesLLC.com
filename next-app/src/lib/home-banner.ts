/**
 * The homepage announcement strip — admin-editable copy, link, and visibility.
 *
 * PURE and client-safe on purpose (the admin panel previews it live): this
 * module holds the shape, the default, validation, and resolution. Fetching
 * lives in the server-only `home-banner-server.ts`, mirroring the
 * business-location / store-hours split.
 */

export interface HomeBannerSettings {
  /** Master switch. Off = the hero starts at the carousel, no strip at all. */
  enabled: boolean;
  eyebrowEn: string;
  messageEn: string;
  /** Blank falls back to the EN string — see `resolveHomeBanner()`. */
  eyebrowEs: string;
  messageEs: string;
  /** Off = the strip renders as a plain <div> with no arrow (see below). */
  linkEnabled: boolean;
  /** Locale-LESS path; `/es` is prefixed at render time. */
  linkPath: string;
}

/**
 * The copy this strip shipped with (owner, 2026-08-11: promote the
 * free-evaluation offer). Served whenever the DB value is null, malformed, or
 * unreachable, so the homepage can never render a blank or broken strip.
 */
export const DEFAULT_HOME_BANNER: HomeBannerSettings = {
  enabled: true,
  eyebrowEn: 'Summer special',
  messageEn: 'Schedule a free evaluation',
  eyebrowEs: 'Oferta de verano',
  messageEs: 'Programe una evaluación gratuita',
  linkEnabled: true,
  linkPath: '/free-evaluation',
};

/**
 * Where the strip may point. Curated marketing destinations only — no admin,
 * checkout, account, or legal routes, which are not promo targets. Paths are
 * locale-less; `resolveHomeBanner()` adds the `/es` prefix.
 */
export const HOME_BANNER_LINK_OPTIONS: ReadonlyArray<{ path: string; labelEn: string }> = [
  { path: '/free-evaluation', labelEn: 'Free evaluation' },
  { path: '/shop', labelEn: 'Shop' },
  { path: '/sell', labelEn: 'Sell your jewelry' },
  { path: '/services', labelEn: 'Services' },
  { path: '/trade-in', labelEn: 'Trade-in' },
  { path: '/bullion', labelEn: 'Bullion' },
  { path: '/contact', labelEn: 'Contact' },
  { path: '/about', labelEn: 'About' },
  { path: '/faq', labelEn: 'FAQ' },
];

/**
 * ⚠️ MEASURED length budget, per locale, for `eyebrow + message` combined.
 *
 * The strip is `white-space: nowrap` at a fitted type clamp, so long copy
 * OVERFLOWS rather than wrapping. Both numbers derive from the 2026-08-14
 * measurement recorded in `globals.css` / the homepage: at a 320px viewport
 * the strip has ~304px of usable width; the shipped Spanish copy is 48 chars
 * and used 273.6px (30.4px slack), the English 40 chars and 228.3px — i.e.
 * ~5.66px per character at that size.
 *
 * - `SAFE` (48) is the shipped Spanish length: known-good, measured.
 * - `MAX` (53) is 304px ÷ 5.66px — the computed point where it overflows.
 *
 * Spanish is the binding locale, but the budget is applied to EACH locale
 * because either can be edited. Re-measure at 320px if the clamp ever changes.
 */
export const BANNER_SAFE_CHARS = 48;
export const BANNER_MAX_CHARS = 53;

/** Combined visible length for one locale, as the budget counts it. */
export function bannerLength(eyebrow: string, message: string): number {
  return eyebrow.trim().length + message.trim().length;
}

export interface ResolvedHomeBanner {
  /** One or two strings; the `·` separator is rendered between them. */
  fragments: string[];
  /** Locale-prefixed href, or null when the link is switched off. */
  href: string | null;
}

/**
 * The strip as the homepage should render it, or `null` when it is switched
 * off or has no copy at all (an empty strip is worse than no strip).
 *
 * Spanish falls back to English per FIELD, not per banner: an owner who
 * translates the message but not the eyebrow gets their translation plus the
 * English eyebrow, rather than silently losing the translated half.
 */
export function resolveHomeBanner(
  settings: HomeBannerSettings,
  isEs: boolean,
): ResolvedHomeBanner | null {
  if (!settings.enabled) return null;

  const eyebrow = (isEs ? settings.eyebrowEs.trim() || settings.eyebrowEn.trim() : settings.eyebrowEn.trim());
  const message = (isEs ? settings.messageEs.trim() || settings.messageEn.trim() : settings.messageEn.trim());
  const fragments = [eyebrow, message].filter((fragment) => fragment.length > 0);
  if (fragments.length === 0) return null;

  return {
    fragments,
    href: settings.linkEnabled ? `${isEs ? '/es' : ''}${settings.linkPath}` : null,
  };
}

/**
 * Validate an untrusted value (jsonb column or PUT body). Returns null on ANY
 * defect — callers fall back to `DEFAULT_HOME_BANNER` (reads) or reject with a
 * per-field message (the admin API re-implements these checks with error
 * strings; keep the two in sync).
 */
export function parseHomeBanner(value: unknown): HomeBannerSettings | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  const booleans = ['enabled', 'linkEnabled'] as const;
  const strings = ['eyebrowEn', 'messageEn', 'eyebrowEs', 'messageEs', 'linkPath'] as const;

  for (const key of booleans) {
    if (typeof record[key] !== 'boolean') return null;
  }
  for (const key of strings) {
    if (typeof record[key] !== 'string') return null;
  }

  const linkPath = (record.linkPath as string).trim();
  if (!HOME_BANNER_LINK_OPTIONS.some((option) => option.path === linkPath)) return null;

  const settings: HomeBannerSettings = {
    enabled: record.enabled as boolean,
    eyebrowEn: (record.eyebrowEn as string).trim(),
    messageEn: (record.messageEn as string).trim(),
    eyebrowEs: (record.eyebrowEs as string).trim(),
    messageEs: (record.messageEs as string).trim(),
    linkEnabled: record.linkEnabled as boolean,
    linkPath,
  };

  // The overflow guard is part of the contract, not just admin-side polish —
  // a hand-edited row must not be able to break the header on phones.
  if (bannerLength(settings.eyebrowEn, settings.messageEn) > BANNER_MAX_CHARS) return null;
  if (bannerLength(settings.eyebrowEs, settings.messageEs) > BANNER_MAX_CHARS) return null;

  return settings;
}
