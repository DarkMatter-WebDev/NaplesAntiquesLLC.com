'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CartItem } from '@/context/CartContext';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import { chargesFlSalesTax, FL_TAX_RATE, FL_TAX_RATE_LABEL } from '@/lib/checkout-pricing';
import { parseManualPriceLabelValue } from '@/lib/pricing';
import {
  inferProductJewelryType,
  formatProductItemYear,
  normalizeProductQuantity,
  productJewelryTypeLabel,
  productLengthSizeDisplay,
  productImagePaddingBackground,
  productMetalVariantLabel,
} from '@/types/product';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';

export const SHIPPING_OPTIONS = [
  { value: 'local-pickup', labelEn: 'Local Pickup', labelEs: 'Recogida local', price: 0 },
  { value: 'express-overnight-insured', labelEn: 'Express Overnight Insured', labelEs: 'Express nocturno asegurado', price: 75 },
  { value: 'priority-insured', labelEn: 'Priority Insured', labelEs: 'Prioritario asegurado', price: 45 },
];

function parsePrice(label: string): number | null {
  return parseManualPriceLabelValue(label);
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
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
}) {
  const lineTotals = items.map((i) => {
    const unit = parsePrice(i.priceLabel);
    return unit === null ? null : unit * purchaseQty(i);
  });
  const knownLineTotals = lineTotals.filter((p): p is number => p !== null);
  const hasUnknown = knownLineTotals.length < lineTotals.length;
  const subtotal = knownLineTotals.reduce((a, b) => a + b, 0);
  const tax = chargesFlSalesTax(shippingMethod, shippingState) ? subtotal * FL_TAX_RATE : 0;
  const selectedShipping = SHIPPING_OPTIONS.find((option) => option.value === shippingMethod) ?? SHIPPING_OPTIONS[0];
  const shipping = selectedShipping.price;
  const total = subtotal + tax + shipping;

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
          />
        ))}
      </div>
      <div className={`${expanded ? 'ml-auto max-w-md rounded-2xl bg-[rgba(255,253,248,0.78)] px-3.5 py-3 shadow-[0_12px_34px_rgba(38,28,6,0.05)]' : ''} flex flex-col gap-1 text-xs border-t pt-3`} style={{ borderColor: BORDER, fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}>
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{subtotal > 0 ? fmt(subtotal) : '-'}{hasUnknown ? '*' : ''}</span>
        </div>
        <div className="flex justify-between">
          <span>
            {tax > 0
              ? (isEs ? `Impuesto FL (${FL_TAX_RATE_LABEL})` : `FL Sales Tax (${FL_TAX_RATE_LABEL})`)
              : (isEs ? 'Impuesto FL' : 'FL Sales Tax')}
          </span>
          <span>{subtotal > 0 ? fmt(tax) : '-'}</span>
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
              {SHIPPING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {isEs ? option.labelEs : option.labelEn}
                </option>
              ))}
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
        <div className="flex justify-between">
          <span>{isEs ? 'Costo de envío' : 'Shipping Cost'}</span>
          <span>{fmt(shipping)}</span>
        </div>
        <div className="flex justify-between pt-2 mt-2 font-bold text-base" style={{ borderTop: `1px solid ${BORDER}`, color: 'var(--color-on-surface)' }}>
          <span>{isEs ? 'Total estimado' : 'Est. Total'}</span>
          <span style={{ color: GOLD }}>{subtotal > 0 ? fmt(total) : '-'}</span>
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
}: {
  item: CartItem;
  isEs: boolean;
  prefix: string;
  onRemove?: () => void;
  onSetQuantity?: (quantity: number) => void;
  expanded?: boolean;
}) {
  const title = isEs && item.title_es ? item.title_es : item.title;
  const circa = formatProductItemYear(item.item_year);
  const specs = buildSpecLine(item, isEs);
  const imageFrameBackground = productImagePaddingBackground(item.image_padding);
  const image = normalizeLegacyLocalImageUrl(item.image);
  const qty = purchaseQty(item);
  const stockCap = Math.max(1, normalizeProductQuantity(item.stockQuantity));
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
            className={`${expanded ? 'text-[0.8rem] md:text-sm line-clamp-2' : 'text-xs line-clamp-2'} font-bold leading-snug hover:underline`}
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            {title}
          </Link>
          <p className={`${expanded ? 'text-xs' : 'text-[0.68rem]'} flex-shrink-0 font-bold`} style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
            {item.priceLabel}
            {qty > 1 && lineTotal !== null && (
              <span style={{ color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>
                {' '}× {qty} = {fmt(lineTotal)}
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
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '18px' }}>
            close
          </span>
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
        style={{ ...btn, opacity: value <= 1 ? 0.4 : 1, cursor: value <= 1 ? 'not-allowed' : 'pointer' }}
        aria-label={isEs ? 'Disminuir cantidad' : 'Decrease quantity'}
      >
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '15px' }}>remove</span>
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
        style={{ ...btn, opacity: value >= max ? 0.4 : 1, cursor: value >= max ? 'not-allowed' : 'pointer' }}
        aria-label={isEs ? 'Aumentar cantidad' : 'Increase quantity'}
      >
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '15px' }}>add</span>
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
