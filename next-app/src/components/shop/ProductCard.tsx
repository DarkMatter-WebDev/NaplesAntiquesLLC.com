'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { isProductPurchasable, isProductSold, productImagePaddingBackground, productLengthSizeDisplay, productMetalVariantLabel, productStatusLabel, type Product, type SpotData } from '@/types/product';
import { getDisplayPrice } from '@/lib/pricing';
import WishlistButton from '@/components/shop/WishlistButton';
import type { WishlistItem } from '@/context/WishlistContext';
import CartButton from '@/components/shop/CartButton';
import type { CartItem } from '@/context/CartContext';

interface Props {
  product: Product;
  spotData: SpotData | null;
  locale: string;
  variant?: 'classic' | 'modern';
}

export default function ProductCard({ product, spotData, locale, variant = 'classic' }: Props) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageHovering, setIsImageHovering] = useState(false);
  const isEs = locale === 'es';
  const title = isEs && product.title_es ? product.title_es : product.title;
  const price = getDisplayPrice(product, spotData);
  const metalLabel = productMetalVariantLabel(product.metal_variant, product.category, locale);
  const purityLabel = formatPurity(product, isEs);
  const purityChipStyle = getPurityChipStyle(product);
  const weightLabel = formatWeight(product.gram_weight ?? product.weight_grams);
  const lengthLabel = productLengthSizeDisplay(product);
  const images = useMemo(
    () => (product.image_urls?.length ? product.image_urls : product.images ?? []).filter(Boolean),
    [product.image_urls, product.images],
  );
  const thumb = images[0];
  const safeActiveImageIndex = activeImageIndex < images.length ? activeImageIndex : 0;
  const activeImage = images[safeActiveImageIndex] ?? thumb;
  const hasMultipleImages = images.length > 1;
  const canShowPreviousImage = hasMultipleImages && safeActiveImageIndex > 0;
  const canShowNextImage = hasMultipleImages && safeActiveImageIndex < images.length - 1;
  const imageFrameBackground = productImagePaddingBackground(product.image_padding);
  const href = locale === 'es' ? `/es/shop/${product.id}` : `/shop/${product.id}`;
  const isSold = isProductSold(product.status);
  const isPurchasable = isProductPurchasable(product.status);
  const isModern = variant === 'modern';

  const cartItem: CartItem = {
    id: product.id,
    title: product.title,
    title_es: product.title_es,
    description: product.description,
    description_es: product.description_es,
    public_notes: product.public_notes,
    image: thumb ?? null,
    status: product.status,
    priceLabel: price,
    category: product.category,
    metal_type: product.metal_type,
    metal_variant: product.metal_variant,
    purity: product.purity,
    weight_grams: product.weight_grams,
    gram_weight: product.gram_weight,
    product_type: product.product_type,
    jewelry_type: product.jewelry_type,
    chain_type: product.chain_type,
    length: product.length,
    brand: product.brand,
    tags: product.tags,
    tags_es: product.tags_es,
    gender: product.gender,
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

  useEffect(() => {
    if (!isImageHovering || !canShowNextImage) return;
    const timer = window.setInterval(() => {
      setActiveImageIndex((current) => Math.min(current + 1, images.length - 1));
    }, 1150);
    return () => window.clearInterval(timer);
  }, [canShowNextImage, images.length, isImageHovering]);

  useEffect(() => {
    if (isImageHovering || activeImageIndex === 0) return;
    const timer = window.setTimeout(() => {
      setActiveImageIndex(0);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [activeImageIndex, isImageHovering]);

  const showPreviousImage = () => {
    if (!canShowPreviousImage) return;
    setActiveImageIndex((current) => Math.max(current - 1, 0));
  };

  const showNextImage = () => {
    if (!canShowNextImage) return;
    setActiveImageIndex((current) => Math.min(current + 1, images.length - 1));
  };

  return (
    <article
      className={`group relative flex flex-col overflow-hidden ${
        isModern
          ? 'modern-product-card bg-white'
          : 'bg-[color:var(--color-surface-container-lowest)] border border-[color:var(--color-outline-variant)]'
      }`}
      style={isModern ? {
        border: '1px solid rgba(115, 92, 0, 0.12)',
        borderRadius: '8px',
        boxShadow: '0 12px 32px rgba(42, 34, 12, 0.10)',
      } : undefined}
    >

      {/* Image */}
      <div
        className={`relative aspect-square overflow-hidden ${isModern ? 'modern-product-image' : ''}`}
        style={{ background: imageFrameBackground }}
        onPointerEnter={() => setIsImageHovering(true)}
        onPointerLeave={() => setIsImageHovering(false)}
        onMouseEnter={() => setIsImageHovering(true)}
        onMouseLeave={() => setIsImageHovering(false)}
      >
        {isSold && (
          <div
            className="absolute top-3 left-3 z-10 text-[0.6rem] font-bold tracking-widest uppercase px-2 py-0.5"
            style={{
              background: isModern ? '#1f2321' : 'var(--color-on-surface)',
              color: 'var(--color-surface)',
              borderRadius: isModern ? '4px' : undefined,
            }}
          >
            {isEs ? 'Vendido' : 'Sold'}
          </div>
        )}
        {!isSold && (
          <div
            className="absolute top-3 left-3 z-10 text-[0.6rem] font-bold tracking-widest uppercase px-2 py-0.5"
            style={{
              background: isPurchasable ? (isModern ? 'linear-gradient(135deg, #d5a820, #ad8507)' : 'var(--color-primary)') : '#8a5a00',
              color: isModern ? '#fffdf7' : 'var(--color-on-primary)',
              borderRadius: isModern ? '4px' : undefined,
              boxShadow: isModern ? '0 8px 18px rgba(115, 92, 0, 0.16)' : undefined,
            }}
          >
            {isPurchasable ? (isEs ? 'Disponible' : 'Available') : productStatusLabel(product.status)}
          </div>
        )}
        {/* Wishlist button — top-right of image */}
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton item={wishlistItem} variant="icon" locale={locale} />
        </div>

        {activeImage ? (
          <Link href={href} className="absolute inset-0">
            {images.map((image, index) => (
              <Image
                key={`${product.id}-${index}-${image}`}
                src={image}
                alt={title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className={`pointer-events-none object-contain object-center transition-opacity duration-700 ease-in-out ${
                  index === safeActiveImageIndex ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
                // Local assets in the static folder aren't in remotePatterns; unoptimized for those
                unoptimized={image.startsWith('/assets/')}
              />
            ))}
          </Link>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">📷</div>
        )}
        {hasMultipleImages && (
          <>
            {canShowPreviousImage && (
              <button
                type="button"
                aria-label={isEs ? 'Imagen anterior' : 'Previous image'}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  showPreviousImage();
                }}
                className="absolute bottom-2 left-2 z-20 inline-flex h-6 w-6 items-center justify-center border text-sm font-bold transition-colors"
                style={{
                  borderColor: 'rgba(115, 92, 0, 0.3)',
                  background: 'rgba(255, 252, 246, 0.9)',
                  color: 'var(--color-primary)',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
                }}
              >
                &lsaquo;
              </button>
            )}
            {canShowNextImage && (
              <button
                type="button"
                aria-label={isEs ? 'Imagen siguiente' : 'Next image'}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  showNextImage();
                }}
                className="absolute bottom-2 right-2 z-20 inline-flex h-6 w-6 items-center justify-center border text-sm font-bold transition-colors"
                style={{
                  borderColor: 'rgba(115, 92, 0, 0.3)',
                  background: 'rgba(255, 252, 246, 0.9)',
                  color: 'var(--color-primary)',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
                }}
              >
                &rsaquo;
              </button>
            )}
          </>
        )}
        {isModern && (
          <div className="modern-card-hover-title" aria-hidden="true">
            {title}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="modern-card-body flex flex-col flex-1 p-4 gap-1.5">
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
          className={`mt-1 flex items-baseline gap-2 px-2 py-1.5 ${isModern ? 'modern-price-row' : 'border-y'}`}
          style={{
            background: isModern ? 'linear-gradient(135deg, rgba(255, 250, 238, 0.92), rgba(249, 244, 232, 0.96))' : 'rgba(194, 155, 45, 0.06)',
            borderColor: 'rgba(115, 92, 0, 0.18)',
            borderTop: isModern ? '1px solid rgba(115, 92, 0, 0.14)' : undefined,
            borderBottom: isModern ? '1px solid rgba(115, 92, 0, 0.14)' : undefined,
            borderRadius: isModern ? '6px' : undefined,
            fontFamily: 'var(--font-label)',
          }}
        >
          <span
            className="text-[0.68rem] font-extrabold uppercase tracking-widest"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            {isEs ? 'Tu precio' : 'Your price'}
          </span>
          <span
            className="text-base font-extrabold uppercase tracking-wide"
            style={{ color: 'var(--color-primary)' }}
          >
            {price}
          </span>
        </p>
        <div
          className="grid grid-cols-3 gap-1 text-[0.68rem] font-bold leading-none"
          style={{ fontFamily: 'var(--font-label)' }}
        >
          <span
            className="inline-flex min-w-0 items-center justify-center whitespace-nowrap border px-1 py-1"
            style={{
              background: purityChipStyle.background,
              borderColor: purityChipStyle.borderColor,
              color: purityChipStyle.color,
            }}
          >
            {purityLabel}
          </span>
          <span
            className="inline-flex min-w-0 items-center justify-center whitespace-nowrap border px-1 py-1"
            style={{
              background: 'rgba(72, 65, 52, 0.07)',
              borderColor: 'rgba(72, 65, 52, 0.18)',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            {weightLabel}
          </span>
          <span
            className="inline-flex min-w-0 items-center justify-center whitespace-nowrap border px-1 py-1"
            style={{
              background: lengthLabel ? 'rgba(139, 85, 36, 0.08)' : 'transparent',
              borderColor: lengthLabel ? 'rgba(139, 85, 36, 0.2)' : 'transparent',
              color: '#7a4a1f',
              visibility: lengthLabel ? 'visible' : 'hidden',
            }}
          >
            {lengthLabel ?? ''}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-auto pt-3">
          <CartButton item={cartItem} variant="card" locale={locale} />
        </div>
      </div>
      {isModern && (
        <style>{`
          .modern-product-card {
            transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
          }
          .modern-product-card:hover {
            transform: translateY(-3px);
            border-color: rgba(181, 137, 12, 0.26) !important;
            box-shadow: 0 18px 44px rgba(42, 34, 12, 0.14) !important;
          }
          .modern-product-card .shop-card-cart-button {
            border-radius: 6px;
            border-color: rgba(181, 137, 12, 0.38) !important;
            background: rgba(255, 253, 248, 0.86);
          }
          .modern-product-card .shop-card-cart-button:hover {
            background: linear-gradient(135deg, #d9ad2f, #b98c09);
            color: #fffdf7;
          }
          /* Compact card body — applied at all breakpoints (mobile, tablet, desktop) */
          .modern-product-card .modern-card-body {
            padding: 0.3rem 0.6rem 0.6rem;
            gap: 0.2rem;
          }
          /* Hide the metal label ("YELLOW GOLD") and the product title */
          .modern-product-card .modern-card-body > span:first-child,
          .modern-product-card .modern-card-body > a {
            display: none;
          }
          /* Price floats on the white card — no cream background or borders */
          .modern-product-card .modern-price-row {
            margin-top: 0;
            padding: 0 0.45rem;
            gap: 0.35rem;
            line-height: 1.1;
            justify-content: center;
            background: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .modern-product-card .modern-price-row span:first-child {
            display: none;
          }
          .modern-product-card .modern-price-row span:last-child {
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 0.92rem;
            font-weight: 700;
            letter-spacing: 0.005em;
            text-transform: none;
            font-variant-numeric: tabular-nums;
          }
          /* Compact spec chips (purity / weight / length) */
          .modern-product-card .modern-card-body > .grid span {
            padding-top: 0.22rem;
            padding-bottom: 0.22rem;
          }
          /* Tighten the action row above the Add button */
          .modern-product-card .modern-card-body > .flex:last-child {
            padding-top: 0.4rem;
          }
          /* Title hover tooltip — desktop only (title is hidden in the card body) */
          .modern-card-hover-title {
            display: none;
          }
          @media (min-width: 1024px) {
            .modern-card-hover-title {
              display: block;
              position: absolute;
              left: 0.7rem;
              right: 0.7rem;
              bottom: 0.7rem;
              padding: 0.5rem 0.75rem;
              border-radius: 8px;
              background: rgba(24, 19, 9, 0.86);
              backdrop-filter: blur(3px);
              color: #fffdf7;
              font-family: var(--font-headline);
              font-size: 0.74rem;
              font-weight: 600;
              line-height: 1.3;
              text-align: center;
              opacity: 0;
              transform: translateY(8px);
              transition: opacity 200ms ease, transform 200ms ease;
              pointer-events: none;
              z-index: 15;
              box-shadow: 0 10px 26px rgba(0, 0, 0, 0.3);
            }
            .modern-product-card:hover .modern-card-hover-title {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      )}
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

function getPurityChipStyle(product: Product) {
  if (!product.purity || product.category !== 'Gold' || product.purity > 24) {
    return {
      background: 'rgba(194, 155, 45, 0.1)',
      borderColor: 'rgba(115, 92, 0, 0.22)',
      color: 'var(--color-primary)',
    };
  }

  const karat = Math.min(24, Math.max(10, product.purity));
  const intensity = (karat - 10) / 12;
  const fillPercent = Math.round(18 + intensity * 42);
  const borderPercent = Math.round(32 + intensity * 38);

  return {
    background: `color-mix(in srgb, #ffd84d ${fillPercent}%, var(--color-background))`,
    borderColor: `color-mix(in srgb, #c99800 ${borderPercent}%, rgba(115, 92, 0, 0.22))`,
    color: karat >= 18 ? '#6f4e00' : karat >= 14 ? '#735c00' : '#6f622f',
  };
}

function formatWeight(weight: number | null): string {
  if (!weight) return '—';
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: weight % 1 === 0 ? 0 : 2,
  }).format(weight)}g`;
}
