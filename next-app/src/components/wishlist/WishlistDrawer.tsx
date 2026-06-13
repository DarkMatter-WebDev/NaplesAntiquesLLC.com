'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useWishlist, type WishlistItem } from '@/context/WishlistContext';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';

export default function WishlistDrawer({ locale }: { locale: string }) {
  const { items, drawerOpen, closeDrawer } = useWishlist();
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';

  return (
    <>
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* Panel — always mounted, slides in/out via transform */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col shadow-2xl transition-transform duration-300"
        style={{
          background: 'var(--color-background)',
          borderLeft: `1px solid ${BORDER}`,
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
        role="dialog"
        aria-label={isEs ? 'Lista de deseos' : 'Saved items'}
        aria-hidden={!drawerOpen}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: BORDER }}
        >
          <h2
            className="text-sm font-bold uppercase tracking-widest"
            style={{ color: GOLD, fontFamily: 'var(--font-label)' }}
          >
            {isEs ? 'Lista de deseos' : 'Saved Items'}
            {items.length > 0 && (
              <span className="ml-2 font-normal normal-case tracking-normal text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                ({items.length})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            className="p-1 text-sm font-bold transition-colors hover:text-[#735c00]"
            style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="mt-12 flex flex-col items-center gap-3 text-center">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '40px', color: 'var(--color-outline-variant)' }}
              >
                favorite
              </span>
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs ? 'No hay artículos guardados.' : 'No saved items yet.'}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs
                  ? 'Toca el ♡ en cualquier pieza para guardarla aquí.'
                  : 'Tap ♡ on any piece to save it here.'}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <DrawerItem key={item.id} item={item} isEs={isEs} prefix={prefix} />
            ))
          )}
        </div>

        {/* Footer CTAs */}
        {items.length > 0 && (
          <div
            className="flex flex-col gap-2 px-4 py-4 border-t flex-shrink-0"
            style={{ borderColor: BORDER }}
          >
            <Link
              href={`${prefix}/contact`}
              onClick={closeDrawer}
              className="gold-button justify-center"
              style={{ width: '100%' }}
            >
              {isEs ? 'Consultar sobre estas piezas' : 'Inquire About These Pieces'}
            </Link>
            <a
              href="tel:2394048505"
              className="outline-button justify-center"
              style={{ width: '100%' }}
            >
              {isEs ? 'Llamar: (239) 404-8505' : 'Call: (239) 404-8505'}
            </a>
          </div>
        )}
      </div>
    </>
  );
}

function DrawerItem({
  item,
  isEs,
  prefix,
}: {
  item: WishlistItem;
  isEs: boolean;
  prefix: string;
}) {
  const { remove } = useWishlist();
  const title = isEs && item.title_es ? item.title_es : item.title;
  const isSold = item.status === 'Sold';

  const priceLabel =
    item.price_mode === 'manual'
      ? (item.manual_price_label ?? (isEs ? 'Consultar precio' : 'Ask for price'))
      : isEs
        ? 'Precio según oro en vivo'
        : 'Live gold price';

  return (
    <div className="flex gap-3 items-start pb-3 border-b" style={{ borderColor: BORDER }}>
      {/* Thumbnail */}
      <Link
        href={`${prefix}/shop/${item.id}`}
        className="relative flex-shrink-0 w-14 h-14 overflow-hidden"
        style={{ background: 'var(--color-surface-container)' }}
      >
        {item.image ? (
          <Image
            src={item.image}
            alt={title}
            fill
            sizes="56px"
            className="object-cover"
            unoptimized={item.image.startsWith('/assets/')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl opacity-30">📷</div>
        )}
        {isSold && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <span className="text-[0.45rem] font-bold text-white uppercase tracking-widest">
              {isEs ? 'Vendido' : 'Sold'}
            </span>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Link
          href={`${prefix}/shop/${item.id}`}
          className="text-xs font-bold leading-snug hover:underline underline-offset-2 line-clamp-2"
          style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}
        >
          {title}
        </Link>
        <p
          className="text-[0.6rem] font-bold uppercase tracking-wide"
          style={{ color: GOLD, fontFamily: 'var(--font-label)' }}
        >
          {priceLabel}
        </p>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => remove(item.id)}
        className="flex-shrink-0 p-1 text-xs transition-colors hover:text-[color:var(--color-error)]"
        style={{ color: 'var(--color-on-surface-variant)' }}
        aria-label={isEs ? 'Eliminar' : 'Remove'}
      >
        ✕
      </button>
    </div>
  );
}
