'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart, type CartItem } from '@/context/CartContext';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';
const FL_TAX = 0.07;

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

async function initiateStripeCheckout(_items: CartItem[], _customer: CustomerInfo) {
  throw new Error('STRIPE_NOT_CONFIGURED');
}

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

export default function CheckoutClient({ locale }: { locale: string }) {
  const { items, clear } = useCart();
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';
  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', email: '', phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await initiateStripeCheckout(items, customer);
    } catch {
      setConfirmed(true);
      clear();
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="max-w-xl mx-auto text-center px-6 py-16">
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: GOLD }}>check_circle</span>
        <h1 className="text-3xl md:text-4xl font-bold mt-4 mb-4" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {isEs ? 'Pedido recibido' : 'Order Received'}
        </h1>
        <p className="leading-relaxed mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs
            ? 'Le contactaremos pronto para finalizar su compra. Tambien puede llamarnos directamente.'
            : "We'll be in touch shortly to finalize your purchase. You can also call us directly."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="tel:2394048505" className="gold-button">
            {isEs ? 'Llamar: (239) 404-8505' : 'Call: (239) 404-8505'}
          </a>
          <Link href={`${prefix}/shop`} className="outline-button">
            {isEs ? 'Volver a la tienda' : 'Back to Shop'}
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center px-6 py-16">
        <span className="material-symbols-outlined" style={{ fontSize: '44px', color: 'var(--color-outline-variant)' }}>shopping_bag</span>
        <h1 className="text-3xl md:text-4xl font-bold mt-4 mb-4" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {isEs ? 'Su carrito esta vacio' : 'Your Cart Is Empty'}
        </h1>
        <p className="mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Agregue un articulo antes de proceder al pago.' : 'Add an item before proceeding to checkout.'}
        </p>
        <Link href={`${prefix}/shop`} className="gold-button">
          {isEs ? 'Ver tienda' : 'Browse Shop'}
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-8 py-10 md:py-16 max-w-6xl">
      <div className="mb-8">
        <Link href={`${prefix}/shop`} className="text-xs font-bold uppercase tracking-widest hover:underline" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {isEs ? '< Volver a la tienda' : '< Back to shop'}
        </Link>
        <h1 className="text-3xl md:text-5xl font-bold mt-4 mb-3" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {isEs ? 'Checkout' : 'Checkout'}
        </h1>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Complete sus datos para reservar los articulos de su carrito.' : 'Complete your details to reserve the items in your cart.'}
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_24rem] gap-8 items-start">
        <form onSubmit={handlePlaceOrder} className="border p-5 md:p-7 flex flex-col gap-4" style={{ borderColor: BORDER, background: 'var(--color-surface-container-lowest)' }}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">{isEs ? 'Nombre completo' : 'Full Name'} *</label>
              <input required className="form-field" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
            </div>
            <div>
              <label className="form-label">{isEs ? 'Telefono' : 'Phone'} *</label>
              <input required type="tel" className="form-field" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="form-label">{isEs ? 'Correo electronico' : 'Email'} *</label>
            <input required type="email" className="form-field" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </div>
          <div>
            <label className="form-label">{isEs ? 'Notas (opcional)' : 'Notes (optional)'}</label>
            <textarea rows={4} className="form-field resize-none" value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />
          </div>

          <div className="rounded border-2 border-dashed px-4 py-4 flex flex-col gap-2 text-center" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <span className="material-symbols-outlined mx-auto" style={{ fontSize: '28px', color: 'var(--color-outline-variant)' }}>lock</span>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Pago seguro - Proximamente' : 'Secure Payment - Coming Soon'}
            </p>
            <p className="text-[0.72rem] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'El pago con Stripe se integrara aqui. Por ahora, recibira una llamada de confirmacion.'
                : "Stripe payment will be integrated here. For now, we'll call to confirm your order."}
            </p>
          </div>

          <button type="submit" disabled={submitting} className="gold-button justify-center disabled:opacity-50" style={{ width: '100%' }}>
            {submitting ? '...' : (isEs ? 'Enviar pedido ->' : 'Place Order ->')}
          </button>
        </form>

        <OrderSummary items={items} isEs={isEs} prefix={prefix} />
      </div>
    </div>
  );
}

function OrderSummary({ items, isEs, prefix }: { items: CartItem[]; isEs: boolean; prefix: string }) {
  const prices = items.map((i) => parsePrice(i.priceLabel));
  const knownPrices = prices.filter((p): p is number => p !== null);
  const hasUnknown = knownPrices.length < prices.length;
  const subtotal = knownPrices.reduce((a, b) => a + b, 0);
  const tax = subtotal * FL_TAX;
  const total = subtotal + tax;

  return (
    <aside className="border p-4 md:p-5 lg:sticky lg:top-24" style={{ borderColor: BORDER, background: 'var(--color-surface-container-lowest)' }}>
      <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
        {isEs ? 'Resumen' : 'Order Summary'}
      </h2>
      <div className="flex flex-col gap-3 mb-5">
        {items.map((item) => (
          <SummaryRow key={item.id} item={item} isEs={isEs} prefix={prefix} />
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
        <div className="flex justify-between pt-2 mt-2 font-bold text-base" style={{ borderTop: `1px solid ${BORDER}`, color: 'var(--color-on-surface)' }}>
          <span>{isEs ? 'Total estimado' : 'Est. Total'}</span>
          <span style={{ color: GOLD }}>{subtotal > 0 ? fmt(total) : '-'}</span>
        </div>
      </div>
    </aside>
  );
}

function SummaryRow({ item, isEs, prefix }: { item: CartItem; isEs: boolean; prefix: string }) {
  const title = isEs && item.title_es ? item.title_es : item.title;
  return (
    <div className="flex gap-3">
      <Link href={`${prefix}/shop/${item.id}`} className="relative w-14 h-14 flex-shrink-0 overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
        {item.image
          ? <Image src={item.image} alt={title} fill sizes="56px" className="object-contain" unoptimized={item.image.startsWith('/assets/')} />
          : <div className="w-full h-full flex items-center justify-center text-xs opacity-40">Photo</div>}
      </Link>
      <div className="min-w-0">
        <Link href={`${prefix}/shop/${item.id}`} className="text-xs font-bold leading-snug line-clamp-2 hover:underline" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {title}
        </Link>
        <p className="text-[0.68rem] font-bold mt-1" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {item.priceLabel}
        </p>
      </div>
    </div>
  );
}
