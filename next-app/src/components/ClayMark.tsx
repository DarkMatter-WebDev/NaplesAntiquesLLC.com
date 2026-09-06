import type { CSSProperties } from 'react';
import Image from 'next/image';

/**
 * An illustrated mark from `public/assets/images/icons/mark-*.webp` — the
 * owner's own icon pack (2026-09-04), which replaced the earlier matte-clay
 * renders one-for-one. The component keeps its historical name and the
 * `.clay-mark` CSS hook so the ~20 call sites and the stylesheet did not have
 * to churn; nothing about it is clay any more.
 *
 * These are DECORATIVE illustrations, deliberately not `AppIcon`. Functional UI
 * icons — cart, heart, chevrons, close, form and admin controls — stay Lucide
 * inline SVG, where a stock glyph is correct and `currentColor` recolouring is
 * load-bearing. See DECISIONS, "Illustrated marks: the owner's icon pack".
 *
 * ⛔ The artwork is never altered here or in the pipeline — resize to 512px
 * and encode to WebP with alpha, nothing else. The "float" is the shared
 * drop-shadow in `.clay-mark`, not baked into the file.
 *
 * Always `aria-hidden`: every placement sits beside a visible text label, so
 * announcing the mark would just duplicate it.
 */

export type ClayMarkName =
  // free-evaluation trust pillars
  | 'nocost'
  | 'pricing'
  | 'private'
  // what we buy / sell
  | 'chain'
  | 'signet-ring'
  | 'gemstone'
  | 'estate-jewelry'
  | 'watch'
  | 'sterling-flatware'
  | 'coins'
  | 'heirloom'
  | 'gold-seal'
  // process + trust
  | 'phone-signal'
  | 'photo-location'
  | 'scale'
  | 'flask'
  | 'xrf'
  | 'purity-test'
  | 'shield'
  | 'magnet'
  | 'house'
  | 'camera'
  | 'recycle'
  | 'cash'
  | 'dollar';

interface Props {
  name: ClayMarkName;
  /**
   * Rendered size in px. Doubles as the intrinsic width/height so the box is
   * reserved before load and nothing shifts. Keep these large — at icon size
   * (~40px) the clay modelling and the float are both invisible and the file
   * weight buys nothing; use an `AppIcon` there instead.
   */
  size?: number;
  /**
   * Suppress the float shadow. Required on dark surfaces, where a black
   * drop-shadow is invisible and only costs paint work.
   */
  onDark?: boolean;
  className?: string;
}

/**
 * Upscaling headroom for the optical scale in CSS. A mark that is scaled up
 * visually still needs enough source pixels, so the intrinsic width asks
 * next/image for the largest size any stylesheet might scale it to.
 */
const MAX_OPTICAL_SCALE = 3;

export default function ClayMark({ name, size = 96, onDark = false, className = '' }: Props) {
  return (
    <Image
      src={`/assets/images/icons/mark-${name}.webp`}
      alt=""
      width={Math.round(size * MAX_OPTICAL_SCALE)}
      height={Math.round(size * MAX_OPTICAL_SCALE)}
      aria-hidden="true"
      // `data-mark` lets the stylesheet target one mark's optical scale without
      // an inline style. Inline beats every class, so putting the scale here
      // would make it impossible for a surface to dial it back — which is
      // needed, because a matched grid cannot take the same boost a lone mark
      // can. Same reason --clay-size is a custom property rather than an inline
      // width: an inline width already silently killed `.fe-icon-mark`'s
      // responsive sizing once.
      data-mark={name}
      className={['clay-mark', onDark ? 'clay-mark--on-dark' : '', className].filter(Boolean).join(' ')}
      style={{ '--clay-size': `${size}px` } as CSSProperties}
    />
  );
}
