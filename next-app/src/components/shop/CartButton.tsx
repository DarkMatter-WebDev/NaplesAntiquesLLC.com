'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart, type CartItem } from '@/context/CartContext';

interface Props {
  item: CartItem;
  variant?: 'card' | 'detail';
  locale?: string;
}

export default function CartButton({ item, variant = 'card', locale = 'en' }: Props) {
  const { isIn, add, remove, openDrawer, notifyAdded } = useCart();
  const inCart = isIn(item.id);
  const isEs = locale === 'es';
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
        className={inCart ? 'outline-button flex items-center gap-2' : 'gold-button flex items-center gap-2'}
        style={inCart ? { borderColor: GOLD, color: GOLD } : undefined}
        aria-pressed={inCart}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px', lineHeight: 1 }}>
          {inCart ? 'remove_shopping_cart' : 'add_shopping_cart'}
        </span>
        {inCart
          ? (isEs ? 'En el carrito' : 'In Cart')
          : (isEs ? 'Agregar al carrito' : 'Add to Cart')}
      </button>
    );
  }

  // card variant — compact button in the actions row
  return (
    <div className="relative inline-flex">
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
        className="outline-button text-xs flex items-center gap-1"
        style={inCart ? { borderColor: GOLD, color: GOLD, background: `color-mix(in srgb, ${GOLD} 8%, transparent)` } : undefined}
        aria-pressed={inCart}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '13px', lineHeight: 1 }}>
          {inCart ? 'remove_shopping_cart' : 'add_shopping_cart'}
        </span>
        {inCart ? (isEs ? 'Quitar del carrito' : 'Remove from Cart') : (isEs ? 'Agregar al carrito' : 'Add to Cart')}
      </button>
    </div>
  );
}

const GOLD = '#735c00';
