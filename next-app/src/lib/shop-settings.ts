import type { SupabaseClient } from '@supabase/supabase-js';

export const SHOP_SETTINGS_TABLE = 'shop_settings';
const SINGLE_ROW_ID = true;

export interface ShopVisibilitySettings {
  showSoldItems: boolean;
  hideSoldItemPrices: boolean;
}

/**
 * Whether SOLD products should appear in the public shop gallery.
 *
 * Degrades to `true` (the historical behavior — show available + sold) on any
 * error, including the table not existing yet before the migration is applied.
 */
export async function fetchShowSoldItems(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from(SHOP_SETTINGS_TABLE)
      .select('show_sold_items')
      .eq('id', SINGLE_ROW_ID)
      .maybeSingle();
    if (error) return true;
    return data?.show_sold_items ?? true;
  } catch {
    return true;
  }
}

/**
 * Public sold-item visibility and price behavior. The price mask defaults off
 * until its additive column exists, preserving the historical storefront.
 */
export async function fetchShopVisibilitySettings(supabase: SupabaseClient): Promise<ShopVisibilitySettings> {
  try {
    const { data, error } = await supabase
      .from(SHOP_SETTINGS_TABLE)
      .select('show_sold_items, hide_sold_item_prices')
      .eq('id', SINGLE_ROW_ID)
      .maybeSingle();
    if (!error) {
      return {
        showSoldItems: data?.show_sold_items ?? true,
        hideSoldItemPrices: data?.hide_sold_item_prices ?? false,
      };
    }
  } catch {
    // Fall through to the old-column-compatible read below.
  }

  return {
    showSoldItems: await fetchShowSoldItems(supabase),
    hideSoldItemPrices: false,
  };
}

/** Persist the toggle. Throws on failure so the caller can surface an error. */
export async function saveShowSoldItems(supabase: SupabaseClient, showSoldItems: boolean): Promise<void> {
  const { error } = await supabase
    .from(SHOP_SETTINGS_TABLE)
    .upsert(
      { id: SINGLE_ROW_ID, show_sold_items: showSoldItems, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    );
  if (error) throw new Error(error.message);
}

export async function saveHideSoldItemPrices(supabase: SupabaseClient, hideSoldItemPrices: boolean): Promise<void> {
  const { error } = await supabase
    .from(SHOP_SETTINGS_TABLE)
    .upsert(
      { id: SINGLE_ROW_ID, hide_sold_item_prices: hideSoldItemPrices, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    );
  if (error) throw new Error(error.message);
}

/** Site-wide default for the product-page trade-in line (a % over/under melt). */
export interface SpecialPriceDefault {
  enabled: boolean;
  /** Signed percent applied to melt value; null when never set. */
  percent: number | null;
}

/**
 * The site-wide trade-in default. Degrades to `{ enabled: false, percent: null }`
 * (the historical behavior — the line shows the plain melt value) on any error,
 * including the columns not existing yet before the migration is applied.
 */
export async function fetchSpecialPriceDefault(supabase: SupabaseClient): Promise<SpecialPriceDefault> {
  try {
    const { data, error } = await supabase
      .from(SHOP_SETTINGS_TABLE)
      .select('special_price_default_enabled, special_price_default_percent')
      .eq('id', SINGLE_ROW_ID)
      .maybeSingle();
    if (error) return { enabled: false, percent: null };
    return {
      enabled: data?.special_price_default_enabled ?? false,
      percent: data?.special_price_default_percent ?? null,
    };
  } catch {
    return { enabled: false, percent: null };
  }
}

/** Persist the site-wide trade-in default. Throws on failure. */
export async function saveSpecialPriceDefault(supabase: SupabaseClient, value: SpecialPriceDefault): Promise<void> {
  const { error } = await supabase
    .from(SHOP_SETTINGS_TABLE)
    .upsert(
      {
        id: SINGLE_ROW_ID,
        special_price_default_enabled: value.enabled,
        special_price_default_percent: value.percent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  if (error) throw new Error(error.message);
}
