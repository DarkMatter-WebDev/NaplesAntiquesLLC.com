'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import OrderSummary, { SHIPPING_OPTIONS } from '@/components/checkout/OrderSummary';
import { createClient } from '@/lib/supabase/client';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

export default function CheckoutClient({ locale }: { locale: string }) {
  const { items, remove, clear } = useCart();
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';
  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', email: '', phone: '', notes: '' });
  const [shippingMethod, setShippingMethod] = useState(SHIPPING_OPTIONS[0].value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<{ orderNumber: string; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function prefillCustomerInfo() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const metadata = user.user_metadata ?? {};
      const profileName = profile?.full_name ?? [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
      const knownName = profileName || metadata.full_name || metadata.name || '';
      const knownEmail = profile?.email ?? user.email ?? metadata.email ?? '';
      const knownPhone = profile?.phone ?? user.phone ?? metadata.phone ?? metadata.phone_number ?? '';

      if (cancelled) return;
      setCustomer((current) => ({
        ...current,
        name: current.name || String(knownName || ''),
        email: current.email || String(knownEmail || ''),
        phone: current.phone || String(knownPhone || ''),
      }));
    }

    prefillCustomerInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/checkout/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productIds: items.map((item) => item.id),
        customer,
        shippingMethod,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      setError(data?.error ?? (isEs ? 'No se pudo enviar el pedido.' : 'Could not submit order.'));
      setSubmitting(false);
      return;
    }

    clear();
    setCreatedOrder({ orderNumber: data.orderNumber, total: data.total });
    setSubmitting(false);
  }

  if (createdOrder) {
    return (
      <div className="max-w-xl mx-auto text-center px-6 py-16">
        <span className="material-symbols-outlined" style={{ fontSize: '44px', color: GOLD }}>check_circle</span>
        <h1 className="text-3xl md:text-4xl font-bold mt-4 mb-4" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {isEs ? 'Pedido recibido' : 'Order Received'}
        </h1>
        <p className="mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Su pedido fue enviado correctamente.' : 'Your order was submitted successfully.'}
        </p>
        <p className="mb-8 text-sm font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {createdOrder.orderNumber}
        </p>
        <Link href={`${prefix}/shop`} className="gold-button">
          {isEs ? 'Volver a la tienda' : 'Back to Shop'}
        </Link>
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
        <form onSubmit={handleSubmitOrder} className="border p-5 md:p-7 flex flex-col gap-4" style={{ borderColor: BORDER, background: 'var(--color-surface-container-lowest)' }}>
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

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-error)' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="gold-button justify-center disabled:opacity-60" style={{ width: '100%' }}>
            {submitting
              ? (isEs ? 'Enviando...' : 'Submitting...')
              : (isEs ? 'Enviar pedido' : 'Submit Order')}
          </button>
        </form>

        <OrderSummary
          items={items}
          isEs={isEs}
          prefix={prefix}
          shippingMethod={shippingMethod}
          onShippingMethodChange={setShippingMethod}
          onRemove={remove}
        />
      </div>
    </div>
  );
}
