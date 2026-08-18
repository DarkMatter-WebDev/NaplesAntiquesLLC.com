'use client';

// Shared "is a filter/sort/pagination navigation in flight" state for the shop
// list page. Every control that changes the URL (filters, sort, view toggle,
// year slider, per-page select) routes its router.push() through push() below
// instead of calling useRouter() directly, so one lightweight spinner
// (ShopLoadingOverlay) can reflect all of them without each control needing
// its own loading UI.
//
// Why useTransition: router.push() started inside startTransition keeps
// isPending true until the new RSC payload for the changed segment has
// resolved and committed — exactly the window where the page would otherwise
// look frozen. Plain <Link> pagination isn't visible to this useTransition
// (Next.js starts its own internal transition for <Link>), so it's covered
// separately via LinkPendingBridge + useLinkStatus.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useLinkStatus } from 'next/link';
import { startRouteProgress } from '@/components/layout/RouteProgressBar';
import { clearRequestedShopReturn, readRequestedShopReturn } from '@/lib/shop-return';

interface ShopNavigationContextValue {
  isPending: boolean;
  getSearchParams: (fallback: string) => URLSearchParams;
  push: (href: string, options?: { scroll?: boolean }) => void;
  reportLinkPending: (pending: boolean) => void;
}

const ShopNavigationContext = createContext<ShopNavigationContextValue | null>(null);

export function ShopNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isTransitionPending, startTransition] = useTransition();
  const [isLinkPending, setIsLinkPending] = useState(false);
  const pendingHrefRef = useRef<string | null>(null);

  const getSearchParams = useCallback((fallback: string) => {
    const source = pendingHrefRef.current;
    if (source != null) {
      const query = source.includes('?') ? source.split('?')[1].split('#')[0] : '';
      return new URLSearchParams(query);
    }
    return new URLSearchParams(fallback);
  }, []);

  const push = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      const currentHref = typeof window === 'undefined'
        ? null
        : `${window.location.pathname}${window.location.search}`;
      pendingHrefRef.current = href === currentHref ? null : href;
      // Every shop control reaches the router through here, and none of them is
      // an anchor the global click listener could see — so this is the one place
      // the top progress bar can learn that a filter/sort/view/pagination
      // navigation just started. It no-ops when href is where we already are.
      startRouteProgress(href);
      startTransition(() => {
        router.push(href, options);
      });
    },
    [router, startTransition],
  );

  const reportLinkPending = useCallback((pending: boolean) => {
    setIsLinkPending(pending);
  }, []);

  useEffect(() => {
    if (!isTransitionPending) pendingHrefRef.current = null;
  }, [isTransitionPending]);

  const value: ShopNavigationContextValue = {
    isPending: isTransitionPending || isLinkPending,
    getSearchParams,
    push,
    reportLinkPending,
  };

  return (
    <ShopNavigationContext.Provider value={value}>
      {children}
    </ShopNavigationContext.Provider>
  );
}

export function useShopNavigation(): ShopNavigationContextValue {
  const ctx = useContext(ShopNavigationContext);
  if (!ctx) {
    throw new Error('useShopNavigation must be used within a ShopNavigationProvider');
  }
  return ctx;
}

// Render as a child of a <Link> to mirror that link's pending state into the
// shared context. Renders nothing.
export function LinkPendingBridge() {
  const { reportLinkPending } = useShopNavigation();
  const { pending } = useLinkStatus();

  useEffect(() => {
    reportLinkPending(pending);
    return () => reportLinkPending(false);
  }, [pending, reportLinkPending]);

  return null;
}

// Product-detail navigation records the exact shop URL and scroll offset before
// leaving the catalog. Restore it only after an explicit Back to Shop action.
export function ShopScrollRestoration() {
  useEffect(() => {
    const scrollY = readRequestedShopReturn();
    if (scrollY == null) return;

    let secondFrame: number | undefined;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
        clearRequestedShopReturn();
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  return null;
}

// Announce filter/sort/view/pagination waits to assistive technology.
//
// ⚠️ This used to ALSO paint a centred spinner overlay. It was removed on
// 2026-08-17, when the global route progress bar started arming on query-only
// navigations (owner: one consistent top loader everywhere). Both fired for a
// single filter click — measured, both true in the same mutation batch — and two
// indicators for one action is worse than either alone. The top bar sits at the
// base of the FIXED header, so it is on screen however far the visitor has
// scrolled down the catalog; that is what made the centred spinner redundant
// rather than merely duplicated.
//
// What stays is the part the bar cannot do: the bar is deliberately
// `aria-hidden` (Next's route announcer covers path changes), and a query-only
// change is not a route change it announces — so without this live region a
// screen-reader user would get no word of the wait at all.
//
// To bring the spinner back, restore the visual markup here; the pending state
// it needs is unchanged.
export function ShopLoadingOverlay() {
  const { isPending } = useShopNavigation();

  return (
    <div className="shop-loading-status" role="status" aria-live="polite">
      {isPending ? 'Loading...' : ''}
      <style>{`
        .shop-loading-status {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </div>
  );
}
