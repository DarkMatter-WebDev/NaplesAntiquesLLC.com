import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  PRODUCT_VIDEO_MAX_DURATION_SECONDS,
  PRODUCT_VIDEO_MIN_DURATION_SECONDS,
  normalizeCloudflareVideoState,
  type ProductVideoStatus,
} from '@/lib/product-video';

interface CloudflareEnvelope<T> {
  result: T;
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
}

export interface CloudflareStreamVideo {
  uid: string;
  readyToStream?: boolean;
  thumbnail?: string;
  preview?: string;
  uploaded?: string;
  duration?: number;
  input?: { width?: number; height?: number };
  playback?: { hls?: string; dash?: string };
  status?: {
    state?: string;
    step?: string;
    pctComplete?: string;
    errReasonCode?: string;
    errReasonText?: string;
  };
}

interface DownloadState {
  default?: { status?: string; url?: string; percentComplete?: number };
}

export interface NormalizedCloudflareVideo {
  cloudflare_uid: string;
  status: ProductVideoStatus;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  iframe_url: string | null;
  playback_hls_url: string | null;
  playback_dash_url: string | null;
  error_code: string | null;
  error_text: string | null;
  uploaded_at: string | null;
  ready_at: string | null;
}

function config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim();
  const customerCode = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim();
  if (!accountId || !apiToken) throw new Error('Cloudflare Stream is not configured.');
  return { accountId, apiToken, customerCode: customerCode || null };
}

function apiUrl(path: string): string {
  const { accountId } = config();
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream${path}`;
}

async function cloudflareFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiToken } = config();
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...init.headers,
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as CloudflareEnvelope<T> | null;
  if (!response.ok || !payload?.success) {
    const message = payload?.errors?.map((error) => error.message).filter(Boolean).join(' ') || `Cloudflare Stream request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload.result;
}

export async function provisionDirectTusUpload(input: {
  uploadLength: number;
  uploadMetadata: string;
  expiresAt: string;
}): Promise<{ location: string; uid: string }> {
  const { apiToken } = config();
  const constraintMetadata = [
    `maxDurationSeconds ${Buffer.from(String(PRODUCT_VIDEO_MAX_DURATION_SECONDS)).toString('base64')}`,
    `expiry ${Buffer.from(input.expiresAt).toString('base64')}`,
  ].join(',');
  const metadata = [input.uploadMetadata, constraintMetadata].filter(Boolean).join(',');
  const response = await fetch(apiUrl('?direct_user=true'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(input.uploadLength),
      'Upload-Metadata': metadata,
    },
    cache: 'no-store',
  });
  const location = response.headers.get('location');
  if (!response.ok || !location) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Cloudflare Stream rejected the upload request (${response.status}).`);
  }
  const uid = response.headers.get('stream-media-id') || new URL(location).pathname.split('/').filter(Boolean).pop();
  if (!uid) throw new Error('Cloudflare Stream accepted the upload but did not return a video identifier.');
  return { location, uid };
}

export async function getCloudflareVideo(uid: string): Promise<CloudflareStreamVideo> {
  return cloudflareFetch<CloudflareStreamVideo>(`/${encodeURIComponent(uid)}`);
}

export async function deleteCloudflareVideo(uid: string): Promise<void> {
  const { apiToken } = config();
  const response = await fetch(apiUrl(`/${encodeURIComponent(uid)}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: 'no-store',
  });
  if (response.status === 404) return;
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Cloudflare Stream did not accept the delete (${response.status}).`);
  }
}

export async function ensureCloudflareDownload(uid: string): Promise<{ status: string | null; url: string | null }> {
  try {
    await cloudflareFetch<DownloadState>(`/${encodeURIComponent(uid)}/downloads`, { method: 'POST' });
  } catch (error) {
    // A repeated request can race an already-running generation. The GET below
    // is authoritative; only rethrow if it also fails.
    if (!(error instanceof Error)) throw error;
  }
  const result = await cloudflareFetch<DownloadState>(`/${encodeURIComponent(uid)}/downloads`);
  return {
    status: result.default?.status ?? null,
    url: result.default?.url ?? null,
  };
}

export function normalizeCloudflareVideo(video: CloudflareStreamVideo): NormalizedCloudflareVideo {
  const duration = typeof video.duration === 'number' && Number.isFinite(video.duration) ? video.duration : null;
  let status = normalizeCloudflareVideoState(video);
  let errorCode = video.status?.errReasonCode ?? null;
  let errorText = video.status?.errReasonText ?? null;
  if (status === 'ready' && duration != null && (duration < PRODUCT_VIDEO_MIN_DURATION_SECONDS || duration > PRODUCT_VIDEO_MAX_DURATION_SECONDS)) {
    status = 'failed';
    errorCode = 'DURATION_OUT_OF_RANGE';
    errorText = 'Processed video must be between 5 and 15 seconds.';
  }
  const { customerCode } = config();
  return {
    cloudflare_uid: video.uid,
    status,
    duration_seconds: duration,
    width: video.input?.width ?? null,
    height: video.input?.height ?? null,
    thumbnail_url: video.thumbnail ?? null,
    preview_url: video.preview ?? null,
    iframe_url: customerCode ? `https://customer-${customerCode}.cloudflarestream.com/${video.uid}/iframe` : null,
    playback_hls_url: video.playback?.hls ?? null,
    playback_dash_url: video.playback?.dash ?? null,
    error_code: errorCode,
    error_text: errorText,
    uploaded_at: video.uploaded ?? null,
    ready_at: status === 'ready' ? new Date().toISOString() : null,
  };
}

export function verifyCloudflareWebhook(input: {
  rawBody: string;
  signatureHeader: string | null;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): { valid: boolean; eventHash: string | null } {
  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET?.trim();
  if (!secret || !input.signatureHeader) return { valid: false, eventHash: null };
  const parts = Object.fromEntries(input.signatureHeader.split(',').map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, value.join('=')];
  }));
  const timestamp = Number(parts.time);
  const actualHex = parts.sig1;
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? 300;
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > tolerance || !/^[0-9a-f]+$/i.test(actualHex ?? '')) {
    return { valid: false, eventHash: null };
  }
  const expectedHex = createHmac('sha256', secret).update(`${parts.time}.${input.rawBody}`).digest('hex');
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(actualHex, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { valid: false, eventHash: null };
  return { valid: true, eventHash: createHash('sha256').update(input.rawBody).digest('hex') };
}

