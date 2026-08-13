'use client';

import { useState } from 'react';
import type { CartItem } from '@/context/CartContext';
import { AppIcon } from '@/components/AppIcon';
import { formatDiscountValue, normalizeDiscountCode, type AppliedDiscount } from '@/lib/discount-codes';
import { normalizeProductQuantity } from '@/types/product';

const GOLD = '#735c00';
const GREEN = '#2e7d32';

/**
 * ⚠️ Tailwind font-size and font-weight utilities DO NOTHING on a <button> in
 * this app. `globals.css:144` sets `button, input, select, textarea { font:
 * inherit }` OUTSIDE any cascade layer, and un-layered rules beat every
 * `@layer utilities` rule regardless of specificity. So `text-[0.68rem]` and
 * `font-bold` on a button are silently dropped.
 *
 * The giveaway is that `letter-spacing` and `text-decoration` still work —
 * neither is part of the `font` shorthand — which makes a broken button look
 * half-styled rather than unstyled, and is exactly how this shipped wrong.
 *
 * Font properties on a button therefore go in `style` (inline beats layers) or
 * in real CSS. These values match `.checkout-recap-edit`, the existing "Edit
 * cart" link this control sits directly beneath, so the two read as a pair.
 */
const BUTTON_LABEL_FONT = {
  fontFamily: 'var(--font-label)',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
} as const;

/**
 * Checkout discount-code entry.
 *
 * The applied discount this produces is DISPLAY ONLY. It is handed to
 * OrderSummary so the shopper sees the reduced total, and its `code` string is
 * sent with the order — but the server re-reads the code and recomputes the
 * amount at order time, so nothing here can change what is charged.
 */
export default function DiscountCodeField({
  items,
  shippingMethod,
  shippingState,
  email,
  isEs,
  applied,
  onApplied,
  onCleared,
}: {
  items: CartItem[];
  shippingMethod: string;
  shippingState?: string;
  email?: string;
  isEs: boolean;
  applied: AppliedDiscount | null;
  onApplied: (discount: AppliedDiscount) => void;
  onCleared: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeDiscountCode(code);
    if (!normalized) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout/discount-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: normalized,
          items: items.map((item) => ({
            id: item.id,
            quantity: Math.max(1, normalizeProductQuantity(item.purchaseQuantity)),
          })),
          shippingMethod,
          shippingState,
          email,
          locale: isEs ? 'es' : 'en',
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          data?.error
            ?? (isEs ? 'No se pudo aplicar el código.' : 'That code couldn’t be applied.'),
        );
        return;
      }
      if (!data.ok) {
        setError(data.message ?? (isEs ? 'No se pudo aplicar el código.' : 'That code couldn’t be applied.'));
        return;
      }

      onApplied(data.discount as AppliedDiscount);
      setCode('');
    } catch {
      setError(
        isEs
          ? 'No se pudo conectar. Inténtelo de nuevo.'
          : 'Couldn’t reach the server. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    return (
      <div
        className="flex items-center justify-between gap-3"
        style={{
          border: `1px solid color-mix(in srgb, ${GREEN} 40%, transparent)`,
          background: `color-mix(in srgb, ${GREEN} 7%, transparent)`,
          borderRadius: 'var(--radius-lg)',
          padding: '0.6rem 0.75rem',
        }}
      >
        <span className="flex items-center gap-2 text-xs" style={{ color: GREEN, fontWeight: 600 }}>
          <AppIcon name="check_circle" aria-hidden="true" style={{ fontSize: '1rem', flexShrink: 0 }} />
          <span>
            <strong>{applied.code}</strong>{' '}
            {formatDiscountValue(applied.type, applied.value, isEs)}
          </span>
        </span>
        <button
          type="button"
          onClick={onCleared}
          style={{
            ...BUTTON_LABEL_FONT,
            color: GOLD,
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          {isEs ? 'Quitar' : 'Remove'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={apply} className="flex flex-col gap-2">
      <label
        htmlFor="checkout-discount-code"
        className="text-[0.62rem] font-bold uppercase tracking-[0.18em]"
        style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
      >
        {isEs ? 'Código de descuento' : 'Discount code'}
      </label>
      <div className="flex gap-2">
        <input
          id="checkout-discount-code"
          name="discount-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          placeholder={isEs ? 'Ingrese el código' : 'Enter code'}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={busy}
          className="flex-1 min-w-0"
          style={{
            border: '1px solid var(--color-outline-variant)',
            background: 'white',
            padding: '0.5rem 0.6rem',
            fontSize: '0.8125rem',
            textTransform: 'uppercase',
            color: 'var(--color-on-surface)',
            borderRadius: 'var(--radius-lg)',
          }}
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="px-4"
          style={{
            ...BUTTON_LABEL_FONT,
            border: `1px solid ${GOLD}`,
            background: 'transparent',
            color: GOLD,
            borderRadius: 'var(--radius-lg)',
            opacity: busy || !code.trim() ? 0.5 : 1,
            cursor: busy || !code.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {busy ? (isEs ? 'Verificando…' : 'Checking…') : (isEs ? 'Aplicar' : 'Apply')}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      )}
    </form>
  );
}
