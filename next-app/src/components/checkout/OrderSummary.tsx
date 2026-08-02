'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CartItem } from '@/context/CartContext';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import {
  calculateFlSalesTax,
  chargesFlSalesTax,
  FL_TAX_RATE_LABEL,
  formatCheckoutCurrency,
  round2,
} from '@/lib/checkout-pricing';
import { parseManualPriceLabelValue } from '@/lib/pricing';
import {
  CHECKOUT_SHIPPING_OPTIONS,
  DEFAULT_SHIPPING_METHOD,
  EXPRESS_SHIPPING_MAX_SUBTOTAL,
  getCheckoutShippingFee,
  getCheckoutShippingOption,
  getShippingServiceNote,
  isShippingMethodAvailable,
} from '@/lib/checkout-shipping';
import {
  inferProductJewelryType,
  formatProductItemYear,
  isProductPurchasable,
  isProductSold,
  normalizeProductQuantity,
  productJewelryTypeLabel,
  productLengthSizeDisplay,
  productImagePaddingBackground,
  productMetalVariantLabel,
} from '@/types/product';
import { AppIcon } from '@/components/AppIcon';

const AVAILABLE_GREEN = '#2e7d32';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';

function parsePrice(label: string): number | null {
  return parseManualPriceLabelValue(label);
}

function purchaseQty(item: CartItem): number {
  return Math.max(1, normalizeProductQuantity(item.purchaseQuantity));
}

export default function OrderSummary({
  items,
  isEs,
  prefix,
  shippingMethod,
  shippingState,
  onShippingMethodChange,
  onRemove,
  onSetQuantity,
  variant = 'compact',
  showAvailability = false,
  hideSoldItemPrices = false,
}: {
  items: CartItem[];
  isEs: boolean;
  prefix: string;
  shippingMethod: string;
  /** Buyer's entered shipping-address state, if collected — used so the estimate
   *  matches the authoritative server tax calc (FL tax only for pickup or an
   *  in-state address; out-of-state shipments aren't taxed). */
  shippingState?: string;
  onShippingMethodChange?: (value: string) => void;
  onRemove?: (id: string) => void;
  onSetQuantity?: (id: string, quantity: number) => void;
  variant?: 'compact' | 'expanded';
  /** Show each item's live availability (In stock / N available / Sold out).
   *  On for the live checkout summary; off for the printed confirmation snapshot. */
  showAvailability?: boolean;
  /** Mask prices for sold items on live customer-facing summaries. */
  hideSoldItemPrices?: boolean;
}) {
  const lineTotals = items.map((i) => {
    if (hideSoldItemPrices && isProductSold(i.status)) return null;
    const unit = parsePrice(i.priceLabel);
    return unit === null ? null : unit * purchaseQty(i);
  });
  const knownLineTotals = lineTotals.filter((p): p is number => p !== null);
  const hasUnknown = knownLineTotals.length < lineTotals.length;
  const subtotal = round2(knownLineTotals.reduce((a, b) => a + b, 0));
  const selectedShipping = getCheckoutShippingOption(shippingMethod) ?? CHECKOUT_SHIPPING_OPTIONS[0];
  // Value-based tier fee. Fall back to the default method's fee while the
  // parent snaps an unavailable selection (Express at $5,000+) back to default.
  const shipping = getCheckoutShippingFee(selectedShipping.value, subtotal)
    ?? getCheckoutShippingFee(DEFAULT_SHIPPING_METHOD, subtotal)
    ?? 0;
  const serviceNote = getShippingServiceNote(selectedShipping.value, subtotal, isEs);
  const tax = chargesFlSalesTax(shippingMethod, shippingState)
    ? calculateFlSalesTax(subtotal, shipping)
    : 0;
  const total = round2(subtotal + tax + shipping);

  const expanded = variant === 'expanded';

  return (
    <aside
      className={`border ${expanded ? 'p-4 md:p-6' : 'p-4 md:p-5 lg:sticky lg:top-24'}`}
      style={{
        borderColor: BORDER,
        background: expanded ? 'rgba(255, 255, 255, 0.9)' : 'var(--color-surface-container-lowest)',
        boxShadow: expanded ? '0 16px 42px rgba(75, 60, 24, 0.08)' : undefined,
      }}
    >
      <div className={expanded ? 'mb-3 flex flex-row items-baseline justify-between gap-2' : ''}>
        <h2 className={`${expanded ? 'text-base' : 'text-sm'} font-bold uppercase tracking-widest ${expanded ? '' : 'mb-4'}`} style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {isEs ? 'Resumen' : 'Order Summary'}
        </h2>
        {expanded && (
          <p className="text-xs flex-shrink-0" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
            {items.length} {isEs ? (items.length === 1 ? 'artículo' : 'artículos') : (items.length === 1 ? 'item' : 'items')}
          </p>
        )}
      </div>
      <div className={`${expanded ? 'grid gap-3 mb-4' : 'flex flex-col gap-3 mb-5'}`}>
        {items.map((item) => (
          <SummaryRow
            key={item.id}
            item={item}
            isEs={isEs}
            prefix={prefix}
            onRemove={onRemove ? () => onRemove(item.id) : undefined}
            onSetQuantity={onSetQuantity ? (qty) => onSetQuantity(item.id, qty) : undefined}
            expanded={expanded}
            showAvailability={showAvailability}
            hideSoldItemPrices={hideSoldItemPrices}
          />
        ))}
      </div>
      <div className={`${expanded ? 'ml-auto max-w-md rounded-2xl bg-[rgba(255,253,248,0.78)] px-3.5 py-3 shadow-[0_12px_34px_rgba(38,28,6,0.05)]' : ''} flex flex-col gap-1 text-xs border-t pt-3`} style={{ borderColor: BORDER, fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}>
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{subtotal > 0 ? formatCheckoutCurrency(subtotal) : '-'}{hasUnknown ? '*' : ''}</span>
        </div>
        {onShippingMethodChange ? (
          <div className="flex items-center justify-between gap-2 pt-2">
            <span>{isEs ? 'Envío' : 'Shipping'}</span>
            <select
              value={selectedShipping.value}
              onChange={(e) => onShippingMethodChange(e.target.value)}
              aria-label={isEs ? 'Método de envío' : 'Shipping method'}
              className="max-w-[62%] rounded-md border px-2 py-1 text-xs font-bold"
              style={{
                borderColor: BORDER,
                background: 'var(--color-background)',
                color: 'var(--color-on-surface)',
                fontFamily: 'var(--font-label)',
                outline: 'none',
              }}
            >
              {CHECKOUT_SHIPPING_OPTIONS
                .filter((option) => isShippingMethodAvailable(option.value, subtotal))
                .map((option) => {
                  const optionFee = getCheckoutShippingFee(option.value, subtotal) ?? 0;
                  return (
                    <option key={option.value} value={option.value}>
                      {`${isEs ? option.labelEs : option.labelEn} — ${formatCheckoutCurrency(optionFee)}`}
                    </option>
                  );
                })}
            </select>
          </div>
        ) : (
          <div className="flex justify-between pt-2">
            <span>{isEs ? 'Envío' : 'Shipping'}</span>
            <span style={{ color: 'var(--color-on-surface)' }}>
              {isEs ? selectedShipping.labelEs : selectedShipping.labelEn}
            </span>
          </div>
        )}
        {serviceNote && (
          <p className="text-[0.65rem] leading-snug" style={{ color: 'var(--color-on-surface-variant)' }}>
            {serviceNote}
          </p>
        )}
        {onShippingMethodChange && subtotal >= EXPRESS_SHIPPING_MAX_SUBTOTAL && (
          <p className="text-[0.65rem] leading-snug" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs
              ? 'El envío nocturno no está disponible para pedidos de $5,000 o más (límite de seguro del transportista).'
              : 'Overnight shipping is unavailable for orders of $5,000 or more (carrier insurance limit).'}
          </p>
        )}
        <div className="flex justify-between">
          <span>{isEs ? 'Costo de envío' : 'Shipping Cost'}</span>
          <span>{formatCheckoutCurrency(shipping)}</span>
        </div>
        {/* Tax renders AFTER shipping (owner request 2026-07-31): Florida tax
            is charged on merchandise + charged shipping, so listing it below
            the shipping cost makes that base visually obvious. */}
        <div className="flex justify-between">
          <span>
            {tax > 0
              ? (isEs ? `Impuesto FL (${FL_TAX_RATE_LABEL})` : `FL Sales Tax (${FL_TAX_RATE_LABEL})`)
              : (isEs ? 'Impuesto FL' : 'FL Sales Tax')}
          </span>
          <span>{subtotal > 0 ? formatCheckoutCurrency(tax) : '-'}</span>
        </div>
        <div className="flex justify-between pt-2 mt-2 font-bold text-base" style={{ borderTop: `1px solid ${BORDER}`, color: 'var(--color-on-surface)' }}>
          <span>{isEs ? 'Total estimado' : 'Est. Total'}</span>
          <span style={{ color: GOLD }}>{subtotal > 0 ? formatCheckoutCurrency(total) : '-'}</span>
        </div>
      </div>
    </aside>
  );
}

function SummaryRow({
  item,
  isEs,
  prefix,
  onRemove,
  onSetQuantity,
  expanded = false,
  showAvailability = false,
  hideSoldItemPrices = false,
}: {
  item: CartItem;
  isEs: boolean;
  prefix: string;
  onRemove?: () => void;
  onSetQuantity?: (quantity: number) => void;
  expanded?: boolean;
  showAvailability?: boolean;
  hideSoldItemPrices?: boolean;
}) {
  const title = isEs && item.title_es ? item.title_es : item.title;
  const circa = formatProductItemYear(item.item_year);
  const specs = buildSpecLine(item, isEs);
  const imageFrameBackground = productImagePaddingBackground(item.image_padding);
  const image = normalizeLegacyLocalImageUrl(item.image);
  const qty = purchaseQty(item);
  const stockCap = Math.max(1, normalizeProductQuantity(item.stockQuantity));
  const purchasable = isProductPurchasable(item.status, item.stockQuantity);
  const soldPriceHidden = hideSoldItemPrices && isProductSold(item.status);
  const unitPrice = parsePrice(item.priceLabel);
  const lineTotal = unitPrice === null ? null : unitPrice * qty;
  return (
    <div className={`flex gap-3 items-start ${expanded ? 'rounded-2xl border p-2 md:gap-3 md:p-2.5' : ''}`} style={expanded ? { borderColor: BORDER, background: 'rgba(255, 253, 248, 0.76)' } : undefined}>
      <Link
        href={`${prefix}/shop/${item.id}`}
        className={`relative flex-shrink-0 overflow-hidden rounded-xl ${expanded ? 'h-16 w-16 md:h-20 md:w-20' : 'w-14 h-14'}`}
        style={{ background: imageFrameBackground }}
      >
        {image
          ? <Image src={image} alt={title} fill sizes={expanded ? '(max-width: 768px) 64px, 80px' : '56px'} className="object-contain" unoptimized={image.startsWith('/assets/')} />
          : <div className="w-full h-full flex items-center justify-center text-xs opacity-40">Photo</div>}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="min-w-0">
          <Link
            href={`${prefix}/shop/${item.id}`}
            className={`${expanded ? 'text-[0.8rem] md:text-sm line-clamp-2' : 'text-xs line-clamp-2'} hover-underline-grow font-bold leading-snug`}
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            {title}
          </Link>
          <p className={`${expanded ? 'text-xs' : 'text-[0.68rem]'} flex-shrink-0 font-bold`} style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
            {soldPriceHidden ? (isEs ? 'Vendido' : 'Sold') : item.priceLabel}
            {!soldPriceHidden && qty > 1 && lineTotal !== null && (
              <span style={{ color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>
                {' '}× {qty} = {formatCheckoutCurrency(lineTotal)}
              </span>
            )}
          </p>
          {expanded && (circa || specs) && (
            <p className="mt-0.5 truncate text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
              {circa && <span className="normal-case">Ca. {circa}</span>}
              {circa && specs && ' · '}
              {specs}
            </p>
          )}
          {showAvailability && !purchasable && (
            <p className="mt-0.5 text-[0.68rem] font-bold uppercase tracking-wide" style={{ color: 'var(--color-error)', fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Agotado — ya no disponible' : 'Sold out — no longer available'}
            </p>
          )}
          {showAvailability && purchasable && stockCap <= 1 && (
            <p className="mt-0.5 text-[0.68rem] font-bold uppercase tracking-wide" style={{ color: AVAILABLE_GREEN, fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Disponible' : 'In stock'}
            </p>
          )}
          {onSetQuantity && stockCap > 1 ? (
            <div className="mt-1.5 flex items-center gap-2">
              <QuantityStepper
                value={qty}
                max={stockCap}
                onChange={onSetQuantity}
                isEs={isEs}
              />
              <span className="text-[0.62rem] font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                {stockCap} {isEs ? 'en stock' : 'in stock'}
              </span>
            </div>
          ) : qty > 1 ? (
            <p className="mt-0.5 text-[0.68rem] font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Cantidad' : 'Qty'}: {qty}
            </p>
          ) : null}
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center transition-colors hover:text-[color:var(--color-error)]"
          style={{ color: 'var(--color-on-surface-variant)' }}
          aria-label={isEs ? `Eliminar ${title}` : `Remove ${title}`}
          title={isEs ? 'Eliminar' : 'Remove'}
        >
          <AppIcon name="close"  aria-hidden="true" style={{ fontSize: '18px' }} />
        </button>
      )}
    </div>
  );
}

export function QuantityStepper({
  value,
  max,
  onChange,
  isEs,
}: {
  value: number;
  max: number;
  onChange: (quantity: number) => void;
  isEs: boolean;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(1, n));
  const btn: React.CSSProperties = {
    width: '1.6rem',
    height: '1.6rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    border: `1px solid ${BORDER}`,
    background: 'var(--color-background)',
    color: GOLD,
    lineHeight: 1,
  };
  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label={isEs ? 'Cantidad' : 'Quantity'}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= 1}
        className="checkout-quantity-button"
        style={{ ...btn, opacity: value <= 1 ? 0.4 : 1, cursor: value <= 1 ? 'not-allowed' : 'pointer' }}
        aria-label={isEs ? 'Disminuir cantidad' : 'Decrease quantity'}
      >
        <AppIcon name="remove"  aria-hidden="true" style={{ fontSize: '15px' }} />
      </button>
      <span
        className="text-sm font-bold tabular-nums"
        style={{ minWidth: '1.4rem', textAlign: 'center', color: 'var(--color-on-surface)', fontFamily: 'var(--font-label)' }}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className="checkout-quantity-button"
        style={{ ...btn, opacity: value >= max ? 0.4 : 1, cursor: value >= max ? 'not-allowed' : 'pointer' }}
        aria-label={isEs ? 'Aumentar cantidad' : 'Increase quantity'}
      >
        <AppIcon name="add"  aria-hidden="true" style={{ fontSize: '15px' }} />
      </button>
    </div>
  );
}

function buildSpecLine(item: CartItem, isEs: boolean): string | null {
  const category = item.category ?? (item.purity && item.purity > 24 ? 'Silver' : 'Gold');
  const jewelryType = inferProductJewelryType({
    title: item.title,
    title_es: item.title_es,
    chain_type: item.chain_type ?? null,
    tags: item.tags ?? [],
    tags_es: item.tags_es ?? [],
    jewelry_type: item.jewelry_type ?? null,
    product_type: item.product_type ?? null,
  });
  const purity = formatPurity(item.purity, category, isEs);
  const metal = item.metal_variant ? productMetalVariantLabel(item.metal_variant, category, isEs ? 'es' : 'en') : null;
  const length = productLengthSizeDisplay({
    length: item.length ?? null,
    tags: item.tags ?? [],
    jewelry_type: item.jewelry_type ?? null,
    product_type: item.product_type ?? null,
    title: item.title,
    title_es: item.title_es,
    chain_type: item.chain_type ?? null,
    tags_es: item.tags_es ?? [],
  });
  const weight = formatWeight(item.gram_weight ?? item.weight_grams ?? null);
  const productType = productJewelryTypeLabel(jewelryType, isEs ? 'es' : 'en');
  const parts = [
    purity,
    metal,
    productType,
    item.chain_type,
    length,
    weight,
    item.brand,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part);

  const uniqueParts = parts.filter((part, index) => parts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index);
  return uniqueParts.length > 0 ? uniqueParts.join(' · ') : null;
}

function formatPurity(purity: number | null | undefined, category: CartItem['category'], isEs: boolean): string | null {
  if (!purity) return null;
  if (category === 'Silver' && purity >= 100) {
    return purity === 925 ? `925 ${isEs ? 'esterlina' : 'sterling'}` : `${purity}`;
  }
  return `${purity}K`;
}

function formatWeight(weight: number | null | undefined): string | null {
  if (!weight) return null;
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: weight % 1 === 0 ? 0 : 2,
  }).format(weight)}g`;
}
