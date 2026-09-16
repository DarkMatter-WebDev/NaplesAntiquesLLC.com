import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { PRODUCT_IMAGE_MAX_UPLOAD_BYTES } from '@/lib/product-image-encode';
import { loadDeal, storeDealPhoto } from '@/lib/text-alerts/deals';

/**
 * POST the raw photo bytes with `?dealId=` → stored as WebP under the deal,
 * the deal's `photo_path` set, any previous picture invalidated (a new photo
 * needs a new render). Same size limits as product photos.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  const dealId = new URL(req.url).searchParams.get('dealId') ?? '';
  if (!dealId) return NextResponse.json({ error: 'dealId is required.' }, { status: 400 });

  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > PRODUCT_IMAGE_MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `Photo is too large (${Math.round(declaredLength / 1024 / 1024)} MB). Limit is ${PRODUCT_IMAGE_MAX_UPLOAD_BYTES / 1024 / 1024} MB.` }, { status: 413 });
  }
  const input = Buffer.from(await req.arrayBuffer());
  if (input.byteLength === 0) return NextResponse.json({ error: 'No image data received.' }, { status: 400 });
  if (input.byteLength > PRODUCT_IMAGE_MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'Photo is too large to process.' }, { status: 413 });

  const service = createServiceClient();
  const deal = await loadDeal(service, dealId);
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
  if (deal.status !== 'draft') return NextResponse.json({ error: 'The photo can only be changed before the deal is sent.' }, { status: 409 });

  try {
    const stored = await storeDealPhoto(service, dealId, input);
    const { error } = await service
      .from('text_deals')
      .update({ photo_path: stored.path, card_path: null, updated_at: new Date().toISOString() })
      .eq('id', dealId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ path: stored.path, url: stored.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not store the photo.' }, { status: 500 });
  }
}
