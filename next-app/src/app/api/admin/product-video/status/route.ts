import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { deleteCloudflareVideo, ensureCloudflareDownload, getCloudflareVideo, normalizeCloudflareVideo } from '@/lib/cloudflare-stream';
import { getProductVideoUpload, updateVideoRowsForUid } from '@/lib/product-video-store';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const searchParams = new URL(request.url).searchParams;
  const uploadId = searchParams.get('uploadId');
  const uid = searchParams.get('uid');
  if (!uploadId && !uid) return NextResponse.json({ error: 'uploadId or uid is required.' }, { status: 400 });
  try {
    const service = createServiceClient();
    const upload = uploadId
      ? await getProductVideoUpload(service, uploadId, auth.user.id)
      : (await service.from('product_video_uploads').select('*').eq('cloudflare_uid', uid as string).eq('admin_user_id', auth.user.id).maybeSingle()).data;
    if (!upload) return NextResponse.json({ error: 'Video upload was not found.' }, { status: 404 });
    const normalized = normalizeCloudflareVideo(await getCloudflareVideo(upload.cloudflare_uid));
    let download: { status: string | null; url: string | null } | undefined;
    if (normalized.status === 'ready') download = await ensureCloudflareDownload(upload.cloudflare_uid).catch(() => ({ status: null, url: null }));
    if (normalized.status === 'failed' && normalized.error_code === 'DURATION_OUT_OF_RANGE') {
      await deleteCloudflareVideo(upload.cloudflare_uid).catch(() => undefined);
    }
    await updateVideoRowsForUid(service, normalized, download);
    return NextResponse.json({ video: { ...upload, ...normalized, ...(download ? { download_status: download.status, download_url: download.url } : {}) } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not check video processing.' }, { status: 502 });
  }
}
