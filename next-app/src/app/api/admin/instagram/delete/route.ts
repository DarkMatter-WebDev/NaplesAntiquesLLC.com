import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { deletePost, forgetPost } from '@/lib/instagram/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Delete a published Instagram post and its renditions.
 *
 * Irreversible on Instagram's side — the post's likes and comments are gone
 * for good — so this requires an explicit `confirm: true` from the caller in
 * addition to the admin check.
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
      { error: 'Deleting an Instagram post is permanent and loses its likes and comments. Confirm to proceed.' },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // "forget" clears local state after the operator deleted the post by hand in
  // the Instagram app — Instagram's API cannot delete media itself.
  if (body?.mode === 'forget') {
    const forgotten = await forgetPost(service, productId);
    return NextResponse.json(forgotten, { status: forgotten.forgotten ? 200 : 422 });
  }

  const result = await deletePost(service, productId);
  // A manual-delete outcome is expected behaviour, not a failure, so it returns
  // 200 with instructions rather than an error status.
  return NextResponse.json(result, {
    status: result.deleted || result.manualDeleteRequired ? 200 : 422,
  });
}
