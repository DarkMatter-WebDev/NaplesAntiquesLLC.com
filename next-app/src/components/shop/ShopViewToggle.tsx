'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useShopNavigation } from '@/components/shop/ShopNavigationProgress';

interface Props {
  locale: string;
  currentView: 'gallery' | 'list';
}

export default function ShopViewToggle({ locale, currentView }: Props) {
  const { getSearchParams, push } = useShopNavigation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEs = locale === 'es';

  function setView(value: 'gallery' | 'list') {
    if (value === currentView) return;
    const params = getSearchParams(searchParams.toString());
    if (value === 'list') {
      params.set('view', 'list');
    } else {
      params.delete('view');
    }
    const qs = params.toString();
    push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="shop-view-toggle" role="group" aria-label={isEs ? 'Vista' : 'View'}>
      <button
        type="button"
        onClick={() => setView('gallery')}
        disabled={currentView === 'gallery'}
        data-active={currentView === 'gallery' || undefined}
        aria-pressed={currentView === 'gallery'}
        aria-label={isEs ? 'Vista de galería' : 'Gallery view'}
        title={isEs ? 'Vista de galería' : 'Gallery view'}
      >
        <span className="material-symbols-outlined" aria-hidden="true">grid_view</span>
      </button>
      <button
        type="button"
        onClick={() => setView('list')}
        disabled={currentView === 'list'}
        data-active={currentView === 'list' || undefined}
        aria-pressed={currentView === 'list'}
        aria-label={isEs ? 'Vista de lista' : 'List view'}
        title={isEs ? 'Vista de lista' : 'List view'}
      >
        <span className="material-symbols-outlined" aria-hidden="true">view_list</span>
      </button>
      <style>{`
        .shop-view-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          padding: 0.18rem;
          border: 1px solid rgba(115, 92, 0, 0.18);
          border-radius: 7px;
          background: #ffffff;
          box-shadow: 0 8px 18px rgba(42, 34, 12, 0.05);
        }
        .shop-view-toggle button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.9rem;
          height: 1.9rem;
          border: 0;
          border-radius: 5px;
          background: transparent;
          color: var(--color-on-surface-variant);
          cursor: pointer;
          transition: background-color 160ms ease, color 160ms ease, transform 100ms ease;
        }
        .shop-view-toggle button:hover {
          color: var(--color-primary);
          background: rgba(212, 175, 55, 0.12);
        }
        .shop-view-toggle button:disabled {
          cursor: default;
        }
        .shop-view-toggle button:active {
          transform: scale(0.86);
          transition-duration: 0.05s;
        }
        @media (prefers-reduced-motion: reduce) {
          .shop-view-toggle button {
            transition: background-color 160ms ease, color 160ms ease;
          }
          .shop-view-toggle button:active {
            transform: none;
          }
        }
        .shop-view-toggle button[data-active] {
          background: linear-gradient(135deg, #dcb336, #b5890c);
          color: #fffdf7;
          box-shadow: 0 6px 16px rgba(181, 137, 12, 0.18);
        }
        .shop-view-toggle button .material-symbols-outlined {
          font-size: 18px;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}
