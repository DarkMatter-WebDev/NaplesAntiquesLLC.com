'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart, type CartItem } from '@/context/CartContext';
import { isProductPurchasable, productStatusLabel } from '@/types/product';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';
const FL_TAX = 0.07;

function parsePrice(label: string): number | null {
  const m = label.replace(/,/g, '').match(/\$([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CartDrawer({ locale }: { locale: string }) {
  const { items, remove, clear, drawerOpen, closeDrawer } = useCart();
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';

  function handleClose() {
    closeDrawer();
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    const x = e.clientX;
    const y = e.clientY;
    handleClose();
    setTimeout(() => {
      const el = document.elementFromPoint(x, y);
      if (!el || !(el instanceof HTMLElement)) return;
      const clickable = el.closest('a, button') as HTMLElement | null;
      if (clickable) clickable.click();
    }, 0);
  }

  return (
    <>
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-md flex-col shadow-2xl transition-transform duration-300"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,253,248,0.98) 100%)',
          borderLeft: `1px solid ${BORDER}`,
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
        role="dialog"
        aria-label={isEs ? 'Carrito' : 'Cart'}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between border-b px-5 py-5 flex-shrink-0" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={{
                width: '2.35rem',
                height: '2.35rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '999px',
                background: 'rgba(212, 175, 55, 0.12)',
                color: GOLD,
              }}
            >
              shopping_bag
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Mi Carrito' : 'My Cart'}
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {items.length > 0
                  ? `${items.length} ${isEs ? 'articulo(s)' : 'item(s)'}`
                  : (isEs ? 'Sin articulos' : 'No items yet')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[rgba(212,175,55,0.12)] hover:text-[#735c00]"
            style={{ color: 'var(--color-on-surface-variant)' }}
            aria-label="Close"
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <CartView items={items} isEs={isEs} prefix={prefix} onRemove={remove} onClear={clear} onClose={handleClose} />
        </div>
      </div>
    </>
  );
}

function CartView({
  items,
  isEs,
  prefix,
  onRemove,
  onClear,
  onClose,
}: {
  items: CartItem[];
  isEs: boolean;
  prefix: string;
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 text-center mt-16 px-6">
        <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-outline-variant)' }}>shopping_bag</span>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Tu carrito esta vacio.' : 'Your cart is empty.'}
        </p>
        <Link href={`${prefix}/shop`} onClick={onClose} className="outline-button text-xs mt-2">
          {isEs ? 'Ver tienda' : 'Browse Shop'}
        </Link>
      </div>
    );
  }

  const prices = items.map((i) => parsePrice(i.priceLabel));
  const knownPrices = prices.filter((p): p is number => p !== null);
  const hasUnknown = knownPrices.length < prices.length;
  const subtotal = knownPrices.reduce((a, b) => a + b, 0);
  const tax = subtotal * FL_TAX;
  const total = subtotal + tax;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {items.map((item) => (
          <CartItemRow key={item.id} item={item} isEs={isEs} prefix={prefix} onRemove={() => onRemove(item.id)} />
        ))}
      </div>

      <div className="mx-4 border px-4 py-3" style={{ borderColor: BORDER, background: 'rgba(255, 253, 248, 0.82)' }}>
        <div className="flex flex-col gap-1 text-xs" style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{subtotal > 0 ? fmt(subtotal) : '-'}{hasUnknown ? '*' : ''}</span>
          </div>
          <div className="flex justify-between">
            <span>{isEs ? 'Impuesto FL (7%)' : 'FL Sales Tax (7%)'}</span>
            <span>{subtotal > 0 ? fmt(tax) : '-'}</span>
          </div>
          <div
            className="flex justify-between pt-1 mt-1 font-bold text-sm"
            style={{ borderTop: `1px solid ${BORDER}`, color: 'var(--color-on-surface)' }}
          >
            <span>{isEs ? 'Total estimado' : 'Est. Total'}</span>
            <span style={{ color: GOLD }}>{subtotal > 0 ? fmt(total) : '-'}</span>
          </div>
          {hasUnknown && (
            <p className="text-[0.6rem] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              * {isEs ? 'Algunos articulos requieren confirmacion de precio.' : 'Some items require price confirmation.'}
            </p>
          )}
          <p className="text-[0.6rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs ? 'Los precios spot pueden variar. El impuesto es estimado.' : 'Spot prices may vary. Tax is an estimate.'}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-2 flex-shrink-0">
        <Link href={`${prefix}/checkout`} onClick={onClose} className="gold-button justify-center" style={{ width: '100%' }}>
          {isEs ? 'Proceder al pago' : 'Proceed to Checkout'}
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '17px', lineHeight: 1 }}>chevron_right</span>
        </Link>
        <button
          type="button"
          onClick={onClear}
          className="outline-button justify-center text-xs"
          style={{
            width: '100%',
            borderColor: 'rgba(186, 26, 26, 0.32)',
            color: 'var(--color-error)',
          }}
        >
          {isEs ? 'Vaciar carrito' : 'Clear Cart'}
        </button>
        <Link href={`${prefix}/shop`} onClick={onClose} className="outline-button justify-center text-xs" style={{ width: '100%' }}>
          {isEs ? 'Seguir comprando' : 'Continue Shopping'}
        </Link>
      </div>
    </div>
  );
}

function CartItemRow({ item, isEs, prefix, onRemove }: { item: CartItem; isEs: boolean; prefix: string; onRemove: () => void }) {
  const title = isEs && item.title_es ? item.title_es : item.title;
  const description = (isEs && item.description_es ? item.description_es : item.description) ?? item.public_notes ?? null;
  return (
    <div className="flex gap-3 items-start border p-3" style={{ borderColor: BORDER, background: 'rgba(255, 255, 255, 0.74)' }}>
      <Link href={`${prefix}/shop/${item.id}`} className="relative flex-shrink-0 w-20 h-20 overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
        {item.image
          ? <Image src={item.image} alt={title} fill sizes="80px" className="object-contain" unoptimized={item.image.startsWith('/assets/')} />
          : <div className="w-full h-full flex items-center justify-center text-xl opacity-30">Photo</div>}
      </Link>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Link href={`${prefix}/shop/${item.id}`} className="text-sm font-bold leading-snug hover:underline"
          style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
          {title}
        </Link>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {item.priceLabel}
        </p>
        {description && (
          <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            {description}
          </p>
        )}
        {!isProductPurchasable(item.status) && (
          <span className="text-[0.55rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-error)' }}>
            {isEs ? 'No disponible' : productStatusLabel(item.status)}
          </span>
        )}
      </div>
      <button type="button" onClick={onRemove} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[rgba(186,26,26,0.08)] hover:text-[color:var(--color-error)]"
        style={{ color: 'var(--color-on-surface-variant)' }} aria-label={isEs ? 'Eliminar' : 'Remove'}>
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '18px' }}>close</span>
      </button>
    </div>
  );
}
