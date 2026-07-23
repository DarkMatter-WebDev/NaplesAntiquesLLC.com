import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeCloudflareVideo, verifyCloudflareWebhook } from '@/lib/cloudflare-stream';
import { buildProductMediaItems, normalizeCloudflareVideoState, validateProductVideoFile } from '@/lib/product-video';

describe('product video constraints', () => {
  it('accepts a normal iPhone MOV and rejects duration/size violations', () => {
    expect(validateProductVideoFile({ size: 20_000_000, durationSeconds: 10, type: 'video/quicktime', name: 'IMG_0001.MOV' })).toEqual([]);
    expect(validateProductVideoFile({ size: 1, durationSeconds: 4.9, type: 'video/mp4', name: 'clip.mp4' })[0]).toContain('at least 5');
    expect(validateProductVideoFile({ size: 151 * 1024 * 1024, durationSeconds: 15.1, type: 'video/mp4', name: 'clip.mp4' })).toHaveLength(2);
  });

  it('maps Cloudflare states without exposing an unready asset', () => {
    expect(normalizeCloudflareVideoState({ status: { state: 'pendingupload' } })).toBe('uploading');
    expect(normalizeCloudflareVideoState({ readyToStream: false, status: { state: 'ready' } })).toBe('processing');
    expect(normalizeCloudflareVideoState({ readyToStream: true, status: { state: 'ready' } })).toBe('ready');
  });

  it('places the single video directly after the cover image', () => {
    expect(buildProductMediaItems(3, true)).toEqual([
      { type: 'image', index: 0 },
      { type: 'video', index: -1 },
      { type: 'image', index: 1 },
      { type: 'image', index: 2 },
    ]);
    expect(buildProductMediaItems(2, false)).toEqual([{ type: 'image', index: 0 }, { type: 'image', index: 1 }]);
  });
});

describe('Cloudflare Stream processing and webhooks', () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account';
    process.env.CLOUDFLARE_STREAM_API_TOKEN = 'token';
    process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE = 'customer-code';
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = 'webhook-secret';
  });

  afterEach(() => { process.env = { ...previousEnv }; });

  it('rejects a provider-ready video outside the locked 5–15 second contract', () => {
    const value = normalizeCloudflareVideo({ uid: 'uid', readyToStream: true, duration: 16, status: { state: 'ready' } });
    expect(value.status).toBe('failed');
    expect(value.error_code).toBe('DURATION_OUT_OF_RANGE');
  });

  it('accepts an authentic current webhook and rejects tampering and stale replay', () => {
    const rawBody = JSON.stringify({ uid: 'abc', readyToStream: true });
    const time = 1_700_000_000;
    const signature = createHmac('sha256', 'webhook-secret').update(`${time}.${rawBody}`).digest('hex');
    expect(verifyCloudflareWebhook({ rawBody, signatureHeader: `time=${time},sig1=${signature}`, nowSeconds: time }).valid).toBe(true);
    expect(verifyCloudflareWebhook({ rawBody: `${rawBody} `, signatureHeader: `time=${time},sig1=${signature}`, nowSeconds: time }).valid).toBe(false);
    expect(verifyCloudflareWebhook({ rawBody, signatureHeader: `time=${time},sig1=${signature}`, nowSeconds: time + 301 }).valid).toBe(false);
  });
});
