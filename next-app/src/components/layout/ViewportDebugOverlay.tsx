'use client';

import { useEffect, useState } from 'react';

/**
 * TEMPORARY diagnostic overlay for the in-app-browser viewport jump.
 *
 * WHY THIS EXISTS
 * ---------------
 * The owner reports that opening the site from an Instagram link and scrolling
 * makes Instagram's bottom toolbar show/hide and the whole page jump. That
 * environment cannot be reproduced locally — on a desktop browser
 * `100vh === innerHeight`, so the failure mode is structurally absent — and the
 * 2026-08-11 `svh` batch shipped on desktop measurements alone for exactly that
 * reason. This overlay exists so the next attempt is settled by data from the
 * device that actually fails, not by a second round of inference.
 *
 * It answers four questions, in the order they narrow the search:
 *
 * 1. **How does this WebView resolve `vh` / `svh` / `dvh`?** Three probes are
 *    measured live. The whole page-shell theory rests on `vh` being the LARGE
 *    viewport here; if `vh` tracks `dvh` instead, the diagnosis changes.
 * 2. **Does the DOCUMENT height move when the toolbar does?** `docH` range. If
 *    it moves, some rule is still sized to the dynamic viewport. If it does not
 *    and the page still jumps, the cause is not CSS units at all.
 * 3. **Does the page scroll on its own?** Movement with no finger on the glass
 *    is counted separately. The homepage hero's touch snap reasserts
 *    `window.scrollTo` every frame for up to 1.6s; if it is mis-targeting after
 *    a toolbar transition, it shows up here and nowhere else.
 * 4. **Do the layout and visual viewports disagree?** `offsetTop` is the
 *    browser sliding the visual viewport under a fixed page.
 *
 * ⚠️ REMOVE THIS once the jump is understood and fixed — the component, its
 * mount in `[locale]/layout.tsx`, and its entry in the `dvh` allowlist in
 * `lib/__tests__/viewport-units.test.ts`. It is a diagnostic, not a feature.
 *
 * SAFETY
 * ------
 * - Renders `null` unless the URL carries `?vpdebug=1`, so it can never reach
 *   an ordinary visitor, and the probe elements are created imperatively so an
 *   ordinary visitor is not even shipped the markup.
 * - The flag is read from `window.location.search` inside an effect, NOT from
 *   `useSearchParams`. That hook client-renders everything up to the nearest
 *   `<Suspense>` boundary, and a throwaway diagnostic is not worth risking the
 *   454-page prerender invariant over. See the `RouteProgressBar` note in the
 *   layout.
 * - Everything it adds is `position: fixed` and `pointer-events: none`, so it
 *   contributes no scroll height and cannot intercept the gestures it measures.
 * - Every listener is passive. A non-passive one here could itself change
 *   scrolling, which would corrupt the measurement it exists to take.
 */

const FLAG = 'vpdebug=1';

interface Range {
  min: number;
  max: number;
  changes: number;
}

const seed = (value: number): Range => ({ min: value, max: value, changes: 0 });

function widen(range: Range, value: number): Range {
  const min = Math.min(range.min, value);
  const max = Math.max(range.max, value);
  if (min === range.min && max === range.max) return range;
  return { min, max, changes: range.changes + 1 };
}

interface Snapshot {
  innerH: Range;
  visualH: Range;
  offsetTop: Range;
  docH: Range;
  /** Live probe heights for the three viewport units. */
  vh: number;
  svh: number;
  dvh: number;
  /** Scroll movement that happened with no finger on the glass. */
  autoScrolls: number;
  autoScrollMax: number;
  /** False until the page-load growth has been discounted. */
  settled: boolean;
}

export default function ViewportDebugOverlay() {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.search.includes(FLAG)) return;

    // Probes are built here rather than rendered so that a visitor without the
    // flag is never sent them. `position: fixed` keeps them out of the scroll
    // height; `visibility: hidden` keeps them off the screen while STILL being
    // laid out, which is the only reason they are measurable at all.
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('data-customer-reveal-skip', '');
    host.style.cssText = 'position:fixed;top:0;left:-9999px;visibility:hidden;pointer-events:none';
    const units = ['100vh', '100svh', '100dvh'].map((unit) => {
      const probe = document.createElement('div');
      probe.style.height = unit;
      host.appendChild(probe);
      return probe;
    });
    document.body.appendChild(host);

    const vv = window.visualViewport;
    const state: Snapshot = {
      innerH: seed(window.innerHeight),
      visualH: seed(vv ? Math.round(vv.height) : 0),
      offsetTop: seed(vv ? Math.round(vv.offsetTop) : 0),
      docH: seed(document.documentElement.scrollHeight),
      vh: 0,
      svh: 0,
      dvh: 0,
      autoScrolls: 0,
      autoScrollMax: 0,
      settled: false,
    };

    let lastScrollY = window.scrollY;
    let fingerDown = false;
    let frame = 0;
    let timer = 0;
    let settled = false;

    /**
     * Re-seed every range from the CURRENT values, once, after the page settles.
     *
     * Without this the readout is actively misleading: the document grows from
     * roughly one viewport to its full height while content and images arrive,
     * so `docH` reports a multi-thousand-pixel range and the verdict line says
     * the document height moves — which is true, and has nothing whatever to do
     * with the toolbar. An instrument that answers its own headline question
     * wrongly on every page load is worse than no instrument.
     */
    const settle = () => {
      state.innerH = seed(window.innerHeight);
      state.visualH = seed(vv ? Math.round(vv.height) : 0);
      state.offsetTop = seed(vv ? Math.round(vv.offsetTop) : 0);
      state.docH = seed(document.documentElement.scrollHeight);
      state.autoScrolls = 0;
      state.autoScrollMax = 0;
      lastScrollY = window.scrollY;
      settled = true;
      schedule();
    };

    const sample = () => {
      state.innerH = widen(state.innerH, window.innerHeight);
      state.docH = widen(state.docH, document.documentElement.scrollHeight);
      if (vv) {
        state.visualH = widen(state.visualH, Math.round(vv.height));
        state.offsetTop = widen(state.offsetTop, Math.round(vv.offsetTop));
      }
      [state.vh, state.svh, state.dvh] = units.map((probe) =>
        Math.round(probe.getBoundingClientRect().height),
      ) as [number, number, number];

      const dy = window.scrollY - lastScrollY;
      lastScrollY = window.scrollY;
      // Movement with no finger on the glass is momentum or a programmatic
      // scroll. Momentum decays; a snap fighting the platform does not.
      if (!fingerDown && Math.abs(dy) > 1) {
        state.autoScrolls += 1;
        state.autoScrollMax = Math.max(state.autoScrollMax, Math.round(Math.abs(dy)));
      }

      state.settled = settled;
      setSnap({ ...state });
    };

    const run = () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
      frame = 0;
      timer = 0;
      sample();
    };

    /**
     * rAF-aligned, with a bounded timeout backstop.
     *
     * The backstop is not belt-and-braces. A hidden or non-compositing webview
     * suspends `requestAnimationFrame` indefinitely — this project has measured
     * it (no callback in 1500ms) — and a diagnostic that silently shows nothing
     * in exactly the conditions people reach for it is worse than none. Same
     * shape as `CustomerReveal`'s bounded backstop, for the same reason.
     */
    const schedule = () => {
      if (frame || timer) return;
      frame = window.requestAnimationFrame(run);
      timer = window.setTimeout(run, 250);
    };

    const down = () => {
      fingerDown = true;
    };
    const up = () => {
      fingerDown = false;
    };

    /**
     * A slow poll alongside the event listeners.
     *
     * Not redundant. A non-compositing webview suppresses `scroll` events and
     * `requestAnimationFrame` entirely while still moving `scrollY` — measured
     * here: a 1200px programmatic scroll produced 0 scroll events and 0 frames,
     * and only `setTimeout` ran. An instrument whose every input can be
     * suppressed by the same conditions it is meant to survive cannot be
     * trusted, and could not be verified before shipping. 250ms is far below
     * any toolbar transition and costs nothing for a flag-gated diagnostic.
     */
    const poll = window.setInterval(schedule, 250);

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    window.addEventListener('touchcancel', up, { passive: true });
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    // Deferred, not called inline: a synchronous first sample would be a
    // setState in the effect body.
    schedule();

    // Discount page-load growth once, then start measuring for real. 600ms
    // after `load` clears late images and the lazy map frame.
    let settleTimer = 0;
    const armSettle = () => {
      settleTimer = window.setTimeout(settle, 600);
    };
    if (document.readyState === 'complete') armSettle();
    else window.addEventListener('load', armSettle, { once: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
      if (settleTimer) window.clearTimeout(settleTimer);
      window.clearInterval(poll);
      window.removeEventListener('load', armSettle);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      host.remove();
    };
  }, []);

  if (!snap) return null;

  const span = (r: Range) => `${r.min}${r.max === r.min ? '' : `-${r.max}`}${r.changes ? ` ~${r.changes}` : ''}`;
  const drift = (r: Range) => r.max - r.min;

  // The verdict lines, so the reading does not depend on interpreting raw
  // numbers on a phone screen.
  //
  // ⚠️ `vh - svh` is the honest question, NOT "does vh equal dvh". On a
  // desktop all three units coincide, so an equality test reads as a dramatic
  // YES while measuring nothing at all. The GAP is the load-bearing number: it
  // is the retractable chrome as CSS sees it, and therefore exactly the phantom
  // scroll that a `100vh` page shell was adding to every short page. A gap of 0
  // means this browser has no retractable chrome and the shell theory does not
  // apply here.
  const docMoves = drift(snap.docH);
  const chromeGap = snap.vh - snap.svh;
  const dvhSits = snap.dvh === snap.vh ? 'at vh' : snap.dvh === snap.svh ? 'at svh' : 'between';

  return (
    <div
      data-customer-reveal-skip
      style={{
        position: 'fixed',
        top: '4.25rem',
        left: '0.5rem',
        zIndex: 2147483647,
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 1rem)',
        padding: '0.5rem 0.6rem',
        borderRadius: '0.5rem',
        background: 'rgba(8, 8, 6, 0.88)',
        color: '#fff8e6',
        font: '600 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
        letterSpacing: '0.01em',
        whiteSpace: 'pre',
      }}
    >
      {[
        `vh ${snap.vh}   svh ${snap.svh}   dvh ${snap.dvh}`,
        `innerH    ${span(snap.innerH)}`,
        `visualH   ${span(snap.visualH)}`,
        `offsetTop ${span(snap.offsetTop)}`,
        `docH      ${span(snap.docH)}`,
        `auto-scroll ${snap.autoScrolls}x max ${snap.autoScrollMax}px`,
        '',
        snap.settled ? '' : 'SETTLING - ignore these numbers',
        `doc height moves: ${docMoves ? `YES ${docMoves}px` : 'no'}`,
        `vh-svh gap:       ${chromeGap}px${chromeGap ? '' : '  (no retractable chrome)'}`,
        `dvh sits:         ${dvhSits}`,
        `toolbar travel:   ${drift(snap.innerH)}px`,
      ].join('\n')}
    </div>
  );
}
