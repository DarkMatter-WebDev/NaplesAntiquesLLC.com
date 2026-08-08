import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { addPostComment } from '@/lib/instagram/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';
  if (!productId) return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  if (!comment) return NextResponse.json({ error: 'Enter a comment before posting.' }, { status: 400 });
  if (comment.length > 1_000) return NextResponse.json({ error: 'Keep the comment to 1,000 characters or fewer.' }, { status: 400 });

  const result = await addPostComment(createServiceClient(), productId, comment);
  return NextResponse.json(result, { status: result.commented ? 200 : 422 });
}
