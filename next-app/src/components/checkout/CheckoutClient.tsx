'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart, type CartItem } from '@/context/CartContext';
import OrderSummary, { SHIPPING_OPTIONS } from '@/components/checkout/OrderSummary';
import FormPrivacyNotice from '@/components/legal/FormPrivacyNotice';
import { createClient } from '@/lib/supabase/client';
import { productImagePaddingForImage } from '@/types/product';

const GOLD = '#735c00';
type CartProductInfo = Pick<
  CartItem,
  | 'description'
  | 'description_es'
  | 'public_notes'
  | 'image_padding'
  | 'category'
  | 'metal_type'
  | 'metal_variant'
  | 'purity'
  | 'weight_grams'
  | 'gram_weight'
  | 'product_type'
  | 'jewelry_type'
  | 'chain_type'
  | 'length'
  | 'brand'
  | 'tags'
  | 'tags_es'
  | 'gender'
>;

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
  const [productInfoById, setProductInfoById] = useState<Record<string, CartProductInfo>>({});
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
        .select('full_name, first_name, last_name, email, phone')
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

  useEffect(() => {
    let cancelled = false;
    const missingProductInfoIds = items
      .filter((item) => (
        !item.description &&
        !item.description_es &&
        !item.public_notes
      ) || (
        item.image_padding === undefined
      ) || (
        !item.category &&
        !item.metal_variant &&
        !item.purity &&
        !item.length &&
        !item.chain_type &&
        !item.product_type &&
        !item.jewelry_type
      ))
      .map((item) => item.id);

    if (missingProductInfoIds.length === 0) return;

    async function loadCartProductInfo() {
      const supabase = createClient();
      const { data } = await supabase
        .from('products')
        .select('id, description, description_es, public_notes, image_padding, image_padding_by_image, category, metal_type, metal_variant, purity, weight_grams, gram_weight, product_type, jewelry_type, chain_type, length, brand, tags, tags_es, gender')
        .in('id', missingProductInfoIds);

      if (cancelled || !data) return;
      setProductInfoById((current) => ({
        ...current,
        ...Object.fromEntries(data.map((product) => {
          const cartItem = items.find((item) => item.id === product.id);
          return [
            product.id,
            {
            description: product.description,
            description_es: product.description_es,
            public_notes: product.public_notes,
            image_padding: productImagePaddingForImage(product.image_padding, product.image_padding_by_image, cartItem?.image, 0),
            category: product.category,
            metal_type: product.metal_type,
            metal_variant: product.metal_variant,
            purity: product.purity,
            weight_grams: product.weight_grams,
            gram_weight: product.gram_weight,
            product_type: product.product_type,
            jewelry_type: product.jewelry_type,
            chain_type: product.chain_type,
            length: product.length,
            brand: product.brand,
            tags: product.tags,
            tags_es: product.tags_es,
            gender: product.gender,
          },
          ];
        })),
      }));
    }

    loadCartProductInfo();

    return () => {
      cancelled = true;
    };
  }, [items]);

  const summaryItems = items.map((item) => ({
    ...item,
    ...productInfoById[item.id],
  }));

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
          {isEs ? 'Su carrito está vacío' : 'Your Cart Is Empty'}
        </h1>
        <p className="mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Agregue un artículo antes de proceder al pago.' : 'Add an item before proceeding to checkout.'}
        </p>
        <Link href={`${prefix}/shop`} className="gold-button">
          {isEs ? 'Ver tienda' : 'Browse Shop'}
        </Link>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-shell">
      <section className="checkout-hero">
        <Link href={`${prefix}/shop`} className="text-xs font-bold uppercase tracking-widest hover:underline" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {isEs ? '< Volver a la tienda' : '< Back to shop'}
        </Link>
        <h1 className="text-3xl md:text-5xl font-bold mt-4 mb-3" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {isEs ? 'Checkout' : 'Checkout'}
        </h1>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Complete sus datos para reservar los artículos de su carrito.' : 'Complete your details to reserve the items in your cart.'}
        </p>
      </section>

      <div className="checkout-dashboard">
        <OrderSummary
          items={summaryItems}
          isEs={isEs}
          prefix={prefix}
          shippingMethod={shippingMethod}
          onShippingMethodChange={setShippingMethod}
          onRemove={remove}
          variant="expanded"
        />

        <form onSubmit={handleSubmitOrder} className="checkout-contact-panel">
          <div className="checkout-panel-heading">
            <span className="material-symbols-outlined" aria-hidden="true">person</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Datos de contacto' : 'Contact Details'}
              </p>
              <h2>{isEs ? '¿Cómo podemos contactarte?' : 'How should we contact you?'}</h2>
            </div>
          </div>
          <div className="responsive-form-grid">
            <div>
              <label className="form-label">{isEs ? 'Nombre completo' : 'Full Name'} *</label>
              <input required className="form-field" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
            </div>
            <div>
              <label className="form-label">{isEs ? 'Teléfono' : 'Phone'} *</label>
              <input required type="tel" className="form-field" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="form-label">{isEs ? 'Correo electrónico' : 'Email'} *</label>
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

          <FormPrivacyNotice locale={locale} />

          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs ? 'Antes de enviar, revise nuestras ' : 'Before submitting, please review our '}
            <Link href={`${prefix}/returns-refunds`} className="font-bold underline underline-offset-2" style={{ color: GOLD }}>
              {isEs ? 'Devoluciones' : 'Returns & Refunds'}
            </Link>
            {', '}
            <Link href={`${prefix}/shipping`} className="font-bold underline underline-offset-2" style={{ color: GOLD }}>
              {isEs ? 'Envíos' : 'Shipping'}
            </Link>
            {isEs ? ', ' : ', '}
            <Link href={`${prefix}/terms`} className="font-bold underline underline-offset-2" style={{ color: GOLD }}>
              {isEs ? 'Términos' : 'Terms'}
            </Link>
            {isEs ? ' y ' : ', and '}
            <Link href={`${prefix}/privacy`} className="font-bold underline underline-offset-2" style={{ color: GOLD }}>
              {isEs ? 'Privacidad' : 'Privacy Policy'}
            </Link>
            .
          </p>

          <button type="submit" disabled={submitting} className="gold-button justify-center disabled:opacity-60" style={{ width: '100%' }}>
            {submitting
              ? (isEs ? 'Enviando...' : 'Submitting...')
              : (isEs ? 'Enviar pedido' : 'Submit Order')}
          </button>
        </form>
      </div>
      </div>

      <style jsx>{`
        .checkout-page {
          min-height: 100vh;
          padding: 3rem 0 4rem;
          background:
            linear-gradient(180deg, rgba(255, 253, 248, 0.94) 0%, rgba(249, 247, 239, 0.98) 46%, #f9f7ef 100%),
            radial-gradient(circle at top right, rgba(212, 175, 55, 0.18), transparent 34%);
        }
        .checkout-shell {
          width: 100%;
          max-width: 1160px;
          margin: 0 auto;
          padding-inline: clamp(1rem, 4vw, 2rem);
        }
        .checkout-hero {
          margin-bottom: 1.5rem;
          padding: clamp(1.25rem, 3vw, 2rem);
          border: 1px solid rgba(216, 208, 194, 0.86);
          background: rgba(255, 255, 255, 0.82);
          box-shadow: 0 18px 48px rgba(75, 60, 24, 0.08);
        }
        .checkout-dashboard {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 1.5rem;
        }
        .checkout-contact-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: clamp(1.25rem, 3vw, 1.75rem);
          border: 1px solid rgba(216, 208, 194, 0.94);
          background: rgba(255, 255, 255, 0.86);
          box-shadow: 0 14px 36px rgba(75, 60, 24, 0.07);
        }
        .checkout-panel-heading {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding-bottom: 0.35rem;
        }
        @media (min-width: 1024px) {
          .checkout-dashboard {
            grid-template-columns: minmax(0, 1fr) minmax(20rem, 24rem);
            align-items: start;
          }
          .checkout-dashboard > :first-child {
            order: 2;
          }
          .checkout-dashboard > :last-child {
            order: 1;
          }
        }
        .checkout-panel-heading > .material-symbols-outlined {
          display: inline-flex;
          width: 2.5rem;
          height: 2.5rem;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(212, 175, 55, 0.12);
          color: ${GOLD};
        }
        .checkout-panel-heading h2 {
          margin: 0.15rem 0 0;
          font-family: var(--font-headline);
          font-size: clamp(1.25rem, 2.4vw, 1.75rem);
          color: var(--color-on-surface);
        }
      `}</style>
    </div>
  );
}
