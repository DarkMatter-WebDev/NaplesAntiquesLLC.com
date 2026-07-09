'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart, type CartItem } from '@/context/CartContext';
import OrderSummary, { DEFAULT_SHIPPING_METHOD } from '@/components/checkout/OrderSummary';
import PayPalCheckoutButton from '@/components/checkout/PayPalCheckoutButton';
import FormPrivacyNotice from '@/components/legal/FormPrivacyNotice';
import { createClient } from '@/lib/supabase/client';
import { normalizeManualPriceLabel, parseManualPriceLabelValue } from '@/lib/pricing';
import { productImagePaddingForImage } from '@/types/product';

const GOLD = '#735c00';

type CartProductInfo = Pick<
  CartItem,
  | 'description'
  | 'priceLabel'
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
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export default function CheckoutClient({ locale, paypalClientId }: { locale: string; paypalClientId?: string | null }) {
  const { items, remove, clear, setQuantity } = useCart();
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: '', email: '', phone: '', notes: '',
    address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: 'United States',
  });
  const [shippingMethod, setShippingMethod] = useState(DEFAULT_SHIPPING_METHOD);
  const [infoConfirmed, setInfoConfirmed] = useState(false);
  const [productInfoById, setProductInfoById] = useState<Record<string, CartProductInfo>>({});
  // On a successful capture we snapshot the order (items + shipping + contact) so
  // the confirmation screen can render a complete, printable summary — the cart is
  // cleared right after, and a guest has no account to look the order up in later.
  const [createdOrder, setCreatedOrder] = useState<{
    orderNumber: string;
    items: CartItem[];
    shippingMethod: string;
    customer: CustomerInfo;
  } | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  // Internal order id from the first create-order call, reused if the buyer
  // cancels the PayPal window and tries again (so we don't create a duplicate order).
  const orderIdRef = useRef<string | null>(null);
  // Cart+shipping fingerprint the order was created for. If the buyer edits the
  // cart or switches shipping after cancelling PayPal, the old order's totals no
  // longer apply — forget it so the retry creates a fresh order. (The server
  // re-validates this too; clearing here just avoids a doomed reuse attempt.)
  const orderPayloadKeyRef = useRef<string | null>(null);

  // Guest checkout: no account required. Offer an optional sign-in only to
  // visitors who aren't already signed in.
  const [isGuest, setIsGuest] = useState(false);
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setIsGuest(!data.user)).catch(() => {});
  }, []);

  const cartPayloadKey = `${items
    .map((item) => `${item.id}:${Math.max(1, Math.floor(item.purchaseQuantity ?? 1))}`)
    .sort()
    .join(',')}|${shippingMethod}`;

  // Invalidate the reusable order id when the cart or shipping method changes
  // after the order was created (buyer cancelled PayPal, then edited things).
  useEffect(() => {
    if (orderIdRef.current && orderPayloadKeyRef.current !== cartPayloadKey) {
      orderIdRef.current = null;
      orderPayloadKeyRef.current = null;
    }
  }, [cartPayloadKey]);

  const needsShipping = shippingMethod !== 'local-pickup';
  const contactReady =
    customer.name.trim() !== '' && customer.email.trim() !== '' && customer.phone.trim() !== '';
  const shippingAddressReady =
    !needsShipping ||
    (customer.address_line1.trim() !== '' &&
      customer.city.trim() !== '' &&
      customer.state.trim() !== '' &&
      customer.postal_code.trim() !== '');
  const payReady = items.length > 0 && contactReady && shippingAddressReady && infoConfirmed;

  const missingFieldLabels = [
    needsShipping && customer.address_line1.trim() === '' ? (isEs ? 'Dirección' : 'Street Address') : null,
    needsShipping && customer.city.trim() === '' ? (isEs ? 'Ciudad' : 'City') : null,
    needsShipping && customer.state.trim() === '' ? (isEs ? 'Estado' : 'State') : null,
    needsShipping && customer.postal_code.trim() === '' ? (isEs ? 'Código postal' : 'ZIP / Postal Code') : null,
    customer.name.trim() === '' ? (isEs ? 'Nombre completo' : 'Full Name') : null,
    customer.phone.trim() === '' ? (isEs ? 'Teléfono' : 'Phone') : null,
    customer.email.trim() === '' ? (isEs ? 'Correo electrónico' : 'Email') : null,
    // The confirmation checkbox is surfaced separately (needsInfoConfirmation) so
    // the pay reminder can spell out "check the box" clearly.
  ].filter((label): label is string => Boolean(label));

  function buildPayPalPayload() {
    return {
      items: items.map((item) => ({ id: item.id, quantity: Math.max(1, Math.floor(item.purchaseQuantity ?? 1)) })),
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        notes: customer.notes,
        // Always send the address the buyer entered (captured as a contact record
        // on the order). The server only *requires* a complete address when the
        // shipping method needs one — see `needsShipping` on the route.
        address_line1: customer.address_line1,
        address_line2: customer.address_line2,
        city: customer.city,
        state: customer.state,
        postal_code: customer.postal_code,
        country: customer.country,
      },
      shippingMethod,
      orderId: orderIdRef.current,
    };
  }

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
        parseManualPriceLabelValue(item.priceLabel) == null
      ) || (
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
        .select('id, description, description_es, public_notes, image_padding, image_padding_by_image, category, metal_type, metal_variant, purity, weight_grams, gram_weight, product_type, jewelry_type, chain_type, length, brand, tags, tags_es, gender, price_mode, manual_price_label')
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
            priceLabel:
              product.price_mode === 'manual'
                ? (normalizeManualPriceLabel(product.manual_price_label) ?? cartItem?.priceLabel ?? '')
                : (cartItem?.priceLabel ?? ''),
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

  // The PayPal approval round-trip swaps this page's content (full form ->
  // success screen) without a real navigation, so the browser keeps whatever
  // scroll position the buyer had before leaving for PayPal. Reset to the top
  // when the confirmation screen takes over.
  useEffect(() => {
    if (createdOrder) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [createdOrder]);

  if (createdOrder) {
    const needsShippingReceipt = createdOrder.shippingMethod !== 'local-pickup';
    const c = createdOrder.customer;
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center">
          <span className="material-symbols-outlined" style={{ fontSize: '44px', color: GOLD }}>check_circle</span>
          <h1 className="text-3xl md:text-4xl font-bold mt-4 mb-4" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
            {isEs ? 'Pedido recibido' : 'Order Received'}
          </h1>
          <p className="mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs ? 'Su pedido fue enviado correctamente.' : 'Your order was submitted successfully.'}
          </p>
          <p className="mb-6 text-sm font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
            {createdOrder.orderNumber}
          </p>
        </div>

        <div className="no-print flex flex-wrap justify-center gap-3">
          {/* Plain anchor (not Link) forces a full navigation, so the shop grid is
              guaranteed to reflect the item(s) just purchased as sold rather than
              serving a router-cached page from before the purchase completed. */}
          <a href={`${prefix}/shop`} className="gold-button">
            {isEs ? 'Volver a la tienda' : 'Back to Shop'}
          </a>
          <button type="button" className="outline-button" onClick={() => setShowOrderDetails((v) => !v)}>
            {isGuest
              ? (isEs ? 'Ver e imprimir detalles' : 'View & Print Order Details')
              : (isEs ? 'Ver detalles del pedido' : 'View Order Details')}
          </button>
        </div>

        {showOrderDetails && (
          <div className="mt-10">
            <div className="checkout-receipt-print">
              <div className="mb-5 border-b pb-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <p className="text-sm font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                  Naples Estate Jewelry
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  (239) 404-8505 · naplesestatejewelry.co
                </p>
                <p className="mt-3 text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  <strong>{isEs ? 'Pedido' : 'Order'}:</strong> {createdOrder.orderNumber}
                </p>
              </div>

              <OrderSummary
                items={createdOrder.items}
                isEs={isEs}
                prefix={prefix}
                shippingMethod={createdOrder.shippingMethod}
                shippingState={c.state}
                variant="expanded"
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                    {isEs ? 'Contacto' : 'Contact'}
                  </p>
                  <p style={{ color: 'var(--color-on-surface)' }}>{c.name}</p>
                  <p>{c.email}</p>
                  <p>{c.phone}</p>
                </div>
                {needsShippingReceipt && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                      {isEs ? 'Envío a' : 'Ship To'}
                    </p>
                    <p style={{ color: 'var(--color-on-surface)' }}>{c.address_line1}</p>
                    {c.address_line2 && <p>{c.address_line2}</p>}
                    <p>{[c.city, c.state, c.postal_code].filter(Boolean).join(', ')}</p>
                    <p>{c.country}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="no-print mt-6 flex justify-center">
              <button type="button" className="gold-button" onClick={() => window.print()}>
                <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '17px', lineHeight: 1 }}>print</span>
                {isEs ? 'Imprimir' : 'Print'}
              </button>
            </div>
          </div>
        )}

        <style>{`
          @media print {
            header, footer, .no-print { display: none !important; }
          }
        `}</style>
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
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mt-1 mb-0 md:mt-4 md:mb-3" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {isEs ? 'Checkout' : 'Checkout'}
        </h1>
        <p className="hidden md:block text-sm md:text-base" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Complete sus datos para finalizar la compra de los artículos de su carrito.' : 'Complete your details to check out the items in your cart.'}
        </p>
      </section>

      <div className="checkout-dashboard">
        <div className="checkout-review">
          <OrderSummary
            items={summaryItems}
            isEs={isEs}
            prefix={prefix}
            shippingMethod={shippingMethod}
            shippingState={customer.state}
            onShippingMethodChange={setShippingMethod}
            onRemove={remove}
            onSetQuantity={setQuantity}
            variant="expanded"
          />
        </div>

        <div className="checkout-contact-panel">
          <div className="checkout-panel-heading">
            <span className="material-symbols-outlined" aria-hidden="true">person</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Datos de contacto' : 'Contact Details'}
              </p>
              <h2>{isEs ? 'Información de contacto' : 'Contact information'}</h2>
            </div>
          </div>
          {isGuest && (
            <p className="text-xs mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs ? '¿Ya tiene cuenta? ' : 'Have an account? '}
              <Link
                href={`${prefix}/account/sign-in?next=${prefix}/checkout`}
                style={{ color: GOLD, fontWeight: 700 }}
              >
                {isEs ? 'Inicie sesión' : 'Sign in'}
              </Link>
              {isEs ? ' para un pago más rápido — opcional.' : ' for faster checkout — optional.'}
            </p>
          )}
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
            <input required type="email" className="form-field" autoComplete="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </div>

          <div className="checkout-address-fields">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Dirección' : 'Address'}
              </p>
              {needsShipping && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Enviaremos su pedido a esta dirección. ¿Prefiere recogerlo en persona? Cambie el método de envío a Recogida local en el resumen del pedido.'
                    : 'We’ll ship your order to this address. Prefer to pick it up in person? Switch the shipping method to Local Pickup in your order summary.'}
                </p>
              )}
            </div>
            <div>
              <label className="form-label">{isEs ? 'Dirección' : 'Street Address'}{needsShipping ? ' *' : ''}</label>
              <input required={needsShipping} className="form-field" autoComplete="address-line1" value={customer.address_line1} onChange={(e) => setCustomer({ ...customer, address_line1: e.target.value })} />
            </div>
            <div>
              <label className="form-label">{isEs ? 'Apartamento, suite, etc. (opcional)' : 'Apartment, suite, etc. (optional)'}</label>
              <input className="form-field" autoComplete="address-line2" value={customer.address_line2} onChange={(e) => setCustomer({ ...customer, address_line2: e.target.value })} />
            </div>
            <div className="responsive-form-grid">
              <div>
                <label className="form-label">{isEs ? 'Ciudad' : 'City'}{needsShipping ? ' *' : ''}</label>
                <input required={needsShipping} className="form-field" autoComplete="address-level2" value={customer.city} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} />
              </div>
              <div>
                <label className="form-label">{isEs ? 'Estado' : 'State'}{needsShipping ? ' *' : ''}</label>
                <input required={needsShipping} className="form-field" autoComplete="address-level1" value={customer.state} onChange={(e) => setCustomer({ ...customer, state: e.target.value })} />
              </div>
            </div>
            <div className="responsive-form-grid">
              <div>
                <label className="form-label">{isEs ? 'Código postal' : 'ZIP / Postal Code'}{needsShipping ? ' *' : ''}</label>
                <input required={needsShipping} className="form-field" autoComplete="postal-code" value={customer.postal_code} onChange={(e) => setCustomer({ ...customer, postal_code: e.target.value })} />
              </div>
              <div>
                <label className="form-label">{isEs ? 'País' : 'Country'}</label>
                <input className="form-field" autoComplete="country-name" value={customer.country} onChange={(e) => setCustomer({ ...customer, country: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">{isEs ? 'Notas (opcional)' : 'Notes (optional)'}</label>
            <textarea rows={4} className="form-field resize-none" value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />
          </div>

          <FormPrivacyNotice locale={locale} />

          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs ? 'Antes de pagar, revise nuestras ' : 'Before paying, please review our '}
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

          <div
            className="checkout-confirm-box"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '1rem 1.1rem',
              border: '1px solid rgba(216, 208, 194, 0.94)',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(255, 253, 248, 0.9)',
            }}
          >
            <input
              type="checkbox"
              id="checkout-confirm-info"
              checked={infoConfirmed}
              onChange={(e) => setInfoConfirmed(e.target.checked)}
              className="mt-1"
              style={{ accentColor: GOLD, width: '1.05rem', height: '1.05rem', flexShrink: 0, cursor: 'pointer' }}
            />
            <label
              htmlFor="checkout-confirm-info"
              className="text-sm leading-relaxed"
              style={{ color: 'var(--color-on-surface)', cursor: 'pointer' }}
            >
              {isEs
                ? 'Confirmo que he revisado mi pedido y que mis datos de contacto, dirección de envío y demás información anterior son correctos antes de proceder al pago.'
                : 'I confirm that I have reviewed my order and that my contact details, shipping address, and other information above are correct before proceeding to payment.'}
            </label>
          </div>

          {paypalClientId ? (
            <PayPalCheckoutButton
              clientId={paypalClientId}
              ready={payReady}
              isEs={isEs}
              missingFields={missingFieldLabels}
              needsInfoConfirmation={!infoConfirmed}
              getPayload={buildPayPalPayload}
              onOrderId={(id) => {
                orderIdRef.current = id;
                orderPayloadKeyRef.current = cartPayloadKey;
              }}
              onSuccess={({ orderNumber }) => {
                // Snapshot the order for the printable confirmation, THEN clear the
                // cart (clearing empties `items`, so capture the summary first).
                setCreatedOrder({ orderNumber, items: summaryItems, shippingMethod, customer });
                clear();
              }}
            />
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-error)' }}>
              {isEs
                ? 'El pago en línea no está disponible en este momento. Llámenos al (239) 404-8505.'
                : 'Online payment is unavailable right now. Please call us at (239) 404-8505.'}
            </p>
          )}
        </div>
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
        @media (max-width: 640px) {
          .checkout-page {
            padding: 1.25rem 0 3rem;
          }
          .checkout-hero {
            margin-bottom: 0.85rem;
            padding: 0.75rem 1.1rem;
          }
        }
        .checkout-dashboard {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 1.5rem;
        }
        .checkout-review {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          min-width: 0;
        }
        .checkout-address-fields {
          display: flex;
          flex-direction: column;
          gap: 1rem;
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
