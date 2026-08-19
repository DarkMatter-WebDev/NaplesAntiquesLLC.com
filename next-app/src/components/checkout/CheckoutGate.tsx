'use client';

const BORDER = '#d8d0c2';

/**
 * The buyer's "I don't want an account" answer, remembered per TAB.
 *
 * sessionStorage, not localStorage, on purpose: the answer belongs to this
 * shopping run, not to the device. A PayPal cancel/return re-mounts the
 * checkout page and must not re-ask, but a visit next week should.
 */
export const CHECKOUT_AUTH_CHOICE_KEY = 'nej-checkout-auth-choice';

/**
 * Records that the buyer chose to continue without signing in.
 *
 * ⚠️ The cart drawer MUST call this before routing to `/checkout`. It is the
 * only thing stopping the checkout page from opening this same gate a second
 * time — which is exactly the double-prompt bug fixed on 2026-08-19.
 */
export function rememberGuestCheckout() {
  try {
    sessionStorage.setItem(CHECKOUT_AUTH_CHOICE_KEY, 'guest');
  } catch {
    /* storage unavailable — the gate simply asks again rather than throwing */
  }
}

export function hasChosenGuestCheckout(): boolean {
  try {
    return sessionStorage.getItem(CHECKOUT_AUTH_CHOICE_KEY) === 'guest';
  } catch {
    /* storage unavailable — treat as "not asked yet" */
    return false;
  }
}

/**
 * The ONE sign-in/guest gate a signed-out buyer ever sees.
 *
 * WHY IT LIVES IN ITS OWN FILE
 * ----------------------------
 * There used to be two of these: this one (four options) raised by the cart
 * drawer, and a second, thinner one (sign in / guest only) baked into
 * `CheckoutClient`. The drawer never recorded the buyer's answer, so a shopper
 * who picked "Continue as Guest" was asked again the moment checkout mounted.
 * The owner picked this screen; the other is gone. Both callers now render THIS
 * component, so there is one design and one set of options.
 *
 * ⚠️ RENDER IT OUTSIDE `.checkout-page`. It is `position: fixed`, and
 * `.checkout-page` carries `data-customer-reveal="visible"` — whose
 * transform/filter/will-change (globals.css) make it a containing block for
 * fixed descendants. Nested inside it, `inset: 0` resolved to the full 2409px
 * page rather than the viewport and the card centred 1114px down a 812px
 * phone screen: dimmed, unreachable, and off-screen until you scrolled. Any
 * ancestor with a transform, filter or will-change reintroduces that bug.
 */
export default function CheckoutGate({
  isEs,
  prefix,
  checkoutHref,
  showCancel = true,
  onClose,
  onGuest,
  onNavigate,
}: {
  isEs: boolean;
  prefix: string;
  checkoutHref: string;
  /**
   * Cancel means "don't go to checkout", which only makes sense from the cart.
   * On the checkout page the buyer is already there and "Continue as Guest" is
   * the way out, so the caller hides it rather than showing two buttons that
   * do the same thing.
   */
  showCancel?: boolean;
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

        {showCancel && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full text-center text-xs font-bold uppercase tracking-widest transition-colors hover:text-[#735c00]"
            style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
          >
            {isEs ? 'Cancelar' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  );
}
