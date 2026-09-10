import sharp from 'sharp';

/**
 * Server-side product photo encoding (2026-09-09).
 *
 * WebKit — Safari AND Chrome on iPhone, which is Safari underneath — has never
 * implemented `canvas.toBlob('image/webp')`, so the browser encoder in
 * `image-encode.ts` honestly fell back to JPEG on every phone upload (0.7–2 MB
 * each at 2048px). The browser now only DOWNSIZES and hands over a high-quality
 * intermediate; the bytes that reach Storage are produced here by sharp, which
 * is already a dependency running on Netlify for the Etsy/Instagram pipelines.
 * The output format is therefore a fact, not a request — the `.webp` name and
 * `image/webp` contentType are always truthful.
 */

export const PRODUCT_IMAGE_MAX_EDGE_PX = 2048;
export const PRODUCT_IMAGE_WEBP_QUALITY = 80;
/**
 * Netlify cuts a synchronous function request body at 6 MB. A 2048px JPEG
 * intermediate is 1–3 MB, so 5 MB leaves headroom while still rejecting an
 * un-downsized original with a readable message instead of a gateway error.
 */
export const PRODUCT_IMAGE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/**
 * Longest edge for the copies sent to the listing assistant. Anthropic
 * downsamples anything larger than ~1568px anyway, so bytes above that only
 * slow the Lambda → provider hop (two 2 MB JPEGs = 5.3 MB of base64).
 */
export const AI_IMAGE_MAX_EDGE_PX = 1600;
const AI_IMAGE_SMALL_ENOUGH_BYTES = 600_000;

export type EncodedWebp = {
  buffer: Buffer;
  width: number;
  height: number;
  bytes: number;
  /** What sharp sniffed from the input bytes (jpeg, png, webp, heif…), never the filename. */
  sourceFormat: string | null;
};

/**
 * Any sharp-readable image -> WebP, EXIF-oriented, resized DOWN (never up) so
 * the longest edge is at most `maxEdge`. Throws on bytes that are not an image.
 */
export async function encodeProductImageToWebp(
  input: Buffer,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<EncodedWebp> {
  const maxEdge = options.maxEdge ?? PRODUCT_IMAGE_MAX_EDGE_PX;
  const quality = options.quality ?? PRODUCT_IMAGE_WEBP_QUALITY;

  const sourceMetadata = await sharp(input).metadata();
  const buffer = await sharp(input)
    .rotate()
    .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
  const outputMetadata = await sharp(buffer).metadata();

  return {
    buffer,
    width: outputMetadata.width ?? 0,
    height: outputMetadata.height ?? 0,
    bytes: buffer.byteLength,
    sourceFormat: sourceMetadata.format ?? null,
  };
}

/**
 * The copy handed to the AI provider: left alone when it is already small,
 * otherwise re-encoded to WebP at `AI_IMAGE_MAX_EDGE_PX`. Returns the bytes
 * and the mime type that is TRUE for them.
 */
export async function shrinkImageForAi(
  input: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string; shrunk: boolean }> {
  const metadata = await sharp(input).metadata();
  const longestEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  if (longestEdge <= AI_IMAGE_MAX_EDGE_PX && input.byteLength <= AI_IMAGE_SMALL_ENOUGH_BYTES) {
    return { buffer: input, mimeType, shrunk: false };
  }
  const encoded = await encodeProductImageToWebp(input, { maxEdge: AI_IMAGE_MAX_EDGE_PX, quality: 80 });
  return { buffer: encoded.buffer, mimeType: 'image/webp', shrunk: true };
}
