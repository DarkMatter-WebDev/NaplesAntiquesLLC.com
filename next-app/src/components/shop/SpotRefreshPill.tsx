'use client';

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

interface Props {
  /** Formatted price text (already localized/formatted by the call site). */
  display: string;
  label: string;
  ariaLabel: string;
  isEs: boolean;
  containerStyle?: CSSProperties;
  labelStyle?: CSSProperties;
  priceStyle?: CSSProperties;
}

const BUSINESS_TIME_ZONE = 'America/New_York';

function formatRefreshTime(ms: number, isEs: boolean): string {
  return new Intl.DateTimeFormat(isEs ? 'es-US' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(ms));
}

/**
 * Live-spot pill that refreshes the page's server-rendered pricing on click
 * (router.refresh() — so product cards and the pill always agree, instead of
 * only the pill updating) and confirms with a short timestamped note.
 *
 * The root element stays a styled DIV on purpose: the shop layouts target the
 * pills with `.shop-search-spot-row > div:nth-child(...)` (grid reordering,
 * responsive hide, radius overrides), so the click behavior lives on an
 * invisible stretched button INSIDE the div rather than changing the tag.
 *
 * The confirmation note renders through a portal to document.body with fixed
 * positioning: the shop sidebar/reveal animations create stacking contexts
 * that would otherwise paint sibling pills and neighboring sections over it.
 */
export default function SpotRefreshPill({
  display,
  label,
  ariaLabel,
  isEs,
  containerStyle,
  labelStyle,
  priceStyle,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [showNote, setShowNote] = useState(false);
  const [notePos, setNotePos] = useState<{ left: number; top: number } | null>(null);
  const [refreshedAt, setRefreshedAt] = useState('');
  const awaitingRefresh = useRef(false);

  const handleClick = () => {
    setShowNote(false);
    awaitingRefresh.current = true;
    startTransition(() => router.refresh());
  };

  // Show the note when the refresh transition lands, then auto-hide. Deferred
  // callbacks (PriceUpdateTicker's pattern) keep react-hooks/set-state-in-effect
  // satisfied.
  useEffect(() => {
    if (isPending || !awaitingRefresh.current) return;
    awaitingRefresh.current = false;
    const show = window.setTimeout(() => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) setNotePos({ left: rect.left + rect.width / 2, top: rect.top - 6 });
      setRefreshedAt(formatRefreshTime(Date.now(), isEs));
      setShowNote(true);
    }, 0);
    const hide = window.setTimeout(() => setShowNote(false), 2200);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [isEs, isPending]);

  return (
    <div
      ref={rootRef}
      className="spot-refresh-pill"
      style={{ position: 'relative', ...containerStyle, opacity: isPending ? 0.6 : undefined }}
    >
      <span style={labelStyle}>{label}</span>
      <span style={priceStyle}>{display}</span>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`${ariaLabel} — ${isEs ? 'toque para actualizar' : 'tap to refresh'}`}
        aria-busy={isPending}
        title={isEs ? 'Actualizar precio en vivo' : 'Refresh live price'}
        className="spot-refresh-hit"
      />
      {showNote && notePos && typeof document !== 'undefined' && createPortal(
        <span
          role="status"
          className="spot-refresh-note"
          style={{ left: notePos.left, top: notePos.top }}
        >
          {isEs ? `Precio actualizado · ${refreshedAt}` : `Price refreshed · ${refreshedAt}`}
        </span>,
        document.body,
      )}
      <style jsx global>{`
        .spot-refresh-note {
          position: fixed;
          transform: translate(-50%, -100%);
          padding: 0.28rem 0.6rem;
          border-radius: 999px;
          border: 1px solid rgba(115, 92, 0, 0.35);
          background: rgba(255, 253, 248, 0.98);
          box-shadow: 0 8px 22px rgba(42, 34, 12, 0.22);
          color: #735c00;
          font-family: var(--font-label);
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
          pointer-events: none;
          z-index: 9999;
          animation: spot-refresh-note-in 180ms ease;
        }
        @keyframes spot-refresh-note-in {
          from {
            opacity: 0;
            transform: translate(-50%, calc(-100% + 3px));
          }
          to {
            opacity: 1;
            transform: translate(-50%, -100%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .spot-refresh-note {
            animation: none;
          }
        }
      `}</style>
      <style jsx>{`
        .spot-refresh-pill {
          transition: transform 140ms ease, opacity 140ms ease;
        }
        .spot-refresh-pill:hover {
          transform: translateY(-1px);
        }
        .spot-refresh-pill:active {
          transform: translateY(0);
        }
        .spot-refresh-hit {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          border-radius: inherit;
        }
        @media (prefers-reduced-motion: reduce) {
          .spot-refresh-pill {
            transition: none;
          }
          .spot-refresh-pill:hover {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
