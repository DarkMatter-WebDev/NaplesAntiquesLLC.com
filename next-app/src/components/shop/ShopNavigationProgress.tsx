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

// Show immediately so every filter, sort, view, and pagination click receives
// visible acknowledgement while its navigation is in flight.
export function ShopLoadingOverlay() {
  const { isPending } = useShopNavigation();

  return (
    <div
      className={`shop-loading-overlay${isPending ? ' is-visible' : ''}`}
      role="status"
      aria-live="polite"
      aria-hidden={!isPending}
    >
      <span className="shop-loading-spinner" aria-hidden="true" />
      <span className="shop-loading-overlay-sr-only">
        {isPending ? 'Loading...' : ''}
      </span>
      <style>{`
        .shop-loading-overlay {
          position: fixed;
          top: 50%;
          left: 50%;
          z-index: 70;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3.25rem;
          height: 3.25rem;
          border: 1px solid rgba(115, 92, 0, 0.18);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 38px rgba(42, 34, 12, 0.18);
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.92);
          transition: opacity 140ms ease, transform 140ms ease;
          pointer-events: none;
        }
        .shop-loading-overlay.is-visible {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
        .shop-loading-overlay-sr-only {
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
        .shop-loading-spinner {
          width: 2.1rem;
          height: 2.1rem;
          border-radius: 50%;
          border: 3px solid rgba(115, 92, 0, 0.16);
          border-top-color: #b5890c;
          animation: shop-loading-spin 0.65s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .shop-loading-overlay {
            transition: opacity 140ms ease;
          }
          .shop-loading-spinner {
            animation-duration: 1.6s;
          }
        }
        @keyframes shop-loading-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
