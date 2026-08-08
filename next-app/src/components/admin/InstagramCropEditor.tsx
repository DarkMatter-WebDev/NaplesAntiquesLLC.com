'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { centeredSquareCrop } from '@/lib/social-image-framing';
import {
  hasSquareCanvas,
  SocialSquareFramingImage,
  type SocialSquareFraming,
} from './SocialSquareFramingPreview';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  startRect: CropRect;
}

const FULL_FRAME: CropRect = { x: 0, y: 0, w: 1, h: 1 };
/** Keep a crop from collapsing to nothing while dragging a corner past itself. */
const MIN_SIZE = 0.05;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

/**
 * Drag-to-crop editor for one Instagram carousel image.
 *
 * Crops are Instagram-only and stored normalized (fractions of the source), so
 * they survive both reordering the lineup and the source being re-encoded at a
 * different size. Nothing here touches the product's own photos.
 *
 * "Auto" asks the server to propose a box. That matters most on the black-sweep
 * chain shots, where the piece hangs on a neutral velvet bust: the proposal
 * keys on saturation there and frames the metal instead of the whole bust.
 */
export default function InstagramCropEditor({
  productId,
  imageUrl,
  value,
  framing,
  onChange,
  onClose,
}: {
  productId: string;
  imageUrl: string;
  value: CropRect | null;
  framing: SocialSquareFraming | undefined;
  onChange: (rect: CropRect | null) => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<CropRect>(value ?? FULL_FRAME);
  const [aspect, setAspect] = useState<number | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Takes the mode as an argument rather than being curried: a factory called
  // during render trips react-hooks/refs, which cannot see that the ref write
  // happens later in an event handler.
  const beginDrag = (event: React.PointerEvent, mode: DragMode) => {
    event.preventDefault();
    event.stopPropagation();
    const frame = frameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    dragRef.current = {
      mode,
      startX: (event.clientX - bounds.left) / bounds.width,
      startY: (event.clientY - bounds.top) / bounds.height,
      startRect: rect,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame) return;
    const bounds = frame.getBoundingClientRect();
    const dx = (event.clientX - bounds.left) / bounds.width - drag.startX;
    const dy = (event.clientY - bounds.top) / bounds.height - drag.startY;
    const start = drag.startRect;

    if (drag.mode === 'move') {
      setRect({
        ...start,
        // Clamp the origin so the box slides against the frame edge rather
        // than shrinking when dragged past it.
        x: clamp01(Math.min(start.x + dx, 1 - start.w)),
        y: clamp01(Math.min(start.y + dy, 1 - start.h)),
      });
      return;
    }

    // Corner drags move two edges; the opposite corner stays pinned.
    const left = drag.mode === 'nw' || drag.mode === 'sw';
    const top = drag.mode === 'nw' || drag.mode === 'ne';
    const anchorX = left ? start.x + start.w : start.x;
    const anchorY = top ? start.y + start.h : start.y;
    const movedX = clamp01(left ? start.x + dx : start.x + start.w + dx);
    const movedY = clamp01(top ? start.y + dy : start.y + start.h + dy);

    const nextX = Math.min(anchorX, movedX);
    const nextY = Math.min(anchorY, movedY);
    setRect({
      x: nextX,
      y: nextY,
      w: Math.max(MIN_SIZE, Math.abs(movedX - anchorX)),
      h: Math.max(MIN_SIZE, Math.abs(movedY - anchorY)),
    });
  };

  const endDrag = (event: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  const suggest = useCallback(async () => {
    setSuggesting(true);
    setHint(null);
    try {
      const res = await fetch('/api/admin/instagram/crop-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, imageUrl }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not analyze this image.');
      if (data?.rect) {
        setRect(data.rect as CropRect);
        setHint(
          data.mode === 'saturation'
            ? 'Framed the metal and excluded the neutral display prop.'
            : 'Framed everything that stands out from the backdrop.',
        );
      } else {
        setHint(data?.reason ?? 'No automatic crop could be determined.');
      }
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Could not analyze this image.');
    } finally {
      setSuggesting(false);
    }
  }, [imageUrl, productId]);

  const isFullFrame =
    rect.x <= 0.001 && rect.y <= 0.001 && rect.w >= 0.999 && rect.h >= 0.999;
  const currentHasCanvas = hasSquareCanvas(framing, rect);

  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: 16,
    height: 16,
    background: 'var(--color-primary)',
    border: '2px solid #fff',
    touchAction: 'none',
  };

  // Chrome-less on purpose: this editor renders inside AdminModal, which
  // supplies the window frame, title and close affordance.
  return (
    <div className="flex flex-col gap-3">
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_11rem]">
        <div>
          <p
            className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em]"
            style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
          >
            Source crop
          </p>
          <div
            ref={frameRef}
            className="relative w-full max-w-md select-none"
            style={{ aspectRatio: aspect ?? 4 / 3, touchAction: 'none' }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <Image
              src={imageUrl}
              alt="Crop source"
              fill
              sizes="448px"
              className="object-contain"
              unoptimized={imageUrl.startsWith('/assets/')}
              onLoad={(event) => {
                const img = event.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setAspect(img.naturalWidth / img.naturalHeight);
                }
              }}
            />

            {/* Dim everything outside the crop so the framing reads at a glance. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: 'rgba(0,0,0,0.55)',
                clipPath: `polygon(0% 0%, 0% 100%, ${pct(rect.x)} 100%, ${pct(rect.x)} ${pct(rect.y)}, ${pct(rect.x + rect.w)} ${pct(rect.y)}, ${pct(rect.x + rect.w)} ${pct(rect.y + rect.h)}, ${pct(rect.x)} ${pct(rect.y + rect.h)}, ${pct(rect.x)} 100%, 100% 100%, 100% 0%)`,
              }}
            />

            <div
              onPointerDown={(event) => beginDrag(event, 'move')}
              className="absolute cursor-move"
              style={{
                left: pct(rect.x),
                top: pct(rect.y),
                width: pct(rect.w),
                height: pct(rect.h),
                border: '1px solid var(--color-primary)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.6) inset',
                touchAction: 'none',
              }}
            />

            {([
              ['nw', rect.x, rect.y],
              ['ne', rect.x + rect.w, rect.y],
              ['sw', rect.x, rect.y + rect.h],
              ['se', rect.x + rect.w, rect.y + rect.h],
            ] as Array<[DragMode, number, number]>).map(([mode, cx, cy]) => (
              <div
                key={mode}
                role="slider"
                tabIndex={0}
                aria-label={`Resize crop from the ${mode} corner`}
                aria-valuenow={Math.round(rect.w * rect.h * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                onPointerDown={(event) => beginDrag(event, mode)}
                style={{
                  ...handleStyle,
                  left: `calc(${pct(cx)} - 8px)`,
                  top: `calc(${pct(cy)} - 8px)`,
                  cursor: mode === 'nw' || mode === 'se' ? 'nwse-resize' : 'nesw-resize',
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <p
            className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em]"
            style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
          >
            Prepared post preview
          </p>
          <div
            className="relative aspect-square w-full overflow-hidden border"
            style={{ borderColor: 'var(--color-outline-variant)' }}
          >
            <SocialSquareFramingImage imageUrl={imageUrl} crop={rect} framing={framing} />
          </div>
          <p
            className="mt-2 text-[0.68rem] leading-snug"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            {currentHasCanvas
              ? 'This framing keeps the entire photo and adds matching canvas. Choose Fill square to remove it.'
              : 'This crop fills the prepared square with no added canvas.'}
          </p>
        </div>
      </div>

      {hint && (
        <p className="text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
          {hint}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={suggest}
          disabled={suggesting}
          className="outline-button text-xs disabled:opacity-50"
        >
          {suggesting ? 'Analyzing…' : 'Auto'}
        </button>
        <button
          type="button"
          onClick={() => setRect(FULL_FRAME)}
          className="outline-button text-xs"
        >
          Full frame
        </button>
        <button
          type="button"
          onClick={() => {
            setRect(centeredSquareCrop(aspect));
            setHint('Started a centered square crop. Adjust it before applying so important details stay in frame.');
          }}
          disabled={!aspect}
          className="outline-button text-xs disabled:opacity-50"
        >
          Fill square
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => {
            // A full-frame box means "no crop", so it is stored as null rather
            // than as a rect that would do nothing.
            onChange(isFullFrame ? null : rect);
            onClose();
          }}
          className="gold-button text-xs"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onClose}
          className="outline-button text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
