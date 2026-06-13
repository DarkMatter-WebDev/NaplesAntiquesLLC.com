import Image from 'next/image';
import Link from 'next/link';
import type { Product, SpotData } from '@/types/product';
import { getDisplayPrice, getPriceContext } from '@/lib/pricing';
import WishlistButton from '@/components/shop/WishlistButton';
import type { WishlistItem } from '@/context/WishlistContext';
import CartButton from '@/components/shop/CartButton';
import type { CartItem } from '@/context/CartContext';

interface Props {
  product: Product;
  spotData: SpotData | null;
  locale: string;
}

export default function ProductCard({ product, spotData, locale }: Props) {
  const isEs = locale === 'es';
  const title = isEs && product.title_es ? product.title_es : product.title;
  const price = getDisplayPrice(product, spotData);
  const priceCtx = getPriceContext(product, spotData, locale);
  const thumb = product.images?.[0];
  const href = locale === 'es' ? `/es/shop/${product.id}` : `/shop/${product.id}`;
  const isSold = product.status === 'Sold';

  const cartItem: CartItem = {
    id: product.id,
    title: product.title,
    title_es: product.title_es,
    image: thumb ?? null,
    status: product.status,
    priceLabel: price,
  };

  const wishlistItem: WishlistItem = {
    id: product.id,
    title: product.title,
    title_es: product.title_es,
    image: thumb ?? null,
    status: product.status,
    price_mode: product.price_mode,
    purity: product.purity,
    weight_grams: product.weight_grams,
    pricing_multiplier: product.pricing_multiplier,
    manual_price_label: product.manual_price_label,
  };

  return (
    <article className="group relative flex flex-col bg-[color:var(--color-surface-container-lowest)] border border-[color:var(--color-outline-variant)] overflow-hidden">

      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-[color:var(--color-surface-container)]">
        {isSold && (
          <div
            className="absolute top-3 left-3 z-10 text-[0.6rem] font-bold tracking-widest uppercase px-2 py-0.5"
            style={{ background: 'var(--color-on-surface)', color: 'var(--color-surface)' }}
          >
            {isEs ? 'Vendido' : 'Sold'}
          </div>
        )}
        {!isSold && (
          <div
            className="absolute top-3 left-3 z-10 text-[0.6rem] font-bold tracking-widest uppercase px-2 py-0.5"
            style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
          >
            {isEs ? 'Disponible' : 'Available'}
          </div>
        )}
        {/* Wishlist button — top-right of image */}
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton item={wishlistItem} variant="icon" locale={locale} />
        </div>

        {thumb ? (
          <Link href={href}>
            <Image
              src={thumb}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
              // Local assets in the static folder aren't in remotePatterns; unoptimized for those
              unoptimized={thumb.startsWith('/assets/')}
            />
          </Link>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">📷</div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <span
          className="text-[0.62rem] font-bold uppercase tracking-[0.28em]"
          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
        >
          {isEs ? (product.category === 'Gold' ? 'Oro' : 'Plata') : product.category}
        </span>

        <Link href={href} className="group/title">
          <h3
            className="font-bold text-lg leading-snug mt-1 group-hover/title:underline underline-offset-2"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            {title}
          </h3>
        </Link>

        <p
          className="text-xs font-bold uppercase tracking-widest mt-auto pt-2"
          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
        >
          {price}
        </p>
        <p
          className="text-[0.52rem] leading-tight opacity-75"
          style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
        >
          {priceCtx}
        </p>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          <CartButton item={cartItem} variant="card" locale={locale} />
          <Link
            href={`${locale === 'es' ? '/es' : ''}/contact`}
            className="outline-button text-xs"
          >
            {isEs ? 'Consultar' : 'Inquire'}
          </Link>
        </div>
      </div>
    </article>
  );
}
