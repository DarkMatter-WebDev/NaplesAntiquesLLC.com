import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { deleteCloudflareVideo, provisionDirectTusUpload } from '@/lib/cloudflare-stream';
import { PRODUCT_VIDEO_MAX_SIZE_BYTES, PRODUCT_VIDEO_UPLOAD_EXPIRY_MINUTES, validateProductVideoFile } from '@/lib/product-video';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

function parseMetadata(value: string): Record<string, string> {
  return Object.fromEntries(value.split(',').map((part) => {
    const [key, encoded = ''] = part.trim().split(' ');
    try { return [key, Buffer.from(encoded, 'base64').toString('utf8')]; }
    catch { return [key, '']; }
  }).filter(([key]) => Boolean(key)));
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const uploadLength = Number(request.headers.get('upload-length'));
  const uploadMetadata = request.headers.get('upload-metadata') ?? '';
  const metadata = parseMetadata(uploadMetadata);
  const duration = Number(metadata.clientDurationSeconds);
  const errors = validateProductVideoFile({ size: uploadLength, durationSeconds: duration, type: metadata.filetype, name: metadata.filename });
  if (!Number.isFinite(uploadLength) || uploadLength > PRODUCT_VIDEO_MAX_SIZE_BYTES || errors.length) {
    return NextResponse.json({ error: errors[0] ?? 'Invalid video upload.' }, { status: 400 });
  }
  const expiresAt = new Date(Date.now() + PRODUCT_VIDEO_UPLOAD_EXPIRY_MINUTES * 60_000).toISOString();
  let provisioned: { location: string; uid: string } | null = null;
  try {
    const service = createServiceClient();
    // Opportunistic bounded cleanup keeps abandoned editor uploads from
    // accumulating without introducing a cron dependency.
    const { data: expired } = await service.from('product_video_uploads')
      .select('id, cloudflare_uid')
      .lt('expires_at', new Date().toISOString())
      .in('status', ['uploading', 'processing', 'ready', 'failed'])
      .limit(10);
    for (const stale of expired ?? []) {
      try {
        await deleteCloudflareVideo(stale.cloudflare_uid);
        await service.from('product_video_uploads').update({ status: 'cancelled', cleanup_error: null }).eq('id', stale.id);
      } catch (cleanupError) {
        await service.from('product_video_uploads').update({ cleanup_error: cleanupError instanceof Error ? cleanupError.message : 'Cleanup failed.' }).eq('id', stale.id);
      }
    }
    provisioned = await provisionDirectTusUpload({ uploadLength, uploadMetadata, expiresAt });
    const { data, error } = await service.from('product_video_uploads').insert({
      admin_user_id: auth.user.id,
      product_id: metadata.productId || null,
      cloudflare_uid: provisioned.uid,
      source_filename: metadata.filename || 'product-video',
      source_size_bytes: uploadLength,
      source_content_type: metadata.filetype || null,
      client_duration_seconds: duration,
      expires_at: expiresAt,
    }).select('id').single();
    if (error) throw error;
    return new Response(null, {
      status: 201,
      headers: {
        Location: provisioned.location,
        'Tus-Resumable': '1.0.0',
        'Stream-Media-Id': provisioned.uid,
        'Upload-Session-Id': data.id,
        'Access-Control-Expose-Headers': 'Location, Stream-Media-Id, Upload-Session-Id, Tus-Resumable',
      },
    });
  } catch (error) {
    if (provisioned) await deleteCloudflareVideo(provisioned.uid).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not start the video upload.' }, { status: 502 });
  }
}
