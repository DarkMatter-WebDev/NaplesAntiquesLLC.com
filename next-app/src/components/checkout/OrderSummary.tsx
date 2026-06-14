'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CartItem } from '@/context/CartContext';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';
const FL_TAX = 0.07;

export const SHIPPING_OPTIONS = [
  { value: 'local-pickup', labelEn: 'Local Pickup', labelEs: 'Recogida local', price: 0 },
  { value: 'express-overnight-insured', labelEn: 'Express Overnight Insured', labelEs: 'Express nocturno asegurado', price: 75 },
  { value: 'priority-insured', labelEn: 'Priority Insured', labelEs: 'Prioritario asegurado', price: 45 },
];

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

export default function OrderSummary({
  items,
  isEs,
  prefix,
  shippingMethod,
  onShippingMethodChange,
  onRemove,
}: {
  items: CartItem[];
  isEs: boolean;
  prefix: string;
  shippingMethod: string;
  onShippingMethodChange?: (value: string) => void;
  onRemove?: (id: string) => void;
}) {
  const prices = items.map((i) => parsePrice(i.priceLabel));
  const knownPrices = prices.filter((p): p is number => p !== null);
  const hasUnknown = knownPrices.length < prices.length;
  const subtotal = knownPrices.reduce((a, b) => a + b, 0);
  const tax = subtotal * FL_TAX;
  const selectedShipping = SHIPPING_OPTIONS.find((option) => option.value === shippingMethod) ?? SHIPPING_OPTIONS[0];
  const shipping = selectedShipping.price;
  const total = subtotal + tax + shipping;

  return (
    <aside className="border p-4 md:p-5 lg:sticky lg:top-24" style={{ borderColor: BORDER, background: 'var(--color-surface-container-lowest)' }}>
      <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
        {isEs ? 'Resumen' : 'Order Summary'}
      </h2>
      <div className="flex flex-col gap-3 mb-5">
        {items.map((item) => (
          <SummaryRow
            key={item.id}
            item={item}
            isEs={isEs}
            prefix={prefix}
            onRemove={onRemove ? () => onRemove(item.id) : undefined}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1 text-xs border-t pt-4" style={{ borderColor: BORDER, fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}>
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{subtotal > 0 ? fmt(subtotal) : '-'}{hasUnknown ? '*' : ''}</span>
        </div>
        <div className="flex justify-between">
          <span>{isEs ? 'Impuesto FL (7%)' : 'FL Sales Tax (7%)'}</span>
          <span>{subtotal > 0 ? fmt(tax) : '-'}</span>
        </div>
        <label className="flex flex-col gap-1 pt-2">
          <span>{isEs ? 'Envio' : 'Shipping'}</span>
          <select
            value={selectedShipping.value}
            onChange={(e) => onShippingMethodChange?.(e.target.value)}
            disabled={!onShippingMethodChange}
            className="w-full border px-2 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-100"
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
                {isEs ? option.labelEs : option.labelEn} - {fmt(option.price)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-between">
          <span>{isEs ? 'Costo de envio' : 'Shipping Cost'}</span>
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
}: {
  item: CartItem;
  isEs: boolean;
  prefix: string;
  onRemove?: () => void;
}) {
  const title = isEs && item.title_es ? item.title_es : item.title;
  return (
    <div className="flex gap-3 items-start">
      <Link href={`${prefix}/shop/${item.id}`} className="relative w-14 h-14 flex-shrink-0 overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
        {item.image
          ? <Image src={item.image} alt={title} fill sizes="56px" className="object-contain" unoptimized={item.image.startsWith('/assets/')} />
          : <div className="w-full h-full flex items-center justify-center text-xs opacity-40">Photo</div>}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`${prefix}/shop/${item.id}`} className="text-xs font-bold leading-snug line-clamp-2 hover:underline" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {title}
        </Link>
        <p className="text-[0.68rem] font-bold mt-1" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {item.priceLabel}
        </p>
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
