import type { SupabaseClient } from '@supabase/supabase-js';

/** Single-row settings table holding the one editable AI listing-assistant prompt. */
export const AI_SETTINGS_TABLE = 'ai_settings';
export const AI_SETTINGS_ROW_ID = 1;

/**
 * Read the saved AI listing-assistant prompt.
 *
 * There is a single prompt. Returns the trimmed saved value when the admin has
 * edited it, or `null` to mean "nothing saved yet — use the built-in starting
 * prompt shipped in code". Any failure (table not created yet, RLS, network) is
 * swallowed and treated as `null` so the live AI assistant keeps working on the
 * built-in prompt rather than erroring.
 */
export async function fetchStoredSystemPrompt(
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
 * Persist the one AI prompt. Pass a non-empty string to save it as the active
 * prompt, or `null`/empty to clear the saved value and fall back to the
 * built-in starting prompt shipped in code.
 */
export async function saveSystemPrompt(
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
