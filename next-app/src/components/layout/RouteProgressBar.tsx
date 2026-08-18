'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  /**
   * The committed query string, with or without its leading '?' ('' when none).
   * Present because a query-only change IS a wait on this site: the shop's
   * filters, sort, view toggle and pagination all keep the path and swap the
   * query, and each one round-trips to the server for a new RSC payload.
   */
  currentSearch?: string;
  /** The anchor's `target` attribute, if any. */
  target?: string | null;
  hasDownload?: boolean;
  /** Non-left button, or any of ctrl/meta/shift/alt held. */
  modifiedClick?: boolean;
};

/** '' or '?a=1' — one spelling, so two URLs can be compared as strings. */
function normalizeSearch(search: string): string {
  if (!search || search === '?') return '';
  return search.startsWith('?') ? search : `?${search}`;
}

/**
 * The identity of a location for "are we there yet" purposes: path + query.
 *
 * Path alone is not enough. A shop filter changes only the query, so a
 * path-only comparison would report "not arrived" forever and leave the bar up
 * until the safety timeout — the same class of bug as the popstate trap below.
 */
export function locationKey(pathname: string, search: string): string {
  return `${pathname}${normalizeSearch(search)}`;
}

/**
 * Should this click arm the progress bar?
 *
 * The test is now simply "will this make the visitor wait on the server?".
 * Anything that leaves the site, opens a new tab, downloads a file, or changes
 * nothing but the hash is still refused — those do not involve a wait. A
 * same-path/different-query click DOES, and arms.
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

  // Same path AND same query = a hash jump or a link to where we already are.
  // Nothing is fetched, so there is nothing to report.
  const from = locationKey(intent.currentPath, intent.currentSearch ?? '');
  const to = locationKey(url.pathname, url.search);
  if (from === to) return false;

  return true;
}

/**
 * Has the pending navigation finished?
 *
 * Trivial on its face, and worth naming because getting `startedFrom` wrong is
 * what broke this component once already. On `popstate` the URL has ALREADY
 * moved to the destination, so passing the destination as the origin makes this
 * compare a key against itself — it returns false forever and the bar hangs
 * until the safety timeout. The origin must be the last COMMITTED location.
 */
export function isNavigationComplete(startedFrom: string, committedLocation: string): boolean {
  return startedFrom !== committedLocation;
}

/* ── Imperative arming, for navigations that begin in code ─────────────────
   A document click listener can only see anchors. Several real waits on this
   site start from a <button> that calls router.push — the cart drawer's
   Checkout, Sign out, every shop filter control, and the admin order rows.
   Those call startRouteProgress() so the bar covers them too.

   Pass the destination when it is known: it is the only way this can tell a
   real navigation from a push to where the visitor already is, and a push to
   the current URL commits nothing for the completion check to observe. */
type ArmListener = (targetHref?: string) => void;
const armListeners = new Set<ArmListener>();

export function startRouteProgress(targetHref?: string): void {
  armListeners.forEach((listener) => listener(targetHref));
}

/**
 * A 2px route-change progress bar.
 *
 * **Owner rules, as they now stand (rule 1 was reversed on 2026-08-17):**
 *
 * 1. **It appears immediately, on every navigation.** There is no delay: the
 *    bar is set visible synchronously in the click handler. The original rule
 *    was the opposite — a 120ms delay so the bar appeared "only when genuinely
 *    needed" — but that made feedback unpredictable in practice. Most links are
 *    prefetched and commit inside 120ms, so identical taps produced a bar or no
 *    bar depending on whether that link had been prefetched, which tracked how
 *    much of the page was on screen and therefore looked like a per-page and
 *    per-viewport lottery. Consistency is the feature.
 *
 * 2. **It disappears the moment the route commits.** UNCHANGED, and reaffirmed
 *    by the owner on 2026-08-17. There is deliberately no minimum display time,
 *    no animate-to-100%, and no fade-out tail. The bar means "still working";
 *    when the work stops the signal stops, even if that means vanishing at 40%
 *    width. A fast navigation therefore shows a brief flash, and that is the
 *    accepted cost of rule 1 — do not "fix" it by adding a minimum duration
 *    without asking, because that was considered and declined.
 *
 * **Why a document click listener rather than `useLinkStatus`:** that hook
 * reports a single Link's pending state and must render *inside* that Link, so
 * a global bar would mean wrapping every link in the app.
 *
 * **Why `useSearchParams` despite the cost:** completion is keyed on path AND
 * query, because arming on query-only changes (rule 1's reach) means the path
 * often does not change at all. Calling it makes the client tree up to the
 * nearest Suspense boundary client-rendered, so ⚠️ **this component must stay
 * wrapped in `<Suspense>`** where it mounts in `[locale]/layout.tsx`. With that
 * boundary the containment is exact — the bar renders null, and everything
 * above it still prerenders. Verified: the build stays at 454/454 static pages.
 */
export default function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentKey = locationKey(pathname, searchParams.toString());

  const [visible, setVisible] = useState(false);
  /** Location the pending navigation started FROM. Null means nothing pending. */
  const startedFrom = useRef<string | null>(null);
  /**
   * The location React has actually committed — which is NOT always
   * `window.location`. On `popstate` the URL has already moved to the
   * destination, so this ref is the only reliable record of where we came from.
   * Getting that wrong makes the completion check compare a key against itself,
   * and the bar then hangs until the safety timeout.
   */
  const committedKey = useRef(currentKey);
  const committedPath = useRef(pathname);
  const committedSearch = useRef(searchParams.toString());
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
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
    // Synchronous, not a timer: rule 1 is that the tap is acknowledged at once.
    setVisible(true);
    safetyTimer.current = setTimeout(() => {
      clear();
      setVisible(false);
    }, SAFETY_TIMEOUT_MS);
  }, [clear]);

  // Arm on any click that will actually fetch something.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      const anchor = target instanceof Element ? target.closest('a') : null;
      if (!anchor || !anchor.getAttribute('href')) return;

      const armed = shouldArmProgressBar({
        href: anchor.href,
        currentOrigin: window.location.origin,
        currentPath: committedPath.current,
        currentSearch: committedSearch.current,
        target: anchor.target,
        hasDownload: anchor.hasAttribute('download'),
        modifiedClick:
          event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
      });
      if (!armed) return;

      start(committedKey.current);
    }

    // Capture phase, so this still sees clicks on links whose own handler calls
    // preventDefault and navigates via `router.push` instead (ProductBackLink).
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [start]);

  // Navigations started in code, via startRouteProgress().
  useEffect(() => {
    const listener: ArmListener = (targetHref) => {
      if (targetHref) {
        try {
          const url = new URL(targetHref, window.location.origin);
          // A push to where we already are commits nothing, so the completion
          // check would never fire and the bar would sit until the safety stop.
          if (locationKey(url.pathname, url.search) === committedKey.current) return;
        } catch {
          // An unparseable href is not a reason to withhold feedback; the
          // safety timeout still bounds it.
        }
      }
      start(committedKey.current);
    };
    armListeners.add(listener);
    return () => {
      armListeners.delete(listener);
    };
  }, [start]);

  // Back/forward. `popstate` fires AFTER the URL has moved, so `window.location`
  // here is the DESTINATION; the origin is whatever React last committed.
  // Passing the destination as the origin would make the completion check
  // compare a key against itself and leave the bar up for the full safety
  // timeout — measured, not theorised.
  useEffect(() => {
    function onPopState() {
      const destination = locationKey(window.location.pathname, window.location.search);
      // A history entry identical to where we are changes nothing.
      if (destination === committedKey.current) return;
      start(committedKey.current);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [start]);

  // Completion: React has committed a different location than the one we left.
  useEffect(() => {
    if (startedFrom.current !== null && isNavigationComplete(startedFrom.current, currentKey)) {
      stop();
    }
    // Must trail the check above — this is the "from" for the NEXT navigation.
    committedKey.current = currentKey;
    committedPath.current = pathname;
    committedSearch.current = searchParams.toString();
  }, [currentKey, pathname, searchParams, stop]);

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
