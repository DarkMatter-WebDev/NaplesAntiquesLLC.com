'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';

const LENS = 100;  // lens square side px
const ZOOM = 3;    // magnification
const PANEL = 220; // floating zoom box size px

interface Props {
  images: string[];
  title: string;
}

interface ZoomState {
  lensX: number;
  lensY: number;
  panelLeft: number;  // viewport x for the floating box
  panelTop: number;   // viewport y for the floating box
  bgX: number;
  bgY: number;
  bw: number;
  bh: number;
}

export default function ProductImageGallery({ images, title }: Props) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const lensX = x - LENS / 2;
    const lensY = y - LENS / 2;

    // Zoom box centered on cursor, clamped to viewport
    let panelLeft = e.clientX - PANEL / 2;
    let panelTop  = e.clientY - PANEL / 2;
    if (panelLeft < 0) panelLeft = 0;
    if (panelTop  < 0) panelTop  = 0;
    if (panelLeft + PANEL > window.innerWidth)  panelLeft = window.innerWidth  - PANEL;
    if (panelTop  + PANEL > window.innerHeight) panelTop  = window.innerHeight - PANEL;

    // Center the hovered point in the zoom box
    const bw = rect.width  * ZOOM;
    const bh = rect.height * ZOOM;
    const bgX = -(x * ZOOM - PANEL / 2);
    const bgY = -(y * ZOOM - PANEL / 2);

    setZoom({ lensX, lensY, panelLeft, panelTop, bgX, bgY, bw, bh });
  }, []);

  const handleMouseLeave = useCallback(() => setZoom(null), []);

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

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div
        ref={containerRef}
        className="relative aspect-square overflow-hidden"
        style={{ background: 'var(--color-surface-container)', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <Image
          src={current}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover object-center"
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
              }}
              aria-label={`View image ${i + 1}`}
            >
              <Image
                src={img}
                alt={`${title} ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover object-center"
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
            width: PANEL,
            height: PANEL,
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
