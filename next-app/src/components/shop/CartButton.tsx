'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart, type CartItem } from '@/context/CartContext';
import { isProductPurchasable } from '@/types/product';

interface Props {
  item: CartItem;
  variant?: 'card' | 'detail';
  locale?: string;
}

export default function CartButton({ item, variant = 'card', locale = 'en' }: Props) {
  const { isIn, add, remove, openDrawer, notifyAdded } = useCart();
  const inCart = isIn(item.id);
  const isEs = locale === 'es';
  const canPurchase = isProductPurchasable(item.status);
  const [showCardConfirmation, setShowCardConfirmation] = useState(false);
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
    };
  }, []);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canPurchase && !inCart) return;
    if (inCart) {
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
      setShowCardConfirmation(false);
      remove(item.id);
    } else {
      add(item);
      if (variant === 'card') {
        if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
        setShowCardConfirmation(true);
        confirmationTimer.current = setTimeout(() => setShowCardConfirmation(false), 1800);
      } else {
        notifyAdded(item.title);
        openDrawer();
      }
    }
  }

  if (variant === 'detail') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={!canPurchase && !inCart}
        className={inCart ? 'outline-button flex items-center gap-2' : 'gold-button detail-cart-button flex items-center gap-2'}
        style={inCart ? { borderColor: GOLD, color: GOLD } : !canPurchase ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
        aria-pressed={inCart}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px', lineHeight: 1 }}>
          {inCart ? 'remove_shopping_cart' : 'add_shopping_cart'}
        </span>
        {inCart
          ? (isEs ? 'En el carrito' : 'In Cart')
          : canPurchase ? (isEs ? 'Agregar al carrito' : 'Add to Cart') : (isEs ? 'No disponible' : 'Unavailable')}
      </button>
    );
  }

  // card variant — compact button in the actions row
  return (
    <div className="relative inline-flex w-full">
      {showCardConfirmation && (
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-8 whitespace-nowrap px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wide"
          style={{
            background: 'var(--color-surface-container-lowest)',
            border: `1px solid color-mix(in srgb, ${GOLD} 28%, transparent)`,
            color: GOLD,
            boxShadow: '0 6px 18px rgba(0,0,0,0.10)',
            fontFamily: 'var(--font-label)',
          }}
        >
          {isEs ? 'Agregado al carrito' : 'Added to cart'}
        </span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={!canPurchase && !inCart}
        className="outline-button shop-card-cart-button text-xs flex w-full min-h-9 items-center justify-center gap-1 whitespace-nowrap"
        style={inCart ? { borderColor: GOLD, color: GOLD, background: `color-mix(in srgb, ${GOLD} 8%, transparent)` } : !canPurchase ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
        aria-pressed={inCart}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '13px', lineHeight: 1 }}>
          {inCart ? 'remove_shopping_cart' : 'add_shopping_cart'}
        </span>
        <span className="shop-card-cart-label-full">
          {inCart ? (isEs ? 'Quitar del carrito' : 'Remove from Cart') : canPurchase ? (isEs ? 'Agregar al carrito' : 'Add to Cart') : (isEs ? 'No disponible' : 'Unavailable')}
        </span>
        <span className="shop-card-cart-label-compact" aria-hidden="true">
          {inCart ? (isEs ? 'Quitar' : 'Remove') : canPurchase ? (isEs ? 'Agregar' : 'Add') : (isEs ? 'No' : 'N/A')}
        </span>
      </button>
      <style>{`
        .shop-card-cart-button {
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
          padding-inline: 0.55rem;
          letter-spacing: 0.08em;
        }
        .shop-card-cart-label-compact {
          display: none;
        }
        @media (max-width: 480px) {
          .shop-card-cart-button {
            padding-inline: 0.38rem;
            font-size: 0.58rem;
            gap: 0.22rem;
            letter-spacing: 0.045em;
          }
          .shop-card-cart-button .material-symbols-outlined {
            font-size: 12px !important;
          }
        }
        @media (max-width: 480px) {
          .shop-card-cart-label-full {
            display: none;
          }
          .shop-card-cart-label-compact {
            display: inline;
          }
        }
      `}</style>
    </div>
  );
}

const GOLD = '#735c00';
