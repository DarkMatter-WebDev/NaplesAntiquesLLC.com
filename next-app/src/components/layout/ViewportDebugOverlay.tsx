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
 * device that actually fails, not by another round of inference.
 *
 * It answers four questions, in the order they narrow the search:
 *
 * 1. **How does this WebView resolve `vh` / `svh` / `dvh`?** Three probes are
 *    measured live. A `vh-svh gap` of 0 means the retractable-chrome theory
 *    never applied on this device at all.
 * 2. **Does the DOCUMENT height move when the toolbar does?** `docH` range. If
 *    it moves, something is still sized to the dynamic viewport. If it does not
 *    and the page still jumps, the cause is not CSS units.
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
 * HOW IT IS TURNED ON
 * -------------------
 * A **visible DEBUG button**, bottom-left on every page. Owner's call
 * (2026-08-18), made explicitly and knowing it is on a live storefront, because
 * the environment under test cannot be reached any other way: the Instagram
 * in-app browser has **no address bar**, so `?vpdebug=1` cannot be typed or
 * pasted — you arrive on whatever URL the link carried.
 *
 * `?vpdebug=1` still works where there IS an address bar.
 *
 * The choice is persisted to `localStorage` and the page reloads, so the
 * measurement starts from a clean baseline and survives the navigations needed
 * to reach a page worth measuring. The overlay carries its own TURN OFF, which
 * clears the key and drops the query string.
 *
 * ⚠️ This button is the single most visible piece of this diagnostic and the
 * first thing to delete when it comes out.
 *
 * SAFETY
 * ------
 * - The button sits where the readout will appear (top-left, under the fixed
 *   header), so the control and its output share one place. Deliberately NOT
 *   bottom-left: `CookieNotice` is `fixed bottom-3 left-3 right-3`, and a fresh
 *   in-app-browser session is precisely the state that still shows it.
 * - The measurement machinery and the probe elements are only created once
 *   enabled, so an ordinary visitor is never sent them.
 * - Everything it renders is `position: fixed`, so it contributes no scroll
 *   height. The readout is `pointer-events: none`; only the OFF control takes
 *   input.
 * - Every measurement listener is passive. A non-passive one here could itself
 *   change scrolling, corrupting the measurement it exists to take.
 */

const FLAG = 'vpdebug=1';
const STORAGE_KEY = 'nej-vpdebug';

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

    let stopMeasuring: (() => void) | null = null;

    const start = () => {
      if (stopMeasuring) return;

      // Probes are built here rather than rendered so a visitor who never turns
      // this on is not sent them. `position: fixed` keeps them out of the
      // scroll height; `visibility: hidden` keeps them off the screen while
      // STILL being laid out, which is the only reason they are measurable.
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
      let settleTimer = 0;
      let settled = false;

      /**
       * Re-seed every range from the CURRENT values, once, after the page
       * settles.
       *
       * Without this the readout is actively misleading: the document grows
       * from roughly one viewport to its full height while content and images
       * arrive, so `docH` reports a multi-thousand-pixel range and the verdict
       * line says the document height moves — which is true, and has nothing
       * whatever to do with the toolbar. An instrument that answers its own
       * headline question wrongly on every page load is worse than none.
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
       * A hidden or non-compositing webview suspends `requestAnimationFrame`
       * indefinitely — measured in this project — and a diagnostic that shows
       * nothing in exactly the conditions people reach for it is worse than
       * none.
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
       * Not redundant. A non-compositing webview suppresses `scroll` events AND
       * `requestAnimationFrame` while still moving `scrollY` — measured here: a
       * 1200px programmatic scroll produced 0 scroll events and 0 frames, and
       * only `setTimeout` ran. An instrument whose every input can be
       * suppressed by the conditions it must survive cannot be trusted, and
       * could not be verified before shipping.
       */
      const poll = window.setInterval(schedule, 250);

      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
      window.addEventListener('touchstart', down, { passive: true });
      window.addEventListener('touchend', up, { passive: true });
      window.addEventListener('touchcancel', up, { passive: true });
      vv?.addEventListener('resize', schedule);
      vv?.addEventListener('scroll', schedule);
      // Deferred, not inline: a synchronous first sample would be a setState in
      // the effect body.
      schedule();

      // Discount page-load growth once, then measure for real. 600ms after
      // `load` clears late images and the lazy map frame.
      const armSettle = () => {
        settleTimer = window.setTimeout(settle, 600);
      };
      if (document.readyState === 'complete') armSettle();
      else window.addEventListener('load', armSettle, { once: true });

      stopMeasuring = () => {
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
    };

    let persisted = false;
    try {
      persisted = window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // Private-mode storage can throw on read. Not a reason to fail.
    }
    if (persisted || window.location.search.includes(FLAG)) start();

    return () => {
      stopMeasuring?.();
    };
  }, []);

  const enable = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Private mode. The reload below still lands with the flag off, so say
      // nothing rather than pretend it worked.
    }
    // Reload rather than starting in place: the measurement wants a clean
    // baseline, and page-load growth is precisely what it has to discount.
    window.location.reload();
  };

  const disable = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
    // Drop the query string too, or `?vpdebug=1` would switch it straight back
    // on at the next render.
    window.location.href = window.location.pathname;
  };

  if (!snap) {
    return (
      <button
        type="button"
        onClick={enable}
        data-customer-reveal-skip
        style={{
          position: 'fixed',
          // Same spot the readout will occupy, so the control and its output
          // are in one place. NOT bottom-left: `CookieNotice` is
          // `fixed bottom-3 left-3 right-3`, so a bottom-left button lands on
          // top of the cookie banner on a first visit — which is exactly the
          // state a fresh in-app-browser session arrives in.
          top: '4.25rem',
          left: '0.5rem',
          zIndex: 2147483647,
          padding: '0.45rem 0.7rem',
          borderRadius: '0.4rem',
          border: '1px solid rgba(255, 248, 230, 0.45)',
          background: 'rgba(8, 8, 6, 0.82)',
          color: '#fff8e6',
          font: '700 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
          letterSpacing: '0.1em',
        }}
      >
        DEBUG
      </button>
    );
  }

  const span = (r: Range) => `${r.min}${r.max === r.min ? '' : `-${r.max}`}${r.changes ? ` ~${r.changes}` : ''}`;
  const drift = (r: Range) => r.max - r.min;

  // The verdict lines, so the reading does not depend on interpreting raw
  // numbers on a phone screen.
  //
  // ⚠️ `vh - svh` is the honest question, NOT "does vh equal dvh". On a desktop
  // all three units coincide, so an equality test reads as a dramatic YES while
  // measuring nothing at all. The GAP is the load-bearing number: it is the
  // retractable chrome as CSS sees it, and therefore exactly the phantom scroll
  // a `100vh` page shell was adding to every short page. A gap of 0 means this
  // browser has no retractable chrome and that theory does not apply here.
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
        // Print the magnitude, never a bare YES. Late content settles the
        // document by a few px after load, and a 10px drift beside a 50px
        // toolbar is noise — but a verdict word would read as a finding.
        // The `toolbar travel` line directly below is the comparison.
        `doc height moves: ${docMoves ? `${docMoves}px` : 'no'}`,
        `vh-svh gap:       ${chromeGap}px${chromeGap ? '' : '  (no retractable chrome)'}`,
        `dvh sits:         ${dvhSits}`,
        `toolbar travel:   ${drift(snap.innerH)}px`,
      ]
        .filter((line, index, all) => line !== '' || all[index - 1] !== '')
        .join('\n')}
      <button
        type="button"
        onClick={disable}
        style={{
          pointerEvents: 'auto',
          display: 'block',
          marginTop: '0.45rem',
          padding: '0.3rem 0.6rem',
          border: '1px solid rgba(255, 248, 230, 0.4)',
          borderRadius: '0.35rem',
          background: 'transparent',
          color: '#fff8e6',
          font: '700 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
          letterSpacing: '0.08em',
        }}
      >
        TURN OFF
      </button>
    </div>
  );
}
