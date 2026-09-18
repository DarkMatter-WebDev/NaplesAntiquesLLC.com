'use client';

import { useState } from 'react';
import Image from 'next/image';
import { formatCurrency, formatOrderDate, formatPublicPurity, orderStatusLabel } from '@/types/sales';
import type { PublicOrderView } from '@/lib/order-lookup';
import { AppIcon } from '@/components/AppIcon';

/**
 * Guest order lookup: order number + the email or phone on the order → the
 * order, right here. No account needed (owner, 2026-09-17: "most people never
 * make an account"). The receipt and shipping emails link here with the
 * order number prefilled.
 */
export default function OrderLookupForm({ locale, initialOrderNumber }: { locale: string; initialOrderNumber?: string }) {
  const isEs = locale === 'es';
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber ?? '');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<PublicOrderView | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, contact }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.order) {
        setError(data.error ?? (isEs ? 'No encontramos ese pedido.' : 'We could not find that order.'));
        return;
      }
      setOrder(data.order as PublicOrderView);
    } catch {
      setError(isEs ? 'No se pudo conectar. Inténtelo de nuevo.' : 'Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const label = 'form-label';
  const card: React.CSSProperties = { borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' };
  const muted: React.CSSProperties = { color: 'var(--color-on-surface-variant)' };

  const deliveryLabel = (kind: string) => {
    switch (kind) {
      case 'pickup': return isEs ? 'Recogida en la tienda' : 'Local Pickup';
      case 'local_delivery': return isEs ? 'Entrega local' : 'Local Delivery';
      case 'express': return isEs ? 'Express nocturno asegurado' : 'Express Overnight Insured';
      case 'priority': return isEs ? 'Envío asegurado' : 'Insured Shipping';
      case 'registered': return isEs ? 'Envío asegurado (Registered Mail)' : 'Insured Shipping (Registered Mail)';
      default: return isEs ? 'Envío' : 'Shipping';
    }
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={onSubmit} className="rounded-[1.25rem] border p-5 md:p-6 grid gap-4" style={card}>
        <label className="block">
          <span className={label}>{isEs ? 'Número de pedido' : 'Order number'}</span>
          <input
            className="form-field"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="NEJ-20260917-ABCDE"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
          />
          <span className="mt-1 block text-xs" style={muted}>
            {isEs ? 'Está en el asunto y en el cuerpo de su recibo por correo.' : 'It is in the subject line and body of your receipt email.'}
          </span>
        </label>
        <label className="block">
          <span className={label}>{isEs ? 'Correo o teléfono del pedido' : 'Email or phone on the order'}</span>
          <input
            className="form-field"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={isEs ? 'nombre@ejemplo.com o (239) 555-0134' : 'name@example.com or (239) 555-0134'}
            autoComplete="email"
            required
          />
        </label>
        {error && (
          <div className="rounded-lg px-3 py-2 text-sm" role="alert" style={{ background: 'color-mix(in srgb, var(--color-error) 10%, transparent)', color: 'var(--color-error)' }}>
            {error}
          </div>
        )}
        <div>
          <button type="submit" className="gold-button" disabled={busy}>
            {busy ? (isEs ? 'Buscando…' : 'Looking up…') : (isEs ? 'Ver mi pedido' : 'Find my order')}
          </button>
        </div>
      </form>

      {order && (
        <section className="rounded-[1.25rem] border p-5 md:p-6 grid gap-5" style={card} aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Pedido' : 'Order'}
              </p>
              <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>{order.orderNumber}</h2>
              <p className="text-xs" style={muted}>{formatOrderDate(order.placedAt)}{order.firstName ? ` · ${order.firstName}` : ''}</p>
            </div>
            <div className="text-right text-sm">
              <div><span style={muted}>{isEs ? 'Pago: ' : 'Payment: '}</span><strong>{orderStatusLabel(order.paymentStatus)}</strong></div>
              <div><span style={muted}>{isEs ? 'Estado: ' : 'Status: '}</span><strong>{orderStatusLabel(order.fulfillmentStatus)}</strong></div>
            </div>
          </div>

          {(order.trackingNumber || order.fulfillmentStatus === 'shipped') && (
            <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-primary)', background: '#fffbe8' }}>
              <div className="font-bold" style={{ color: 'var(--color-on-surface)' }}>
                {isEs ? 'Enviado' : 'Shipped'}{order.carrier ? ` · ${order.carrier}` : ''}
              </div>
              {order.trackingNumber && (
                <div className="mt-1">
                  {isEs ? 'Rastreo: ' : 'Tracking: '}
                  {order.trackingUrl ? (
                    <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: 'var(--color-primary)' }}>
                      {order.trackingNumber}
                    </a>
                  ) : (
                    <strong>{order.trackingNumber}</strong>
                  )}
                </div>
              )}
            </div>
          )}

          <ul className="grid gap-3">
            {order.items.map((item, i) => (
              <li key={i} className="flex gap-3 items-center">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-outline-variant)', background: '#fff' }}>
                  {item.image ? (
                    <Image src={item.image} alt="" fill sizes="64px" className="object-contain" unoptimized={item.image.startsWith('/assets/')} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center" style={muted}><AppIcon name="photo_camera" aria-hidden="true" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-semibold leading-snug" style={{ color: 'var(--color-on-surface)' }}>{item.title}</div>
                  <div className="text-xs" style={muted}>
                    {[item.metal, formatPublicPurity(item.purity), item.grams ? `${item.grams}g` : null, item.quantity > 1 ? `${isEs ? 'Cant.' : 'Qty'} ${item.quantity}` : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(item.unitPrice * item.quantity)}</div>
              </li>
            ))}
          </ul>

          <div className="grid gap-1 text-sm border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <Row label={isEs ? 'Subtotal' : 'Subtotal'} value={formatCurrency(order.subtotal)} />
            {order.discount > 0 && <Row label={isEs ? 'Descuento' : 'Discount'} value={`−${formatCurrency(order.discount)}`} />}
            <Row label={deliveryLabel(order.deliveryKind)} value={order.shippingFee > 0 ? formatCurrency(order.shippingFee) : (isEs ? 'Gratis' : 'Free')} />
            <Row label={isEs ? 'Impuesto' : 'Tax'} value={formatCurrency(order.tax)} />
            <div className="flex justify-between border-t pt-2 mt-1 text-lg font-bold" style={{ borderColor: 'var(--color-outline-variant)', fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              <span>Total</span><span>{formatCurrency(order.total)}</span>
            </div>
          </div>

          {order.shippingAddress && (
            <div className="text-sm">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Dirección de envío' : 'Shipping address'}
              </p>
              <p style={{ color: 'var(--color-on-surface)' }}>{order.shippingAddress}</p>
            </div>
          )}
          {order.deliveryKind === 'pickup' && (
            <p className="text-sm" style={muted}>
              {isEs ? 'Recogida en nuestra tienda, 6240 Shirley St, Ste 104, Naples, FL 34109.' : 'Pickup at our showroom, 6240 Shirley St, Ste 104, Naples, FL 34109.'}
            </p>
          )}
          <p className="text-xs" style={muted}>
            {isEs ? '¿Preguntas? Llame o envíe un mensaje al (239) 404-8505.' : 'Questions? Call or text (239) 404-8505.'}
          </p>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <span style={{ color: 'var(--color-on-surface)' }}>{value}</span>
    </div>
  );
}
