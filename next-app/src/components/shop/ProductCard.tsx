import Image from 'next/image';
import Link from 'next/link';
import { inferProductJewelryType, isProductPurchasable, isProductSold, productMetalVariantLabel, productStatusLabel, type Product, type SpotData } from '@/types/product';
import { getDisplayPrice } from '@/lib/pricing';
import WishlistButton from '@/components/shop/WishlistButton';
import type { WishlistItem } from '@/context/WishlistContext';
import CartButton from '@/components/shop/CartButton';
import type { CartItem } from '@/context/CartContext';

interface Props {
  product: Product;
  spotData: SpotData | null;
  locale: string;
}

function formatLengthSize(product: Product, isEs: boolean): string | null {
  const value = product.length?.trim();
  if (!value) return null;
  const isRing = inferProductJewelryType(product) === 'Ring';
  const label = isRing ? (isEs ? 'Talla' : 'Size') : (isEs ? 'Largo' : 'Length');
  return `${label}: ${value}`;
}

export default function ProductCard({ product, spotData, locale }: Props) {
  const isEs = locale === 'es';
  const title = isEs && product.title_es ? product.title_es : product.title;
  const price = getDisplayPrice(product, spotData);
  const metalLabel = productMetalVariantLabel(product.metal_variant, product.category, locale);
  const purityLabel = formatPurity(product, isEs);
  const weightLabel = formatWeight(product.gram_weight ?? product.weight_grams);
  const lengthLabel = formatLengthSize(product, isEs);
  const images = product.image_urls?.length ? product.image_urls : product.images;
  const thumb = images?.[0];
  const href = locale === 'es' ? `/es/shop/${product.id}` : `/shop/${product.id}`;
  const isSold = isProductSold(product.status);
  const isPurchasable = isProductPurchasable(product.status);

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
            style={{ background: isPurchasable ? 'var(--color-primary)' : '#8a5a00', color: 'var(--color-on-primary)' }}
          >
            {isPurchasable ? (isEs ? 'Disponible' : 'Available') : productStatusLabel(product.status)}
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
              className="object-contain object-center"
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
      <div className="flex flex-col flex-1 p-4 gap-1.5">
        <span
          className="text-[0.62rem] font-bold uppercase tracking-[0.28em]"
          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
        >
          {metalLabel}
        </span>

        <Link href={href} className="group/title">
          <h3
            className="font-bold text-[0.98rem] leading-snug mt-0.5 line-clamp-3 group-hover/title:underline underline-offset-2"
            style={{
              fontFamily: 'var(--font-headline)',
              color: 'var(--color-on-surface)',
              minHeight: 'calc(1.375em * 3)',
            }}
          >
            {title}
          </h3>
        </Link>

        <p
          className="pt-0.5 flex items-baseline gap-1.5 flex-wrap"
          style={{ fontFamily: 'var(--font-label)' }}
        >
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            {isEs ? 'Tu precio' : 'Your price'}
          </span>
          <span
            className="text-xs font-extrabold uppercase tracking-widest"
            style={{ color: 'var(--color-primary)' }}
          >
            {price}
          </span>
        </p>
        <div
          className="text-[0.76rem] leading-snug font-semibold opacity-85 flex items-start justify-between gap-x-3 gap-y-0.5"
          style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
        >
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 min-w-0">
            <span>{isEs ? 'Pureza' : 'Purity'}: {purityLabel}</span>
            <span>{isEs ? 'Gramos' : 'Grams'}: {weightLabel}</span>
          </div>
          {lengthLabel && (
            <span className="shrink-0 text-right">{lengthLabel}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-auto pt-3">
          <CartButton item={cartItem} variant="card" locale={locale} />
        </div>
      </div>
    </article>
  );
}

function formatPurity(product: Product, isEs: boolean): string {
  if (!product.purity) return isEs ? 'No indicado' : 'Not listed';
  if (product.category === 'Silver' && product.purity >= 100) {
    return product.purity === 925
      ? `925 ${isEs ? 'esterlina' : 'sterling'}`
      : `${product.purity}`;
  }
  return `${product.purity}K`;
}

function formatWeight(weight: number | null): string {
  if (!weight) return '—';
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: weight % 1 === 0 ? 0 : 2,
  }).format(weight)}g`;
}
