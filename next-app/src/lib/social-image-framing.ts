export interface SocialCropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL_FRAME: SocialCropRect = { x: 0, y: 0, w: 1, h: 1 };

/**
 * A safe starting crop that fills a square rendition while keeping the source
 * centered. It is deliberately only a starting point: the operator can move
 * or resize it before saving so edge details are never silently cut off.
 */
export function centeredSquareCrop(sourceAspect: number | null): SocialCropRect {
  if (!sourceAspect || !Number.isFinite(sourceAspect) || sourceAspect <= 0) return FULL_FRAME;
  if (sourceAspect > 1) {
    const w = 1 / sourceAspect;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  if (sourceAspect < 1) {
    const h = sourceAspect;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  return FULL_FRAME;
}

/** The contained crop's placement inside the prepared square canvas. */
export function squareCanvasWindow(sourceAspect: number | null, crop: SocialCropRect) {
  const cropAspect = (sourceAspect && sourceAspect > 0 ? sourceAspect : 1) * crop.w / crop.h;
  if (cropAspect >= 1) {
    const h = 1 / cropAspect;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  const w = cropAspect;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}

/** CSS percentage used to align a normalized source crop in a background. */
export function cropBackgroundPosition(start: number, size: number): string {
  if (size >= 0.9999) return '50%';
  return `${Math.min(100, Math.max(0, (start / (1 - size)) * 100)).toFixed(3)}%`;
}
