import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PRODUCT_EXTRACTION_SYSTEM_PROMPT, PROMPT_VERSION } from '@/lib/ai-product-provider';
import { fetchSystemPromptOverride, saveSystemPromptOverride } from '@/lib/ai-settings-store';

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

  const override = await fetchSystemPromptOverride(supabase);
  return NextResponse.json({
    systemPrompt: override ?? PRODUCT_EXTRACTION_SYSTEM_PROMPT,
    defaultPrompt: PRODUCT_EXTRACTION_SYSTEM_PROMPT,
    isCustom: override !== null,
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

  // Empty/blank clears the override and reverts to the built-in default.
  const trimmed = raw.trim();
  try {
    await saveSystemPromptOverride(supabase, trimmed || null);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save the AI prompt.' },
      { status: 500 }
    );
  }

  const isCustom = trimmed.length > 0;
  return NextResponse.json({
    systemPrompt: isCustom ? trimmed : PRODUCT_EXTRACTION_SYSTEM_PROMPT,
    defaultPrompt: PRODUCT_EXTRACTION_SYSTEM_PROMPT,
    isCustom,
    promptVersion: PROMPT_VERSION,
  });
}
