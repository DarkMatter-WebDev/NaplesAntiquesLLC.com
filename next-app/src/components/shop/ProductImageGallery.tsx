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

const ZOOM = 3;    // magnification
const PANEL = 220; // floating zoom box size px
const MOBILE_PANEL = 190;
// A small non-interactive border around each image where the magnifier does not
// activate, so the prev/next buttons at the edges stay usable.
const EDGE_DEAD_ZONE = 44;
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
  const left = getWholeThumbnailScrollLeft(
    targetContentLeft,
    visibleCount,
    targetRect.width,
    gap,
    inlinePadding,
  );
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
  const nextThumbnail = thumbnail.nextElementSibling as HTMLElement | null;
  const measuredGap = nextThumbnail
    ? nextThumbnail.getBoundingClientRect().left - thumbnail.getBoundingClientRect().right
    : Number.NaN;
  const thumbnailParentStyle = window.getComputedStyle(thumbnail.parentElement ?? track);
  const gap = Number.isFinite(measuredGap)
    ? Math.max(0, measuredGap)
    : Number.parseFloat(thumbnailParentStyle.columnGap || thumbnailParentStyle.gap) || 0;
  const { trackWidth } = getWholeThumbnailTrackLayout(
    track.clientWidth,
    thumbnail.getBoundingClientRect().width,
    gap,
    inlinePadding,
  );
  track.style.width = `${trackWidth}px`;
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

interface ZoomState {
  source: 'main' | 'lightbox'; // which image is being magnified
  lensX: number;
  lensY: number;
  lensSize: number;   // matches the magnified region (panelSize / ZOOM)
  panelLeft: number;  // viewport x for the floating box
  panelTop: number;   // viewport y for the floating box
  panelSize: number;
  bgX: number;
  bgY: number;
  bw: number;
  bh: number;
}

export default function ProductImageGallery({ images, title, imagePadding = null, imagePaddingByImage = null, video = null, locale = 'en' }: Props) {
  const [active, setActive] = useState(0);
  const [videoSelected, setVideoSelected] = useState(false);
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const lightboxContainerRef = useRef<HTMLDivElement>(null);
  const lightboxImageRef = useRef<HTMLImageElement>(null);
  const touchZoomingRef = useRef(false);
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
    hoverToMagnify: 'Pase el cursor para ampliar',
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
    hoverToMagnify: 'Hover to magnify',
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

  const closeZoom = useCallback(() => {
    touchZoomingRef.current = false;
    setZoom(null);
  }, []);

  const moveToImage = useCallback((index: number) => {
    closeZoom();
    setVideoSelected(false);
    setActive(index);
  }, [closeZoom]);

  const moveToVideo = useCallback(() => {
    closeZoom();
    setLightboxOpen(false);
    setVideoSelected(true);
  }, [closeZoom]);

  const showPreviousImage = useCallback(() => {
    closeZoom();
    const targetIndex = (active - 1 + images.length) % images.length;
    prepareLightboxThumbnailNavigation(getThumbnailLoopDirection(active, targetIndex, images.length));
    prepareMediaThumbnailNavigation(null);
    setActive(targetIndex);
  }, [active, closeZoom, images.length, prepareLightboxThumbnailNavigation, prepareMediaThumbnailNavigation]);

  const showNextImage = useCallback(() => {
    closeZoom();
    const targetIndex = (active + 1) % images.length;
    prepareLightboxThumbnailNavigation(getThumbnailLoopDirection(active, targetIndex, images.length));
    prepareMediaThumbnailNavigation(null);
    setActive(targetIndex);
  }, [active, closeZoom, images.length, prepareLightboxThumbnailNavigation, prepareMediaThumbnailNavigation]);

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

  const openLightbox = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (videoSelected) return;
    // Ignore clicks that land on the prev/next edge buttons.
    if (e.target instanceof HTMLElement && e.target.closest('.product-gallery-edge-button')) return;
    closeZoom();
    setLightboxOpen(true);
  }, [closeZoom, videoSelected]);

  // Closing the lightbox also clears any active magnifier — the zoom panel
  // renders outside the lightbox portal, so it would otherwise linger.
  const closeLightbox = useCallback(() => {
    closeZoom();
    setLightboxOpen(false);
  }, [closeZoom]);

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

  const updateZoom = useCallback((
    clientX: number,
    clientY: number,
    mode: 'mouse' | 'touch',
    container: HTMLDivElement | null,
    img: HTMLImageElement | null,
    source: 'main' | 'lightbox',
  ) => {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    let imageLeft = rect.left;
    let imageTop = rect.top;
    let imageWidth = rect.width;
    let imageHeight = rect.height;

    if (img?.naturalWidth && img.naturalHeight) {
      const frameRatio = rect.width / rect.height;
      const imageRatio = img.naturalWidth / img.naturalHeight;

      if (imageRatio > frameRatio) {
        imageWidth = rect.width;
        imageHeight = rect.width / imageRatio;
        imageTop = rect.top + (rect.height - imageHeight) / 2;
      } else {
        imageHeight = rect.height;
        imageWidth = rect.height * imageRatio;
        imageLeft = rect.left + (rect.width - imageWidth) / 2;
      }
    }

    const x = Math.max(0, Math.min(clientX - imageLeft, imageWidth));
    const y = Math.max(0, Math.min(clientY - imageTop, imageHeight));

    const panelSize = mode === 'touch'
      ? Math.min(MOBILE_PANEL, Math.max(150, window.innerWidth - 32))
      : PANEL;
    // The lens marks exactly the region the panel magnifies (panelSize / ZOOM),
    // so the on-image highlight and the zoomed view stay in alignment.
    const lensSize = panelSize / ZOOM;
    const lensX = imageLeft - rect.left + x - lensSize / 2;
    const lensY = imageTop - rect.top + y - lensSize / 2;

    // Center the magnifier on the cursor (a magnifying glass), clamped to the
    // viewport so it stays fully on-screen near the edges.
    let panelLeft = clientX - panelSize / 2;
    let panelTop = clientY - panelSize / 2;
    if (panelLeft < 8) panelLeft = 8;
    else if (panelLeft + panelSize > window.innerWidth - 8) panelLeft = window.innerWidth - 8 - panelSize;
    if (panelTop < 8) panelTop = 8;
    else if (panelTop + panelSize > window.innerHeight - 8) panelTop = window.innerHeight - 8 - panelSize;

    // Center the hovered point in the zoom box
    const bw = imageWidth * ZOOM;
    const bh = imageHeight * ZOOM;
    const bgX = -(x * ZOOM - panelSize / 2);
    const bgY = -(y * ZOOM - panelSize / 2);

    setZoom({ source, lensX, lensY, lensSize, panelLeft, panelTop, panelSize, bgX, bgY, bw, bh });
  }, []);

  const handleZoomPointerMove = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    container: HTMLDivElement | null,
    img: HTMLImageElement | null,
    source: 'main' | 'lightbox',
  ) => {
    if (!container) return;
    // Non-interactive perimeter: don't magnify within a small margin of the image
    // edges, so the prev/next buttons at the sides stay usable without the
    // magnifier fighting them. (Clicking the edge buttons still navigates.)
    const rect = container.getBoundingClientRect();
    if (
      e.clientX < rect.left + EDGE_DEAD_ZONE || e.clientX > rect.right - EDGE_DEAD_ZONE ||
      e.clientY < rect.top + EDGE_DEAD_ZONE || e.clientY > rect.bottom - EDGE_DEAD_ZONE
    ) {
      closeZoom();
      return;
    }

    if (e.pointerType === 'mouse') {
      updateZoom(e.clientX, e.clientY, 'mouse', container, img, source);
      return;
    }

    if (touchZoomingRef.current) {
      e.preventDefault();
      updateZoom(e.clientX, e.clientY, 'touch', container, img, source);
    }
  }, [closeZoom, updateZoom]);

  const handleNavigationPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    closeZoom();
  }, [closeZoom]);

  const handleZoomPointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    container: HTMLDivElement | null,
    img: HTMLImageElement | null,
    source: 'main' | 'lightbox',
  ) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    touchZoomingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateZoom(e.clientX, e.clientY, 'touch', container, img, source);
  }, [updateZoom]);

  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') closeZoom();
  }, [closeZoom]);

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
      <div
        ref={containerRef}
        className="relative aspect-square overflow-hidden"
        style={{ background: videoSelected ? '#0b0b0b' : imageFrameBackground, cursor: videoSelected ? 'default' : 'crosshair', touchAction: videoSelected ? 'auto' : 'none' }}
        title={videoSelected ? labels.productVideo : labels.viewFullSize}
        onClick={openLightbox}
        onPointerDown={(e) => handleZoomPointerDown(e, containerRef.current, imageRef.current, 'main')}
        onPointerMove={(e) => handleZoomPointerMove(e, containerRef.current, imageRef.current, 'main')}
        onPointerLeave={handlePointerLeave}
        onPointerUp={closeZoom}
        onPointerCancel={closeZoom}
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
          ref={imageRef}
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
            <button
              type="button"
              className="product-gallery-edge-button product-gallery-edge-prev absolute left-0 top-0 z-10 flex h-full w-[28%] items-center justify-start px-3 text-[var(--color-primary)] opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
              onPointerDown={handleNavigationPointerDown}
              onClick={showPreviousMedia}
              aria-label={labels.previousMedia}
              title={labels.previousMedia}
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(115,92,0,0.28)] bg-white/85 shadow-sm backdrop-blur"
                aria-hidden="true"
              >
                <AppIcon name="chevron_left" className="text-[30px] leading-none" />
              </span>
            </button>
            <button
              type="button"
              className="product-gallery-edge-button product-gallery-edge-next absolute right-0 top-0 z-10 flex h-full w-[28%] items-center justify-end px-3 text-[var(--color-primary)] opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
              onPointerDown={handleNavigationPointerDown}
              onClick={showNextMedia}
              aria-label={labels.nextMedia}
              title={labels.nextMedia}
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(115,92,0,0.28)] bg-white/85 shadow-sm backdrop-blur"
                aria-hidden="true"
              >
                <AppIcon name="chevron_right" className="text-[30px] leading-none" />
              </span>
            </button>
          </>
        )}

        {/* Lens square */}
        {!videoSelected && zoom && zoom.source === 'main' && (
          <div
            style={{
              position: 'absolute',
              left: zoom.lensX,
              top: zoom.lensY,
              width: zoom.lensSize,
              height: zoom.lensSize,
              border: '2px solid rgba(115,92,0,0.65)',
              background: 'rgba(255,255,255,0.12)',
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>

      {/* Thumbnails */}
      {hasMultipleMedia && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={showPreviousMedia}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-[var(--color-outline-variant)] bg-white text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)] hover:bg-[rgba(212,160,23,0.08)]"
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
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-[var(--color-outline-variant)] bg-white text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)] hover:bg-[rgba(212,160,23,0.08)]"
            aria-label={labels.nextMediaThumbnail}
            title={labels.nextMedia}
          >
            <AppIcon name="chevron_right" className="text-2xl" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Zoom panel — portaled to <body> so its position: fixed is relative to
          the viewport. (An ancestor with any transform would otherwise become the
          containing block, offsetting the panel by that ancestor's position — an
          offset that grows with screen width via the centered max-width wrapper.) */}
      {zoom && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: zoom.panelLeft,
            top: zoom.panelTop,
            width: zoom.panelSize,
            height: zoom.panelSize,
            backgroundImage: `url(${current})`,
            backgroundSize: `${zoom.bw}px ${zoom.bh}px`,
            backgroundPosition: `${zoom.bgX}px ${zoom.bgY}px`,
            backgroundRepeat: 'no-repeat',
            border: zoom.source === 'lightbox' ? '1px solid rgba(255,255,255,0.45)' : '1px solid rgba(115,92,0,0.28)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            // Sit above the lightbox overlay (z-1000) when magnifying it.
            zIndex: zoom.source === 'lightbox' ? 1001 : 50,
            pointerEvents: 'none',
          }}
        />,
        document.body,
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
            <div
              ref={lightboxContainerRef}
              className="relative h-full w-full max-w-5xl"
              style={{ cursor: 'crosshair', touchAction: 'none' }}
              title={labels.hoverToMagnify}
              onPointerDown={(e) => handleZoomPointerDown(e, lightboxContainerRef.current, lightboxImageRef.current, 'lightbox')}
              onPointerMove={(e) => handleZoomPointerMove(e, lightboxContainerRef.current, lightboxImageRef.current, 'lightbox')}
              onPointerLeave={handlePointerLeave}
              onPointerUp={closeZoom}
              onPointerCancel={closeZoom}
            >
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
                ref={lightboxImageRef}
                src={current}
                alt={title}
                fill
                sizes="100vw"
                className="object-contain object-center product-gallery-fade-in"
                unoptimized={current.startsWith('/assets/')}
              />
              {/* Lens square */}
              {zoom && zoom.source === 'lightbox' && (
                <div
                  style={{
                    position: 'absolute',
                    left: zoom.lensX,
                    top: zoom.lensY,
                    width: zoom.lensSize,
                    height: zoom.lensSize,
                    border: '2px solid rgba(255,255,255,0.7)',
                    background: 'rgba(255,255,255,0.12)',
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              )}
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
