import 'server-only';
import crypto from 'node:crypto';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSiteUrl } from '@/lib/order-email-branding';
import { etsyFetch, etsyUpload } from './client';
import { ETSY_MAX_IMAGES, resolveImageSourceKey } from './mapping';
import { insertListingImage, type EtsyListingImageRow } from './store';

// Image pipeline: fetch bytes from Supabase Storage / public/assets, transcode
// WebP -> JPEG (Etsy accepts JPEG/PNG/GIF, not WebP), upload, and reconcile
// crash-window duplicates. See etsy-sync-plan/05-image-pipeline.md.

const JPEG_QUALITY = 90;
// Etsy seller-help guidance (2026-07-08): "listing photos have a width and
// height of at least 2000 pixels" (both sides, not just the longest edge —
// a 2400x1200 photo would pass a longest-edge-only check but still fail
// this), "first listing photo should have a width and height of at least
// 635 pixels to avoid showing up lower in searches" (a stricter, ranking-
// affecting floor specific to rank 1), and "images larger than 1MB... may
// not finish uploading". All three are advisory — never block a sync, only
// warn (matches the existing non-blocking philosophy in sync.ts).
const RECOMMENDED_MIN_EDGE_PX = 2000;
const FIRST_PHOTO_MIN_EDGE_PX = 635;
const RECOMMENDED_MAX_UPLOAD_BYTES = 1 * 1024 * 1024;
// Resize DOWN only (never up — small sources stay small, same as before) to
// a generous bounding box comfortably above the 2000px recommendation. Caps
// unnecessarily huge sources (a modern phone photo is easily 4000px+) so
// file size and transcode time don't balloon for no visual benefit, while
// still safely clearing Etsy's floor for anything roughly square to start.
const UPLOAD_RESIZE_MAX_EDGE_PX = 2400;
// TODO(etsy-verify): the live OpenAPI spec fetch (2026-07-08) could not surface
// uploadListingImage's documented file-size/dimension caps (response was
// truncated before that operation). 20MB is a conservative placeholder cap
// pinned from general platform knowledge, not a confirmed API limit — verify
// against https://www.etsy.com/openapi/generated/oas/3.0.0.json or the Etsy
// seller-help docs before the first live upload and adjust if needed.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
// Budget per sync-step invocation (etsy-sync-plan/05-image-pipeline.md,
// 10-rate-limits-and-quotas.md): ~1-3s/image, stay well inside a ~10s Netlify
// function timeout.
export const IMAGE_STEP_BUDGET = 4;

/**
 * Legacy product photos can be a bare same-origin path (e.g.
 * "/assets/images/shop/...") rather than a full Supabase Storage URL — this
 * module's own header comment always documented both as valid sources, but
 * the fetch here never actually resolved the relative case. Node's fetch has
 * no implicit page origin to resolve a relative path against (unlike a
 * browser), so it threw "Failed to parse URL" — confirmed live 2026-07-08
 * (session 9), where this silently retried forever until a separate
 * stall-detection fix (sync.ts) made it fail fast instead. Resolved against
 * the site's own canonical URL (not the local dev origin) since
 * public/assets/* deploys identically everywhere this app runs, so this
 * works the same in local dev and production.
 */
export function resolveImageUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${getSiteUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function fetchImageBytes(url: string): Promise<Buffer> {
  const resolvedUrl = resolveImageUrl(url);
  const res = await fetch(resolvedUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${resolvedUrl}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`Image exceeds the ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB upload cap: ${resolvedUrl}`);
  }
  return buffer;
}

export interface TranscodeResult {
  buffer: Buffer;
  width: number;
  height: number;
  warning?: string;
}

/**
 * WebP (with or without alpha) or any other sharp-supported format -> JPEG,
 * quality ~90, sRGB, white background for transparency. sharp sniffs the real
 * format from the bytes (magic numbers), never trusts the source URL's
 * extension. Resizes down (never up) to UPLOAD_RESIZE_MAX_EDGE_PX — see the
 * constant's comment above.
 */
export async function transcodeToJpeg(input: Buffer): Promise<TranscodeResult> {
  const sourceMetadata = await sharp(input).metadata();
  const sourceShortestEdge = Math.min(sourceMetadata.width ?? 0, sourceMetadata.height ?? 0);

  const buffer = await sharp(input)
    .resize(UPLOAD_RESIZE_MAX_EDGE_PX, UPLOAD_RESIZE_MAX_EDGE_PX, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .toColorspace('srgb')
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  const outputMetadata = await sharp(buffer).metadata();

  return {
    buffer,
    width: outputMetadata.width ?? sourceMetadata.width ?? 0,
    height: outputMetadata.height ?? sourceMetadata.height ?? 0,
    warning:
      sourceShortestEdge > 0 && sourceShortestEdge < RECOMMENDED_MIN_EDGE_PX
        ? `Source image is ${sourceMetadata.width}x${sourceMetadata.height}px — Etsy recommends both width and height at least ${RECOMMENDED_MIN_EDGE_PX}px (small sources are not upscaled).`
        : undefined,
  };
}

export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Pure checks against Etsy's own photo guidance (see the constants' comment
 * above) for an already-transcoded image — no I/O, so unit-testable
 * independent of uploadListingImage's live Etsy call.
 */
export function computeUploadWarnings(params: { rank: number; width: number; height: number; byteLength: number }): string[] {
  const warnings: string[] = [];
  if (params.rank === 1) {
    const shortestEdge = Math.min(params.width, params.height);
    if (shortestEdge > 0 && shortestEdge < FIRST_PHOTO_MIN_EDGE_PX) {
      warnings.push(
        `First photo is ${params.width}x${params.height}px — Etsy says the first photo should be at least ${FIRST_PHOTO_MIN_EDGE_PX}px on both sides or it may rank lower in search.`,
      );
    }
  }
  if (params.byteLength > RECOMMENDED_MAX_UPLOAD_BYTES) {
    warnings.push(
      `Uploaded photo is ${(params.byteLength / (1024 * 1024)).toFixed(1)}MB — Etsy recommends keeping listing photos under 1MB for reliable uploads.`,
    );
  }
  return warnings;
}

export function formatUploadWarnings(rank: number, warnings: Array<string | undefined>): string | undefined {
  const unique = Array.from(new Set(warnings.filter((warning): warning is string => Boolean(warning))));
  return unique.length > 0 ? `Photo ${rank}: ${unique.join(' ')}` : undefined;
}

export interface UploadImageResult {
  etsyListingImageId: number;
  bytesSha256: string;
  warning?: string;
}

export async function uploadListingImage(params: {
  shopId: number;
  listingId: number;
  accessToken: string;
  sourceUrl: string;
  rank: number;
}): Promise<UploadImageResult> {
  const original = await fetchImageBytes(params.sourceUrl);
  const transcoded = await transcodeToJpeg(original);
  const bytesSha256 = sha256Hex(transcoded.buffer);

  const warnings = [
    transcoded.warning,
    ...computeUploadWarnings({ rank: params.rank, width: transcoded.width, height: transcoded.height, byteLength: transcoded.buffer.byteLength }),
  ];

  const form = new FormData();
  // Buffer's underlying ArrayBufferLike type includes SharedArrayBuffer, which
  // BlobPart's DOM typing rejects even though a plain Buffer is never actually
  // backed by one — the cast is safe at runtime.
  form.append('image', new Blob([transcoded.buffer as unknown as ArrayBuffer], { type: 'image/jpeg' }), `image-${params.rank}.jpg`);
  form.append('rank', String(params.rank));

  const res = await etsyUpload<{ listing_image_id: number }>(
    `/v3/application/shops/${params.shopId}/listings/${params.listingId}/images`,
    form,
    params.accessToken,
  );

  return { etsyListingImageId: res.data.listing_image_id, bytesSha256, warning: formatUploadWarnings(params.rank, warnings) };
}

export interface EtsyListingImageApi {
  listing_image_id: number;
  rank: number;
}

export async function fetchEtsyListingImages(params: { listingId: number; accessToken: string }): Promise<EtsyListingImageApi[]> {
  const res = await etsyFetch<{ results: EtsyListingImageApi[] }>({
    path: `/v3/application/listings/${params.listingId}/images`,
    accessToken: params.accessToken,
  });
  return res.data.results ?? [];
}

export async function deleteEtsyListingImage(params: {
  shopId: number;
  listingId: number;
  listingImageId: number;
  accessToken: string;
}): Promise<void> {
  await etsyFetch({
    method: 'DELETE',
    path: `/v3/application/shops/${params.shopId}/listings/${params.listingId}/images/${params.listingImageId}`,
    accessToken: params.accessToken,
  });
}

// ---------------------------------------------------------------------------
// Diff planning — pure. URL identity is the change signal (crop/replace in
// Product Admin always produces a new Storage URL, so byte-hashing remote
// objects is unnecessary). Re-rank is implemented as delete+re-upload.
// Confirmed 2026-07-08 against the full local OpenAPI spec: the only
// operation at /v3/application/shops/{shop_id}/listings/{listing_id}/images/
// {listing_image_id} is DELETE (deleteListingImage) — no PATCH/rank-only
// update exists, so 2 calls per re-rank is the real floor, not a placeholder
// (see etsy-sync-plan/05-image-pipeline.md).
// ---------------------------------------------------------------------------
export type ImageSyncOp =
  | { type: 'upload'; sourceUrl: string; sourceKey: string; rank: number }
  | { type: 'delete'; row: EtsyListingImageRow }
  | { type: 'rerank'; row: EtsyListingImageRow; sourceUrl: string; sourceKey: string; newRank: number };

export function planImageDiff(productImageUrls: string[], existingRows: EtsyListingImageRow[]): ImageSyncOp[] {
  const desired = productImageUrls.slice(0, ETSY_MAX_IMAGES).map((url, index) => ({
    sourceUrl: url,
    sourceKey: resolveImageSourceKey(url),
    rank: index + 1,
  }));
  const byKey = new Map(existingRows.map((row) => [row.source_key, row]));
  const desiredKeys = new Set(desired.map((entry) => entry.sourceKey));

  const ops: ImageSyncOp[] = [];
  for (const entry of desired) {
    const existing = byKey.get(entry.sourceKey);
    if (!existing) {
      ops.push({ type: 'upload', sourceUrl: entry.sourceUrl, sourceKey: entry.sourceKey, rank: entry.rank });
    } else if (existing.rank !== entry.rank) {
      ops.push({ type: 'rerank', row: existing, sourceUrl: entry.sourceUrl, sourceKey: entry.sourceKey, newRank: entry.rank });
    }
  }
  for (const row of existingRows) {
    if (!desiredKeys.has(row.source_key)) ops.push({ type: 'delete', row });
  }
  return ops;
}

/**
 * Crash-window reconciliation (etsy-sync-plan/05-image-pipeline.md,
 * 11-error-handling.md): before uploading, check whether Etsy already has an
 * image at a planned rank (uploaded in a prior invocation that died before its
 * DB row was written) and adopt it instead of uploading a duplicate.
 */
export async function reconcileMissingImageRows(params: {
  service: SupabaseClient;
  productId: string;
  listingId: number;
  accessToken: string;
  ops: ImageSyncOp[];
}): Promise<ImageSyncOp[]> {
  const hasUpload = params.ops.some((op) => op.type === 'upload');
  if (!hasUpload) return params.ops;

  const live = await fetchEtsyListingImages({ listingId: params.listingId, accessToken: params.accessToken });
  if (live.length === 0) return params.ops;
  const liveByRank = new Map(live.map((image) => [image.rank, image]));

  const remaining: ImageSyncOp[] = [];
  for (const op of params.ops) {
    if (op.type === 'upload') {
      const adopt = liveByRank.get(op.rank);
      if (adopt) {
        await insertListingImage(params.service, {
          product_id: params.productId,
          etsy_listing_id: params.listingId,
          source_url: op.sourceUrl,
          source_key: op.sourceKey,
          bytes_sha256: null,
          etsy_listing_image_id: adopt.listing_image_id,
          rank: op.rank,
        });
        continue;
      }
    }
    remaining.push(op);
  }
  return remaining;
}
