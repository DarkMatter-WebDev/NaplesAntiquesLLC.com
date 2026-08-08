import {
  cropBackgroundPosition,
  squareCanvasWindow,
  type SocialCropRect,
} from '@/lib/social-image-framing';

export interface SocialSquareFraming {
  sourceAspect: number;
  canvasColor: string;
  hasCanvas: boolean;
}

/** Whether the current (including unsaved) crop still needs a square canvas. */
export function hasSquareCanvas(
  framing: SocialSquareFraming | undefined,
  crop: SocialCropRect | null | undefined,
): boolean {
  if (!framing) return false;
  const activeCrop = crop ?? FULL_FRAME;
  const cropAspect = framing.sourceAspect * activeCrop.w / activeCrop.h;
  return Math.abs(cropAspect - 1) > 0.001;
}

const FULL_FRAME: SocialCropRect = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Renders directly inside a lineup thumbnail using the same post-crop
 * contain-to-square framing and sampled canvas colour as the rendition
 * pipeline. There is intentionally no second "preview" beside the toolbar:
 * the selectable thumbnail itself is the honest preview.
 */
export function SocialSquareFramingImage({
  imageUrl,
  crop,
  framing,
}: {
  imageUrl: string;
  crop: SocialCropRect | null | undefined;
  framing: SocialSquareFraming | undefined;
}) {
  const activeCrop = crop ?? FULL_FRAME;
  const canvas = squareCanvasWindow(framing?.sourceAspect ?? null, activeCrop);
  const cropPositionX = cropBackgroundPosition(activeCrop.x, activeCrop.w);
  const cropPositionY = cropBackgroundPosition(activeCrop.y, activeCrop.h);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ background: framing?.canvasColor ?? '#ffffff' }}
    >
      <div
        className="absolute"
        style={{
          left: `${canvas.x * 100}%`,
          top: `${canvas.y * 100}%`,
          width: `${canvas.w * 100}%`,
          height: `${canvas.h * 100}%`,
          backgroundImage: `url("${imageUrl}")`,
          backgroundSize: `${100 / activeCrop.w}% ${100 / activeCrop.h}%`,
          backgroundPosition: `${cropPositionX} ${cropPositionY}`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}
