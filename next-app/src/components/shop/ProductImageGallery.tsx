'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { productImagePaddingBackground, productImagePaddingForImage, type ProductImagePaddingMap } from '@/types/product';

const LENS = 100;  // lens square side px
const ZOOM = 3;    // magnification
const PANEL = 220; // floating zoom box size px
const MOBILE_PANEL = 190;

interface Props {
  images: string[];
  title: string;
  imagePadding?: string | null;
  imagePaddingByImage?: ProductImagePaddingMap | null;
}

interface ZoomState {
  lensX: number;
  lensY: number;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const touchZoomingRef = useRef(false);

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

  const updateZoom = useCallback((clientX: number, clientY: number, mode: 'mouse' | 'touch') => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const img = imageRef.current;
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

    const lensX = imageLeft - rect.left + x - LENS / 2;
    const lensY = imageTop - rect.top + y - LENS / 2;
    const panelSize = mode === 'touch'
      ? Math.min(MOBILE_PANEL, Math.max(150, window.innerWidth - 32))
      : PANEL;

    // Desktop centers on cursor. Touch keeps the panel offset from the finger.
    let panelLeft = clientX - panelSize / 2;
    let panelTop = mode === 'touch' ? clientY - panelSize - 18 : clientY - panelSize / 2;
    if (mode === 'touch' && panelTop < 0) panelTop = clientY + 18;
    if (panelLeft < 0) panelLeft = 0;
    if (panelTop < 0) panelTop = 0;
    if (panelLeft + panelSize > window.innerWidth) panelLeft = window.innerWidth - panelSize;
    if (panelTop + panelSize > window.innerHeight) panelTop = window.innerHeight - panelSize;

    // Center the hovered point in the zoom box
    const bw = imageWidth * ZOOM;
    const bh = imageHeight * ZOOM;
    const bgX = -(x * ZOOM - panelSize / 2);
    const bgY = -(y * ZOOM - panelSize / 2);

    setZoom({ lensX, lensY, panelLeft, panelTop, panelSize, bgX, bgY, bw, bh });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest('.product-gallery-edge-button')) {
      closeZoom();
      return;
    }

    if (e.pointerType === 'mouse') {
      updateZoom(e.clientX, e.clientY, 'mouse');
      return;
    }

    if (touchZoomingRef.current) {
      e.preventDefault();
      updateZoom(e.clientX, e.clientY, 'touch');
    }
  }, [closeZoom, updateZoom]);

  const handleNavigationPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    closeZoom();
  }, [closeZoom]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    touchZoomingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateZoom(e.clientX, e.clientY, 'touch');
  }, [updateZoom]);

  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') closeZoom();
  }, [closeZoom]);

  if (!images.length) {
    return (
      <div
        className="aspect-square flex items-center justify-center text-6xl opacity-20"
        style={{ background: 'var(--color-surface-container)' }}
      >
        📷
      </div>
    );
  }

  const current = images[active];
  const imageFrameBackground = productImagePaddingBackground(productImagePaddingForImage(imagePadding, imagePaddingByImage, current, active));
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerUp={closeZoom}
        onPointerCancel={closeZoom}
      >
        <Image
          ref={imageRef}
          src={current}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain object-center"
          priority
          unoptimized={current.startsWith('/assets/')}
        />

        {hasMultipleImages && (
          <>
            <button
              type="button"
              className="product-gallery-edge-button product-gallery-edge-prev absolute left-0 top-0 z-10 flex h-full w-[28%] items-center justify-start px-3 text-[var(--color-primary)] opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
              onPointerEnter={closeZoom}
              onPointerMove={closeZoom}
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
              onPointerEnter={closeZoom}
              onPointerMove={closeZoom}
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
        {zoom && (
          <div
            style={{
              position: 'absolute',
              left: zoom.lensX,
              top: zoom.lensY,
              width: LENS,
              height: LENS,
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
              const thumbnailFrameBackground = productImagePaddingBackground(productImagePaddingForImage(imagePadding, imagePaddingByImage, img, i));

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

      {/* Zoom panel — fixed to viewport, no overflow clipping */}
      {zoom && (
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
            border: '1px solid rgba(115,92,0,0.28)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
