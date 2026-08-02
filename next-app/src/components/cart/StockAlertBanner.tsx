'use client';

import type { StockAlert } from '@/context/CartContext';
import { AppIcon } from '@/components/AppIcon';

const GOLD = '#735c00';

/**
 * Heads-up shown in the cart drawer and at checkout when a re-check found that an
 * item went out of stock or dropped below the requested quantity while it sat in
 * the shopper's cart. Purely informational — the actual item rows and the pay
 * button reflect the same live state.
 */
export default function StockAlertBanner({
  alerts,
  isEs,
  onDismiss,
}: {
  alerts: StockAlert[];
  isEs: boolean;
  onDismiss?: () => void;
}) {
  if (alerts.length === 0) return null;
  const soldOut = alerts.filter((alert) => alert.kind === 'sold-out');
  const reduced = alerts.filter((alert) => alert.kind === 'reduced');

  return (
    <div
      role="alert"
      className="flex items-start gap-2 text-xs"
      style={{
        padding: '0.7rem 0.8rem',
        border: '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)',
        background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--color-on-surface)',
      }}
    >
      <AppIcon name="error"  aria-hidden="true" style={{ fontSize: '1.1rem', lineHeight: 1.2, color: 'var(--color-error)', flexShrink: 0 }} />
      <div className="flex-1">
        <p className="font-bold uppercase tracking-widest" style={{ color: 'var(--color-error)', fontFamily: 'var(--font-label)', fontSize: '0.62rem' }}>
          {isEs ? 'Cambió la disponibilidad' : 'Availability changed'}
        </p>
        {soldOut.length > 0 && (
          <p className="mt-1 leading-relaxed">
            {isEs ? 'Ya no está disponible: ' : 'No longer available: '}
            <strong>{soldOut.map((alert) => alert.title).join(', ')}</strong>
            {'. '}
            {isEs ? 'Elimínelo del carrito para continuar.' : 'Remove it from your cart to continue.'}
          </p>
        )}
        {reduced.map((alert) => (
          <p key={alert.id} className="mt-1 leading-relaxed">
            <strong>{alert.title}</strong>
            {isEs
              ? `: solo quedan ${alert.available} — ajustamos su cantidad.`
              : `: only ${alert.available} left — we adjusted your quantity.`}
          </p>
        ))}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={isEs ? 'Descartar' : 'Dismiss'}
          className="stock-alert-dismiss flex-shrink-0"
          style={{ color: GOLD, lineHeight: 1 }}
        >
          <AppIcon name="close"  aria-hidden="true" style={{ fontSize: '1rem' }} />
        </button>
      )}
    </div>
  );
}
