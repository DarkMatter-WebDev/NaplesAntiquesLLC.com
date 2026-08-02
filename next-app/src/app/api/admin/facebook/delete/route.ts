import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { deletePost, forgetPost } from '@/lib/facebook/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Delete a published Facebook post and its renditions.
 *
 * Facebook's API genuinely supports deletion (unlike Instagram's), but the act
 * still destroys the post's likes and comments, so it requires an explicit
 * `confirm: true` from the caller in addition to the admin check.
 */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  if (!productId) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }
  if (body?.confirm !== true) {
    return NextResponse.json(
      { error: 'Deleting a Facebook post is permanent and loses its likes and comments. Confirm to proceed.' },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // "forget" clears local state after the operator removed the post by hand on
  // Facebook itself.
  if (body?.mode === 'forget') {
    const forgotten = await forgetPost(service, productId);
    return NextResponse.json(forgotten, { status: forgotten.forgotten ? 200 : 422 });
  }

  const result = await deletePost(service, productId);
  return NextResponse.json(result, { status: result.deleted ? 200 : 422 });
}
