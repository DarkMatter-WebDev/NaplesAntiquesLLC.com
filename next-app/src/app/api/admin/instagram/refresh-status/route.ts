import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { refreshPostStatus } from '@/lib/instagram/sync';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Verify one locally published post against Instagram without changing it remotely. */
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  if (!productId) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }

  const result = await refreshPostStatus(createServiceClient(), productId);
  return NextResponse.json(result, { status: result.checked ? 200 : 422 });
}
