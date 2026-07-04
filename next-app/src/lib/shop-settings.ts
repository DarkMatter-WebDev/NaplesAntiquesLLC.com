import type { SupabaseClient } from '@supabase/supabase-js';

export const SHOP_SETTINGS_TABLE = 'shop_settings';
const SINGLE_ROW_ID = true;

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
