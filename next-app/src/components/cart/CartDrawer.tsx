'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startRouteProgress } from '@/components/layout/RouteProgressBar';
import { useCart, type CartItem } from '@/context/CartContext';
import { formatProductItemYear, isProductPurchasable, isProductSold, normalizeProductQuantity, productImagePaddingBackground, productStatusLabel } from '@/types/product';
import { QuantityStepper } from '@/components/checkout/OrderSummary';
import StockAlertBanner from '@/components/cart/StockAlertBanner';
import type { StockAlert } from '@/context/CartContext';
import { normalizeLegacyLocalImageUrl } from '@/lib/image-url';
import {
  calculateFlSalesTax,
  FL_TAX_RATE_LABEL,
  formatCheckoutCurrency,
  round2,
  type OrderQuote,
} from '@/lib/checkout-pricing';
import { parseManualPriceLabelValue } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/client';
import { useHideSoldItemPrices } from '@/hooks/useHideSoldItemPrices';
import { findUnavailableCartItems } from '@/lib/cart-availability';
import { AppIcon } from '@/components/AppIcon';

const GOLD = '#735c00';
const BORDER = '#d8d0c2';

function parsePrice(label: string): number | null {
  return parseManualPriceLabelValue(label);
}

export default function CartDrawer({ locale }: { locale: string }) {
  const { items, remove, clear, setQuantity, drawerOpen, closeDrawer, refreshAvailability, stockAlerts, dismissStockAlerts } = useCart();
  const router = useRouter();
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';
  const checkoutHref = `${prefix}/checkout`;
  const hideSoldItemPrices = useHideSoldItemPrices(drawerOpen);
  const hasUnavailableItems = findUnavailableCartItems(items).length > 0;

  // Re-check live stock each time the drawer is opened, so the shopper sees an
  // up-to-date picture (and an alert) if something sold out while it sat in their
  // cart. Fire-and-forget — a failed check just leaves the cart as-is.
  useEffect(() => {
    if (drawerOpen) void refreshAvailability();
  }, [drawerOpen, refreshAvailability]);

  // Live prices, same source as the checkout summary. Without this the drawer
  // renders the price LABEL frozen at add-to-cart time, which drifts as metal
  // moves (64% of the catalog is spot-linked) — and after the checkout page
  // started quoting, the two surfaces would have disagreed with each other, one
  // click apart via "Edit cart".
  //
  // Tagged with the cart it was computed for, so a quote is ignored the moment
  // the cart changes rather than briefly describing a cart the shopper has
  // already edited.
  const [quoteState, setQuoteState] = useState<{ key: string; quote: OrderQuote } | null>(null);
  const quoteKey = items
    .map((i) => `${i.id}:${Math.max(1, normalizeProductQuantity(i.purchaseQuantity))}`)
    .sort()
    .join(',');
  const quote = quoteState?.key === quoteKey ? quoteState.quote : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Only while the drawer is actually open — it is always mounted, so an
      // unconditional fetch would quote on every page load for every visitor.
      if (!drawerOpen || items.length === 0) return;
      try {
        const res = await fetch('/api/checkout/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((i) => ({ id: i.id, quantity: Math.max(1, normalizeProductQuantity(i.purchaseQuantity)) })),
            // Local pickup deliberately: the drawer shows "calculated at
            // checkout" for shipping and only consumes unit prices + subtotal.
            // It also cannot be refused the way Express is above $5,000.
            shippingMethod: 'local-pickup',
          }),
        });
        if (cancelled) return;
        const data = await res.json().catch(() => null);
        // A failed quote leaves the stored labels in place rather than blanking
        // the drawer. Checkout still recomputes authoritatively either way.
        if (res.ok && data?.quote) setQuoteState({ key: quoteKey, quote: data.quote as OrderQuote });
      } catch {
        /* keep whatever is showing */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, quoteKey]);

  // Auth state, resolved when the drawer opens, so "Proceed to Checkout" knows
  // whether to go straight through (signed in) or offer the sign-in / guest gate.
  // null = not yet known.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [showCheckoutGate, setShowCheckoutGate] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);

  useEffect(() => {
    if (!drawerOpen || loggedIn !== null) return;
    let cancelled = false;
    createClient().auth.getUser()
      .then(({ data }) => { if (!cancelled) setLoggedIn(!!data.user); })
      .catch(() => { if (!cancelled) setLoggedIn(false); });
    return () => { cancelled = true; };
  }, [drawerOpen, loggedIn]);

  async function handleProceedToCheckout() {
    if (checkoutPending || hasUnavailableItems) return;
    setCheckoutPending(true);

    // Resolve auth on the spot if the drawer was clicked before the effect settled.
    let isLoggedIn = loggedIn;
    if (isLoggedIn === null) {
      try {
        const { data } = await createClient().auth.getUser();
        isLoggedIn = !!data.user;
        setLoggedIn(isLoggedIn);
      } catch {
        isLoggedIn = false;
      }
    }
    if (isLoggedIn) {
      setCheckoutPending(false);
      closeDrawer();
      startRouteProgress(checkoutHref);
      router.push(checkoutHref);
    } else {
      // Signed-out shoppers get the choice to log in, create an account, or
      // continue as a guest before landing on checkout.
      setCheckoutPending(false);
      setShowCheckoutGate(true);
    }
  }

  function handleClose() {
    closeDrawer();
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    const x = e.clientX;
    const y = e.clientY;
    handleClose();
    setTimeout(() => {
      const el = document.elementFromPoint(x, y);
      if (!el || !(el instanceof HTMLElement)) return;
      const clickable = el.closest('a, button') as HTMLElement | null;
      if (clickable) clickable.click();
    }, 0);
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
        className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[min(28rem,100vw)] flex-col shadow-2xl transition-transform duration-300"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,253,248,0.98) 100%)',
          borderLeft: `1px solid ${BORDER}`,
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          maxHeight: '100svh',
        }}
        role="dialog"
        aria-label={isEs ? 'Carrito' : 'Cart'}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between border-b px-5 py-5 flex-shrink-0" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-3">
            <AppIcon name="shopping_cart"

              aria-hidden="true"
              style={{
                width: '2.35rem',
                height: '2.35rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '999px',
                background: 'rgba(212, 175, 55, 0.12)',
                color: GOLD,
              }}
             />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                {isEs ? 'Mi Carrito' : 'My Cart'}
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {items.length > 0
                  ? `${items.length} ${isEs ? (items.length === 1 ? 'artículo' : 'artículos') : (items.length === 1 ? 'item' : 'items')}`
                  : (isEs ? 'Sin artículos' : 'No items yet')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[rgba(212,175,55,0.12)] hover:text-[#735c00]"
            style={{ color: 'var(--color-on-surface-variant)' }}
            aria-label="Close"
          >
            <AppIcon name="close"  aria-hidden="true" style={{ fontSize: '20px' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <CartView items={items} isEs={isEs} prefix={prefix} hideSoldItemPrices={hideSoldItemPrices} onRemove={remove} onSetQuantity={setQuantity} onClear={clear} onClose={handleClose} onCheckout={handleProceedToCheckout} checkoutPending={checkoutPending} hasUnavailableItems={hasUnavailableItems} stockAlerts={stockAlerts} onDismissAlerts={dismissStockAlerts} quote={quote} />
        </div>
      </div>

      {showCheckoutGate && (
        <CheckoutGate
          isEs={isEs}
          prefix={prefix}
          checkoutHref={checkoutHref}
          onClose={() => setShowCheckoutGate(false)}
          onGuest={() => {
            setShowCheckoutGate(false);
            if (hasUnavailableItems) return;
            closeDrawer();
            startRouteProgress(checkoutHref);
            router.push(checkoutHref);
          }}
          onNavigate={(href) => {
            setShowCheckoutGate(false);
            closeDrawer();
            startRouteProgress(href);
            router.push(href);
          }}
        />
      )}
    </>
  );
}

function CheckoutGate({
  isEs,
  prefix,
  checkoutHref,
  onClose,
  onGuest,
  onNavigate,
}: {
  isEs: boolean;
  prefix: string;
  checkoutHref: string;
  onClose: () => void;
  onGuest: () => void;
  onNavigate: (href: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-label={isEs ? 'Opciones de pago' : 'Checkout options'}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--color-background)', border: `1px solid ${BORDER}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 text-center">
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
            {isEs ? '¿Cómo desea continuar?' : 'How would you like to continue?'}
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            {isEs
              ? 'Inicie sesión para un pago más rápido, o continúe como invitado — no se requiere cuenta.'
              : 'Sign in for a faster checkout, or continue as a guest — no account required.'}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate(`${prefix}/account/sign-in?next=${encodeURIComponent(checkoutHref)}`)}
            className="gold-button justify-center"
            style={{ width: '100%' }}
          >
            {isEs ? 'Iniciar sesión' : 'Log In'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(`${prefix}/account/sign-up`)}
            className="outline-button justify-center"
            style={{ width: '100%' }}
          >
            {isEs ? 'Crear cuenta' : 'Create Account'}
          </button>
          <button
            type="button"
            onClick={onGuest}
            className="outline-button justify-center"
            style={{ width: '100%' }}
          >
            {isEs ? 'Continuar como invitado' : 'Continue as Guest'}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-xs font-bold uppercase tracking-widest transition-colors hover:text-[#735c00]"
          style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
        >
          {isEs ? 'Cancelar' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

function CartView({
  items,
  isEs,
  prefix,
  hideSoldItemPrices,
  onRemove,
  onSetQuantity,
  onClear,
  onClose,
  onCheckout,
  checkoutPending,
  hasUnavailableItems,
  stockAlerts,
  onDismissAlerts,
  quote,
}: {
  items: CartItem[];
  isEs: boolean;
  prefix: string;
  hideSoldItemPrices: boolean;
  onRemove: (id: string) => void;
  onSetQuantity: (id: string, quantity: number) => void;
  onClear: () => void;
  onClose: () => void;
  onCheckout: () => void;
  checkoutPending: boolean;
  hasUnavailableItems: boolean;
  stockAlerts: StockAlert[];
  onDismissAlerts: () => void;
  /** Live server prices; falls back to the cart's stored labels when absent. */
  quote: OrderQuote | null;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 text-center mt-16 px-6">
        <AppIcon name="shopping_cart"  style={{ fontSize: '40px', color: 'var(--color-outline-variant)' }} />
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Tu carrito está vacío.' : 'Your cart is empty.'}
        </p>
        <Link href={`${prefix}/shop`} onClick={onClose} className="outline-button text-xs mt-2">
          {isEs ? 'Ver tienda' : 'Browse Shop'}
        </Link>
      </div>
    );
  }

  // Live unit price for a line, or null to fall back to its stored label.
  const quotedUnitPrice = (productId: string): number | null =>
    quote?.items.find((q) => q.productId === productId)?.unitPrice ?? null;

  const lineTotals = items.map((i) => {
    if (hideSoldItemPrices && isProductSold(i.status)) return null;
    const unit = quotedUnitPrice(i.id) ?? parsePrice(i.priceLabel);
    return unit === null ? null : unit * Math.max(1, normalizeProductQuantity(i.purchaseQuantity));
  });
  const knownLineTotals = lineTotals.filter((p): p is number => p !== null);
  const hasUnknown = knownLineTotals.length < lineTotals.length;
  const subtotal = round2(knownLineTotals.reduce((a, b) => a + b, 0));
  const tax = calculateFlSalesTax(subtotal);
  const total = round2(subtotal + tax);

  return (
      <div className="flex min-h-0 flex-col">
      <div className="px-4 py-4 flex flex-col gap-3">
        <StockAlertBanner alerts={stockAlerts} isEs={isEs} onDismiss={onDismissAlerts} />
        {items.map((item) => (
          <CartItemRow key={item.id} item={item} isEs={isEs} prefix={prefix} hideSoldItemPrices={hideSoldItemPrices} onRemove={() => onRemove(item.id)} onSetQuantity={(qty) => onSetQuantity(item.id, qty)} quotedUnitPrice={quotedUnitPrice(item.id)} />
        ))}
      </div>

      <div className="mx-4 border px-4 py-3" style={{ borderColor: BORDER, background: 'rgba(255, 253, 248, 0.82)' }}>
        <div className="flex flex-col gap-1 text-xs" style={{ fontFamily: 'var(--font-label)', color: 'var(--color-on-surface-variant)' }}>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{subtotal > 0 ? formatCheckoutCurrency(subtotal) : '-'}{hasUnknown ? '*' : ''}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>{isEs ? 'Envío' : 'Shipping'}</span>
            <span className="text-right">{isEs ? 'Calculado al finalizar la compra' : 'Calculated at checkout'}</span>
          </div>
          <div className="flex justify-between">
            <span>{isEs ? `Impuesto FL (${FL_TAX_RATE_LABEL})` : `FL Sales Tax (${FL_TAX_RATE_LABEL})`}</span>
            <span>{subtotal > 0 ? formatCheckoutCurrency(tax) : '-'}</span>
          </div>
          <div
            className="flex justify-between pt-1 mt-1 font-bold text-sm"
            style={{ borderTop: `1px solid ${BORDER}`, color: 'var(--color-on-surface)' }}
          >
            <span>{isEs ? 'Total estimado' : 'Est. Total'}</span>
            <span style={{ color: GOLD }}>{subtotal > 0 ? formatCheckoutCurrency(total) : '-'}</span>
          </div>
          {hasUnknown && (
            <p className="text-[0.6rem] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              * {isEs ? 'Algunos artículos requieren confirmación de precio.' : 'Some items require price confirmation.'}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onCheckout}
          disabled={checkoutPending || hasUnavailableItems}
          aria-busy={checkoutPending}
          className="gold-button justify-center"
          style={{ width: '100%' }}
        >
          {hasUnavailableItems
            ? (isEs ? 'Elimina los artículos no disponibles' : 'Remove Unavailable Items')
            : checkoutPending
            ? (isEs ? 'Comprobando...' : 'Checking...')
            : (isEs ? 'Proceder al pago' : 'Proceed to Checkout')}
          {!checkoutPending && !hasUnavailableItems && (
            <AppIcon name="chevron_right"  aria-hidden="true" style={{ fontSize: '17px', lineHeight: 1 }} />
          )}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="outline-button justify-center text-xs"
          style={{
            width: '100%',
            borderColor: 'rgba(186, 26, 26, 0.32)',
            color: 'var(--color-error)',
          }}
        >
          {isEs ? 'Vaciar carrito' : 'Clear Cart'}
        </button>
        <Link href={`${prefix}/shop`} onClick={onClose} className="outline-button justify-center text-xs" style={{ width: '100%' }}>
          {isEs ? 'Seguir comprando' : 'Continue Shopping'}
        </Link>
      </div>
    </div>
  );
}

function CartItemRow({ item, isEs, prefix, hideSoldItemPrices, onRemove, onSetQuantity, quotedUnitPrice = null }: { item: CartItem; isEs: boolean; prefix: string; hideSoldItemPrices: boolean; onRemove: () => void; onSetQuantity: (quantity: number) => void; quotedUnitPrice?: number | null }) {
  const title = isEs && item.title_es ? item.title_es : item.title;
  const description = (isEs && item.description_es ? item.description_es : item.description) ?? item.public_notes ?? null;
  const imageFrameBackground = productImagePaddingBackground(item.image_padding);
  const image = normalizeLegacyLocalImageUrl(item.image);
  const itemDate = formatProductItemYear(item.item_year);
  const purchasable = isProductPurchasable(item.status, item.stockQuantity);
  const hidePrice = hideSoldItemPrices && isProductSold(item.status);
  const stockCap = Math.max(1, normalizeProductQuantity(item.stockQuantity));
  const qty = Math.max(1, normalizeProductQuantity(item.purchaseQuantity));
  // Live figure first; the stored label is the fallback when no quote is in hand.
  const unitPrice = quotedUnitPrice ?? parsePrice(item.priceLabel);
  const unitPriceLabel = quotedUnitPrice != null ? formatCheckoutCurrency(quotedUnitPrice) : item.priceLabel;
  const lineTotal = unitPrice === null ? null : unitPrice * qty;
  return (
      <div className="flex gap-3 items-start border p-3" style={{ borderColor: BORDER, background: 'rgba(255, 255, 255, 0.74)' }}>
      <Link href={`${prefix}/shop/${item.id}`} className="relative flex-shrink-0 w-16 h-16 min-[380px]:h-20 min-[380px]:w-20 overflow-hidden" style={{ background: imageFrameBackground }}>
        {image
          ? <Image src={image} alt={title} fill sizes="80px" className="object-contain" unoptimized={image.startsWith('/assets/')} />
          : <div className="w-full h-full flex items-center justify-center text-xl opacity-30">Photo</div>}
      </Link>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Link href={`${prefix}/shop/${item.id}`} className="hover-underline-grow text-sm font-bold leading-snug"
          style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
          {title}
        </Link>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
          {hidePrice ? (isEs ? 'Vendido' : 'Sold') : unitPriceLabel}
        </p>
        {itemDate && (
          <p className="text-[0.64rem] font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
            <span className="normal-case">Ca.</span> {itemDate}
          </p>
        )}
        {description && (
          <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
            {description}
          </p>
        )}
        {!purchasable && (
          <span className="text-[0.55rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-error)' }}>
            {isEs ? 'No disponible' : productStatusLabel(item.status)}
          </span>
        )}
        {purchasable && stockCap > 1 && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <QuantityStepper value={qty} max={stockCap} onChange={onSetQuantity} isEs={isEs} />
            {lineTotal !== null && (
              <span className="text-[0.7rem] font-bold" style={{ color: GOLD, fontFamily: 'var(--font-label)' }}>
                = {formatCheckoutCurrency(lineTotal)}
              </span>
            )}
            <span className="w-full text-[0.6rem] font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
              {stockCap} {isEs ? 'en stock' : 'in stock'}
            </span>
          </div>
        )}
      </div>
      <button type="button" onClick={onRemove} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[rgba(186,26,26,0.08)] hover:text-[color:var(--color-error)]"
        style={{ color: 'var(--color-on-surface-variant)' }} aria-label={isEs ? 'Eliminar' : 'Remove'}>
        <AppIcon name="close"  aria-hidden="true" style={{ fontSize: '18px' }} />
      </button>
    </div>
  );
}
