import type { SupabaseClient } from '@supabase/supabase-js';

/** Single-row settings table holding the editable AI listing-assistant prompt. */
export const AI_SETTINGS_TABLE = 'ai_settings';
export const AI_SETTINGS_ROW_ID = 1;

/**
 * Read the admin-configured system-prompt override.
 *
 * Returns the trimmed override when one is set, or `null` to mean "use the
 * built-in default". Any failure (table not created yet, RLS, network) is
 * swallowed and treated as `null` so the live AI assistant keeps working on
 * the default prompt rather than erroring.
 */
export async function fetchSystemPromptOverride(
  supabase: SupabaseClient
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from(AI_SETTINGS_TABLE)
      .select('system_prompt')
      .eq('id', AI_SETTINGS_ROW_ID)
      .maybeSingle();
    if (error) return null;
    const value = typeof data?.system_prompt === 'string' ? data.system_prompt.trim() : '';
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Persist the system-prompt override. Pass a non-empty string to set a custom
 * prompt, or `null`/empty to clear it (revert to the built-in default).
 */
export async function saveSystemPromptOverride(
  supabase: SupabaseClient,
  prompt: string | null
): Promise<void> {
  const value = prompt?.trim() ? prompt.trim() : null;
  const { error } = await supabase
    .from(AI_SETTINGS_TABLE)
    .upsert(
      { id: AI_SETTINGS_ROW_ID, system_prompt: value, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  // Re-throw as a real Error so the message survives `instanceof Error` checks
  // (Supabase returns a plain PostgrestError object, not an Error instance).
  if (error) throw new Error(error.message);
}
