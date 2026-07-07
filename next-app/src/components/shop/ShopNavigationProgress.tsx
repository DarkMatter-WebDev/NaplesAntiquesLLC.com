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
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useLinkStatus } from 'next/link';

interface ShopNavigationContextValue {
  isPending: boolean;
  push: (href: string, options?: { scroll?: boolean }) => void;
  reportLinkPending: (pending: boolean) => void;
}

const ShopNavigationContext = createContext<ShopNavigationContextValue | null>(null);

export function ShopNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isTransitionPending, startTransition] = useTransition();
  const [isLinkPending, setIsLinkPending] = useState(false);

  const push = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      startTransition(() => {
        router.push(href, options);
      });
    },
    [router, startTransition],
  );

  const reportLinkPending = useCallback((pending: boolean) => {
    setIsLinkPending(pending);
  }, []);

  const value: ShopNavigationContextValue = {
    isPending: isTransitionPending || isLinkPending,
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

const SPINNER_SHOW_DELAY_MS = 150;

// Debounced so an instant (prefetched) navigation never flashes a spinner —
// it only appears once a change has genuinely been loading for a moment, and
// disappears the instant the new content is ready.
export function ShopLoadingOverlay() {
  const { isPending } = useShopNavigation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isPending) return;
    const timer = setTimeout(() => setVisible(true), SPINNER_SHOW_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setVisible(false);
    };
  }, [isPending]);

  return (
    <div
      className={`shop-loading-overlay${visible ? ' is-visible' : ''}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <span className="shop-loading-spinner" aria-hidden="true" />
      <span className="shop-loading-overlay-sr-only">
        {visible ? 'Loading…' : ''}
      </span>
      <style>{`
        .shop-loading-overlay {
          position: absolute;
          inset: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(249, 249, 247, 0.55);
          opacity: 0;
          pointer-events: none;
          transition: opacity 120ms ease;
        }
        .shop-loading-overlay.is-visible {
          opacity: 1;
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
