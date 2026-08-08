'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useWishlist, type WishlistItem } from '@/context/WishlistContext';
import type { CartItem } from '@/context/CartContext';
import CartButton from '@/components/shop/CartButton';
import { getProductSoldPriceLock, isProductSold, productImagePaddingBackground, type Product, type SpotData } from '@/types/product';
import { calcSpotPriceValue, formatUsdPrice } from '@/lib/pricing';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import { useHideSoldItemPrices } from '@/hooks/useHideSoldItemPrices';
import { AppIcon } from '@/components/AppIcon';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';

export default function WishlistDrawer({ locale }: { locale: string }) {
  const { items, drawerOpen, closeDrawer } = useWishlist();
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';
  const hideSoldItemPrices = useHideSoldItemPrices(drawerOpen);

  // Live spot data for computing saved-item prices. Fetched lazily the first time
  // the drawer opens with at least one spot-linked item, so the saved list shows
  // a real price instead of just a "Live gold price" label.
  const [spot, setSpot] = useState<SpotData | null>(null);
  useEffect(() => {
    if (!drawerOpen || spot) return;
    if (!items.some((item) => item.price_mode === 'spot-multiplier')) return;
    let cancelled = false;
    fetch('/api/metal-prices')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setSpot(data as SpotData); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [drawerOpen, spot, items]);

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

      {/* Panel — always mounted, slides in/out via transform.
          The width MUST stay capped at the viewport (this is `max-w-sm` plus a
          100vw clamp, matching CartDrawer's `min(28rem,100vw)`). Because the
          panel is always in the DOM and parked at translateX(100%), a panel
          wider than the screen sits that much past the right edge and drags the
          document into horizontal scroll — and since it is also `w-full`, it
          then measures against the document it just widened, so the overflow
          feeds itself. Plain `max-w-sm` did exactly that below ~384px. */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[min(24rem,100vw)] flex flex-col shadow-2xl transition-transform duration-300"
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
              <AppIcon name="favorite"
                
                style={{ fontSize: '40px', color: 'var(--color-outline-variant)' }}
               />
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
              <DrawerItem key={item.id} item={item} isEs={isEs} prefix={prefix} spot={spot} hideSoldItemPrices={hideSoldItemPrices} />
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
  spot,
  hideSoldItemPrices,
}: {
  item: WishlistItem;
  isEs: boolean;
  prefix: string;
  spot: SpotData | null;
  hideSoldItemPrices: boolean;
}) {
  const { remove } = useWishlist();
  const title = isEs && item.title_es ? item.title_es : item.title;
  const isSold = isProductSold(item.status);
  const lockedPrice = getProductSoldPriceLock(item);
  const imageFrameBackground = productImagePaddingBackground(item.image_padding);
  const image = normalizeLegacyLocalImageUrl(item.image);

  // Compute the live spot-linked price from the fields saved with the item. Gold
  // purity is stored as karat (<=24); silver as fineness (>24), matching the rest
  // of the app. Falls back to the "live price" label until spot loads or if the
  // item is missing weight/purity.
  const spotPrice = item.price_mode === 'spot-multiplier'
    ? calcSpotPriceValue(
        {
          price_mode: item.price_mode,
          pricing_multiplier: item.pricing_multiplier,
          weight_grams: item.weight_grams,
          gram_weight: item.weight_grams,
          purity: item.purity,
          category: item.purity != null && item.purity > 24 ? 'Silver' : 'Gold',
        } as unknown as Product,
        spot,
      )
    : null;

  const priceLabel =
    hideSoldItemPrices && isSold
      ? (isEs ? 'Vendido' : 'Sold')
      : lockedPrice != null
      ? formatUsdPrice(lockedPrice)
      : item.price_mode === 'manual'
      ? (item.manual_price_label ?? (isEs ? 'Consultar precio' : 'Ask for price'))
      : spotPrice != null
        ? formatUsdPrice(spotPrice)
        : isEs
          ? 'Precio según oro en vivo'
          : 'Live gold price';

  // Minimal CartItem from what the wishlist stores. CheckoutClient backfills the
  // richer product fields (description, metal, length, etc.) it's missing before
  // rendering the order summary — same as any other partially-populated cart item.
  const cartItem: CartItem = {
    id: item.id,
    title: item.title,
    title_es: item.title_es,
    image: item.image,
    image_padding: item.image_padding,
    status: item.status,
    priceLabel,
    purity: item.purity,
    weight_grams: item.weight_grams,
  };

  return (
    <div className="flex gap-3 items-start pb-3 border-b" style={{ borderColor: BORDER }}>
      {/* Thumbnail */}
      <Link
        href={`${prefix}/shop/${item.id}`}
        className="relative flex-shrink-0 w-14 h-14 overflow-hidden"
        style={{ background: imageFrameBackground }}
      >
        {image ? (
          <Image
            src={image}
            alt={title}
            fill
            sizes="56px"
            className="object-contain"
            unoptimized={image.startsWith('/assets/')}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#735c00]/35">
            <AppIcon name="image"  style={{ fontSize: '1.4rem' }} aria-hidden="true" />
          </div>
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
          className="hover-underline-grow text-xs font-bold leading-snug line-clamp-2"
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

      {/* Actions: add to cart + remove */}
      <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
        <CartButton item={cartItem} variant="icon" locale={isEs ? 'es' : 'en'} />
        <button
          type="button"
          onClick={() => remove(item.id)}
          className="p-1 text-xs transition-colors hover:text-[color:var(--color-error)]"
          style={{ color: 'var(--color-on-surface-variant)' }}
          aria-label={isEs ? 'Eliminar' : 'Remove'}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
