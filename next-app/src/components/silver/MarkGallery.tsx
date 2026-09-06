'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

/** One photo in a "Reading Silver Marks" grid. Files live in `/assets/images/pages/silver-marks/`. */
export interface MarkPhoto {
  /** File stem: `<key>.webp` is the tile crop, `<key>-full.webp` the whole photo for the lightbox. */
  key: string;
  /** Bold lead of the caption ("EPBM", "London, 1824"). */
  lead: string;
  /** Rest of the caption. */
  rest: string;
  /** Square tile instead of 4:3 — for marks that read better as a square crop. */
  tall?: boolean;
  /** Photographed on a piece that went through the shop (gets the small "from our shop" tag). */
  shop?: boolean;
}

interface Props {
  photos: MarkPhoto[];
  /** Columns from `md` up; phones always get two. */
  cols?: 2 | 3;
  /** Localized UI strings. */
  labels: { expand: string; close: string; fromShop: string; hint: string };
  /** Image folder; defaults to the silver-marks folder. The gold guide passes its own (2026-09-06). */
  dir?: string;
}

const DIR = '/assets/images/pages/silver-marks';

/**
 * Click-to-expand photo grid for the silver-marks section (owner, 2026-09-06:
 * "make each image expandable … some of the images are cropped a bit close
 * and details are hanging off"). Each tile is a tight crop of the mark; the
 * expanded view is the whole photograph, so nothing is lost at the edges.
 *
 * Accessibility: tiles are real buttons (keyboard-openable), the viewer is a
 * native `<dialog>` opened with `showModal()` — it traps focus, closes on Esc,
 * and returns focus to the tile that opened it. The full-size image is only
 * requested when a tile is opened.
 */
export default function MarkGallery({ photos, cols = 2, labels, dir = DIR }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  const close = useCallback(() => setOpen(null), []);

  // A click on the backdrop lands on the <dialog> element itself, not on its
  // children — that is how "click outside to close" is told apart from a
  // click on the photo.
  function onDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) close();
  }

  const current = open !== null ? photos[open] : null;

  return (
    <>
      {/* Owner, 2026-09-06: "add a note for the user at the top of each photo
          bank that lets them know they can click to expand a photo". */}
      <p
        className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em]"
        style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        {labels.hint}
      </p>
      <div className={`grid grid-cols-2 gap-3 ${cols === 3 ? 'md:grid-cols-3' : ''}`}>
        {photos.map((p, i) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`${labels.expand}: ${p.lead}`}
            className="group flex flex-col overflow-hidden rounded-xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(38,28,6,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ borderColor: 'var(--color-outline-variant)', outlineColor: 'var(--color-primary)' }}
          >
            <span className={`relative block w-full ${p.tall ? 'aspect-square' : 'aspect-[4/3]'}`} style={{ background: '#eae7df' }}>
              <Image
                src={`${dir}/${p.key}.webp`}
                alt=""
                fill
                sizes={cols === 3 ? '(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw' : '(min-width: 1024px) 26vw, (min-width: 640px) 45vw, 45vw'}
                className="object-cover"
              />
              <span
                aria-hidden="true"
                className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-md text-sm shadow"
                style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--color-primary)' }}
              >
                ⤢
              </span>
            </span>
            <span className="block px-3 py-2 text-[0.75rem] leading-snug" style={{ color: 'var(--color-on-surface-variant)' }}>
              <b style={{ color: 'var(--color-on-surface)' }}>{p.lead}</b> {p.rest}
              {p.shop && (
                <span
                  className="ml-1 inline-block rounded-sm border px-1 align-[1px] text-[0.55rem] font-bold uppercase tracking-[0.1em]"
                  style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                >
                  {labels.fromShop}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClose={close}
        onClick={onDialogClick}
        className="m-auto max-h-[92vh] max-w-[min(96vw,1400px)] overflow-hidden rounded-xl border-0 bg-transparent p-0 backdrop:bg-[rgba(26,28,28,0.92)]"
        aria-label={current?.lead}
      >
        {current && (
          <div className="relative">
            {/* Plain <img>, not next/image: the whole photograph, requested only now. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${dir}/${current.key}-full.webp`}
              alt={`${current.lead} ${current.rest}`}
              className="block max-h-[82vh] w-auto max-w-full rounded-lg bg-white object-contain"
            />
            <p className="mt-3 text-center text-sm text-white">
              <b style={{ color: '#e9c349' }}>{current.lead}</b> {current.rest}
            </p>
            <button
              type="button"
              onClick={close}
              aria-label={labels.close}
              className="absolute -top-1 right-0 flex h-9 w-9 items-center justify-center rounded-full text-xl text-white"
              style={{ background: 'rgba(0,0,0,0.45)' }}
            >
              ×
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
