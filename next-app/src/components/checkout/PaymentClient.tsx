'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import OrderSummary, { SHIPPING_OPTIONS } from '@/components/checkout/OrderSummary';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';

export default function PaymentClient({ locale }: { locale: string }) {
  const { items } = useCart();
  const searchParams = useSearchParams();
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';
  const initialShipping = searchParams.get('shipping') ?? SHIPPING_OPTIONS[0].value;
  const [shippingMethod, setShippingMethod] = useState(
    SHIPPING_OPTIONS.some((option) => option.value === initialShipping)
      ? initialShipping
      : SHIPPING_OPTIONS[0].value,
  );

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center px-6 py-16">
        <span className="material-symbols-outlined" style={{ fontSize: '44px', color: 'var(--color-outline-variant)' }}>shopping_bag</span>
        <h1 className="text-3xl md:text-4xl font-bold mt-4 mb-4" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {isEs ? 'Su carrito esta vacio' : 'Your Cart Is Empty'}
        </h1>
        <p className="mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Agregue un articulo antes de proceder al pago.' : 'Add an item before proceeding to payment.'}
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
        <Link href={`${prefix}/checkout`} className="text-xs font-bold uppercase tracking-widest hover:underline" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {isEs ? '< Volver al checkout' : '< Back to checkout'}
        </Link>
        <h1 className="text-3xl md:text-5xl font-bold mt-4 mb-3" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {isEs ? 'Pago' : 'Payment'}
        </h1>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Revise su pedido y complete los detalles de pago.' : 'Review your order and complete your payment details.'}
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_24rem] gap-8 items-start">
        <section className="border p-5 md:p-7 flex flex-col gap-5" style={{ borderColor: BORDER, background: 'var(--color-surface-container-lowest)' }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Metodo de pago' : 'Payment Method'}
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <label>
                <span className="form-label">{isEs ? 'Numero de tarjeta' : 'Card Number'} *</span>
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
                <span className="form-label">{isEs ? 'Codigo postal' : 'Billing ZIP'} *</span>
                <input className="form-field" inputMode="numeric" autoComplete="postal-code" />
              </label>
            </div>
          </div>

          <div className="border px-4 py-4" style={{ borderColor: BORDER }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
              {isEs ? 'Confirmacion' : 'Confirmation'}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'La integracion del procesador de pagos se conectara aqui antes de publicar pagos reales.'
                : 'The live payment processor integration will connect here before real payments are accepted.'}
            </p>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs
              ? 'No envie informacion de pago real hasta que un procesador de pagos seguro este conectado. Revise nuestras '
              : 'Do not submit real payment information until a secure payment processor is connected. Review our '}
            <Link href={`${prefix}/terms`} className="font-bold underline underline-offset-2" style={{ color: GOLD }}>
              {isEs ? 'Terminos' : 'Terms'}
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
        />
      </div>
    </div>
  );
}
