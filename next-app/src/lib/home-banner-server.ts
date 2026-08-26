import 'server-only';

import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { SHOP_SETTINGS_TABLE } from '@/lib/shop-settings';
import { DEFAULT_HOME_BANNER, parseHomeBanner, type HomeBannerSettings } from '@/lib/home-banner';

/**
 * Server-side read for the homepage announcement strip.
 *
 * Storage: `shop_settings.home_banner` (jsonb, single row, added by
 * `supabase/home-banner-2026-08.sql`). Anything unexpected — column missing,
 * null, malformed, over the length budget, network failure — degrades to
 * `DEFAULT_HOME_BANNER`, so the homepage always renders a valid strip.
 *
 * ⛔ Server-only. The admin panel imports the PURE half (`home-banner.ts`) for
 * its live preview; this module must never reach a client bundle.
 */

export const HOME_BANNER_CACHE_TAG = 'home-banner';

const fetchCachedHomeBanner = unstable_cache(
  async (): Promise<HomeBannerSettings | null> => {
    try {
      const { data, error } = await createPublicClient()
        .from(SHOP_SETTINGS_TABLE)
        .select('home_banner')
        .eq('id', true)
        .maybeSingle();
      if (error) return null;
      return parseHomeBanner(data?.home_banner);
    } catch {
      return null;
    }
  },
  // v1: bump if HomeBannerSettings' shape changes — a cached old payload would
  // otherwise deserialize into the new shape.
  ['home-banner-v1'],
  {
    tags: [HOME_BANNER_CACHE_TAG],
    revalidate: 300,
  },
);

export async function getHomeBanner(): Promise<HomeBannerSettings> {
  try {
    return (await fetchCachedHomeBanner()) ?? DEFAULT_HOME_BANNER;
  } catch {
    return DEFAULT_HOME_BANNER;
  }
}
