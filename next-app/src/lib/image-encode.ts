/**
 * Canvas → upload encoding, with an HONEST content type.
 *
 * 🔴 The bug this exists to prevent (found on production 2026-08-30):
 * `canvas.toBlob(cb, 'image/webp', q)` does NOT fail when the browser cannot
 * encode WebP — the spec says the user agent falls back to `image/png`, and it
 * does so silently. The old upload path called `toBlob(..., 'image/webp')`,
 * never looked at `blob.type`, then hardcoded BOTH a `.webp` filename and
 * `contentType: 'image/webp'`.
 *
 * Result: **46 of 67 live product images were PNG wearing a `.webp` name**,
 * ~50 MB in total. A 2048px product photo is 1–3 MB as lossless PNG versus
 * 20–60 KB as WebP. They defeated the image optimizer (which honours the real
 * content type) and starved the rest of the carousel of bandwidth.
 *
 * Two rules come out of that, and both are load-bearing:
 *
 * 1. **`blob.type` is the only trustworthy signal.** The `type` argument you
 *    passed to `toBlob` is a request, not a result. Always compare them.
 * 2. **Never name or label a file by what you hoped it was.** If the browser
 *    hands back PNG, upload it AS PNG — a correctly-labelled PNG is merely
 *    large, while a mislabelled one is invisible to every audit and to the
 *    optimizer.
 *
 * JPEG is the fallback rather than PNG because these are photographs: for a
 * 2048px product shot JPEG is roughly an order of magnitude smaller than PNG,
 * and it is universally supported by `toBlob`.
 */

/** Encodings to attempt, best first. */
const PREFERRED_TYPES = ['image/webp', 'image/jpeg'] as const;

const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
};

/**
 * File extension for an image content type. Unknown types fall back to `png`,
 * the only lossless raster type `toBlob` is guaranteed to produce — so an
 * unexpected blob still gets a truthful, openable name rather than `.webp`.
 */
export function extensionForImageType(type: string): string {
  const normalized = (type || '').toLowerCase().split(';')[0].trim();
  return EXTENSIONS[normalized] ?? 'png';
}

export type EncodedImage = {
  blob: Blob;
  /** The type the bytes ACTUALLY are — safe to send as the upload contentType. */
  contentType: string;
  /** Extension matching `contentType`, never a guess. */
  extension: string;
  /** False when the browser could not produce WebP and we fell back. */
  isPreferred: boolean;
};

function toBlobAsync(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Encode a canvas for upload, preferring WebP and falling back to JPEG.
 *
 * Never throws on a format mismatch: if the browser produces something other
 * than what was asked for, the blob is returned with its REAL type so the
 * caller labels it correctly. It throws only if `toBlob` yields nothing at all.
 */
export async function encodeCanvasForUpload(
  canvas: HTMLCanvasElement,
  quality = 0.85,
): Promise<EncodedImage> {
  let fallback: Blob | null = null;

  for (const type of PREFERRED_TYPES) {
    const blob = await toBlobAsync(canvas, type, quality);
    if (!blob) continue;
    // The requested type is a REQUEST; blob.type is the result. They differ
    // exactly when the browser silently substituted PNG.
    if (blob.type === type) {
      return {
        blob,
        contentType: type,
        extension: extensionForImageType(type),
        isPreferred: type === PREFERRED_TYPES[0],
      };
    }
    fallback ??= blob;
  }

  if (!fallback) throw new Error('Could not encode image: the canvas produced no data.');

  const contentType = fallback.type || 'image/png';
  return {
    blob: fallback,
    contentType,
    extension: extensionForImageType(contentType),
    isPreferred: false,
  };
}
