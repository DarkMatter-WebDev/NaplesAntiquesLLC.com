'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { inferProductJewelryType, isProductPurchasable, isProductSold, productImagePaddingBackground, productImagePaddingForImage, productLengthSizeDisplay, productMetalVariantLabel, productStatusLabel, productSupportsLinkType, type Product, type SpotData } from '@/types/product';
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
  const [isImageArrowHovering, setIsImageArrowHovering] = useState(false);
  const isEs = locale === 'es';
  const title = isEs && product.title_es ? product.title_es : product.title;
  const price = getDisplayPrice(product, spotData);
  const metalLabel = productMetalVariantLabel(product.metal_variant, product.category, locale);
  const purityLabel = formatPurity(product, isEs);
  const purityChipStyle = getPurityChipStyle(product);
  const weightLabel = formatWeight(product.gram_weight ?? product.weight_grams);
  const lengthLabel = formatLengthChip(productLengthSizeDisplay(product));
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
  const imageFrameBackground = productImagePaddingBackground(productImagePaddingForImage(product.image_padding, product.image_padding_by_image, activeImage, safeActiveImageIndex));
  const thumbPadding = productImagePaddingForImage(product.image_padding, product.image_padding_by_image, thumb, 0);
  const href = locale === 'es' ? `/es/shop/${product.id}` : `/shop/${product.id}`;
  const isSold = isProductSold(product.status);
  const isPurchasable = isProductPurchasable(product.status);
  const isModern = variant === 'modern';
  const brand = product.brand?.trim() ?? '';
  const fallbackFlagLabel = getProductCardFlagFallback(product);
  const flagLabel = brand || fallbackFlagLabel;
  const isBrandFlag = brand.length > 0;
  const showBrandTag = flagLabel.length > 0 && safeActiveImageIndex === 0 && !isImageArrowHovering;

  const cartItem: CartItem = {
    id: product.id,
    title: product.title,
    title_es: product.title_es,
    description: product.description,
    description_es: product.description_es,
    public_notes: product.public_notes,
    image: thumb ?? null,
    image_padding: thumbPadding,
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
    image_padding: thumbPadding,
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
            className="shop-card-status-tag absolute top-3 left-3 z-10 text-[0.6rem] font-bold tracking-widest uppercase px-2 py-0.5"
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
            className="shop-card-status-tag absolute top-3 left-3 z-10 text-[0.6rem] font-bold tracking-widest uppercase px-2 py-0.5"
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

        {showBrandTag && (
          <div
            className={`shop-card-brand-tag ${isBrandFlag ? 'shop-card-brand-tag-brand' : 'shop-card-brand-tag-link'} absolute bottom-2 left-2 z-10 max-w-[70%] truncate px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.16em] transition-opacity duration-150`}
            style={{
              background: isBrandFlag
                ? 'linear-gradient(135deg, rgba(255, 253, 246, 0.96), rgba(246, 232, 184, 0.94))'
                : 'rgba(255, 252, 246, 0.92)',
              border: isBrandFlag
                ? '1px solid rgba(181, 137, 12, 0.42)'
                : '1px solid rgba(115, 92, 0, 0.22)',
              borderRadius: isModern ? '6px' : undefined,
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-label)',
              boxShadow: isBrandFlag
                ? '0 7px 18px rgba(42, 34, 12, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.82)'
                : '0 6px 16px rgba(42, 34, 12, 0.14)',
              textShadow: isBrandFlag ? '0 1px 0 rgba(255, 255, 255, 0.72)' : undefined,
            }}
          >
            {flagLabel}
          </div>
        )}

        {activeImage ? (
          <Link href={href} className="absolute inset-0">
            {images.map((image, index) => (
              <Image
                key={`${product.id}-${index}-${image}`}
                src={image}
                alt={title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1719px) 25vw, (max-width: 1959px) 20vw, (max-width: 2319px) 16vw, 14vw"
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
                onPointerEnter={() => setIsImageArrowHovering(true)}
                onPointerLeave={() => setIsImageArrowHovering(false)}
                onFocus={() => setIsImageArrowHovering(true)}
                onBlur={() => setIsImageArrowHovering(false)}
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
                onPointerEnter={() => setIsImageArrowHovering(true)}
                onPointerLeave={() => setIsImageArrowHovering(false)}
                onFocus={() => setIsImageArrowHovering(true)}
                onBlur={() => setIsImageArrowHovering(false)}
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
          @media (max-width: 640px) {
            .shop-card-status-tag {
              top: 0.35rem !important;
              left: 0.35rem !important;
              padding: 0.12rem 0.32rem !important;
              font-size: 0.44rem !important;
              letter-spacing: 0.08em !important;
              border-radius: 3px !important;
              box-shadow: 0 4px 10px rgba(115, 92, 0, 0.14) !important;
            }
          }
          .shop-card-brand-tag-link {
            padding-top: 0.22rem !important;
            padding-bottom: 0.22rem !important;
            font-size: 0.56rem !important;
            line-height: 1 !important;
            letter-spacing: 0.12em !important;
          }
          @media (max-width: 640px) {
            .shop-card-brand-tag-link {
              bottom: 0.35rem !important;
              left: 0.35rem !important;
              padding: 0.14rem 0.38rem !important;
              font-size: 0.48rem !important;
              letter-spacing: 0.08em !important;
              border-radius: 3px !important;
            }
          }
          @media (max-width: 640px) {
            .modern-product-card .modern-card-body {
              padding-left: 0.35rem;
              padding-right: 0.35rem;
            }
            .modern-product-card .modern-card-body > .grid {
              gap: 0.08rem;
              font-size: 0.58rem;
            }
            .modern-product-card .modern-card-body > .grid span {
              padding-left: 0.08rem;
              padding-right: 0.08rem;
            }
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
            .modern-product-card:hover .shop-card-brand-tag,
            .modern-product-card:focus-within .shop-card-brand-tag {
              opacity: 0;
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
    return `${product.purity}`;
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
  const maximumFractionDigits = weight >= 100 ? 1 : weight >= 10 ? 1 : 2;
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: weight % 1 === 0 ? 0 : maximumFractionDigits,
  }).format(weight)}g`;
}

function formatLengthChip(value: string | null): string | null {
  if (!value) return null;
  const ringSize = value.match(/^Size:\s*(.+)$/i);
  if (ringSize) return ringSize[1];

  const inchValue = value.match(/^(\d+(?:\.\d+)?)\s*in$/i);
  if (!inchValue) return value;

  const numeric = Number(inchValue[1]);
  if (!Number.isFinite(numeric)) return value;
  const compact = numeric >= 10
    ? Math.round(numeric)
    : Number.isInteger(numeric) ? numeric : Number(numeric.toFixed(1));
  return `${compact}in`;
}

function getProductCardFlagFallback(product: Product): string {
  const jewelryType = inferProductJewelryType(product);
  if (!productSupportsLinkType(jewelryType)) return '';

  const linkType = product.chain_type ?? (product.tags ?? []).find((tag) => tag.startsWith('ct:'))?.slice(3) ?? '';
  return linkType.trim();
}
