/**
 * Resize subscription that ignores in-app-browser toolbar movement.
 *
 * THE PROBLEM (owner report, 2026-08-11)
 * --------------------------------------
 * Instagram's, Facebook's and TikTok's in-app browsers hide and show their
 * toolbar as you scroll. Every one of those transitions fires a `resize` event
 * and changes `window.innerHeight` by roughly the toolbar's height. Any handler
 * that re-measures or re-renders on `resize` therefore runs continuously while
 * the visitor is simply scrolling, and the page visibly stutters — the classic
 * symptom being layout that "jumps" or appears to reload mid-scroll.
 *
 * Crucially the WIDTH does not change during those transitions, and neither does
 * `svh` (the small-viewport unit is defined against fully-expanded chrome, so it
 * is stable across exactly this event). So a resize is only worth reacting to
 * when the width changed — a rotation or a real window resize — or when the
 * height moved far more than any toolbar could account for.
 *
 * Pair this with `svh` in CSS: the units keep layout stable, this keeps the
 * JavaScript from doing pointless work (and forced reflows) on every scroll.
 */

/**
 * How much height change is written off as browser chrome.
 *
 * Mobile toolbars run roughly 44–120 CSS px (iOS Safari's bars, Chrome Android's
 * top bar, the in-app browsers' own). 160px clears all of them with margin while
 * staying far below the things that SHOULD count: a rotation moves the width, so
 * it is caught by the width test regardless of this number, and an on-screen
 * keyboard takes 250–350px.
 */
export const VIEWPORT_CHROME_TOLERANCE_PX = 160;

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * True when a resize is worth reacting to — i.e. not just browser chrome
 * sliding in or out.
 *
 * Width is checked first and exactly: any width change is a real layout change
 * (rotation, desktop resize, devtools). Height is checked only against the
 * tolerance, because that is the axis the toolbar moves.
 */
export function isLayoutAffectingResize(
  previous: ViewportSize,
  next: ViewportSize,
  tolerancePx: number = VIEWPORT_CHROME_TOLERANCE_PX,
): boolean {
  if (next.width !== previous.width) return true;
  return Math.abs(next.height - previous.height) > tolerancePx;
}

/**
 * Subscribe to resizes that actually change layout. Returns an unsubscribe
 * function; safe to call during an effect.
 *
 * The handler is NOT called on subscribe — callers already do their initial
 * measurement themselves, and firing here would double it.
 */
export function onLayoutAffectingResize(
  handler: () => void,
  tolerancePx: number = VIEWPORT_CHROME_TOLERANCE_PX,
): () => void {
  if (typeof window === 'undefined') return () => {};

  // ANCHOR, not "last seen". Comparing against the last event would make a slow
  // drag-resize invisible — a hundred 10px steps are each under tolerance, so
  // the baseline would creep along with them and never register the 300px total.
  // Anchoring to the last size we actually ACTED on fixes that, and still
  // absorbs toolbar oscillation: hiding the bar moves the height 60px off the
  // anchor (no fire), showing it again returns to 0px off (no fire).
  let anchor: ViewportSize = { width: window.innerWidth, height: window.innerHeight };

  const onResize = () => {
    const next: ViewportSize = { width: window.innerWidth, height: window.innerHeight };
    if (!isLayoutAffectingResize(anchor, next, tolerancePx)) return;
    anchor = next;
    handler();
  };

  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}
