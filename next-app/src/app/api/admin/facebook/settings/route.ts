import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getConnection, updateConnection } from '@/lib/facebook/store';
import { FACEBOOK_MAX_HASHTAGS } from '@/lib/facebook/client';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.autoPublish === 'boolean') patch.auto_publish = body.autoPublish;
  if (typeof body.captionIncludePrice === 'boolean') patch.caption_include_price = body.captionIncludePrice;
  if (typeof body.captionSpanishLine === 'boolean') patch.caption_spanish_line = body.captionSpanishLine;
  if (typeof body.soldCommentEnabled === 'boolean') patch.sold_comment_enabled = body.soldCommentEnabled;

  if (body.captionCta !== undefined) {
    const cta = body.captionCta === null ? null : String(body.captionCta).trim();
    if (cta && cta.length > 300) {
      return NextResponse.json({ error: 'The call-to-action line is too long.' }, { status: 400 });
    }
    patch.caption_cta = cta || null;
  }

  if (body.soldCommentText !== undefined) {
    const text = String(body.soldCommentText ?? '').trim();
    if (!text) {
      return NextResponse.json({ error: 'The sold comment text cannot be empty.' }, { status: 400 });
    }
    if (text.length > 300) {
      return NextResponse.json({ error: 'The sold comment text is too long.' }, { status: 400 });
    }
    patch.sold_comment_text = text;
  }

  if (body.baseHashtags !== undefined) {
    const raw = Array.isArray(body.baseHashtags)
      ? body.baseHashtags
      : String(body.baseHashtags ?? '').split(/[\s,]+/);
    const tags = raw
      .map((tag: unknown) => String(tag).replace(/^#/, '').trim().toLowerCase())
      .filter((tag: string) => tag.length >= 3);
    if (tags.length > FACEBOOK_MAX_HASHTAGS) {
      return NextResponse.json(
        { error: `Keep at most ${FACEBOOK_MAX_HASHTAGS} base hashtags.` },
        { status: 400 },
      );
    }
    patch.base_hashtags = Array.from(new Set(tags));
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No recognized settings were provided.' }, { status: 400 });
  }

  const service = createServiceClient();
  await updateConnection(service, patch);
  const connection = await getConnection(service);

  return NextResponse.json({
    policy: {
      autoPublish: connection?.auto_publish ?? false,
      captionIncludePrice: connection?.caption_include_price ?? true,
      captionSpanishLine: connection?.caption_spanish_line ?? true,
      captionCta: connection?.caption_cta ?? null,
      baseHashtags: connection?.base_hashtags ?? [],
      soldCommentEnabled: connection?.sold_comment_enabled ?? true,
      soldCommentText: connection?.sold_comment_text ?? 'SOLD',
    },
  });
}
