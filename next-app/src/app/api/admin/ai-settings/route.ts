import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PRODUCT_EXTRACTION_SYSTEM_PROMPT, PROMPT_VERSION } from '@/lib/ai-product-provider';
import { fetchStoredSystemPrompt, saveSystemPrompt } from '@/lib/ai-settings-store';

const MAX_PROMPT_LENGTH = 20000;

/** Resolve the signed-in admin, or return an error response. */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }) };
  }
  return { supabase };
}

export async function GET() {
  const { supabase, error } = await requireAdmin();
  if (error) return error;

  const stored = await fetchStoredSystemPrompt(supabase);
  return NextResponse.json({
    // The one active prompt: the saved value, or the built-in starting prompt
    // when nothing has been saved yet.
    systemPrompt: stored ?? PRODUCT_EXTRACTION_SYSTEM_PROMPT,
    builtInPrompt: PRODUCT_EXTRACTION_SYSTEM_PROMPT,
    promptVersion: PROMPT_VERSION,
  });
}

export async function PUT(req: Request) {
  const { supabase, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const raw = typeof body?.systemPrompt === 'string' ? body.systemPrompt : '';
  if (raw.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt is too long. Limit is ${MAX_PROMPT_LENGTH} characters.` },
      { status: 400 }
    );
  }

  // Saving a non-empty value makes it the active prompt. Empty/blank clears the
  // saved value and falls back to the built-in starting prompt shipped in code.
  const trimmed = raw.trim();
  try {
    await saveSystemPrompt(supabase, trimmed || null);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save the AI prompt.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    systemPrompt: trimmed || PRODUCT_EXTRACTION_SYSTEM_PROMPT,
    builtInPrompt: PRODUCT_EXTRACTION_SYSTEM_PROMPT,
    promptVersion: PROMPT_VERSION,
  });
}
