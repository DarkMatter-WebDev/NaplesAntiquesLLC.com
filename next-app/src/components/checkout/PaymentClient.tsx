'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import OrderSummary from '@/components/checkout/OrderSummary';
import {
  DEFAULT_SHIPPING_METHOD,
  isCheckoutShippingMethod,
} from '@/lib/checkout-shipping';
import { useHideSoldItemPrices } from '@/hooks/useHideSoldItemPrices';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';

export default function PaymentClient({ locale }: { locale: string }) {
  const { items } = useCart();
  const searchParams = useSearchParams();
  const isEs = locale === 'es';
  const hideSoldItemPrices = useHideSoldItemPrices(true);
  const prefix = isEs ? '/es' : '';
  const initialShipping = searchParams.get('shipping') ?? DEFAULT_SHIPPING_METHOD;
  const [shippingMethod, setShippingMethod] = useState<string>(
    isCheckoutShippingMethod(initialShipping)
      ? initialShipping
      : DEFAULT_SHIPPING_METHOD,
  );

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-[clamp(1rem,4vw,2rem)] py-16 text-center">
        <span className="material-symbols-outlined" style={{ fontSize: '44px', color: 'var(--color-outline-variant)' }}>shopping_bag</span>
        <h1 className="text-3xl md:text-4xl font-bold mt-4 mb-4" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {isEs ? 'Su carrito está vacío' : 'Your Cart Is Empty'}
        </h1>
        <p className="mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Agregue un artículo antes de proceder al pago.' : 'Add an item before proceeding to payment.'}
        </p>
        <Link href={`${prefix}/shop`} className="gold-button">
          {isEs ? 'Ver tienda' : 'Browse Shop'}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-[clamp(1rem,4vw,2rem)] py-10 md:py-16">
      <div className="mb-8">
        <Link href={`${prefix}/checkout`} className="hover-underline-grow text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {isEs ? '< Volver al checkout' : '< Back to checkout'}
        </Link>
        <h1 className="text-3xl md:text-5xl font-bold mt-4 mb-3" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {isEs ? 'Pago' : 'Payment'}
        </h1>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Revise su pedido y complete los detalles de pago.' : 'Review your order and complete your payment details.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start">
        <section className="border p-5 md:p-7 flex flex-col gap-5" style={{ borderColor: BORDER, background: 'var(--color-surface-container-lowest)' }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Método de pago' : 'Payment Method'}
            </p>
            <div className="responsive-form-grid">
              <label>
                <span className="form-label">{isEs ? 'Número de tarjeta' : 'Card Number'} *</span>
                <input className="form-field" inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" />
              </label>
              <label>
                <span className="form-label">{isEs ? 'Nombre en la tarjeta' : 'Name on Card'} *</span>
                <input className="form-field" autoComplete="cc-name" />
              </label>
              <label>
                <span className="form-label">{isEs ? 'Vencimiento' : 'Expiration'} *</span>
                <input className="form-field" inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" />
              </label>
              <label>
                <span className="form-label">CVC *</span>
                <input className="form-field" inputMode="numeric" autoComplete="cc-csc" placeholder="123" />
              </label>
              <label>
                <span className="form-label">{isEs ? 'Código postal' : 'Billing ZIP'} *</span>
                <input className="form-field" inputMode="numeric" autoComplete="postal-code" />
              </label>
            </div>
          </div>

          <div className="border px-4 py-4" style={{ borderColor: BORDER }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Confirmación' : 'Confirmation'}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'La integración del procesador de pagos se conectará aquí antes de publicar pagos reales.'
                : 'The live payment processor integration will connect here before real payments are accepted.'}
            </p>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs
              ? 'No envíe información de pago real hasta que un procesador de pagos seguro esté conectado. Revise nuestras '
              : 'Do not submit real payment information until a secure payment processor is connected. Review our '}
            <Link href={`${prefix}/terms`} className="font-bold underline underline-offset-2" style={{ color: GOLD }}>
              {isEs ? 'Términos' : 'Terms'}
            </Link>
            {', '}
            <Link href={`${prefix}/privacy`} className="font-bold underline underline-offset-2" style={{ color: GOLD }}>
              {isEs ? 'Privacidad' : 'Privacy Policy'}
            </Link>
            {isEs ? ' y ' : ', and '}
            <Link href={`${prefix}/returns-refunds`} className="font-bold underline underline-offset-2" style={{ color: GOLD }}>
              {isEs ? 'Devoluciones' : 'Returns & Refunds'}
            </Link>
            .
          </p>

          <button type="button" className="gold-button justify-center opacity-70" style={{ width: '100%' }} disabled>
            {isEs ? 'Completar pago' : 'Complete Payment'}
          </button>
        </section>

        <OrderSummary
          items={items}
          isEs={isEs}
          prefix={prefix}
          shippingMethod={shippingMethod}
          onShippingMethodChange={setShippingMethod}
          hideSoldItemPrices={hideSoldItemPrices}
        />
      </div>
    </div>
  );
}
