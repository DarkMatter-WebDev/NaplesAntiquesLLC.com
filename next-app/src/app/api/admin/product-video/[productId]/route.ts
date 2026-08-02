import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { deleteCloudflareVideo, getCloudflareVideo, normalizeCloudflareVideo } from '@/lib/cloudflare-stream';
import { getProductVideo, getProductVideoUpload, updateVideoRowsForUid } from '@/lib/product-video-store';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

type Context = { params: Promise<{ productId: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const { productId } = await context.params;
    const service = createServiceClient();
    let video = await getProductVideo(service, productId);
    if (video) {
      if (video.pending_delete_uid) {
        try {
          await deleteCloudflareVideo(video.pending_delete_uid);
          await service.from('product_videos').update({ pending_delete_uid: null, cleanup_error: null }).eq('product_id', productId);
          video = { ...video, pending_delete_uid: null, cleanup_error: null };
        } catch (cleanupError) {
          await service.from('product_videos').update({ cleanup_error: cleanupError instanceof Error ? cleanupError.message : 'Old video cleanup failed.' }).eq('product_id', productId);
        }
      }
      const normalized = normalizeCloudflareVideo(await getCloudflareVideo(video.cloudflare_uid));
      await updateVideoRowsForUid(service, normalized);
      video = { ...video, ...normalized };
    }
    return NextResponse.json({ video });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load the product video.' }, { status: 502 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const { productId } = await context.params;
    const uploadId = new URL(request.url).searchParams.get('uploadId');
    const service = createServiceClient();
    if (uploadId) {
      const upload = await getProductVideoUpload(service, uploadId, auth.user.id);
      if (!upload) return NextResponse.json({ deleted: true });
      await deleteCloudflareVideo(upload.cloudflare_uid);
      const { error } = await service.from('product_video_uploads').update({ status: 'cancelled' }).eq('id', uploadId);
      if (error) throw error;
      return NextResponse.json({ deleted: true });
    }
    const active = await getProductVideo(service, productId);
    if (!active) return NextResponse.json({ deleted: true });
    await deleteCloudflareVideo(active.cloudflare_uid);
    const { error } = await service.from('product_videos').delete().eq('product_id', productId);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cloudflare did not accept the video delete.' }, { status: 502 });
  }
}
