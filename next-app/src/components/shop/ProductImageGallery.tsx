'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { productImagePaddingBackground, productImagePaddingForImage, type ProductImagePaddingMap } from '@/types/product';

const ZOOM = 3;    // magnification
const PANEL = 220; // floating zoom box size px
const MOBILE_PANEL = 190;
// A small non-interactive border around each image where the magnifier does not
// activate, so the prev/next buttons at the edges stay usable.
const EDGE_DEAD_ZONE = 44;

interface Props {
  images: string[];
  title: string;
  imagePadding?: string | null;
  imagePaddingByImage?: ProductImagePaddingMap | null;
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

export default function ProductImageGallery({ images, title, imagePadding = null, imagePaddingByImage = null }: Props) {
  const [active, setActive] = useState(0);
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

  const closeZoom = useCallback(() => {
    touchZoomingRef.current = false;
    setZoom(null);
  }, []);

  const moveToImage = useCallback((index: number) => {
    closeZoom();
    setActive(index);
  }, [closeZoom]);

  const showPreviousImage = useCallback(() => {
    closeZoom();
    setActive((currentIndex) => (currentIndex - 1 + images.length) % images.length);
  }, [closeZoom, images.length]);

  const showNextImage = useCallback(() => {
    closeZoom();
    setActive((currentIndex) => (currentIndex + 1) % images.length);
  }, [closeZoom, images.length]);

  const openLightbox = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore clicks that land on the prev/next edge buttons.
    if (e.target instanceof HTMLElement && e.target.closest('.product-gallery-edge-button')) return;
    closeZoom();
    setLightboxOpen(true);
  }, [closeZoom]);

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
        <span className="material-symbols-outlined" style={{ fontSize: '4rem' }} aria-hidden="true">
          image
        </span>
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
  const visibleThumbnailIndexes = hasMultipleImages
    ? images.length === 2
      ? [active, (active + 1) % images.length]
      : [-1, 0, 1].map((offset) => (active + offset + images.length) % images.length)
    : [active];

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div
        ref={containerRef}
        className="relative aspect-square overflow-hidden"
        style={{ background: imageFrameBackground, cursor: 'crosshair', touchAction: 'none' }}
        title="Click to view full size"
        onClick={openLightbox}
        onPointerDown={(e) => handleZoomPointerDown(e, containerRef.current, imageRef.current, 'main')}
        onPointerMove={(e) => handleZoomPointerMove(e, containerRef.current, imageRef.current, 'main')}
        onPointerLeave={handlePointerLeave}
        onPointerUp={closeZoom}
        onPointerCancel={closeZoom}
      >
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
          priority
          unoptimized={current.startsWith('/assets/')}
        />

        {hasMultipleImages && (
          <>
            <button
              type="button"
              className="product-gallery-edge-button product-gallery-edge-prev absolute left-0 top-0 z-10 flex h-full w-[28%] items-center justify-start px-3 text-[var(--color-primary)] opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
              onPointerDown={handleNavigationPointerDown}
              onClick={showPreviousImage}
              aria-label="Previous image"
              title="Previous image"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(115,92,0,0.28)] bg-white/85 shadow-sm backdrop-blur"
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-[30px] leading-none">
                  chevron_left
                </span>
              </span>
            </button>
            <button
              type="button"
              className="product-gallery-edge-button product-gallery-edge-next absolute right-0 top-0 z-10 flex h-full w-[28%] items-center justify-end px-3 text-[var(--color-primary)] opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
              onPointerDown={handleNavigationPointerDown}
              onClick={showNextImage}
              aria-label="Next image"
              title="Next image"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(115,92,0,0.28)] bg-white/85 shadow-sm backdrop-blur"
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-[30px] leading-none">
                  chevron_right
                </span>
              </span>
            </button>
          </>
        )}

        {/* Lens square */}
        {zoom && zoom.source === 'main' && (
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
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={showPreviousImage}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-[var(--color-outline-variant)] bg-white text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)] hover:bg-[rgba(212,160,23,0.08)]"
            aria-label="Previous thumbnail"
            title="Previous image"
          >
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">
              chevron_left
            </span>
          </button>

          <div className="product-gallery-thumbnails flex items-center justify-center gap-2">
            {visibleThumbnailIndexes.map((i, slotIndex) => {
              const img = images[i] ?? current;
              const thumbnailFrameBackground = resolveFrameBackground(img, i);

              return (
                <button
                  key={`${i}-${slotIndex}`}
                  type="button"
                  onClick={() => moveToImage(i)}
                  className="product-gallery-thumbnail relative h-16 w-16 flex-shrink-0 overflow-hidden border-2 transition-all"
                  data-active={i === active ? 'true' : 'false'}
                  style={{
                    borderColor: i === active ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                    background: thumbnailFrameBackground,
                  }}
                  aria-label={`View image ${i + 1}`}
                >
                  <Image
                    src={img}
                    alt={`${title} ${i + 1}`}
                    fill
                    sizes="64px"
                    className="object-contain object-center"
                    unoptimized={img.startsWith('/assets/')}
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={showNextImage}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-[var(--color-outline-variant)] bg-white text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)] hover:bg-[rgba(212,160,23,0.08)]"
            aria-label="Next thumbnail"
            title="Next image"
          >
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">
              chevron_right
            </span>
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
          aria-label={`${title} — full size image viewer`}
          onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
        >
          <button
            type="button"
            onClick={() => closeLightbox()}
            aria-label="Close image viewer"
            title="Close"
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white transition-colors hover:bg-black/60"
          >
            <span className="material-symbols-outlined text-[28px] leading-none" aria-hidden="true">close</span>
          </button>

          <div
            className="relative flex flex-1 items-center justify-center px-4 pt-16 pb-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
          >
            <div
              ref={lightboxContainerRef}
              className="relative h-full w-full max-w-5xl"
              style={{ cursor: 'crosshair', touchAction: 'none' }}
              title="Hover to magnify"
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
                  aria-label="Previous image"
                  title="Previous image"
                  className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white transition-colors hover:bg-black/60"
                >
                  <span className="material-symbols-outlined text-[32px] leading-none" aria-hidden="true">chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  aria-label="Next image"
                  title="Next image"
                  className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white transition-colors hover:bg-black/60"
                >
                  <span className="material-symbols-outlined text-[32px] leading-none" aria-hidden="true">chevron_right</span>
                </button>
              </>
            )}
          </div>

          {hasMultipleImages && (
            <div className="overflow-x-auto pb-6">
              <div className="mx-auto flex w-max gap-2 px-4">
                {images.map((img, i) => {
                  const thumbBg = resolveFrameBackground(img, i);
                  return (
                    <button
                      key={`lightbox-${i}`}
                      type="button"
                      onClick={() => moveToImage(i)}
                      className="relative h-16 w-16 flex-shrink-0 overflow-hidden border-2 transition-all"
                      style={{
                        borderColor: i === active ? 'var(--color-primary)' : 'rgba(255,255,255,0.35)',
                        background: thumbBg,
                      }}
                      aria-label={`View image ${i + 1}`}
                      aria-current={i === active ? 'true' : undefined}
                    >
                      <Image
                        src={img}
                        alt={`${title} ${i + 1}`}
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
