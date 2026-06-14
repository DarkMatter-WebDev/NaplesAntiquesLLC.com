'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { items, remove } = useCart();
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';
  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', email: '', phone: '', notes: '' });
  const [shippingMethod, setShippingMethod] = useState(SHIPPING_OPTIONS[0].value);

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

  function handleContinueToPayment(e: React.FormEvent) {
    e.preventDefault();
    router.push(`${prefix}/payment?shipping=${encodeURIComponent(shippingMethod)}`);
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
        <form onSubmit={handleContinueToPayment} className="border p-5 md:p-7 flex flex-col gap-4" style={{ borderColor: BORDER, background: 'var(--color-surface-container-lowest)' }}>
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

          <button type="submit" className="gold-button justify-center" style={{ width: '100%' }}>
            {isEs ? 'Continuar al pago ->' : 'Continue to Payment ->'}
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
