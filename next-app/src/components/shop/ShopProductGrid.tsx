'use client';

import { useEffect, useState } from 'react';
import ProductCard from '@/components/shop/ProductCard';
import ProductListRow from '@/components/shop/ProductListRow';
import type { Product, SpotData } from '@/types/product';
import { onLayoutAffectingResize } from '@/lib/viewport-resize';

interface Props {
  products: Product[];
  spotData: SpotData | null;
  locale: string;
  hideSoldItemPrices?: boolean;
  variant?: 'classic' | 'modern';
  view?: 'gallery' | 'list';
}

function getShopGridColumnCount() {
  if (typeof window === 'undefined') return 3;

  const width = window.innerWidth;
  if (width >= 2320) return 7;
  if (width >= 1960) return 6;
  if (width >= 1720) return 5;
  if (width >= 1280) return 4;
  if (width >= 768) return 3;
  if (width >= 360) return 2;
  return 1;
}

export default function ShopProductGrid({ products, spotData, locale, hideSoldItemPrices = false, variant = 'classic', view = 'gallery' }: Props) {
  const [columnCount, setColumnCount] = useState(3);

  useEffect(() => {
    const updateColumnCount = () => {
      setColumnCount(getShopGridColumnCount());
    };

    updateColumnCount();
    // Column count is a pure function of innerWidth, so the in-app-browser
    // toolbar sliding in and out (height-only, fires resize constantly while
    // scrolling) can never change it. Guarding keeps this handler off the
    // scroll path entirely instead of re-running it every frame.
    return onLayoutAffectingResize(updateColumnCount);
  }, []);

  if (view === 'list') {
    return (
      <div className="shop-product-list">
        {products.map((product, index) => (
          <ProductListRow
            key={product.id}
            product={product}
            spotData={spotData}
            locale={locale}
            hideSoldItemPrices={hideSoldItemPrices}
            prioritizeImage={index < 4}
          />
        ))}
        <style>{`
          .shop-product-list {
            display: flex;
            flex-direction: column;
            gap: 0.7rem;
          }
          .shop-list-row {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            gap: 1rem;
            align-items: center;
            padding: 0.7rem;
            background: #ffffff;
            border: 1px solid rgba(115, 92, 0, 0.12);
            border-radius: 10px;
            box-shadow: 0 8px 22px rgba(42, 34, 12, 0.07);
            transition: box-shadow 180ms ease, border-color 180ms ease, transform 180ms ease;
          }
          @media (hover: hover) {
            .shop-list-row:hover {
              border-color: rgba(181, 137, 12, 0.26);
              box-shadow: 0 14px 32px rgba(42, 34, 12, 0.12);
              transform: translateY(-1px);
            }
          }
          .shop-list-thumb {
            position: relative;
            display: block;
            width: 92px;
            height: 92px;
            border-radius: 8px;
            overflow: hidden;
            flex-shrink: 0;
          }
          .shop-list-thumb-placeholder {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(115, 92, 0, 0.35);
            font-size: 1.6rem;
          }
          .shop-list-metal-row {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            min-width: 0;
          }
          .shop-list-status {
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            padding: 0.12rem 0.4rem;
            border-radius: 3px;
            font-family: var(--font-label);
            font-size: 0.52rem;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #fffdf7;
            background: linear-gradient(135deg, #d5a820, #ad8507);
            box-shadow: 0 2px 6px rgba(115, 92, 0, 0.14);
          }
          .shop-list-status[data-sold] {
            background: #1f2321;
          }
          .shop-list-status[data-pending] {
            background: #8a5a00;
          }
          .shop-list-main {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 0.28rem;
          }
          .shop-list-metal {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: var(--font-label);
            font-size: 0.6rem;
            font-weight: 800;
            letter-spacing: 0.24em;
            text-transform: uppercase;
            color: var(--color-primary);
          }
          .shop-list-title-link {
            text-decoration: none;
          }
          .shop-list-title {
            font-family: var(--font-headline);
            font-size: 1rem;
            font-weight: 700;
            line-height: 1.3;
            color: var(--color-on-surface);
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .shop-list-meta {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.4rem;
          }
          .shop-list-flag {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            padding: 0.12rem 0.42rem;
            border-radius: 5px;
            font-family: var(--font-label);
            font-size: 0.56rem;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--color-primary);
          }
          .shop-list-flag.is-brand {
            background: linear-gradient(135deg, rgba(255, 253, 246, 0.96), rgba(246, 232, 184, 0.94));
            border: 1px solid rgba(181, 137, 12, 0.42);
          }
          .shop-list-flag.is-link {
            background: rgba(255, 252, 246, 0.92);
            border: 1px solid rgba(115, 92, 0, 0.22);
          }
          .shop-list-circa {
            font-family: var(--font-label);
            font-size: 0.62rem;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--color-on-surface-variant);
          }
          .shop-list-circa-prefix {
            text-transform: none;
          }
          .shop-list-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.32rem;
            font-family: var(--font-label);
          }
          .shop-list-chip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.2rem 0.55rem;
            border: 1px solid transparent;
            border-radius: 999px;
            font-size: 0.66rem;
            font-weight: 700;
            line-height: 1;
            white-space: nowrap;
          }
          .shop-list-aside {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 0.55rem;
            flex-shrink: 0;
          }
          .shop-list-price {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            line-height: 1.1;
          }
          .shop-list-price-label {
            font-family: var(--font-label);
            font-size: 0.54rem;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--color-on-surface-variant);
          }
          .shop-list-price-value {
            font-size: 1.12rem;
            font-weight: 800;
            font-variant-numeric: tabular-nums;
            color: var(--color-primary);
          }
          .shop-list-actions {
            display: flex;
            align-items: center;
            gap: 0.4rem;
          }
          @media (max-width: 640px) {
            .shop-list-row {
              grid-template-columns: auto minmax(0, 1fr);
              gap: 0.65rem;
              padding: 0.55rem;
            }
            .shop-list-thumb {
              width: 92px;
              height: 92px;
            }
            .shop-list-title {
              font-size: 0.86rem;
            }
            .shop-list-metal {
              font-size: 0.54rem;
              letter-spacing: 0.18em;
            }
            /* Price + actions span the full width below the image and details. */
            .shop-list-aside {
              grid-column: 1 / -1;
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              gap: 0.5rem;
              padding-top: 0.45rem;
              margin-top: 0.1rem;
              border-top: 1px solid rgba(115, 92, 0, 0.1);
            }
            .shop-list-price {
              flex-direction: row;
              align-items: baseline;
              gap: 0.4rem;
            }
            .shop-list-price-value {
              font-size: 1rem;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="shop-product-grid grid gap-2 sm:gap-5">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          spotData={spotData}
          locale={locale}
          hideSoldItemPrices={hideSoldItemPrices}
          variant={variant}
          prioritizeImage={index < columnCount}
          includeModernStyles={index === 0}
        />
      ))}
      <style>{`
        .shop-product-grid > article {
          content-visibility: auto;
          contain-intrinsic-size: auto 19rem;
        }
        @media (min-width: 768px) {
          .shop-product-grid > article {
            contain-intrinsic-size: auto 20rem;
          }
        }
        @media (min-width: 1536px) {
          .shop-product-grid > article {
            contain-intrinsic-size: auto 24rem;
          }
        }
      `}</style>
    </div>
  );
}
