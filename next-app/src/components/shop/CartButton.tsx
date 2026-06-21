'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart, type CartItem } from '@/context/CartContext';
import { isProductPurchasable } from '@/types/product';

interface Props {
  item: CartItem;
  variant?: 'card' | 'detail' | 'icon';
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

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={!canPurchase && !inCart}
        aria-label={inCart ? (isEs ? 'Quitar del carrito' : 'Remove from cart') : (isEs ? 'Agregar al carrito' : 'Add to cart')}
        aria-pressed={inCart}
        className="shop-card-cart-icon-button flex items-center justify-center w-7 h-7 rounded-full transition-colors"
        style={{
          background: inCart ? 'linear-gradient(135deg, #d9ad2f, #b98c09)' : 'rgba(255, 252, 246, 0.92)',
          border: `1px solid ${inCart ? 'rgba(181, 137, 12, 0.5)' : 'rgba(115, 92, 0, 0.22)'}`,
          color: inCart ? '#fffdf7' : GOLD,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          opacity: !canPurchase && !inCart ? 0.5 : 1,
          cursor: canPurchase || inCart ? 'pointer' : 'not-allowed',
        }}
      >
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          data-cart-icon="true"
          style={{ fontSize: '13px', lineHeight: 1, fontVariationSettings: inCart ? "'FILL' 1" : "'FILL' 0" }}
        >
          shopping_bag
        </span>
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
        /* Compact card button — applied at all breakpoints */
        .shop-card-cart-button {
          min-height: 1.9rem;
          padding-block: 0.18rem;
          padding-inline: 0.38rem;
          font-size: 0.58rem;
          gap: 0.22rem;
          letter-spacing: 0.045em;
        }
        .shop-card-cart-button .material-symbols-outlined {
          font-size: 12px !important;
        }
        @media (max-width: 430px) {
          .shop-card-cart-button {
            min-height: 1.55rem;
            padding-block: 0.08rem;
            padding-inline: 0.28rem;
            font-size: 0.52rem;
            gap: 0.16rem;
          }
          .shop-card-cart-button .material-symbols-outlined {
            font-size: 10px !important;
          }
        }
        .shop-card-cart-label-full {
          display: none;
        }
        .shop-card-cart-label-compact {
          display: inline;
        }
      `}</style>
    </div>
  );
}

const GOLD = '#735c00';
