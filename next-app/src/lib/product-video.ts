export const PRODUCT_VIDEO_MIN_DURATION_SECONDS = 5;
export const PRODUCT_VIDEO_MAX_DURATION_SECONDS = 15;
export const PRODUCT_VIDEO_MAX_SIZE_BYTES = 150 * 1024 * 1024;
export const PRODUCT_VIDEO_UPLOAD_EXPIRY_MINUTES = 60;

export type ProductVideoStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'delete_failed';

export interface ProductVideoRecord {
  product_id: string;
  cloudflare_uid: string;
  status: ProductVideoStatus;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_url: string | null;
  poster_url: string | null;
  poster_source: 'first_photo' | 'cloudflare_thumbnail';
  preview_url: string | null;
  iframe_url: string | null;
  playback_hls_url: string | null;
  playback_dash_url: string | null;
  download_url: string | null;
  download_status: string | null;
  source_filename: string | null;
  source_size_bytes: number | null;
  source_content_type: string | null;
  error_code: string | null;
  error_text: string | null;
  pending_delete_uid: string | null;
  cleanup_error: string | null;
  uploaded_at: string | null;
  ready_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVideoUploadRecord {
  id: string;
  admin_user_id: string;
  product_id: string | null;
  cloudflare_uid: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed' | 'cancelled' | 'committed';
  source_filename: string;
  source_size_bytes: number;
  source_content_type: string | null;
  client_duration_seconds: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  iframe_url: string | null;
  playback_hls_url: string | null;
  playback_dash_url: string | null;
  download_url: string | null;
  download_status: string | null;
  error_code: string | null;
  error_text: string | null;
  cleanup_error: string | null;
  expires_at: string;
  committed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicProductVideo {
  status: 'ready';
  durationSeconds: number;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  iframeUrl: string;
  hlsUrl: string | null;
  dashUrl: string | null;
  downloadUrl: string | null;
  uploadedAt: string | null;
}

export function validateProductVideoFile(input: {
  size: number;
  durationSeconds: number;
  type?: string | null;
  name?: string | null;
}): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(input.size) || input.size <= 0) errors.push('Choose a non-empty video file.');
  if (input.size > PRODUCT_VIDEO_MAX_SIZE_BYTES) errors.push('Video must be 150 MB or smaller.');
  if (!Number.isFinite(input.durationSeconds)) errors.push('The video duration could not be read.');
  else if (input.durationSeconds < PRODUCT_VIDEO_MIN_DURATION_SECONDS) errors.push('Video must be at least 5 seconds long.');
  else if (input.durationSeconds > PRODUCT_VIDEO_MAX_DURATION_SECONDS) errors.push('Video must be 15 seconds or shorter.');
  const extension = String(input.name ?? '').split('.').pop()?.toLowerCase();
  const commonExtension = extension === 'mov' || extension === 'mp4' || extension === 'm4v' || extension === 'quicktime';
  const videoMime = String(input.type ?? '').toLowerCase().startsWith('video/');
  if (!videoMime && !commonExtension) errors.push('Choose a MOV or MP4 video from your device.');
  return errors;
}

export function normalizeCloudflareVideoState(input: {
  readyToStream?: boolean | null;
  status?: { state?: string | null } | null;
}): ProductVideoStatus {
  const state = String(input.status?.state ?? '').toLowerCase();
  if (state === 'error') return 'failed';
  if (input.readyToStream && state === 'ready') return 'ready';
  if (state === 'pendingupload' || state === 'queued') return 'uploading';
  return 'processing';
}

export function formatVideoBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function formatVideoDuration(seconds: number | null | undefined): string {
  if (!Number.isFinite(seconds)) return 'Unknown duration';
  return `${Number(seconds).toFixed(Number(seconds) % 1 === 0 ? 0 : 1)} seconds`;
}

export type ProductMediaItem = { type: 'image'; index: number } | { type: 'video'; index: -1 };

export function buildProductMediaItems(imageCount: number, hasVideo: boolean): ProductMediaItem[] {
  const items: ProductMediaItem[] = [];
  for (let index = 0; index < Math.max(0, imageCount); index += 1) {
    items.push({ type: 'image', index });
    if (index === 0 && hasVideo) items.push({ type: 'video', index: -1 });
  }
  return items;
}
