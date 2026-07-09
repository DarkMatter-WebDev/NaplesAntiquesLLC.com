// Pure helpers for the PayPal checkout error UX (see PayPalCheckoutButton).
// Extracted so the message/escalation logic is unit-testable without a browser.

/**
 * Does a server error message indicate an item is no longer buyable (sold out,
 * low stock, or won by another buyer)? Used to show a stock-specific message and
 * trigger a live re-check instead of a generic PayPal error.
 */
export function isAvailabilityError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /no longer available|not available|unavailable|sold|out of stock|not enough stock|just purchased|another buyer/i.test(message);
}

/**
 * Message for a generic PayPal failure we can't attribute to a specific cause.
 * Because the buyer may have been paying by debit/credit card through PayPal's
 * hosted card form, a card problem is a real possibility — so on the FIRST return
 * we suggest re-checking the card details "just in case", and on the SECOND we
 * suggest trying a different card. Both keep the sold-out possibility in view (a
 * re-check runs in parallel and flags it in the summary if that's the real cause).
 *
 * @param attempt 1-based count of consecutive unknown errors this session.
 */
export function composeUnknownErrorMessage(attempt: number, isEs: boolean): string {
  if (attempt >= 2) {
    return isEs
      ? 'El pago aún no se completó. Es posible que su tarjeta no se acepte — intente con una tarjeta diferente, o llámenos al (239) 404-8505 y le ayudamos a completar su compra. (Si un artículo aparece agotado en su resumen de arriba, quítelo e intente de nuevo.)'
      : 'The payment still didn’t go through. Your card may not be going through — please try a different card, or call us at (239) 404-8505 and we’ll help you complete your purchase. (If an item now shows as sold out in your order summary above, remove it and try again.)';
  }
  return isEs
    ? 'PayPal lo devolvió sin completar el pago y no obtuvimos un motivo exacto. Si pagó con tarjeta de débito o crédito, verifique el número y los datos de la tarjeta e intente de nuevo. (Si un artículo aparece agotado en su resumen de arriba, esa es la causa.)'
    : 'PayPal sent you back without completing the payment, and we couldn’t get an exact reason. If you paid by debit or credit card, please re-enter and double-check your card number and details, then try again. (If an item now shows as sold out in your order summary above, that’s the cause instead.)';
}
