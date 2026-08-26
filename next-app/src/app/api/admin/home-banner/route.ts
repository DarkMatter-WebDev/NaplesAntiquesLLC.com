import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { SHOP_SETTINGS_TABLE } from '@/lib/shop-settings';
import {
  BANNER_MAX_CHARS,
  DEFAULT_HOME_BANNER,
  HOME_BANNER_LINK_OPTIONS,
  bannerLength,
  parseHomeBanner,
  type HomeBannerSettings,
} from '@/lib/home-banner';
import { HOME_BANNER_CACHE_TAG } from '@/lib/home-banner-server';

export const runtime = 'nodejs';

const MIGRATION_HINT = 'Run supabase/home-banner-2026-08.sql in the Supabase SQL Editor first.';

function isMissingColumnError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? '');
  return message.toLowerCase().includes('home_banner');
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const service = createServiceClient();
    const { data, error: dbError } = await service
      .from(SHOP_SETTINGS_TABLE)
      .select('home_banner')
      .eq('id', true)
      .maybeSingle();
    // Pre-migration (missing column) still serves the defaults so the panel
    // works; the save is what surfaces the actionable migration message.
    const banner = dbError ? null : parseHomeBanner(data?.home_banner);
    return NextResponse.json({
      banner: banner ?? DEFAULT_HOME_BANNER,
      isDefault: banner === null,
    });
  } catch {
    return NextResponse.json({ banner: DEFAULT_HOME_BANNER, isDefault: true });
  }
}

/**
 * Same rule set as `parseHomeBanner()`, but with a per-field message — the
 * parser collapses every defect to null, which is right for reads and useless
 * for a form. Keep the two in sync.
 */
function validateBannerBody(value: unknown): { banner: HomeBannerSettings } | { error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { error: 'A banner settings object is required.' };
  }
  const record = value as Record<string, unknown>;

  for (const key of ['enabled', 'linkEnabled'] as const) {
    if (typeof record[key] !== 'boolean') return { error: `${key} must be true or false.` };
  }
  for (const key of ['eyebrowEn', 'messageEn', 'eyebrowEs', 'messageEs', 'linkPath'] as const) {
    if (typeof record[key] !== 'string') return { error: `${key} must be text.` };
  }

  const linkPath = (record.linkPath as string).trim();
  if (!HOME_BANNER_LINK_OPTIONS.some((option) => option.path === linkPath)) {
    return { error: `"${linkPath}" is not one of the allowed banner destinations.` };
  }

  const banner: HomeBannerSettings = {
    enabled: record.enabled as boolean,
    eyebrowEn: (record.eyebrowEn as string).trim(),
    messageEn: (record.messageEn as string).trim(),
    eyebrowEs: (record.eyebrowEs as string).trim(),
    messageEs: (record.messageEs as string).trim(),
    linkEnabled: record.linkEnabled as boolean,
    linkPath,
  };

  // An enabled banner with no copy would render an empty black strip.
  if (banner.enabled && banner.eyebrowEn.length === 0 && banner.messageEn.length === 0) {
    return { error: 'Enter English banner text, or switch the banner off.' };
  }

  // The measured nowrap overflow guard — see BANNER_MAX_CHARS.
  const enLength = bannerLength(banner.eyebrowEn, banner.messageEn);
  if (enLength > BANNER_MAX_CHARS) {
    return { error: `English text is ${enLength} characters; the strip overflows past ${BANNER_MAX_CHARS}.` };
  }
  const esLength = bannerLength(banner.eyebrowEs, banner.messageEs);
  if (esLength > BANNER_MAX_CHARS) {
    return { error: `Spanish text is ${esLength} characters; the strip overflows past ${BANNER_MAX_CHARS}.` };
  }

  return { banner };
}

export async function PUT(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const validated = validateBannerBody((body as { banner?: unknown } | null)?.banner);
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    const { error: dbError } = await service
      .from(SHOP_SETTINGS_TABLE)
      .upsert(
        { id: true, home_banner: validated.banner, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      );
    if (dbError) {
      return NextResponse.json(
        { error: isMissingColumnError(dbError) ? MIGRATION_HINT : dbError.message },
        { status: 500 },
      );
    }

    // The strip is homepage-only, but the homepage lives at the dynamic
    // `/[locale]` route behind a `(home)` group, and it is statically
    // prerendered in both locales. `revalidatePath('/', 'layout')` is the
    // documented always-correct form and is what the store-hours route uses;
    // banner edits are rare enough that a sitewide regeneration is cheap and
    // strictly safer than guessing at the dynamic-segment pattern.
    revalidateTag(HOME_BANNER_CACHE_TAG, { expire: 0 });
    revalidatePath('/', 'layout');

    return NextResponse.json({ banner: validated.banner, isDefault: false });
  } catch (err) {
    return NextResponse.json(
      {
        error: isMissingColumnError(err)
          ? MIGRATION_HINT
          : err instanceof Error
            ? err.message
            : 'Failed to save the banner.',
      },
      { status: 500 },
    );
  }
}
