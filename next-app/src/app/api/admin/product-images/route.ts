import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { PRODUCT_IMAGES_BUCKET, PRODUCT_IMAGES_PREFIX } from '@/lib/product-image-storage';
import {
  PRODUCT_IMAGE_MAX_UPLOAD_BYTES,
  encodeProductImageToWebp,
} from '@/lib/product-image-encode';

/**
 * POST a raw image body (any format the browser can produce — JPEG on iPhone,
 * WebP on desktop Chrome, PNG worst case) and receive its WebP copy's public
 * URL. The server encodes; the browser never labels a file `.webp` again.
 * Storage objects carry the immutable cache header the Netlify Image CDN keys
 * its TTL from (DECISIONS → "Every Storage upload sets cacheControl").
 */
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

  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > PRODUCT_IMAGE_MAX_UPLOAD_BYTES) {
    return NextResponse.json({
      error: `Photo is too large to process (${Math.round(declaredLength / 1024 / 1024)} MB). Limit is ${PRODUCT_IMAGE_MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    }, { status: 413 });
  }

  const input = Buffer.from(await req.arrayBuffer());
  if (input.byteLength === 0) return NextResponse.json({ error: 'No image data received.' }, { status: 400 });
  if (input.byteLength > PRODUCT_IMAGE_MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Photo is too large to process.' }, { status: 413 });
  }

  let encoded;
  try {
    encoded = await encodeProductImageToWebp(input);
  } catch (error) {
    console.warn('[product-images] encode_failed', {
      userId: user.id,
      bytes: input.byteLength,
      contentType: req.headers.get('content-type'),
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'That file is not an image this server can read.' }, { status: 400 });
  }

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const path = `${PRODUCT_IMAGES_PREFIX}/${filename}`;
  const service = createServiceClient();
  const { error } = await service.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, encoded.buffer, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (error) {
    console.error('[product-images] upload_failed', { userId: user.id, path, message: error.message });
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 502 });
  }

  const { data } = service.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  console.info('[product-images] stored', {
    userId: user.id,
    path,
    sourceFormat: encoded.sourceFormat,
    inputBytes: input.byteLength,
    outputBytes: encoded.bytes,
    width: encoded.width,
    height: encoded.height,
    elapsedMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    url: data.publicUrl,
    path,
    bytes: encoded.bytes,
    width: encoded.width,
    height: encoded.height,
    sourceFormat: encoded.sourceFormat,
  });
}
