'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Nothing renders for this long. A navigation that resolves faster shows no bar
 * at all — not a brief flash, nothing. Most internal links on this site are
 * prefetched and commit well inside this window; the ones that do not (product
 * cards set `prefetch={false}`) are exactly the ones worth signalling.
 */
const SHOW_DELAY_MS = 120;

/**
 * Hard stop. A click that arms the bar but never commits a route — an anchor
 * whose handler cancels the navigation, a failed load — must not leave a bar on
 * screen indefinitely. This is a backstop for a case that should not happen,
 * not part of normal operation.
 */
const SAFETY_TIMEOUT_MS = 8_000;

/** A click that might navigate, reduced to primitives so it can be tested. */
export type NavigationIntent = {
  /** The anchor's resolved absolute href. */
  href: string;
  /** `window.location.origin` at click time. */
  currentOrigin: string;
  /** The path React has committed — the navigation's ORIGIN, not its target. */
  currentPath: string;
  /** The anchor's `target` attribute, if any. */
  target?: string | null;
  hasDownload?: boolean;
  /** Non-left button, or any of ctrl/meta/shift/alt held. */
  modifiedClick?: boolean;
};

/**
 * Should this click arm the progress bar?
 *
 * Every `false` here is owner rule 1 — only show the bar when it is genuinely
 * needed. A click that opens a new tab, leaves the site, downloads a file, or
 * updates the current page in place does not make the visitor wait on a route,
 * so it must not produce a bar.
 */
export function shouldArmProgressBar(intent: NavigationIntent): boolean {
  if (intent.modifiedClick) return false;
  if (intent.hasDownload) return false;
  if (intent.target && intent.target !== '_self') return false;

  let url: URL;
  try {
    url = new URL(intent.href, intent.currentOrigin);
  } catch {
    return false;
  }

  // mailto:, tel:, and friends leave the document entirely.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.origin !== intent.currentOrigin) return false;
  // Same path = hash jump or query-only change; both update in place.
  if (url.pathname === intent.currentPath) return false;

  return true;
}

/**
 * Has the pending navigation finished?
 *
 * Trivial on its face, and worth naming because getting `startedFrom` wrong is
 * what broke this component once already. On `popstate` the URL has ALREADY
 * moved to the destination, so passing `location.pathname` as the origin makes
 * this compare a path against itself — it returns false forever and the bar
 * hangs until the safety timeout. The origin must be the last COMMITTED path.
 */
export function isNavigationComplete(startedFrom: string, committedPath: string): boolean {
  return startedFrom !== committedPath;
}

/**
 * A 2px route-change progress bar.
 *
 * Two owner rules (2026-08-15) shape every decision here:
 *
 * 1. **It appears only when genuinely needed.** Hence `SHOW_DELAY_MS`, and hence
 *    same-path navigations never arm it at all — a hash jump or a query-only
 *    shop-filter change updates in place, so a bar there is noise.
 *
 * 2. **It disappears the moment the route commits.** There is deliberately no
 *    minimum display time, no animate-to-100%, and no fade-out tail. The bar
 *    means "still working"; when the work stops the signal stops, even if that
 *    means vanishing at 40% width. A run-out animation would be showing it
 *    longer than needed, which is the thing being ruled out.
 *
 * **Why a document click listener rather than `useLinkStatus`:** that hook
 * reports a single Link's pending state and must render *inside* that Link, so
 * a global bar would mean wrapping every link in the app.
 *
 * **Why `usePathname` and not `useSearchParams` for completion:** this renders
 * in the root layout, and `useSearchParams` would opt every route — all 454
 * static pages — into dynamic rendering. `usePathname` has no such cost, and it
 * is sufficient precisely because only path changes arm the bar.
 */
export default function RouteProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  /** Path the pending navigation started FROM. Null means nothing is pending. */
  const startedFrom = useRef<string | null>(null);
  /**
   * The path React has actually committed — which is NOT always
   * `window.location.pathname`. On `popstate` the URL has already moved to the
   * destination, so this ref is the only reliable record of where we came from.
   * Getting that wrong makes the completion check compare a path against itself,
   * and the bar then hangs until the safety timeout.
   */
  const committedPath = useRef(pathname);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    showTimer.current = null;
    safetyTimer.current = null;
    startedFrom.current = null;
  }, []);

  const stop = useCallback(() => {
    clear();
    setVisible(false);
  }, [clear]);

  const start = useCallback((from: string) => {
    // A second click before the first commits simply restarts the clock rather
    // than stacking timers.
    clear();
    startedFrom.current = from;
    showTimer.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    safetyTimer.current = setTimeout(() => {
      clear();
      setVisible(false);
    }, SAFETY_TIMEOUT_MS);
  }, [clear]);

  // Arm on any click that will actually change the path.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      const anchor = target instanceof Element ? target.closest('a') : null;
      if (!anchor || !anchor.getAttribute('href')) return;

      const armed = shouldArmProgressBar({
        href: anchor.href,
        currentOrigin: window.location.origin,
        currentPath: committedPath.current,
        target: anchor.target,
        hasDownload: anchor.hasAttribute('download'),
        modifiedClick:
          event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
      });
      if (!armed) return;

      start(committedPath.current);
    }

    // Capture phase, so this still sees clicks on links whose own handler calls
    // preventDefault and navigates via `router.push` instead (ProductBackLink).
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [start]);

  // Back/forward. `popstate` fires AFTER the URL has moved, so
  // `location.pathname` here is the DESTINATION; the origin is whatever React
  // last committed. Passing the destination as the origin would make the
  // completion check compare a path against itself and leave the bar up for the
  // full safety timeout — measured, not theorised.
  useEffect(() => {
    function onPopState() {
      // A history entry that only differs by query or hash lands on the same
      // path and updates in place. Rule 1: no bar.
      if (window.location.pathname === committedPath.current) return;
      start(committedPath.current);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [start]);

  // Completion: React has committed a different path than the one we left.
  useEffect(() => {
    if (startedFrom.current !== null && isNavigationComplete(startedFrom.current, pathname)) {
      stop();
    }
    // Must trail the check above — this is the "from" for the NEXT navigation.
    committedPath.current = pathname;
  }, [pathname, stop]);

  // Clean up timers if this unmounts mid-navigation.
  useEffect(() => clear, [clear]);

  if (!visible) return null;

  // aria-hidden on purpose: Next's own route announcer already tells assistive
  // technology that the page changed, so announcing this too would double up.
  return (
    <div className="route-progress" aria-hidden="true">
      <div className="route-progress-bar" />
    </div>
  );
}
