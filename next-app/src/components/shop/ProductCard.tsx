'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatProductItemYear, inferProductJewelryType, isProductPurchasable, isProductSold, productImagePaddingBackground, productImagePaddingForImage, productLengthSizeDisplay, productMetalVariantLabel, productStatusLabel, productSupportsLinkType, type Product, type SpotData } from '@/types/product';
import { getDisplayPrice } from '@/lib/pricing';
import WishlistButton from '@/components/shop/WishlistButton';
import type { WishlistItem } from '@/context/WishlistContext';
import CartButton from '@/components/shop/CartButton';
import type { CartItem } from '@/context/CartContext';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';

interface Props {
  product: Product;
  spotData: SpotData | null;
  locale: string;
  variant?: 'classic' | 'modern';
  revealIndex?: number;
  revealColumnCount?: number;
  prioritizeImage?: boolean;
  includeModernStyles?: boolean;
}

export default function ProductCard({
  product,
  spotData,
  locale,
  variant = 'classic',
  revealIndex = 0,
  revealColumnCount = 3,
  prioritizeImage = false,
  includeModernStyles = false,
}: Props) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageHovering, setIsImageHovering] = useState(false);
  const [isImageArrowHovering, setIsImageArrowHovering] = useState(false);
  const [loadedCoverKey, setLoadedCoverKey] = useState<string | null>(null);
  const [revealedCoverKey, setRevealedCoverKey] = useState<string | null>(null);
  const coverImageRef = useRef<HTMLImageElement | null>(null);
  const isEs = locale === 'es';
  const title = isEs && product.title_es ? product.title_es : product.title;
  const price = getDisplayPrice(product, spotData);
  const metalLabel = productMetalVariantLabel(product.metal_variant, product.category, locale);
  const purityLabel = formatPurity(product, isEs);
  const purityChipStyle = getPurityChipStyle(product);
  const weightLabel = formatWeight(product.gram_weight ?? product.weight_grams);
  const lengthLabel = formatLengthChip(productLengthSizeDisplay(product));
  const itemDateLabel = formatProductItemYear(product.item_year);
  const images = useMemo(
    () =>
      (product.image_urls?.length ? product.image_urls : product.images ?? [])
        .map((image) => normalizeLegacyLocalImageUrl(image))
        .filter((image): image is string => Boolean(image)),
    [product.image_urls, product.images],
  );
  const thumb = images[0] ?? null;
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
  const flagFitClass = getProductCardFlagFitClass(flagLabel);
  const showBrandTag = flagLabel.length > 0 && safeActiveImageIndex === 0 && !isImageArrowHovering;
  const revealColumns = Math.max(1, revealColumnCount);
  const revealRow = Math.floor(revealIndex / revealColumns);
  const revealColumn = revealIndex % revealColumns;
  const revealDelayMs = revealRow * (revealColumns * 90 + 140) + revealColumn * 90;
  const coverKey = `${product.id}:${revealIndex}:${thumb ?? 'no-image'}`;
  const coverImageLoaded = !thumb || loadedCoverKey === coverKey;
  const isRevealed = revealedCoverKey === coverKey;

  const cartItem: CartItem = {
    id: product.id,
    title: product.title,
    title_es: product.title_es,
    description: product.description,
    description_es: product.description_es,
    public_notes: product.public_notes,
    image: thumb,
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
    item_year: product.item_year,
    tags: product.tags,
    tags_es: product.tags_es,
    gender: product.gender,
  };

  const wishlistItem: WishlistItem = {
    id: product.id,
    title: product.title,
    title_es: product.title_es,
    image: thumb,
    image_padding: thumbPadding,
    status: product.status,
    price_mode: product.price_mode,
    purity: product.purity,
    weight_grams: product.weight_grams,
    pricing_multiplier: product.pricing_multiplier,
    manual_price_label: product.manual_price_label,
  };

  useEffect(() => {
    if (!isImageHovering || isImageArrowHovering || !canShowNextImage) return;
    const timer = window.setInterval(() => {
      setActiveImageIndex((current) => Math.min(current + 1, images.length - 1));
    }, 1150);
    return () => window.clearInterval(timer);
  }, [canShowNextImage, images.length, isImageHovering, isImageArrowHovering]);

  useEffect(() => {
    if (!thumb) return;

    let frame = 0;
    let attempts = 0;
    const fallbackTimer = window.setTimeout(() => {
      setLoadedCoverKey(coverKey);
    }, 1800);

    const checkCoverImage = () => {
      const coverImage = coverImageRef.current;
      if (coverImage?.complete && coverImage.naturalWidth > 0) {
        window.clearTimeout(fallbackTimer);
        setLoadedCoverKey(coverKey);
        return;
      }

      attempts += 1;
      if (attempts < 180) {
        frame = window.requestAnimationFrame(checkCoverImage);
      }
    };

    frame = window.requestAnimationFrame(checkCoverImage);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(fallbackTimer);
    };
  }, [coverKey, thumb]);

  useEffect(() => {
    if (!coverImageLoaded) return;

    const timer = window.setTimeout(() => {
      setRevealedCoverKey(coverKey);
    }, revealDelayMs);

    return () => window.clearTimeout(timer);
  }, [coverImageLoaded, coverKey, revealDelayMs]);

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
      } shop-card-reveal ${isRevealed ? 'is-visible' : ''}`}
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
            className="shop-card-status-tag shop-card-status-available absolute top-3 left-3 z-10 text-[0.6rem] font-bold tracking-widest uppercase px-2 py-0.5"
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
        {/* Cart icon button — mobile only, top-left (replaces Available tag on small screens) */}
        {isPurchasable && (
          <div className="shop-card-cart-icon-wrap absolute top-2 left-2 z-10">
            <CartButton item={cartItem} variant="icon" locale={locale} />
          </div>
        )}

        {/* Wishlist button — top-right of image */}
        <div className="shop-card-wishlist-wrap absolute top-2 right-2 z-10">
          <WishlistButton item={wishlistItem} variant="icon" locale={locale} />
        </div>

        {showBrandTag && (
          <div
            className={`shop-card-brand-tag ${isBrandFlag ? 'shop-card-brand-tag-brand' : 'shop-card-brand-tag-link'} ${flagFitClass} absolute bottom-2 left-2 z-10 max-w-[70%] truncate px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.16em] transition-opacity duration-150`}
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
          <Link href={href} prefetch={false} className="absolute inset-0">
            {images.map((image, index) => (
              <Image
                key={`${product.id}-${index}-${image}`}
                ref={index === 0 ? coverImageRef : undefined}
                src={image}
                alt={title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1719px) 25vw, (max-width: 1959px) 20vw, (max-width: 2319px) 16vw, 14vw"
                className={`pointer-events-none object-contain object-center transition-opacity duration-700 ease-in-out ${
                  index === safeActiveImageIndex ? 'opacity-100' : 'opacity-0'
                }`}
                // The first cover image of an above-the-fold card is the LCP
                // candidate: `priority` emits a preload link + fetchpriority=high.
                // Later (hover-carousel) images stay lazy so they don't compete.
                priority={prioritizeImage && index === 0}
                loading={prioritizeImage && index === 0 ? undefined : 'lazy'}
                onLoad={() => {
                  if (index === 0) setLoadedCoverKey(coverKey);
                }}
                onError={() => {
                  if (index === 0) setLoadedCoverKey(coverKey);
                }}
                // Local assets in the static folder aren't in remotePatterns; unoptimized for those
                unoptimized={image.startsWith('/assets/')}
              />
            ))}
          </Link>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#735c00]/35">
            <span className="material-symbols-outlined" style={{ fontSize: '2rem' }} aria-hidden="true">
              image
            </span>
          </div>
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
                className="shop-card-image-arrow absolute bottom-2 left-2 z-20 inline-flex h-6 w-6 items-center justify-center border text-sm font-bold transition-colors"
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
                className="shop-card-image-arrow absolute bottom-2 right-2 z-20 inline-flex h-6 w-6 items-center justify-center border text-sm font-bold transition-colors"
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

        <Link href={href} prefetch={false} className="group/title">
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

        {!isModern && itemDateLabel && (
          <p
            className="modern-card-date text-[0.66rem] font-semibold uppercase tracking-[0.16em]"
            style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
          >
            <span className="normal-case">Ca.</span> {itemDateLabel}
          </p>
        )}

        <p
          className={`mt-1 flex items-baseline gap-2 px-2 py-1.5 ${isModern ? 'modern-price-row' : 'border-y'}`}
          style={{
            position: isModern ? 'relative' : undefined,
            background: isModern ? 'linear-gradient(135deg, rgba(255, 250, 238, 0.92), rgba(249, 244, 232, 0.96))' : 'rgba(194, 155, 45, 0.06)',
            borderColor: 'rgba(115, 92, 0, 0.18)',
            borderTop: isModern ? '1px solid rgba(115, 92, 0, 0.14)' : undefined,
            borderBottom: isModern ? '1px solid rgba(115, 92, 0, 0.14)' : undefined,
            borderRadius: isModern ? '6px' : undefined,
            fontFamily: 'var(--font-label)',
          }}
        >
          {isModern && itemDateLabel && (
            <span
              className="modern-card-date text-[0.66rem] font-semibold uppercase tracking-[0.16em]"
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-on-surface-variant)',
                fontFamily: 'var(--font-label)',
              }}
            >
              <span className="normal-case">Ca.</span> {itemDateLabel}
            </span>
          )}
          <span
            className="modern-price-label text-[0.68rem] font-extrabold uppercase tracking-widest"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            {isEs ? 'Tu precio' : 'Your price'}
          </span>
          <span
            className="modern-price-value text-base font-extrabold uppercase tracking-wide"
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
            className="inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-full border px-1.5 py-1"
            style={{
              background: purityChipStyle.background,
              borderColor: purityChipStyle.borderColor,
              color: purityChipStyle.color,
            }}
          >
            {purityLabel}
          </span>
          <span
            className="inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-full border px-1.5 py-1"
            style={{
              background: 'rgba(72, 65, 52, 0.07)',
              borderColor: 'rgba(72, 65, 52, 0.18)',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            {weightLabel}
          </span>
          <span
            className="inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-full border px-1.5 py-1"
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
          <CartButton item={cartItem} variant="card" locale={locale} includeCardStyles={includeModernStyles} />
        </div>
      </div>
      {isModern && includeModernStyles && (
        <style>{`
          .shop-card-reveal {
            opacity: 0;
            transform: translateY(18px) scale(0.985);
            filter: blur(6px);
            pointer-events: none;
            transition:
              opacity 520ms ease,
              transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1),
              filter 520ms ease,
              box-shadow 180ms ease,
              border-color 180ms ease;
            will-change: opacity, transform, filter;
          }
          .shop-card-reveal.is-visible {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
            pointer-events: auto;
          }
          .modern-product-card {
            transition:
              opacity 520ms ease,
              transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1),
              filter 520ms ease,
              box-shadow 180ms ease,
              border-color 180ms ease;
          }
          .modern-product-card.is-visible:hover {
            transform: translateY(-3px);
            border-color: rgba(181, 137, 12, 0.26) !important;
            box-shadow: 0 18px 44px rgba(42, 34, 12, 0.14) !important;
          }
          .modern-product-card .modern-product-image {
            border-radius: var(--radius-xl);
          }
          .modern-product-card .shop-card-cart-button {
            border-radius: 999px;
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
          .modern-product-card .modern-price-label {
            display: none;
          }
          .modern-product-card .modern-price-value {
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
              top: 0.28rem !important;
              left: 0.28rem !important;
              padding: 0.08rem 0.24rem !important;
              font-size: 0.38rem !important;
              letter-spacing: 0.05em !important;
              border-radius: 2px !important;
              box-shadow: 0 3px 7px rgba(115, 92, 0, 0.12) !important;
            }
            .shop-card-wishlist-wrap {
              top: 0.32rem !important;
              right: 0.32rem !important;
            }
            .shop-card-wishlist-button {
              width: 1.35rem !important;
              height: 1.35rem !important;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
            }
            .shop-card-wishlist-button [data-wishlist-icon="true"] {
              font-size: 12px !important;
            }
            .shop-card-image-arrow {
              width: 1.15rem !important;
              height: 1.15rem !important;
              bottom: 0.35rem !important;
              font-size: 0.7rem !important;
              line-height: 1 !important;
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1) !important;
            }
            .shop-card-image-arrow.left-2 {
              left: 0.35rem !important;
            }
            .shop-card-image-arrow.right-2 {
              right: 0.35rem !important;
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
              bottom: 0.28rem !important;
              left: 0.28rem !important;
              padding: 0.1rem 0.28rem !important;
              font-size: 0.4rem !important;
              letter-spacing: 0.05em !important;
              border-radius: 2px !important;
            }
            .shop-card-brand-tag-fit-medium {
              font-size: 0.36rem !important;
              letter-spacing: 0.03em !important;
            }
            .shop-card-brand-tag-fit-long {
              font-size: 0.32rem !important;
              letter-spacing: 0.01em !important;
              padding-left: 0.22rem !important;
              padding-right: 0.22rem !important;
            }
          }
          @media (max-width: 640px) {
            .shop-card-brand-tag-brand {
              bottom: 0.28rem !important;
              left: 0.28rem !important;
              max-width: 62% !important;
              padding: 0.1rem 0.28rem !important;
              font-size: 0.4rem !important;
              line-height: 1 !important;
              letter-spacing: 0.05em !important;
              border-radius: 2px !important;
              box-shadow: 0 3px 7px rgba(42, 34, 12, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.72) !important;
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
            /* Hide bottom cart button row on mobile — cart icon is in the image instead */
            .modern-product-card .modern-card-body > .flex:last-child {
              display: none !important;
            }
            /* Hide date label on mobile */
            .modern-product-card .modern-card-date {
              display: none;
            }
            /* Hide the Available text tag on mobile — replaced by cart icon */
            .shop-card-status-available {
              display: none !important;
            }
            /* Show cart icon button on mobile */
            .shop-card-cart-icon-wrap {
              display: flex;
            }
            .shop-card-cart-icon-button {
              width: 1.35rem !important;
              height: 1.35rem !important;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
            }
            .shop-card-cart-icon-button [data-cart-icon="true"] {
              font-size: 11px !important;
            }
          }
          /* Cart icon button — hidden on tablet/desktop, visible on mobile */
          @media (min-width: 641px) {
            .shop-card-cart-icon-wrap {
              display: none;
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
              border-radius: var(--radius-lg);
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
          @media (prefers-reduced-motion: reduce) {
            .shop-card-reveal,
            .shop-card-reveal.is-visible,
            .modern-product-card,
            .modern-product-card.is-visible:hover {
              transition: none;
              transform: none;
              filter: none;
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

function getProductCardFlagFitClass(label: string): string {
  const length = label.trim().length;
  if (length >= 18) return 'shop-card-brand-tag-fit-long';
  if (length >= 13) return 'shop-card-brand-tag-fit-medium';
  return '';
}
