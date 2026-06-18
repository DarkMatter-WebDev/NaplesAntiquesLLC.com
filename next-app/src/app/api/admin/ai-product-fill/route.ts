import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateProductDraft } from '@/lib/ai-product-provider';
import { fetchSystemPromptOverride } from '@/lib/ai-settings-store';
import { PRODUCT_AUTOFILL_SCHEMA, coerceProductAutofill } from '@/lib/ai-product-schema';

const MAX_TRANSCRIPT_LENGTH = 8000;
const DEFAULT_MAX_IMAGES = 2;
const HOURLY_LIMIT = Number(process.env.AI_RATE_LIMIT_HOURLY ?? 15);
const DAILY_LIMIT = Number(process.env.AI_RATE_LIMIT_DAILY ?? 60);

type UsageRecord = { timestamps: number[] };
const usageByUser = new Map<string, UsageRecord>();

function pruneUsage(record: UsageRecord, now: number) {
  const dayAgo = now - 24 * 60 * 60 * 1000;
  record.timestamps = record.timestamps.filter((timestamp) => timestamp > dayAgo);
}

function checkRateLimit(userId: string) {
  const now = Date.now();
  const record = usageByUser.get(userId) ?? { timestamps: [] };
  pruneUsage(record, now);
  const hourAgo = now - 60 * 60 * 1000;
  const hourlyCount = record.timestamps.filter((timestamp) => timestamp > hourAgo).length;
  if (hourlyCount >= HOURLY_LIMIT || record.timestamps.length >= DAILY_LIMIT) {
    usageByUser.set(userId, record);
    return false;
  }
  record.timestamps.push(now);
  usageByUser.set(userId, record);
  return true;
}

function isAllowedImageSource(value: string) {
  if (value.startsWith('/assets/')) return true;
  try {
    const url = new URL(value);
    return url.pathname.includes('/storage/v1/object/public/product-images/')
      || url.pathname.includes('/storage/v1/object/sign/product-images/');
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  if (!checkRateLimit(user.id)) {
    console.warn('[ai-product-fill] rate_limited', { userId: user.id });
    return NextResponse.json({ error: 'AI listing limit reached. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : '';
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return NextResponse.json({ error: `Transcript is too long. Limit is ${MAX_TRANSCRIPT_LENGTH} characters.` }, { status: 400 });
  }

  const maxImages = Math.max(0, Number(process.env.AI_MAX_IMAGES ?? DEFAULT_MAX_IMAGES));
  const images = Array.isArray(body?.images)
    ? body.images.map(String).filter(isAllowedImageSource).slice(0, maxImages)
    : [];

  // Photos are the primary source; transcript is optional. Photo-only is allowed,
  // but at least one usable input must be present.
  if (images.length === 0 && !transcript) {
    return NextResponse.json({ error: 'Add at least one photo to generate a listing.' }, { status: 400 });
  }
  const mode = body?.mode === 'accurate' || body?.mode === 'premium' || body?.mode === 'fast' ? body.mode : undefined;

  // Admin-editable system prompt (Settings panel). Null = use the built-in default.
  const systemPromptOverride = await fetchSystemPromptOverride(supabase);

  try {
    const result = await generateProductDraft({
      transcript,
      images,
      origin: new URL(req.url).origin,
      schema: PRODUCT_AUTOFILL_SCHEMA,
      mode,
      systemPrompt: systemPromptOverride ?? undefined,
    });
    const draft = coerceProductAutofill(result.draft);
    const populatedFields = Object.entries(draft.fields)
      .filter(([, value]) => value !== null && value !== '')
      .map(([key]) => key);

    const rawDraft = result.draft as Record<string, unknown> | null;
    const rawTopLevelKeys = rawDraft && typeof rawDraft === 'object' ? Object.keys(rawDraft) : typeof rawDraft;
    const rawHadNestedFields = !!(rawDraft && typeof rawDraft.fields === 'object' && rawDraft.fields !== null);

    console.info('[ai-product-fill] success', {
      userId: user.id,
      provider: result.meta.provider,
      model: result.meta.model,
      promptSource: systemPromptOverride ? 'custom' : 'default',
      populatedFields,
      rawTopLevelKeys,
      rawHadNestedFields,
      elapsedMs: Date.now() - startedAt,
      usage: result.meta.usage,
    });

    return NextResponse.json({ draft, meta: result.meta });
  } catch (error) {
    console.error('[ai-product-fill] failed', {
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : 'Unknown AI error',
    });
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'AI listing generation failed.',
    }, { status: 500 });
  }
}
