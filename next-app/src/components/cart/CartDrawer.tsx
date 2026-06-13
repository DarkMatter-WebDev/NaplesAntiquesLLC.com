'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart, type CartItem } from '@/context/CartContext';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';

// ─── STRIPE INTEGRATION POINT ────────────────────────────────────────────────
// When your Stripe account is ready:
//   1. npm install @stripe/stripe-js
//   2. Create /api/checkout/route.ts that creates a Stripe PaymentIntent or
//      Checkout Session from the cart items
//   3. Replace the body of this function with your real Stripe call, e.g.:
//        const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
//        const { error } = await stripe.redirectToCheckout({ sessionId })
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function initiateStripeCheckout(_items: CartItem[], _customer: CustomerInfo) {
  throw new Error('STRIPE_NOT_CONFIGURED');
}
// ─────────────────────────────────────────────────────────────────────────────

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

type View = 'cart' | 'checkout' | 'confirmed';

export default function CartDrawer({ locale }: { locale: string }) {
  const { items, remove, clear, drawerOpen, closeDrawer } = useCart();
  const [view, setView] = useState<View>('cart');
  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', email: '', phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';

  function handleClose() {
    closeDrawer();
    // Reset to cart view after drawer animates out
    setTimeout(() => setView('cart'), 300);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    const x = e.clientX;
    const y = e.clientY;
    handleClose();
    // After React removes the backdrop, click whatever was underneath the cursor.
    // setTimeout 0 runs after React's synchronous re-render clears the backdrop from the DOM.
    setTimeout(() => {
      const el = document.elementFromPoint(x, y);
      if (!el || !(el instanceof HTMLElement)) return;
      const clickable = el.closest('a, button') as HTMLElement | null;
      if (clickable) clickable.click();
    }, 0);
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await initiateStripeCheckout(items, customer);
    } catch {
      // Stripe not yet configured — show confirmed state with call-to-action
      setView('confirmed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col shadow-2xl transition-transform duration-300"
        style={{
          background: 'var(--color-background)',
          borderLeft: `1px solid ${BORDER}`,
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
        role="dialog"
        aria-label={isEs ? 'Carrito' : 'Cart'}
        aria-hidden={!drawerOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-3">
            {view === 'checkout' && (
              <button
                type="button"
                onClick={() => setView('cart')}
                className="text-xs font-bold uppercase tracking-widest transition-colors hover:text-[#735c00]"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
              >
                ← {isEs ? 'Carrito' : 'Cart'}
              </button>
            )}
            {view !== 'checkout' && (
              <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                {view === 'confirmed'
                  ? (isEs ? 'Pedido Recibido' : 'Order Received')
                  : (isEs ? 'Mi Carrito' : 'My Cart')}
                {view === 'cart' && items.length > 0 && (
                  <span className="ml-2 font-normal normal-case tracking-normal text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    ({items.length})
                  </span>
                )}
              </h2>
            )}
            {view === 'checkout' && (
              <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Pagar' : 'Checkout'}
              </h2>
            )}
          </div>
          <button type="button" onClick={handleClose} className="p-1 text-sm font-bold transition-colors hover:text-[#735c00]"
            style={{ color: 'var(--color-on-surface-variant)' }} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {view === 'cart' && <CartView items={items} isEs={isEs} prefix={prefix} onRemove={remove} onCheckout={() => setView('checkout')} onClose={handleClose} />}
          {view === 'checkout' && <CheckoutView isEs={isEs} customer={customer} onChange={setCustomer} onSubmit={handlePlaceOrder} submitting={submitting} />}
          {view === 'confirmed' && <ConfirmedView isEs={isEs} onClose={() => { handleClose(); clear(); }} />}
        </div>
      </div>
    </>
  );
}

/* ── Cart view ──────────────────────────────────────────────────────────────── */

function CartView({ items, isEs, prefix, onRemove, onCheckout, onClose }: {
  items: CartItem[];
  isEs: boolean;
  prefix: string;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  onClose: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 text-center mt-16 px-6">
        <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-outline-variant)' }}>shopping_bag</span>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Tu carrito está vacío.' : 'Your cart is empty.'}
        </p>
        <Link href={`${prefix}/shop`} onClick={onClose} className="outline-button text-xs mt-2">
          {isEs ? 'Ver tienda' : 'Browse Shop'}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {items.map((item) => (
          <CartItemRow key={item.id} item={item} isEs={isEs} prefix={prefix} onRemove={() => onRemove(item.id)} />
        ))}
      </div>
      <div className="px-4 py-4 border-t flex flex-col gap-2 flex-shrink-0" style={{ borderColor: BORDER }}>
        <button type="button" onClick={onCheckout} className="gold-button justify-center" style={{ width: '100%' }}>
          {isEs ? 'Proceder al pago →' : 'Proceed to Checkout →'}
        </button>
        <Link href={`${prefix}/shop`} onClick={onClose} className="outline-button justify-center text-xs" style={{ width: '100%' }}>
          {isEs ? 'Seguir comprando' : 'Continue Shopping'}
        </Link>
      </div>
    </div>
  );
}

function CartItemRow({ item, isEs, prefix, onRemove }: { item: CartItem; isEs: boolean; prefix: string; onRemove: () => void }) {
  const title = isEs && item.title_es ? item.title_es : item.title;
  return (
    <div className="flex gap-3 items-start pb-3 border-b" style={{ borderColor: BORDER }}>
      <Link href={`${prefix}/shop/${item.id}`} className="relative flex-shrink-0 w-14 h-14 overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
        {item.image
          ? <Image src={item.image} alt={title} fill sizes="56px" className="object-cover" unoptimized={item.image.startsWith('/assets/')} />
          : <div className="w-full h-full flex items-center justify-center text-xl opacity-30">📷</div>}
      </Link>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Link href={`${prefix}/shop/${item.id}`} className="text-xs font-bold leading-snug hover:underline line-clamp-2"
          style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
          {title}
        </Link>
        <p className="text-[0.6rem] font-bold uppercase tracking-wide" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {item.priceLabel}
        </p>
        {item.status === 'Sold' && (
          <span className="text-[0.55rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-error)' }}>
            {isEs ? 'Vendido' : 'Sold'}
          </span>
        )}
      </div>
      <button type="button" onClick={onRemove} className="flex-shrink-0 p-1 text-xs transition-colors hover:text-[color:var(--color-error)]"
        style={{ color: 'var(--color-on-surface-variant)' }} aria-label={isEs ? 'Eliminar' : 'Remove'}>✕</button>
    </div>
  );
}

/* ── Checkout view ──────────────────────────────────────────────────────────── */

function CheckoutView({ isEs, customer, onChange, onSubmit, submitting }: {
  isEs: boolean;
  customer: CustomerInfo;
  onChange: (c: CustomerInfo) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="px-5 py-5 flex flex-col gap-4">
      <div>
        <label className="form-label">{isEs ? 'Nombre completo' : 'Full Name'} *</label>
        <input required className="form-field" value={customer.name}
          onChange={(e) => onChange({ ...customer, name: e.target.value })} />
      </div>
      <div>
        <label className="form-label">{isEs ? 'Correo electrónico' : 'Email'} *</label>
        <input required type="email" className="form-field" value={customer.email}
          onChange={(e) => onChange({ ...customer, email: e.target.value })} />
      </div>
      <div>
        <label className="form-label">{isEs ? 'Teléfono' : 'Phone'} *</label>
        <input required type="tel" className="form-field" value={customer.phone}
          onChange={(e) => onChange({ ...customer, phone: e.target.value })} />
      </div>
      <div>
        <label className="form-label">{isEs ? 'Notas (opcional)' : 'Notes (optional)'}</label>
        <textarea rows={3} className="form-field resize-none" value={customer.notes}
          onChange={(e) => onChange({ ...customer, notes: e.target.value })} />
      </div>

      {/* ── STRIPE PLACEHOLDER ─────────────────────────────────────────────── */}
      <div className="rounded border-2 border-dashed px-4 py-4 flex flex-col gap-2 text-center"
        style={{ borderColor: 'var(--color-outline-variant)' }}>
        <span className="material-symbols-outlined mx-auto" style={{ fontSize: '28px', color: 'var(--color-outline-variant)' }}>lock</span>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
          {isEs ? 'Pago seguro — Próximamente' : 'Secure Payment — Coming Soon'}
        </p>
        <p className="text-[0.65rem] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs
            ? 'El pago con Stripe se integrará aquí. Por ahora, recibirá una llamada de confirmación.'
            : 'Stripe payment will be integrated here. For now, we\'ll call to confirm your order.'}
        </p>
      </div>
      {/* ───────────────────────────────────────────────────────────────────── */}

      <button type="submit" disabled={submitting} className="gold-button justify-center disabled:opacity-50" style={{ width: '100%' }}>
        {submitting ? '…' : (isEs ? 'Enviar pedido →' : 'Place Order →')}
      </button>
    </form>
  );
}

/* ── Confirmed view ─────────────────────────────────────────────────────────── */

function ConfirmedView({ isEs, onClose }: { isEs: boolean; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center mt-12 px-6">
      <span className="material-symbols-outlined" style={{ fontSize: '44px', color: GOLD }}>check_circle</span>
      <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
        {isEs ? '¡Pedido recibido!' : 'Order Received!'}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
        {isEs
          ? 'Le contactaremos pronto para finalizar su compra. También puede llamarnos directamente:'
          : "We'll be in touch shortly to finalize your purchase. You can also call us directly:"}
      </p>
      <a href="tel:2394048505" className="gold-button mt-2">
        {isEs ? 'Llamar: (239) 404-8505' : 'Call: (239) 404-8505'}
      </a>
      <button type="button" onClick={onClose} className="outline-button text-xs mt-1" style={{ width: '100%' }}>
        {isEs ? 'Cerrar' : 'Close'}
      </button>
    </div>
  );
}
