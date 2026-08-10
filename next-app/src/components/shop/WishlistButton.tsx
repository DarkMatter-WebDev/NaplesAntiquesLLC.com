'use client';

import { useWishlist, type WishlistItem } from '@/context/WishlistContext';
import { AppIcon } from '@/components/AppIcon';

interface Props {
  item: WishlistItem;
  /** 'icon' = heart only (product cards); 'button' = labelled button (detail page) */
  variant?: 'icon' | 'button';
  locale?: string;
}

export default function WishlistButton({ item, variant = 'icon', locale = 'en' }: Props) {
  const { isIn, toggle } = useWishlist();
  const saved = isIn(item.id);
  const isEs = locale === 'es';

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle(item);
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="outline-button flex items-center gap-2"
        style={saved ? { borderColor: '#735c00', color: '#735c00', background: 'color-mix(in srgb, #735c00 8%, transparent)' } : undefined}
        aria-pressed={saved}
        aria-label={saved ? (isEs ? 'Guardado' : 'Saved') : (isEs ? 'Guardar' : 'Save')}
      >
        <AppIcon name="favorite"
          fill={saved ? 'currentColor' : 'none'}
          style={{
            fontSize: '16px',
            lineHeight: 1,
          }}
         />
        {saved ? (isEs ? 'Guardado' : 'Saved') : (isEs ? 'Guardar' : 'Save')}
      </button>
    );
  }

  // icon variant — used on product cards
  return (
    <button
      type="button"
      onClick={handleClick}
      className="shop-card-wishlist-button flex items-center justify-center w-7 h-7 rounded-full transition-colors"
      style={{
        background: 'rgba(249,249,247,0.9)',
        color: saved ? '#735c00' : '#5e5e5d',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
      }}
      aria-pressed={saved}
      aria-label={saved ? (isEs ? 'Quitar de guardados' : 'Remove from saved') : (isEs ? 'Guardar' : 'Save')}
    >
      <AppIcon name="favorite"
        fill={saved ? 'currentColor' : 'none'}
        data-wishlist-icon="true"
        style={{
          fontSize: '15px',
          lineHeight: 1,
        }}
       />
    </button>
  );
}
