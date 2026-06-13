'use client';

import { useCart, type CartItem } from '@/context/CartContext';

interface Props {
  item: CartItem;
  variant?: 'card' | 'detail';
  locale?: string;
}

export default function CartButton({ item, variant = 'card', locale = 'en' }: Props) {
  const { isIn, add, remove, openDrawer } = useCart();
  const inCart = isIn(item.id);
  const isEs = locale === 'es';

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (inCart) {
      remove(item.id);
    } else {
      add(item);
      openDrawer();
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
    <button
      type="button"
      onClick={handleClick}
      className="outline-button text-xs flex items-center gap-1"
      style={inCart ? { borderColor: GOLD, color: GOLD, background: `color-mix(in srgb, ${GOLD} 8%, transparent)` } : undefined}
      aria-pressed={inCart}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '13px', lineHeight: 1 }}>
        {inCart ? 'check' : 'add_shopping_cart'}
      </span>
      {inCart ? (isEs ? 'Agregado' : 'Added') : (isEs ? 'Carrito' : 'Cart')}
    </button>
  );
}

const GOLD = '#735c00';
