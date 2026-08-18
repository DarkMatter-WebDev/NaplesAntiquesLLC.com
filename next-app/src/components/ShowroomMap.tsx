'use client';

import { useEffect, useState } from 'react';
import { addressOneLine, BUSINESS_NAME, mapsEmbedUrl } from '@/lib/business-location';

/**
 * Zoom bounds for the buttons.
 *
 * 12 is "which part of Naples", 20 is rooftops. Outside that range the classic
 * embed stops being useful in either direction, and there is nothing to hold
 * the user's attention at z=3.
 */
const MIN_ZOOM = 12;
const MAX_ZOOM = 20;

/** Street level: the plaza and the roads you would turn off. */
const DEFAULT_ZOOM = 17;

/**
 * Rapid clicks coalesce into one frame load. Each zoom step is a full
 * navigation of the Google frame (see below), so an undebounced button would
 * fire three loads for three quick taps and show two of them as flicker.
 */
const APPLY_DELAY_MS = 300;

interface Props {
  locale?: string;
  /**
   * Widest the square may get. The frame is always 1:1 — see the note on
   * squareness below — so this caps the height as much as the width, and is the
   * only lever for how much of the map a surface spends space on.
   */
  maxWidth?: string;
  className?: string;
  initialZoom?: number;
}

/**
 * A small Google map of the showroom, with our own zoom buttons.
 *
 * The pin comes from `lib/business-location`, so it cannot drift from the
 * address printed beside it.
 *
 * ## Why the buttons reload the frame
 *
 * The map is a cross-origin `<iframe>`. Nothing on this page can call into it —
 * no `postMessage` API, no script access — so a zoom button cannot ask Google's
 * map to zoom. What it can do is ask for a *different map*: the zoom level is a
 * query parameter, so each button press re-requests the frame at a new `z`.
 *
 * That is a real trade-off and worth stating plainly: zooming costs a network
 * round trip and a brief redraw, where a native map would be instant. The
 * alternative is the Maps JavaScript API, which zooms smoothly and needs a
 * billable API key — rejected for a decorative widget. The debounce above keeps
 * a burst of clicks down to one load.
 *
 * ⚠️ The frame is **remounted** on zoom (via `key`), not merely re-`src`ed.
 * Changing the `src` of a live iframe pushes a session-history entry, so the
 * browser Back button would walk back through zoom levels instead of leaving
 * the page. A freshly inserted iframe's first load does not do that.
 *
 * The buttons also answer Google's "use ctrl + scroll to zoom" overlay, which
 * is Google's own gesture guard and cannot be turned off on a keyless embed.
 * With buttons present, nobody needs to discover that gesture.
 *
 * ## Three things this depends on, none of them local
 *
 * 1. **CSP.** It frames `https://www.google.com`, which is allowed in
 *    `next.config.ts` AND root `netlify.toml`. Both must list it — the Next
 *    header serves dev and the Netlify header serves production. Drop either
 *    and the frame goes blank with only a console error to show for it.
 * 2. **`loading="lazy"` is load-bearing, not a nicety.** First paint is an open
 *    performance item on this site (see TASKS), and Google's embed pulls a
 *    substantial third-party payload. Lazy keeps all of it below the fold and
 *    out of the critical path. Do not remove it to "make the map appear
 *    sooner".
 * 3. **It is a third party.** Google receives the visitor's IP and may set
 *    cookies once the frame loads, which is why `/privacy` names Google Maps
 *    under Service Providers. If this component is removed sitewide, remove
 *    that bullet too.
 *
 * ℹ️ This is a client component only because of the buttons. It still
 * server-renders its markup, so the map is in the initial HTML and the added
 * cost is the hydration of two buttons — not a deferred map.
 *
 * The map is decoration around information the page already states in text —
 * address, hours and a directions link are always present without it — so a
 * blocked or failed frame costs nothing a visitor needs.
 */
export default function ShowroomMap({
  locale = 'en',
  maxWidth = '28rem',
  className = '',
  initialZoom = DEFAULT_ZOOM,
}: Props) {
  const isEs = locale === 'es';

  // `zoom` follows the button immediately so the controls feel responsive;
  // `appliedZoom` is what the frame actually loads, and lags by the debounce.
  const [zoom, setZoom] = useState(initialZoom);
  const [appliedZoom, setAppliedZoom] = useState(initialZoom);

  useEffect(() => {
    if (zoom === appliedZoom) return;
    const timer = window.setTimeout(() => setAppliedZoom(zoom), APPLY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [zoom, appliedZoom]);

  const canZoomIn = zoom < MAX_ZOOM;
  const canZoomOut = zoom > MIN_ZOOM;

  // 36px. Above WCAG 2.2 AA's 24px minimum and comfortable for a thumb,
  // without the pair eating half the homepage map's 190px minimum height.
  const controlStyle = {
    width: '2.25rem',
    height: '2.25rem',
    background: 'rgba(255, 255, 255, 0.94)',
    color: 'var(--color-on-surface)',
    fontFamily: 'var(--font-label)',
    fontSize: '1.05rem',
    fontWeight: 700,
    lineHeight: 1,
  } as const;

  return (
    // ⚠️ SQUARE, not a letterboxed strip (owner, 2026-08-18). The frame was a
    // wide short band and it showed a corridor of Shirley St with almost no
    // context north or south of the door. A 1:1 frame roughly doubles the
    // north-south extent at the same zoom, which is what makes the plaza
    // recognisable on arrival. The cap is on WIDTH but binds the height too, so
    // widening a surface's `maxWidth` also makes it taller — check both.
    <div
      className={`relative mx-auto overflow-hidden rounded-2xl border ${className}`}
      style={{
        borderColor: 'var(--color-outline-variant)',
        background: 'var(--color-surface-container-low)',
        maxWidth,
        aspectRatio: '1 / 1',
      }}
    >
      <iframe
        // Remount per zoom level — see the history-entry warning above.
        key={appliedZoom}
        src={mapsEmbedUrl(appliedZoom)}
        title={
          isEs
            ? `Mapa de ${BUSINESS_NAME} en ${addressOneLine()}`
            : `Map of ${BUSINESS_NAME} at ${addressOneLine()}`
        }
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-full w-full"
        style={{ border: 0 }}
      />

      {/* Top-right on purpose: Google puts "View larger map" top-left and its
          own controls and terms along the bottom, so this is the one corner
          that is reliably ours to use. */}
      <div
        className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-lg border shadow-sm"
        style={{ borderColor: 'var(--color-outline-variant)' }}
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
          disabled={!canZoomIn}
          aria-label={isEs ? 'Acercar el mapa' : 'Zoom in'}
          className="flex items-center justify-center border-b transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ ...controlStyle, borderColor: 'var(--color-outline-variant)' }}
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
          disabled={!canZoomOut}
          aria-label={isEs ? 'Alejar el mapa' : 'Zoom out'}
          className="flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
          style={controlStyle}
        >
          {/* An en dash, not a hyphen — a hyphen at this weight reads as dust. */}
          <span aria-hidden="true">–</span>
        </button>
      </div>
    </div>
  );
}
