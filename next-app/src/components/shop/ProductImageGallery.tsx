'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { productImagePaddingBackground, productImagePaddingForImage, type ProductImagePaddingMap } from '@/types/product';
import { buildProductMediaItems, type PublicProductVideo } from '@/lib/product-video';
import {
  buildCircularThumbnailItems,
  getThumbnailLoopDirection,
  getWholeThumbnailScrollLeft,
  getWholeThumbnailTrackLayout,
  type ThumbnailCopy,
  type ThumbnailLoopDirection,
} from '@/lib/product-gallery-thumbnails';
import { productThumbnailLoading } from '@/lib/storefront-image-loading';
import { AppIcon } from '@/components/AppIcon';

// The hover/touch magnifier was removed on 2026-08-04 (owner request) at every
// viewport. Full-size viewing is the lightbox, which is what the main image's
// click already opens. Anything reintroducing a magnifier also has to bring back
// the edge dead-zone it needed to keep the prev/next buttons usable.
const thumbnailAnimationFrames = new WeakMap<HTMLDivElement, number>();

function cancelThumbnailTrackAnimation(track: HTMLDivElement) {
  const frame = thumbnailAnimationFrames.get(track);
  if (frame !== undefined) window.cancelAnimationFrame(frame);
  thumbnailAnimationFrames.delete(track);
  delete track.dataset.thumbnailMotion;
}

function findThumbnail(
  track: HTMLDivElement,
  copy: ThumbnailCopy,
  logicalIndex: number,
) {
  return Array.from(track.querySelectorAll<HTMLElement>('[data-thumbnail-copy]')).find(
    (element) => (
      element.dataset.thumbnailCopy === copy
      && Number(element.dataset.thumbnailIndex) === logicalIndex
    ),
  ) ?? null;
}

function positionThumbnailPair(
  track: HTMLDivElement,
  target: HTMLElement,
  behavior: ScrollBehavior,
  inlinePadding = 0,
  onComplete?: () => void,
) {
  const trackRect = track.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const trackStyle = window.getComputedStyle(track);
  const nextThumbnail = target.nextElementSibling as HTMLElement | null;
  const measuredGap = nextThumbnail
    ? nextThumbnail.getBoundingClientRect().left - targetRect.right
    : Number.NaN;
  const gap = Number.isFinite(measuredGap)
    ? Math.max(0, measuredGap)
    : Number.parseFloat(trackStyle.columnGap || trackStyle.gap) || 0;
  const visibleCount = Math.max(
    1,
    Math.round((track.clientWidth - inlinePadding * 2 + gap) / (targetRect.width + gap)),
  );
  const targetContentLeft = track.scrollLeft + targetRect.left - trackRect.left;
  // Clamp to the physically scrollable range. An unreachable target would
  // otherwise freeze the eased animation against the browser's own clamp for
  // its whole duration (the boundary "stutter"); clamping first means the
  // distance and duration always describe motion that can actually happen.
  const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
  const left = Math.min(maxScrollLeft, Math.max(0, getWholeThumbnailScrollLeft(
    targetContentLeft,
    visibleCount,
    targetRect.width,
    gap,
    inlinePadding,
  )));
  cancelThumbnailTrackAnimation(track);

  if (behavior === 'auto') {
    track.scrollLeft = left;
    onComplete?.();
    return;
  }

  const startLeft = track.scrollLeft;
  const distance = left - startLeft;
  if (Math.abs(distance) < 0.5) {
    track.scrollLeft = left;
    onComplete?.();
    return;
  }

  const cardStride = Math.max(1, targetRect.width + gap);
  const duration = Math.min(480, 260 + (Math.abs(distance) / cardStride) * 35);
  const startedAt = window.performance.now();
  track.dataset.thumbnailMotion = 'flowing';
  const animate = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    track.scrollLeft = startLeft + distance * eased;

    if (progress < 1) {
      const frame = window.requestAnimationFrame(animate);
      thumbnailAnimationFrames.set(track, frame);
    } else {
      track.scrollLeft = left;
      thumbnailAnimationFrames.delete(track);
      delete track.dataset.thumbnailMotion;
      onComplete?.();
    }
  };

  const frame = window.requestAnimationFrame(animate);
  thumbnailAnimationFrames.set(track, frame);
}

function fitWholeThumbnailCards(track: HTMLDivElement, inlinePadding: number) {
  const thumbnail = track.querySelector<HTMLElement>('[data-thumbnail-copy]');
  if (!thumbnail) return;

  cancelThumbnailTrackAnimation(track);
  // Clear the previous snapped width before measuring the space currently
  // offered by the responsive parent.
  track.style.width = '';
  track.style.flexShrink = '';
  const nextThumbnail = thumbnail.nextElementSibling as HTMLElement | null;
  const measuredGap = nextThumbnail
    ? nextThumbnail.getBoundingClientRect().left - thumbnail.getBoundingClientRect().right
    : Number.NaN;
  const thumbnailParentStyle = window.getComputedStyle(thumbnail.parentElement ?? track);
  const gap = Number.isFinite(measuredGap)
    ? Math.max(0, measuredGap)
    : Number.parseFloat(thumbnailParentStyle.columnGap || thumbnailParentStyle.gap) || 0;
  // clientWidth is integer-ROUNDED, so a fractional available width (423.6px
  // happens whenever the fluid parent lands off-pixel) can round UP — the
  // snapped width then exceeds the real space by under a pixel, flexbox
  // squeezes the track back down, and the last card's right border hangs in
  // the missing fraction and gets clipped. Floor the fractional truth instead.
  const availableWidth = Math.floor(track.getBoundingClientRect().width);
  // Never show more slots than there are real images: with `visibleCount`
  // capped at the original count, every scroll target (including both wrap
  // clones) stays within the physically scrollable range, keeping boundary
  // motion smooth for small collections too.
  const originalCount = track.querySelectorAll('[data-thumbnail-copy="original"]').length;
  const { trackWidth } = getWholeThumbnailTrackLayout(
    availableWidth,
    thumbnail.getBoundingClientRect().width,
    gap,
    inlinePadding,
    Math.max(1, Math.min(6, originalCount)),
  );
  track.style.width = `${trackWidth}px`;
  // The snapped width is exact by construction — never let the flex algorithm
  // shave sub-pixels off it (that clips the last card's right border).
  track.style.flexShrink = '0';
  // Enables the CSS that soft-fades a partial trailing card during the
  // pre-hydration window, before this fit has ever run.
  track.dataset.thumbnailFit = 'true';
}

function useCircularThumbnailTrack(
  itemCount: number,
  activeIndex: number,
  enabled = true,
  inlinePadding = 0,
) {
  const trackRef = useRef<HTMLDivElement>(null);
  const loopDirectionRef = useRef<ThumbnailLoopDirection>(null);
  const settleLoopRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);

  const prepareNavigation = useCallback((direction: ThumbnailLoopDirection) => {
    // If another click lands before a boundary animation settles, first swap
    // the visible clone for its identical original. The user sees no jump, and
    // the new navigation starts from a canonical scroll position.
    settleLoopRef.current?.();
    loopDirectionRef.current = direction;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track || itemCount < 2) return;

    const direction = loopDirectionRef.current;
    const targetCopy: ThumbnailCopy = direction === 'forward'
      ? 'after'
      : direction === 'backward'
        ? 'before'
        : 'original';
    const targetIndex = direction === 'forward'
      ? 0
      : direction === 'backward'
        ? itemCount - 1
        : activeIndex;
    const target = findThumbnail(track, targetCopy, targetIndex);
    if (!target) return;

    fitWholeThumbnailCards(track, inlinePadding);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = initializedRef.current && !reducedMotion ? 'smooth' : 'auto';
    initializedRef.current = true;

    if (!direction) {
      positionThumbnailPair(track, target, behavior, inlinePadding);
      loopDirectionRef.current = null;
      return;
    }

    let settled = false;
    let fallbackTimer = 0;
    const settle = () => {
      if (settled) return;
      settled = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      const original = findThumbnail(track, 'original', activeIndex);
      if (original) positionThumbnailPair(track, original, 'auto', inlinePadding);
      loopDirectionRef.current = null;
      if (settleLoopRef.current === settle) settleLoopRef.current = null;
    };

    settleLoopRef.current = settle;
    fallbackTimer = window.setTimeout(settle, reducedMotion ? 0 : 650);
    positionThumbnailPair(track, target, behavior, inlinePadding, settle);

    return () => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      if (settleLoopRef.current === settle) settleLoopRef.current = null;
    };
  }, [activeIndex, enabled, inlinePadding, itemCount]);

  useEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track || itemCount < 2 || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (settleLoopRef.current || thumbnailAnimationFrames.has(track)) return;
      fitWholeThumbnailCards(track, inlinePadding);
      const original = findThumbnail(track, 'original', activeIndex);
      if (original) positionThumbnailPair(track, original, 'auto', inlinePadding);
    });
    observer.observe(track.parentElement ?? track);
    return () => observer.disconnect();
  }, [activeIndex, enabled, inlinePadding, itemCount]);

  return { trackRef, prepareNavigation };
}

interface Props {
  images: string[];
  title: string;
  imagePadding?: string | null;
  imagePaddingByImage?: ProductImagePaddingMap | null;
  video?: PublicProductVideo | null;
  locale?: string;
}

export default function ProductImageGallery({ images, title, imagePadding = null, imagePaddingByImage = null, video = null, locale = 'en' }: Props) {
  const [active, setActive] = useState(0);
  const [videoSelected, setVideoSelected] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Cross-fade between image switches: the outgoing image stays underneath while
  // the new one fades in on top, then is cleared when the fade completes.
  const [prevImage, setPrevImage] = useState<string | null>(null);
  const [lastActive, setLastActive] = useState(active);

  const hasMultipleImages = images.length > 1;
  const isEs = locale === 'es';
  const labels = isEs ? {
    productVideo: 'Video del producto',
    viewFullSize: 'Ver en tamaño completo',
    previousMedia: 'Contenido anterior',
    nextMedia: 'Contenido siguiente',
    previousMediaThumbnail: 'Miniatura anterior',
    nextMediaThumbnail: 'Miniatura siguiente',
    playProductVideo: 'Reproducir video del producto',
    viewImage: (index: number) => `Ver imagen ${index}`,
    fullSizeViewer: `${title} - visor de imagen en tamaño completo`,
    closeImageViewer: 'Cerrar visor de imágenes',
    close: 'Cerrar',
    previousImage: 'Imagen anterior',
    nextImage: 'Imagen siguiente',
  } : {
    productVideo: 'Product video',
    viewFullSize: 'Click to view full size',
    previousMedia: 'Previous media',
    nextMedia: 'Next media',
    previousMediaThumbnail: 'Previous media thumbnail',
    nextMediaThumbnail: 'Next media thumbnail',
    playProductVideo: 'Play product video',
    viewImage: (index: number) => `View image ${index}`,
    fullSizeViewer: `${title} - full size image viewer`,
    closeImageViewer: 'Close image viewer',
    close: 'Close',
    previousImage: 'Previous image',
    nextImage: 'Next image',
  };
  const mediaItems = useMemo(() => buildProductMediaItems(images.length, Boolean(video)), [images.length, video]);
  const hasMultipleMedia = mediaItems.length > 1;
  const activeMediaIndex = useMemo(() => {
    const index = videoSelected
      ? mediaItems.findIndex((item) => item.type === 'video')
      : mediaItems.findIndex((item) => item.type === 'image' && item.index === active);
    return Math.max(0, index);
  }, [active, mediaItems, videoSelected]);
  const circularMediaItems = useMemo(() => buildCircularThumbnailItems(mediaItems), [mediaItems]);
  const circularImageItems = useMemo(() => buildCircularThumbnailItems(images), [images]);
  const {
    trackRef: mediaThumbnailTrackRef,
    prepareNavigation: prepareMediaThumbnailNavigation,
  } = useCircularThumbnailTrack(mediaItems.length, activeMediaIndex);
  const {
    trackRef: lightboxThumbnailTrackRef,
    prepareNavigation: prepareLightboxThumbnailNavigation,
  } = useCircularThumbnailTrack(images.length, active, lightboxOpen, 8);

  const moveToImage = useCallback((index: number) => {
    setVideoSelected(false);
    setActive(index);
  }, []);

  const moveToVideo = useCallback(() => {
    setLightboxOpen(false);
    setVideoSelected(true);
  }, []);

  const showPreviousImage = useCallback(() => {
    const targetIndex = (active - 1 + images.length) % images.length;
    prepareLightboxThumbnailNavigation(getThumbnailLoopDirection(active, targetIndex, images.length));
    prepareMediaThumbnailNavigation(null);
    setActive(targetIndex);
  }, [active, images.length, prepareLightboxThumbnailNavigation, prepareMediaThumbnailNavigation]);

  const showNextImage = useCallback(() => {
    const targetIndex = (active + 1) % images.length;
    prepareLightboxThumbnailNavigation(getThumbnailLoopDirection(active, targetIndex, images.length));
    prepareMediaThumbnailNavigation(null);
    setActive(targetIndex);
  }, [active, images.length, prepareLightboxThumbnailNavigation, prepareMediaThumbnailNavigation]);

  const showPreviousMedia = useCallback(() => {
    const currentIndex = videoSelected ? mediaItems.findIndex((item) => item.type === 'video') : mediaItems.findIndex((item) => item.type === 'image' && item.index === active);
    const targetIndex = (currentIndex - 1 + mediaItems.length) % mediaItems.length;
    const target = mediaItems[targetIndex];
    prepareMediaThumbnailNavigation(getThumbnailLoopDirection(currentIndex, targetIndex, mediaItems.length));
    prepareLightboxThumbnailNavigation(null);
    if (target?.type === 'video') moveToVideo();
    else if (target) moveToImage(target.index);
  }, [active, mediaItems, moveToImage, moveToVideo, prepareLightboxThumbnailNavigation, prepareMediaThumbnailNavigation, videoSelected]);

  const showNextMedia = useCallback(() => {
    const currentIndex = videoSelected ? mediaItems.findIndex((item) => item.type === 'video') : mediaItems.findIndex((item) => item.type === 'image' && item.index === active);
    const targetIndex = (currentIndex + 1) % mediaItems.length;
    const target = mediaItems[targetIndex];
    prepareMediaThumbnailNavigation(getThumbnailLoopDirection(currentIndex, targetIndex, mediaItems.length));
    prepareLightboxThumbnailNavigation(null);
    if (target?.type === 'video') moveToVideo();
    else if (target) moveToImage(target.index);
  }, [active, mediaItems, moveToImage, moveToVideo, prepareLightboxThumbnailNavigation, prepareMediaThumbnailNavigation, videoSelected]);

  // A finished swipe must not also open the lightbox: the browser still fires a
  // click after the gesture, and to that handler a swipe is indistinguishable
  // from a tap.
  const suppressNextClick = useRef(false);

  const openLightbox = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (videoSelected) return;
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    // Ignore clicks that land on the prev/next edge buttons. `Element`, NOT
    // `HTMLElement`: the chevron inside each button is an inline SVG, and an
    // SVGElement fails an `instanceof HTMLElement` test — which is exactly why
    // clicking the visible arrow used to fall through and open the lightbox
    // (fixed 2026-08-04). The buttons also stop propagation themselves; this
    // stays as the backstop for a click landing on the button's padding.
    if (e.target instanceof Element && e.target.closest('.product-gallery-edge-button')) return;
    setLightboxOpen(true);
  }, [videoSelected]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  // While the lightbox is open: lock body scroll and wire Esc / arrow keys.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox();
      else if (event.key === 'ArrowLeft') showPreviousImage();
      else if (event.key === 'ArrowRight') showNextImage();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen, closeLightbox, showPreviousImage, showNextImage]);

  // Remove the outgoing cross-fade layer once the incoming image has faded in.
  // A timer (rather than onAnimationEnd) keeps this robust for reduced-motion and
  // rapid switches.
  useEffect(() => {
    if (!prevImage) return;
    const timer = window.setTimeout(() => setPrevImage(null), 320);
    return () => window.clearTimeout(timer);
  }, [prevImage]);

  // An edge arrow navigates and nothing else: the main image sits under it and
  // opens the lightbox on click, so the button must not let that click bubble.
  const handleEdgeNavigation = useCallback((e: React.MouseEvent<HTMLButtonElement>, move: () => void) => {
    e.stopPropagation();
    move();
  }, []);

  /**
   * Fade each edge bar in as the cursor approaches ITS side (owner request
   * 2026-08-04), reaching solid once the pointer is actually over the bar.
   * Writes two custom properties on the frame; the bars read their own one, so
   * this is a single element to update per move.
   *
   * The CLICKABLE area is unchanged — only the reveal ramps. That separation is
   * the point: the bar can advertise itself from a distance without widening
   * the region that steals a click meant for the lightbox.
   */
  const revealFrameRef = useRef<HTMLDivElement>(null);
  const revealFrameId = useRef<number | null>(null);

  const paintEdgeReveal = useCallback((clientX: number | null) => {
    const frame = revealFrameRef.current;
    if (!frame) return;
    if (clientX == null) {
      frame.style.setProperty('--edge-prev-reveal', '0');
      frame.style.setProperty('--edge-next-reveal', '0');
      return;
    }
    const rect = frame.getBoundingClientRect();
    if (!rect.width) return;
    const barWidth = frame
      .querySelector<HTMLElement>('.product-gallery-edge-next')
      ?.getBoundingClientRect().width ?? 0;
    // The ramp reaches this far INWARD from the bar's inner edge. Proportional
    // so a 576px frame and a 344px one feel the same.
    const ramp = rect.width * 0.28;
    const reveal = (distanceFromEdge: number) => {
      const inward = distanceFromEdge - barWidth;
      if (inward <= 0) return 1;
      if (inward >= ramp) return 0;
      const t = 1 - inward / ramp;
      return t * t * (3 - 2 * t); // smoothstep: faint far out, firm up close
    };
    const x = clientX - rect.left;
    frame.style.setProperty('--edge-prev-reveal', reveal(x).toFixed(3));
    frame.style.setProperty('--edge-next-reveal', reveal(rect.width - x).toFixed(3));
  }, []);

  const pendingRevealX = useRef<number | null>(null);

  /**
   * Swipe the main image to change photo (owner request 2026-08-05). This is
   * the ONLY on-image control below 768px, where the edge bars are hidden; from
   * 768px up it runs alongside them.
   *
   * Touch pointers only — a mouse drag stays a plain click so the lightbox and
   * text selection behave as before.
   */
  const swipe = useRef<{ x: number; y: number; id: number; horizontal: boolean; moved: boolean } | null>(null);

  const handleFramePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || videoSelected || !hasMultipleMedia) return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: false, moved: false };
  }, [hasMultipleMedia, videoSelected]);

  const handleFramePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = swipe.current;
    if (gesture && e.pointerId === gesture.id) {
      // Commit to "this is a swipe" only once the movement is clearly sideways,
      // so a vertical scroll that starts on the photo still scrolls the page.
      const dx = e.clientX - gesture.x;
      const dy = e.clientY - gesture.y;
      if (Math.hypot(dx, dy) > 10) gesture.moved = true;
      if (!gesture.horizontal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        gesture.horizontal = true;
      }
      return;
    }
    // Mouse only. A touch device keeps the CSS `(hover: none)` treatment, and
    // writing an inline value here would override it permanently after one tap.
    if (e.pointerType !== 'mouse') return;
    // Always record the LATEST position, then coalesce to one paint per frame.
    // Storing it in a ref rather than capturing it in the callback matters: the
    // scheduled frame must paint where the cursor is now, not where it was when
    // the frame was first requested.
    pendingRevealX.current = e.clientX;
    if (revealFrameId.current !== null) return;
    revealFrameId.current = window.requestAnimationFrame(() => {
      revealFrameId.current = null;
      paintEdgeReveal(pendingRevealX.current);
    });
  }, [paintEdgeReveal]);

  const handleFramePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = swipe.current;
    swipe.current = null;
    if (!gesture || e.pointerId !== gesture.id) return;
    // ANY drag swallows the click that follows — horizontal or not, and even a
    // horizontal one too short to advance. The visitor dragged, they did not
    // tap, so the lightbox must not open. Browsers usually suppress the click
    // themselves once a touch becomes a scroll, but that is not something to
    // depend on.
    if (gesture.moved) suppressNextClick.current = true;
    if (!gesture.horizontal) return;
    const dx = e.clientX - gesture.x;
    const frameWidth = revealFrameRef.current?.getBoundingClientRect().width ?? 0;
    // Proportional, with a floor, so the gesture feels the same on a 344px
    // phone frame and a 576px tablet one.
    if (Math.abs(dx) < Math.max(40, frameWidth * 0.12)) return;
    if (dx < 0) showNextMedia();
    else showPreviousMedia();
  }, [showNextMedia, showPreviousMedia]);

  const handleFramePointerCancel = useCallback(() => {
    swipe.current = null;
  }, []);

  const handleFramePointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    // Cancel any queued paint, or it would re-light the bar just after the
    // pointer left (rAF does not run while the tab is hidden, so a stale frame
    // can land much later).
    if (revealFrameId.current !== null) {
      window.cancelAnimationFrame(revealFrameId.current);
      revealFrameId.current = null;
    }
    pendingRevealX.current = null;
    paintEdgeReveal(null);
  }, [paintEdgeReveal]);

  useEffect(() => () => {
    if (revealFrameId.current !== null) window.cancelAnimationFrame(revealFrameId.current);
  }, []);

  if (!images.length) {
    return (
      <div
        className="flex aspect-square items-center justify-center rounded-2xl text-[#735c00]/35"
        style={{ background: 'var(--color-surface-container)' }}
      >
        <AppIcon name="image"  style={{ fontSize: '4rem' }} aria-hidden="true" />
      </div>
    );
  }

  // On the product detail page the image frame defaults to white. A padding the
  // admin explicitly set (white/black/custom) is still honored; only the unset
  // default ('none') — which would otherwise be light gray — becomes white.
  const resolveFrameBackground = (image: string, index: number) => {
    const padding = productImagePaddingForImage(imagePadding, imagePaddingByImage, image, index);
    return padding === 'none' ? '#ffffff' : productImagePaddingBackground(padding);
  };

  const current = images[active];
  // When the displayed image changes, remember the outgoing one so it can sit
  // beneath the incoming image during its fade-in (a clean cross-fade).
  if (lastActive !== active) {
    setPrevImage(images[lastActive] ?? null);
    setLastActive(active);
  }
  const fadingFrom = prevImage && prevImage !== current ? prevImage : null;
  const imageFrameBackground = resolveFrameBackground(current, active);
  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      {/* `pan-y pinch-zoom` hands horizontal gestures to the swipe handler while
          leaving vertical scrolling AND pinch-zoom to the browser — a plain
          `none` would take all three, and `auto` would let the browser consume
          the horizontal drag before we see it. */}
      <div
        ref={revealFrameRef}
        onPointerDown={handleFramePointerDown}
        onPointerMove={handleFramePointerMove}
        onPointerUp={handleFramePointerUp}
        onPointerCancel={handleFramePointerCancel}
        onPointerLeave={handleFramePointerLeave}
        className="product-gallery-frame relative aspect-square overflow-hidden"
        style={{
          background: videoSelected ? '#0b0b0b' : imageFrameBackground,
          cursor: videoSelected ? 'default' : 'zoom-in',
          touchAction: videoSelected ? 'auto' : 'pan-y pinch-zoom',
        }}
        title={videoSelected ? labels.productVideo : labels.viewFullSize}
        onClick={openLightbox}
      >
        {videoSelected && video ? (
          <iframe
            src={video.iframeUrl}
            title={`${title} ${labels.productVideo.toLowerCase()}`}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : <>
        {fadingFrom && (
          <Image
            key={`prev-${fadingFrom}`}
            src={fadingFrom}
            alt=""
            aria-hidden="true"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain object-center"
            unoptimized={fadingFrom.startsWith('/assets/')}
          />
        )}
        <Image
          key={current}
          src={current}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain object-center product-gallery-fade-in"
          loading="eager"
          fetchPriority="high"
          unoptimized={current.startsWith('/assets/')}
        />
        </>}

        {hasMultipleMedia && (
          <>
            {/* Full-height bars, not floating circles: the hit area has always
                been the whole side of the frame, so the bar draws exactly what
                is clickable. */}
            <button
              type="button"
              className="product-gallery-edge-button product-gallery-edge-prev"
              onClick={(e) => handleEdgeNavigation(e, showPreviousMedia)}
              aria-label={labels.previousMedia}
              title={labels.previousMedia}
            >
              <AppIcon name="chevron_left" className="product-gallery-edge-chevron" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="product-gallery-edge-button product-gallery-edge-next"
              onClick={(e) => handleEdgeNavigation(e, showNextMedia)}
              aria-label={labels.nextMedia}
              title={labels.nextMedia}
            >
              <AppIcon name="chevron_right" className="product-gallery-edge-chevron" aria-hidden="true" />
            </button>
          </>
        )}

      </div>

      {/* Thumbnails */}
      {hasMultipleMedia && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={showPreviousMedia}
            className="product-gallery-thumb-nav"
            aria-label={labels.previousMediaThumbnail}
            title={labels.previousMedia}
          >
            <AppIcon name="chevron_left" className="text-2xl" aria-hidden="true" />
          </button>

          <div
            ref={mediaThumbnailTrackRef}
            className="product-gallery-thumbnails product-gallery-thumbnail-track flex max-w-[calc(100vw-8rem)] items-center gap-2 overflow-x-auto py-1"
          >
            {circularMediaItems.map(({ item, logicalIndex, copy }) => {
              const isClone = copy !== 'original';
              const isActive = logicalIndex === activeMediaIndex;
              const selectThumbnail = () => {
                prepareMediaThumbnailNavigation(
                  getThumbnailLoopDirection(activeMediaIndex, logicalIndex, mediaItems.length),
                );
                prepareLightboxThumbnailNavigation(null);
                if (item.type === 'video') moveToVideo();
                else moveToImage(item.index);
              };

              if (item.type === 'video') return (
                <button
                  key={`product-video-${copy}-${logicalIndex}`}
                  type="button"
                  onClick={selectThumbnail}
                  className="product-gallery-thumbnail relative h-16 w-16 flex-shrink-0 overflow-hidden border-2 transition-all"
                  data-active={isActive ? 'true' : 'false'}
                  data-thumbnail-copy={copy}
                  data-thumbnail-index={logicalIndex}
                  style={{ borderColor: isActive ? 'var(--color-primary)' : 'var(--color-outline-variant)', background: '#171717' }}
                  aria-label={labels.playProductVideo}
                  aria-current={!isClone && isActive ? 'true' : undefined}
                  aria-hidden={isClone || undefined}
                  tabIndex={isClone ? -1 : undefined}
                >
                  <Image src={images[0]} alt="" fill sizes="64px" loading="eager" className="object-cover opacity-55" unoptimized={images[0].startsWith('/assets/')} />
                  <AppIcon name="play_circle" className="absolute inset-0 z-10 flex items-center justify-center text-3xl text-white" aria-hidden="true" />
                </button>
              );
              const i = item.index;
              const img = images[i] ?? current;
              const thumbnailFrameBackground = resolveFrameBackground(img, i);

              return (
                <button
                  key={`image-${i}-${copy}-${logicalIndex}`}
                  type="button"
                  onClick={selectThumbnail}
                  className="product-gallery-thumbnail relative h-16 w-16 flex-shrink-0 overflow-hidden border-2 transition-all"
                  data-active={isActive ? 'true' : 'false'}
                  data-thumbnail-copy={copy}
                  data-thumbnail-index={logicalIndex}
                  style={{
                    borderColor: isActive ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                    background: thumbnailFrameBackground,
                  }}
                  aria-label={labels.viewImage(i + 1)}
                  aria-current={!isClone && isActive ? 'true' : undefined}
                  aria-hidden={isClone || undefined}
                  tabIndex={isClone ? -1 : undefined}
                >
                  <Image
                    src={img}
                    alt={isClone ? '' : `${title} ${i + 1}`}
                    fill
                    sizes="64px"
                    loading={productThumbnailLoading(i)}
                    className="object-contain object-center"
                    unoptimized={img.startsWith('/assets/')}
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={showNextMedia}
            className="product-gallery-thumb-nav"
            aria-label={labels.nextMediaThumbnail}
            title={labels.nextMedia}
          >
            <AppIcon name="chevron_right" className="text-2xl" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Full-size lightbox — portaled to body so ancestor transforms don't
          clip the fixed overlay. */}
      {lightboxOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex flex-col"
          style={{ background: 'rgba(18,14,7,0.94)' }}
          role="dialog"
          aria-modal="true"
          aria-label={labels.fullSizeViewer}
          onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
        >
          <button
            type="button"
            onClick={() => closeLightbox()}
            aria-label={labels.closeImageViewer}
            title={labels.close}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white transition-colors hover:bg-black/60"
          >
            <AppIcon name="close" className="text-[28px] leading-none" aria-hidden="true" />
          </button>

          <div
            className="relative flex flex-1 items-center justify-center px-4 pt-16 pb-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
          >
            <div className="relative h-full w-full max-w-5xl">
              {fadingFrom && (
                <Image
                  key={`lb-prev-${fadingFrom}`}
                  src={fadingFrom}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="100vw"
                  className="object-contain object-center"
                  unoptimized={fadingFrom.startsWith('/assets/')}
                />
              )}
              <Image
                key={current}
                src={current}
                alt={title}
                fill
                sizes="100vw"
                className="object-contain object-center product-gallery-fade-in"
                unoptimized={current.startsWith('/assets/')}
              />
            </div>

            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  aria-label={labels.previousImage}
                  title={labels.previousImage}
                  className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white transition-colors hover:bg-black/60"
                >
                  <AppIcon name="chevron_left" className="text-[32px] leading-none" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  aria-label={labels.nextImage}
                  title={labels.nextImage}
                  className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white transition-colors hover:bg-black/60"
                >
                  <AppIcon name="chevron_right" className="text-[32px] leading-none" aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          {hasMultipleImages && (
            <div
              ref={lightboxThumbnailTrackRef}
              className="product-gallery-thumbnail-track mx-auto max-w-full overflow-x-auto pb-6"
            >
              <div className="mx-auto flex w-max gap-2 px-2">
                {circularImageItems.map(({ item: img, logicalIndex: i, copy }) => {
                  const isClone = copy !== 'original';
                  const isActive = i === active;
                  const thumbBg = resolveFrameBackground(img, i);
                  return (
                    <button
                      key={`lightbox-${i}-${copy}`}
                      type="button"
                      onClick={() => {
                        prepareLightboxThumbnailNavigation(
                          getThumbnailLoopDirection(active, i, images.length),
                        );
                        prepareMediaThumbnailNavigation(null);
                        moveToImage(i);
                      }}
                      className="relative h-16 w-16 flex-shrink-0 overflow-hidden border-2 transition-all"
                      data-thumbnail-copy={copy}
                      data-thumbnail-index={i}
                      style={{
                        borderColor: isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.35)',
                        background: thumbBg,
                      }}
                      aria-label={labels.viewImage(i + 1)}
                      aria-current={!isClone && isActive ? 'true' : undefined}
                      aria-hidden={isClone || undefined}
                      tabIndex={isClone ? -1 : undefined}
                    >
                      <Image
                        src={img}
                        alt={isClone ? '' : `${title} ${i + 1}`}
                        fill
                        sizes="64px"
                        className="object-contain object-center"
                        unoptimized={img.startsWith('/assets/')}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
