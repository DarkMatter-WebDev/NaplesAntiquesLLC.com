'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { productImagePaddingBackground } from '@/types/product';

const LENS = 100;  // lens square side px
const ZOOM = 3;    // magnification
const PANEL = 220; // floating zoom box size px
const MOBILE_PANEL = 190;

interface Props {
  images: string[];
  title: string;
  imagePadding?: string | null;
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

export default function ProductImageGallery({ images, title, imagePadding = null }: Props) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const touchZoomingRef = useRef(false);

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
    if (e.pointerType === 'mouse') {
      updateZoom(e.clientX, e.clientY, 'mouse');
      return;
    }

    if (touchZoomingRef.current) {
      e.preventDefault();
      updateZoom(e.clientX, e.clientY, 'touch');
    }
  }, [updateZoom]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    touchZoomingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateZoom(e.clientX, e.clientY, 'touch');
  }, [updateZoom]);

  const closeZoom = useCallback(() => {
    touchZoomingRef.current = false;
    setZoom(null);
  }, []);

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
  const imageFrameBackground = productImagePaddingBackground(imagePadding);

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
        <div className="flex gap-2 flex-wrap">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className="relative w-16 h-16 overflow-hidden flex-shrink-0 border-2 transition-all"
              style={{
                borderColor: i === active ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                background: imageFrameBackground,
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
          ))}
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
