import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getPost as getFacebookPost } from '@/lib/facebook/store';
import { runPrepareStep as prepareFacebook } from '@/lib/facebook/sync';
import { getPost as getInstagramPost } from '@/lib/instagram/store';
import { runPrepareStep as prepareInstagram } from '@/lib/instagram/sync';
import type { SocialPublishChannel } from '@/lib/social-publish-both';
import {
  copySocialCuration,
  SocialCurationCopyError,
} from '@/lib/social-curation-copy';

export const runtime = 'nodejs';
export const maxDuration = 60;

type CrossChannelSyncMode = 'wording' | 'photos' | 'both';

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  const from = body?.from as SocialPublishChannel;
  const mode: CrossChannelSyncMode = body?.mode ?? 'both';
  if (!productId) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }
  if (from !== 'instagram' && from !== 'facebook') {
    return NextResponse.json({ error: 'from must be "instagram" or "facebook".' }, { status: 400 });
  }
  if (mode !== 'wording' && mode !== 'photos' && mode !== 'both') {
    return NextResponse.json(
      { error: 'mode must be "wording", "photos", or "both".' },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const source = from === 'instagram'
    ? await getInstagramPost(service, productId)
    : await getFacebookPost(service, productId);
  const target = from === 'instagram'
    ? await getFacebookPost(service, productId)
    : await getInstagramPost(service, productId);
  if (source?.sync_state !== 'review') {
    return NextResponse.json(
      { error: `Prepare ${from === 'instagram' ? 'Instagram' : 'Facebook'} first so its reviewed setup can be copied.` },
      { status: 409 },
    );
  }
  if (target?.sync_state === 'published') {
    return NextResponse.json(
      { error: 'The destination post is already live and cannot be re-prepared.' },
      { status: 409 },
    );
  }

  const sourceCaption = source.posted_caption?.trim() || null;
  const targetCaption = target?.posted_caption?.trim() || null;
  if (mode !== 'photos' && !sourceCaption) {
    return NextResponse.json(
      { error: 'The source channel does not have reviewed wording to copy.' },
      { status: 409 },
    );
  }
  if (mode === 'photos' && !targetCaption) {
    return NextResponse.json(
      { error: 'Prepare the destination wording first so photo-only sync can preserve it.' },
      { status: 409 },
    );
  }

  let copiedSetup = null;
  if (mode !== 'wording') {
    try {
      copiedSetup = await copySocialCuration(service, productId, from);
    } catch (err) {
      if (err instanceof SocialCurationCopyError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Could not copy the photo setup.' },
        { status: 500 },
      );
    }
  }

  const captionTemplate = mode === 'photos' ? targetCaption! : sourceCaption!;
  const result = from === 'instagram'
    ? await prepareFacebook(service, productId, undefined, captionTemplate)
    : await prepareInstagram(service, productId, undefined, captionTemplate);

  return NextResponse.json(
    { ...result, syncMode: mode, copiedSetup },
    { status: result.state === 'error' ? 422 : 200 },
  );
}
