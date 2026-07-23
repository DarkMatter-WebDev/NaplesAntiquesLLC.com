import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { deleteCloudflareVideo, getCloudflareVideo, normalizeCloudflareVideo } from '@/lib/cloudflare-stream';
import { PRODUCT_VIDEO_MAX_DURATION_SECONDS, PRODUCT_VIDEO_MIN_DURATION_SECONDS } from '@/lib/product-video';
import { cloudflareDatabaseFields, getProductVideo, getProductVideoUpload, markMarketplaceVideoOutOfDate } from '@/lib/product-video-store';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
type Context = { params: Promise<{ productId: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({})) as { uploadId?: string; remove?: boolean; posterUrl?: string | null };
  try {
    const { productId } = await context.params;
    const service = createServiceClient();
    const active = await getProductVideo(service, productId);
    if (body.remove) {
      if (active) await deleteCloudflareVideo(active.cloudflare_uid);
      const { error } = await service.from('product_videos').delete().eq('product_id', productId);
      if (error) throw error;
      await markMarketplaceVideoOutOfDate(service, productId);
      return NextResponse.json({ committed: true, video: null });
    }
    if (!body.uploadId) return NextResponse.json({ error: 'uploadId is required.' }, { status: 400 });
    const upload = await getProductVideoUpload(service, body.uploadId, auth.user.id);
    if (!upload || upload.status === 'cancelled' || upload.status === 'committed') {
      return NextResponse.json({ error: 'The replacement upload is no longer available.' }, { status: 409 });
    }
    const normalized = normalizeCloudflareVideo(await getCloudflareVideo(upload.cloudflare_uid));
    if (normalized.status === 'uploading') return NextResponse.json({ error: 'Wait for the file upload to finish before saving.' }, { status: 409 });
    if (normalized.status === 'failed') return NextResponse.json({ error: normalized.error_text ?? 'Cloudflare could not process this video.' }, { status: 422 });
    const duration = normalized.duration_seconds ?? Number(upload.client_duration_seconds);
    if (!Number.isFinite(duration) || duration < PRODUCT_VIDEO_MIN_DURATION_SECONDS || duration > PRODUCT_VIDEO_MAX_DURATION_SECONDS) {
      return NextResponse.json({ error: 'Video must be between 5 and 15 seconds.' }, { status: 422 });
    }
    const { error: upsertError } = await service.from('product_videos').upsert({
      product_id: productId,
      cloudflare_uid: upload.cloudflare_uid,
      ...cloudflareDatabaseFields(normalized),
      duration_seconds: duration,
      poster_url: body.posterUrl ?? null,
      poster_source: 'first_photo',
      source_filename: upload.source_filename,
      source_size_bytes: upload.source_size_bytes,
      source_content_type: upload.source_content_type,
      pending_delete_uid: active && active.cloudflare_uid !== upload.cloudflare_uid ? active.cloudflare_uid : null,
      cleanup_error: null,
    }, { onConflict: 'product_id' });
    if (upsertError) throw upsertError;
    const { error: uploadError } = await service.from('product_video_uploads').update({ status: 'committed', committed_at: new Date().toISOString() }).eq('id', upload.id);
    if (uploadError) throw uploadError;
    await markMarketplaceVideoOutOfDate(service, productId);
    if (active && active.cloudflare_uid !== upload.cloudflare_uid) {
      try {
        await deleteCloudflareVideo(active.cloudflare_uid);
        await service.from('product_videos').update({ pending_delete_uid: null, cleanup_error: null }).eq('product_id', productId);
      } catch (cleanupError) {
        const message = cleanupError instanceof Error ? cleanupError.message : 'Old video cleanup failed.';
        await service.from('product_videos').update({ cleanup_error: message }).eq('product_id', productId);
        return NextResponse.json({ error: `The new video was saved, but the old Stream asset could not be removed: ${message}`, committed: true }, { status: 502 });
      }
    }
    return NextResponse.json({ committed: true, video: normalized });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save the product video.' }, { status: 502 });
  }
}
