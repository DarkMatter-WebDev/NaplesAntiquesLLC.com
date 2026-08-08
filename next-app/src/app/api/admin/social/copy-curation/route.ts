import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  copySocialCuration,
  SocialCurationCopyError,
} from '@/lib/social-curation-copy';
import type { SocialPublishChannel } from '@/lib/social-publish-both';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  const from = body?.from as SocialPublishChannel;
  if (!productId) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }
  if (from !== 'instagram' && from !== 'facebook') {
    return NextResponse.json({ error: 'from must be "instagram" or "facebook".' }, { status: 400 });
  }

  try {
    const result = await copySocialCuration(createServiceClient(), productId, from);
    return NextResponse.json({
      ...result,
      message: `${result.message} Open Manage ${result.to === 'instagram' ? 'Instagram' : 'Facebook'} and Prepare to rebuild its slides.`,
    });
  } catch (err) {
    if (err instanceof SocialCurationCopyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not copy the setup.' },
      { status: 500 },
    );
  }
}
