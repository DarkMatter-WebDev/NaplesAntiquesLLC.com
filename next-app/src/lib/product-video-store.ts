import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedCloudflareVideo } from '@/lib/cloudflare-stream';
import type { ProductVideoRecord, ProductVideoUploadRecord, PublicProductVideo } from '@/lib/product-video';

export function isProductVideoSchemaMissing(error: unknown): boolean {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === '42P01' || /product_video/i.test(value?.message ?? '') && /does not exist|schema cache/i.test(value?.message ?? '');
}

export async function getProductVideo(service: SupabaseClient, productId: string): Promise<ProductVideoRecord | null> {
  const { data, error } = await service.from('product_videos').select('*').eq('product_id', productId).maybeSingle();
  if (error) {
    if (isProductVideoSchemaMissing(error)) return null;
    throw error;
  }
  return data as ProductVideoRecord | null;
}

export async function getProductVideoUpload(service: SupabaseClient, uploadId: string, adminUserId?: string): Promise<ProductVideoUploadRecord | null> {
  let query = service.from('product_video_uploads').select('*').eq('id', uploadId);
  if (adminUserId) query = query.eq('admin_user_id', adminUserId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as ProductVideoUploadRecord | null;
}

export function cloudflareDatabaseFields(video: NormalizedCloudflareVideo) {
  return {
    status: video.status,
    duration_seconds: video.duration_seconds,
    width: video.width,
    height: video.height,
    thumbnail_url: video.thumbnail_url,
    preview_url: video.preview_url,
    iframe_url: video.iframe_url,
    playback_hls_url: video.playback_hls_url,
    playback_dash_url: video.playback_dash_url,
    error_code: video.error_code,
    error_text: video.error_text,
    uploaded_at: video.uploaded_at,
    ready_at: video.ready_at,
  };
}

export async function updateVideoRowsForUid(
  service: SupabaseClient,
  video: NormalizedCloudflareVideo,
  download?: { status: string | null; url: string | null },
) {
  const fields = {
    ...cloudflareDatabaseFields(video),
    ...(download ? { download_status: download.status, download_url: download.url } : {}),
  };
  const uploadFields = {
    status: fields.status,
    duration_seconds: fields.duration_seconds,
    width: fields.width,
    height: fields.height,
    thumbnail_url: fields.thumbnail_url,
    preview_url: fields.preview_url,
    iframe_url: fields.iframe_url,
    playback_hls_url: fields.playback_hls_url,
    playback_dash_url: fields.playback_dash_url,
    error_code: fields.error_code,
    error_text: fields.error_text,
    ...('download_status' in fields ? { download_status: fields.download_status, download_url: fields.download_url } : {}),
  };
  const [active, upload] = await Promise.all([
    service.from('product_videos').update(fields).eq('cloudflare_uid', video.cloudflare_uid),
    service.from('product_video_uploads').update(uploadFields).eq('cloudflare_uid', video.cloudflare_uid),
  ]);
  if (active.error && !isProductVideoSchemaMissing(active.error)) throw active.error;
  if (upload.error && !isProductVideoSchemaMissing(upload.error)) throw upload.error;
}

export async function markMarketplaceVideoOutOfDate(service: SupabaseClient, productId: string) {
  const states = ['active', 'draft_review', 'images_synced', 'inventory_synced', 'published', 'review', 'item_synced', 'offer_created'];
  const [etsy, ebay] = await Promise.all([
    service.from('etsy_listings').update({ sync_state: 'out_of_date' }).eq('product_id', productId).in('sync_state', states),
    service.from('ebay_listings').update({ sync_state: 'out_of_date' }).eq('product_id', productId).in('sync_state', states),
  ]);
  // Marketplace schemas are independently deployable. A missing mapping table
  // must not make an otherwise valid product-video save fail.
  for (const result of [etsy, ebay]) {
    if (result.error && result.error.code !== '42P01') throw result.error;
  }
}

export function toPublicProductVideo(record: ProductVideoRecord | null): PublicProductVideo | null {
  if (!record || record.status !== 'ready' || !record.iframe_url || record.duration_seconds == null) return null;
  return {
    status: 'ready',
    durationSeconds: Number(record.duration_seconds),
    width: record.width,
    height: record.height,
    thumbnailUrl: record.thumbnail_url,
    iframeUrl: record.iframe_url,
    hlsUrl: record.playback_hls_url,
    dashUrl: record.playback_dash_url,
    downloadUrl: record.download_url,
    uploadedAt: record.uploaded_at,
  };
}
