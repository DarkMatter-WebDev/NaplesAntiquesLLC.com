import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { HOME_CAROUSEL_CACHE_TAG } from '@/lib/home-carousel-server';

export const runtime = 'nodejs';

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  revalidateTag(HOME_CAROUSEL_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ ok: true });
}
