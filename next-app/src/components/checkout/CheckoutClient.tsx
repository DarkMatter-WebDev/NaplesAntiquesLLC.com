'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart, type CartItem } from '@/context/CartContext';
import OrderSummary from '@/components/checkout/OrderSummary';
import PayPalCheckoutButton from '@/components/checkout/PayPalCheckoutButton';
import StockAlertBanner from '@/components/cart/StockAlertBanner';
import FormPrivacyNotice from '@/components/legal/FormPrivacyNotice';
import { createClient } from '@/lib/supabase/client';
import { normalizeManualPriceLabel, parseManualPriceLabelValue } from '@/lib/pricing';
import { productImagePaddingForImage } from '@/types/product';
import { useHideSoldItemPrices } from '@/hooks/useHideSoldItemPrices';
import { findUnavailableCartItems } from '@/lib/cart-availability';
import {
  CHECKOUT_SHIPPING_OPTIONS,
  DEFAULT_SHIPPING_METHOD,
  EXPRESS_SHIPPING_MAX_SUBTOTAL,
  getCheckoutShippingFee,
  getShippingServiceNote,
  isShippingMethodAvailable,
} from '@/lib/checkout-shipping';
import { formatCheckoutCurrency } from '@/lib/checkout-pricing';
import {
  isUnitedStatesCountry,
  normalizeUsState,
  normalizeUsZip,
  US_STATES,
} from '@/lib/us-address';
import { AppIcon } from '@/components/AppIcon';

const GOLD = '#735c00';

// Step-based checkout flow (owner request 2026-07-31): order summary ->
// delivery choice -> contact/address -> review & pay. With PayPal's
// capture-on-approve design, "place order" IS the Pay Now inside PayPal's
// window, so the final step is the full review plus the PayPal buttons.
type CheckoutStep = 'summary' | 'delivery' | 'contact' | 'review';
const CHECKOUT_STEPS: readonly CheckoutStep[] = ['summary', 'delivery', 'contact', 'review'];
const AUTH_CHOICE_KEY = 'nej-checkout-auth-choice';

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
  const { items, remove, clear, setQuantity, refreshAvailability, stockAlerts, dismissStockAlerts } = useCart();
  const isEs = locale === 'es';
  const hideSoldItemPrices = useHideSoldItemPrices(true);
  const prefix = isEs ? '/es' : '';
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: '', email: '', phone: '', notes: '',
    address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: 'United States',
  });
  const [shippingMethod, setShippingMethod] = useState<string>(DEFAULT_SHIPPING_METHOD);
  const [infoConfirmed, setInfoConfirmed] = useState(false);
  // For Local Pickup the address is optional and hidden behind an accordion the
  // buyer can expand if they want to provide it. (Ignored when shipping is
  // selected — the address is required and always shown then.)
  const [addressExpanded, setAddressExpanded] = useState(false);
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

  // Step machine. `maxStepReached` unlocks the indicator for revisiting any
  // step the buyer already completed without re-walking the Continue gates.
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [maxStepReached, setMaxStepReached] = useState(0);
  // Missing-fields hint under the contact step's Continue, shown only after a
  // blocked attempt (not while the buyer is still typing).
  const [contactHint, setContactHint] = useState(false);
  // Entry sign-in/guest prompt. Starts dismissed and is re-enabled on mount
  // for signed-out visitors who haven't chosen "guest" this tab (sessionStorage
  // is unavailable during SSR, so this must not participate in hydration).
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  useEffect(() => {
    // Deferred callback (PriceUpdateTicker's pattern) — satisfies
    // react-hooks/set-state-in-effect while still only opening post-hydration.
    const timer = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem(AUTH_CHOICE_KEY) !== 'guest') setAuthPromptOpen(true);
      } catch {
        /* storage unavailable — keep the prompt closed rather than nag every render */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const dismissAuthPrompt = () => {
    setAuthPromptOpen(false);
    try {
      sessionStorage.setItem(AUTH_CHOICE_KEY, 'guest');
    } catch {
      /* ignore */
    }
  };

  const goToStep = (next: CheckoutStep) => {
    setStep(next);
    setMaxStepReached((reached) => Math.max(reached, CHECKOUT_STEPS.indexOf(next)));
  };

  // Each step change starts at the top of the page, like a page navigation.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

  // Re-check live stock when the checkout page loads (and whenever the cart
  // changes), so an item that sold out while it sat in the cart is caught here —
  // and flagged — before the buyer pays, rather than surfacing as an opaque
  // PayPal error. `items` is passed explicitly (and is the dep) because on the
  // hydration commit it's fresher than the context's effect-updated ref. It
  // converges: refreshAvailability only re-sets items when something actually
  // changed, so the reference stabilizes after at most one update.
  useEffect(() => {
    if (items.length > 0) void refreshAvailability(items);
  }, [items, refreshAvailability]);

  // Shipping fees are tiered on the merchandise subtotal, and Express is not
  // offered at $5,000+ (USPS insurance cap). Rather than mutating the stored
  // selection, derive the effective method each render: an unavailable
  // selection (a cart edit crossed the $5,000 boundary) falls back to the
  // default. The raw choice is preserved, so shrinking the cart restores it;
  // the server rejects an unavailable method regardless.
  const cartSubtotal = items.reduce((sum, item) => {
    const unit = parseManualPriceLabelValue(item.priceLabel);
    if (unit === null) return sum;
    return sum + unit * Math.max(1, Math.floor(item.purchaseQuantity ?? 1));
  }, 0);
  const effectiveShippingMethod = isShippingMethodAvailable(shippingMethod, cartSubtotal)
    ? shippingMethod
    : DEFAULT_SHIPPING_METHOD;

  const cartPayloadKey = `${items
    .map((item) => `${item.id}:${Math.max(1, Math.floor(item.purchaseQuantity ?? 1))}`)
    .sort()
    .join(',')}|${effectiveShippingMethod}`;

  // Invalidate the reusable order id when the cart or shipping method changes
  // after the order was created (buyer cancelled PayPal, then edited things).
  useEffect(() => {
    if (orderIdRef.current && orderPayloadKeyRef.current !== cartPayloadKey) {
      orderIdRef.current = null;
      orderPayloadKeyRef.current = null;
    }
  }, [cartPayloadKey]);

  const needsShipping = effectiveShippingMethod !== 'local-pickup';
  const normalizedShippingState = normalizeUsState(customer.state);
  const normalizedShippingZip = normalizeUsZip(customer.postal_code);
  const contactReady =
    customer.name.trim() !== '' && customer.email.trim() !== '' && customer.phone.trim() !== '';
  const shippingAddressReady =
    !needsShipping ||
    (customer.address_line1.trim() !== '' &&
      customer.city.trim() !== '' &&
      normalizedShippingState !== null &&
      normalizedShippingZip !== null &&
      isUnitedStatesCountry(customer.country));
  // An item that's gone sold out (or over-requested) can't be paid for — block
  // checkout with a clear message instead of letting it fail at PayPal.
  const unavailableItems = findUnavailableCartItems(items);
  const hasUnavailableItem = unavailableItems.length > 0;
  const payReady = items.length > 0 && contactReady && shippingAddressReady && infoConfirmed && !hasUnavailableItem;

  const missingFieldLabels = [
    needsShipping && customer.address_line1.trim() === '' ? (isEs ? 'Dirección' : 'Street Address') : null,
    needsShipping && customer.city.trim() === '' ? (isEs ? 'Ciudad' : 'City') : null,
    needsShipping && normalizedShippingState === null ? (isEs ? 'Estado válido de EE. UU.' : 'Valid U.S. State') : null,
    needsShipping && normalizedShippingZip === null ? (isEs ? 'Código postal válido de EE. UU.' : 'Valid U.S. ZIP Code') : null,
    needsShipping && !isUnitedStatesCountry(customer.country) ? (isEs ? 'Dirección en Estados Unidos' : 'United States Address') : null,
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
      shippingMethod: effectiveShippingMethod,
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
          <AppIcon name="check_circle"  style={{ fontSize: '44px', color: GOLD }} />
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
                  (239) 404-8505 · naplesestatejewelry.com
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
                {(needsShippingReceipt || c.address_line1.trim() !== '') && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                      {needsShippingReceipt ? (isEs ? 'Envío a' : 'Ship To') : (isEs ? 'Dirección' : 'Address')}
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
                <AppIcon name="print"  aria-hidden="true" style={{ fontSize: '17px', lineHeight: 1 }} />
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
        <AppIcon name="shopping_bag"  style={{ fontSize: '44px', color: 'var(--color-outline-variant)' }} />
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
        <Link href={`${prefix}/shop`} className="hover-underline-grow text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {isEs ? '< Volver a la tienda' : '< Back to shop'}
        </Link>
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mt-1 mb-0 md:mt-4 md:mb-3" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          {isEs ? 'Finalizar Compra' : 'Checkout'}
        </h1>
        <p className="hidden md:block text-sm md:text-base" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Complete sus datos para finalizar la compra de los artículos de su carrito.' : 'Complete your details to check out the items in your cart.'}
        </p>
      </section>

      {/* Entry prompt: signed-out visitors pick sign-in or guest before the
          steps. Signed-in buyers never see it; the guest choice is remembered
          per tab so a PayPal cancel/return doesn't re-ask. */}
      {isGuest && authPromptOpen && (
        <div
          className="checkout-auth-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={isEs ? 'Iniciar sesión o continuar como invitado' : 'Sign in or continue as guest'}
        >
          <div className="checkout-auth-card">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
              {isEs ? '¿Cómo desea continuar?' : 'How would you like to check out?'}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Inicie sesión para un pago más rápido con sus datos guardados, o continúe como invitado — no se requiere cuenta.'
                : 'Sign in for faster checkout with your saved details, or continue as a guest — no account required.'}
            </p>
            <Link href={`${prefix}/account/sign-in?next=${prefix}/checkout`} className="gold-button justify-center" style={{ width: '100%' }}>
              {isEs ? 'Iniciar sesión' : 'Sign in'}
            </Link>
            <button type="button" className="outline-button justify-center" style={{ width: '100%' }} onClick={dismissAuthPrompt}>
              {isEs ? 'Continuar como invitado' : 'Continue as guest'}
            </button>
          </div>
        </div>
      )}

      {/* Step flow (owner request 2026-07-31): Summary -> Delivery -> Contact ->
          Review & Pay. The indicator lets the buyer revisit any completed step;
          future steps unlock through each step's Continue gate. */}
      <nav className="checkout-steps" aria-label={isEs ? 'Pasos de compra' : 'Checkout steps'}>
        {CHECKOUT_STEPS.map((stepId, index) => {
          const labels: Record<CheckoutStep, string> = {
            summary: isEs ? 'Resumen' : 'Summary',
            delivery: isEs ? 'Entrega' : 'Delivery',
            contact: isEs ? 'Contacto' : 'Contact',
            review: isEs ? 'Revisar y pagar' : 'Review & Pay',
          };
          const unlocked = index <= maxStepReached;
          const current = stepId === step;
          return (
            <button
              key={stepId}
              type="button"
              disabled={!unlocked || current}
              aria-current={current ? 'step' : undefined}
              onClick={() => unlocked && setStep(stepId)}
              className="checkout-step-chip"
              data-state={current ? 'current' : unlocked ? 'done' : 'todo'}
            >
              <span className="checkout-step-num">{index + 1}</span>
              {labels[stepId]}
            </button>
          );
        })}
      </nav>

      <div className="checkout-step-flow">
        <StockAlertBanner alerts={stockAlerts} isEs={isEs} onDismiss={dismissStockAlerts} />

        {step === 'contact' && (
        <div className="checkout-contact-panel">
          <div className="checkout-panel-heading">
            <AppIcon name="person"  aria-hidden="true" />
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
            {needsShipping ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                  {isEs ? 'Dirección' : 'Address'}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Enviaremos su pedido a esta dirección. ¿Prefiere recogerlo en persona? Elija Recogida local en el paso Entrega.'
                    : 'We’ll ship your order to this address. Prefer to pick it up in person? Choose Local Pickup in the Delivery step.'}
                </p>
              </div>
            ) : (
              // Local pickup: address isn't needed, so tuck it behind an accordion
              // the buyer can open if they'd still like to add one.
              <button
                type="button"
                onClick={() => setAddressExpanded((open) => !open)}
                aria-expanded={addressExpanded}
                aria-controls="checkout-address-inputs"
                className="checkout-address-toggle"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.7rem 0.85rem',
                  border: '1px solid rgba(216, 208, 194, 0.94)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(255, 253, 248, 0.9)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                  {isEs ? 'Dirección (opcional)' : 'Address (optional)'}
                </span>
                <AppIcon name={addressExpanded ? 'expand_less' : 'expand_more'}  aria-hidden="true" style={{ fontSize: '20px', color: GOLD, lineHeight: 1 }} />
              </button>
            )}
            {(needsShipping || addressExpanded) && (
              <div id="checkout-address-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                    <select
                      required={needsShipping}
                      className="form-field"
                      autoComplete="address-level1"
                      value={customer.state}
                      onChange={(e) => setCustomer({ ...customer, state: e.target.value })}
                    >
                      <option value="">{isEs ? 'Seleccione un estado' : 'Select a state'}</option>
                      {US_STATES.map(([code, name]) => (
                        <option key={code} value={code}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="responsive-form-grid">
                  <div>
                    <label className="form-label">{isEs ? 'Código postal' : 'ZIP / Postal Code'}{needsShipping ? ' *' : ''}</label>
                    <input
                      required={needsShipping}
                      className="form-field"
                      autoComplete="postal-code"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{5}(-[0-9]{4})?"
                      placeholder="12345"
                      value={customer.postal_code}
                      aria-invalid={needsShipping && customer.postal_code.trim() !== '' && normalizedShippingZip === null}
                      aria-describedby={
                        needsShipping && customer.postal_code.trim() !== '' && normalizedShippingZip === null
                          ? 'checkout-zip-error'
                          : undefined
                      }
                      onChange={(e) => {
                        const entered = e.target.value;
                        setCustomer({
                          ...customer,
                          postal_code: normalizeUsZip(entered) ?? entered,
                        });
                      }}
                    />
                    {needsShipping && customer.postal_code.trim() !== '' && normalizedShippingZip === null && (
                      <p id="checkout-zip-error" role="alert" className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
                        {isEs
                          ? 'Ingrese un código postal de EE. UU. válido (12345 o 12345-6789).'
                          : 'Enter a valid U.S. ZIP code (12345 or 12345-6789).'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="form-label">{isEs ? 'País' : 'Country'}</label>
                    <input
                      readOnly
                      className="form-field"
                      autoComplete="country-name"
                      value="United States"
                      aria-describedby="checkout-country-note"
                    />
                    <p id="checkout-country-note" className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {isEs ? 'Actualmente solo enviamos dentro de Estados Unidos.' : 'We currently ship only within the United States.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="form-label">{isEs ? 'Notas (opcional)' : 'Notes (optional)'}</label>
            <textarea rows={4} className="form-field resize-none" value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />
          </div>

          <FormPrivacyNotice locale={locale} />

          {contactHint && !(contactReady && shippingAddressReady) && (
            <p role="alert" className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>
              {isEs ? 'Complete: ' : 'Please complete: '}
              {missingFieldLabels.join(', ')}
            </p>
          )}
          <div className="checkout-step-nav">
            <button type="button" className="outline-button" onClick={() => goToStep('delivery')}>
              {isEs ? '< Entrega' : '< Delivery'}
            </button>
            <button
              type="button"
              className="gold-button"
              onClick={() => {
                if (contactReady && shippingAddressReady) {
                  setContactHint(false);
                  goToStep('review');
                } else {
                  setContactHint(true);
                }
              }}
            >
              {isEs ? 'Continuar a revisar y pagar' : 'Continue to Review & Pay'}
            </button>
          </div>
        </div>
        )}

        {step === 'summary' && (
        <div className="checkout-contact-panel">
          <div className="checkout-panel-heading">
            <AppIcon name="shopping_bag"  aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Paso 1' : 'Step 1'}
              </p>
              <h2>{isEs ? 'Resumen del pedido' : 'Order summary'}</h2>
            </div>
          </div>
          <OrderSummary
            items={summaryItems}
            isEs={isEs}
            prefix={prefix}
            shippingMethod={effectiveShippingMethod}
            shippingState={customer.state}
            onRemove={remove}
            onSetQuantity={setQuantity}
            variant="expanded"
            showAvailability
            hideSoldItemPrices={hideSoldItemPrices}
          />
          {hasUnavailableItem && (
            <p role="alert" className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>
              {isEs
                ? 'Elimine los artículos no disponibles arriba para continuar.'
                : 'Remove the unavailable items above to continue.'}
            </p>
          )}
          <div className="checkout-step-nav">
            <span aria-hidden="true" />
            <button type="button" className="gold-button" disabled={hasUnavailableItem} onClick={() => goToStep('delivery')}>
              {isEs ? 'Continuar a entrega' : 'Continue to Delivery'}
            </button>
          </div>
        </div>
        )}

        {step === 'delivery' && (
        <div className="checkout-contact-panel">
          <div className="checkout-panel-heading">
            <AppIcon name="inventory_2"  aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Paso 2' : 'Step 2'}
              </p>
              <h2>{isEs ? 'Entrega, envío o recogida' : 'Delivery, shipping, or pickup'}</h2>
            </div>
          </div>
          <div role="radiogroup" aria-label={isEs ? 'Método de entrega' : 'Delivery method'} className="checkout-delivery-options">
            {CHECKOUT_SHIPPING_OPTIONS
              .filter((option) => isShippingMethodAvailable(option.value, cartSubtotal))
              .map((option) => {
                const fee = getCheckoutShippingFee(option.value, cartSubtotal) ?? 0;
                const selected = effectiveShippingMethod === option.value;
                const description = option.value === 'local-pickup'
                  ? (isEs ? 'Recogida en persona con cita en el área de Naples.' : 'In-person pickup by appointment in the Naples area.')
                  : option.value === 'express-overnight-insured'
                    ? (isEs ? 'Entrega al día siguiente, totalmente asegurada.' : 'Next-day delivery, fully insured.')
                    : (isEs ? 'Envío totalmente asegurado con firma de entrega.' : 'Fully insured shipping with delivery signature.');
                return (
                  <label key={option.value} className="checkout-delivery-option" data-selected={selected ? 'true' : 'false'}>
                    <input
                      type="radio"
                      name="checkout-delivery-method"
                      value={option.value}
                      checked={selected}
                      onChange={() => setShippingMethod(option.value)}
                      style={{ accentColor: GOLD, width: '1.05rem', height: '1.05rem', flexShrink: 0, marginTop: '0.15rem' }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>
                          {isEs ? option.labelEs : option.labelEn}
                        </span>
                        <span className="font-bold text-sm" style={{ color: GOLD }}>{formatCheckoutCurrency(fee)}</span>
                      </span>
                      <span className="block text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{description}</span>
                    </span>
                  </label>
                );
              })}
          </div>
          {getShippingServiceNote(effectiveShippingMethod, cartSubtotal, isEs) && (
            <p className="text-xs leading-snug" style={{ color: 'var(--color-on-surface-variant)' }}>
              {getShippingServiceNote(effectiveShippingMethod, cartSubtotal, isEs)}
            </p>
          )}
          {cartSubtotal >= EXPRESS_SHIPPING_MAX_SUBTOTAL && (
            <p className="text-xs leading-snug" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'El envío nocturno no está disponible para pedidos de $5,000 o más (límite de seguro del transportista).'
                : 'Overnight shipping is unavailable for orders of $5,000 or more (carrier insurance limit).'}
            </p>
          )}
          <div className="checkout-step-nav">
            <button type="button" className="outline-button" onClick={() => goToStep('summary')}>
              {isEs ? '< Resumen' : '< Summary'}
            </button>
            <button type="button" className="gold-button" onClick={() => goToStep('contact')}>
              {isEs ? 'Continuar a contacto' : 'Continue to Contact'}
            </button>
          </div>
        </div>
        )}

        {step === 'review' && (
        <div className="checkout-contact-panel checkout-payment-panel">
          <div className="checkout-panel-heading">
            <AppIcon name="payments"  aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Paso 4' : 'Step 4'}
              </p>
              <h2>{isEs ? 'Revise y pague' : 'Review and pay'}</h2>
            </div>
          </div>

          <div className="checkout-review-recap">
            <div>
              <p className="checkout-recap-title">{isEs ? 'Entrega' : 'Delivery'}</p>
              <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}>
                {(() => {
                  const selected = CHECKOUT_SHIPPING_OPTIONS.find((option) => option.value === effectiveShippingMethod);
                  const fee = getCheckoutShippingFee(effectiveShippingMethod, cartSubtotal) ?? 0;
                  return `${selected ? (isEs ? selected.labelEs : selected.labelEn) : effectiveShippingMethod} — ${formatCheckoutCurrency(fee)}`;
                })()}
              </p>
              <button type="button" className="checkout-recap-edit" onClick={() => goToStep('delivery')}>
                {isEs ? 'Editar' : 'Edit'}
              </button>
            </div>
            <div>
              <p className="checkout-recap-title">{isEs ? 'Contacto' : 'Contact'}</p>
              <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}>{customer.name}</p>
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{customer.phone} · {customer.email}</p>
              {needsShipping && (
                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {[customer.address_line1, customer.address_line2, customer.city, customer.state, customer.postal_code].filter(Boolean).join(', ')}
                </p>
              )}
              <button type="button" className="checkout-recap-edit" onClick={() => goToStep('contact')}>
                {isEs ? 'Editar' : 'Edit'}
              </button>
            </div>
          </div>

          <OrderSummary
            items={summaryItems}
            isEs={isEs}
            prefix={prefix}
            shippingMethod={effectiveShippingMethod}
            shippingState={customer.state}
            onRemove={remove}
            onSetQuantity={setQuantity}
            variant="expanded"
            showAvailability
            hideSoldItemPrices={hideSoldItemPrices}
          />

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

          {hasUnavailableItem ? (
            <div
              role="alert"
              className="flex items-start gap-2 text-sm"
              style={{
                padding: '0.75rem 0.85rem',
                border: '1px solid color-mix(in srgb, var(--color-error) 45%, transparent)',
                background: 'color-mix(in srgb, var(--color-error) 9%, transparent)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--color-error)',
                fontWeight: 600,
              }}
            >
              <AppIcon name="error"  aria-hidden="true" style={{ fontSize: '1.15rem', lineHeight: 1.25, flexShrink: 0 }} />
              <span>
                {isEs
                  ? `Ya no está disponible: ${unavailableItems.map((i) => i.title_es || i.title).join(', ')}. Elimínelo de su pedido arriba para continuar con el pago.`
                  : `No longer available: ${unavailableItems.map((i) => i.title).join(', ')}. Please remove it from your order above to continue to payment.`}
              </span>
            </div>
          ) : paypalClientId ? (
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
              // A create-order/capture error can mean an item just sold out — re-check
              // live stock so the summary + this button reflect it immediately.
              onAvailabilityIssue={() => { void refreshAvailability(); }}
              onSuccess={({ orderNumber }) => {
                // Snapshot the order for the printable confirmation, THEN clear the
                // cart (clearing empties `items`, so capture the summary first).
                setCreatedOrder({ orderNumber, items: summaryItems, shippingMethod: effectiveShippingMethod, customer });
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
        )}
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
        .checkout-steps {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          max-width: 54rem;
          margin: 0 auto 1.25rem;
        }
        .checkout-step-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.8rem 0.45rem 0.5rem;
          border: 1px solid rgba(216, 208, 194, 0.94);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-on-surface-variant);
          font-family: var(--font-label);
          cursor: pointer;
        }
        .checkout-step-chip[data-state='current'] {
          border-color: #b5890c;
          color: #735c00;
          background: rgba(212, 175, 55, 0.14);
          cursor: default;
        }
        .checkout-step-chip[data-state='done'] {
          color: #735c00;
        }
        .checkout-step-chip[data-state='todo'] {
          opacity: 0.55;
          cursor: default;
        }
        .checkout-step-num {
          display: inline-flex;
          width: 1.35rem;
          height: 1.35rem;
          border-radius: 999px;
          align-items: center;
          justify-content: center;
          background: rgba(115, 92, 0, 0.1);
          font-size: 0.68rem;
        }
        .checkout-step-flow {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          max-width: 54rem;
          margin: 0 auto;
          width: 100%;
        }
        .checkout-step-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }
        .checkout-delivery-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .checkout-delivery-option {
          display: flex;
          gap: 0.75rem;
          padding: 0.9rem 1rem;
          border: 1px solid rgba(216, 208, 194, 0.94);
          border-radius: var(--radius-lg);
          background: rgba(255, 253, 248, 0.9);
          cursor: pointer;
        }
        .checkout-delivery-option[data-selected='true'] {
          border-color: #b5890c;
          box-shadow: 0 0 0 1px #b5890c inset;
        }
        .checkout-auth-overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: rgba(42, 34, 12, 0.45);
        }
        .checkout-auth-card {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          width: min(26rem, 100%);
          padding: 1.5rem;
          border: 1px solid rgba(216, 208, 194, 0.94);
          background: #fffdf8;
          box-shadow: 0 24px 64px rgba(42, 34, 12, 0.25);
          border-radius: var(--radius-lg);
        }
        .checkout-review-recap {
          display: grid;
          gap: 0.9rem;
          padding: 0.9rem 1rem;
          border: 1px solid rgba(216, 208, 194, 0.94);
          border-radius: var(--radius-lg);
          background: rgba(255, 253, 248, 0.9);
        }
        @media (min-width: 640px) {
          .checkout-review-recap {
            grid-template-columns: 1fr 1fr;
          }
        }
        .checkout-recap-title {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #735c00;
          font-family: var(--font-label);
          margin-bottom: 0.2rem;
        }
        .checkout-recap-edit {
          margin-top: 0.35rem;
          padding: 0;
          border: none;
          background: none;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #735c00;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
          font-family: var(--font-label);
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
          .checkout-step-flow {
            gap: 1.5rem;
          }
        }
        .checkout-panel-heading > .app-icon {
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
