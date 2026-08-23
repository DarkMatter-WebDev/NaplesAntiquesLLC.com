/**
 * Phone-number normalization for checkout and contact forms.
 *
 * Exists because checkout only ever checked that `phone` was non-empty. A buyer
 * tabbed out of "Full Name" after typing her first name, typed her surname into
 * "Phone", and placed a real order whose `customer_phone` was `Catlett`
 * (2026-08-22). The order was otherwise valid and paid — it just left the owner
 * with no way to reach the buyer by phone.
 *
 * Deliberately permissive about FORMAT and strict about SUBSTANCE: every way a
 * person might punctuate a number is accepted, but the digits underneath have to
 * be able to ring a telephone.
 *
 * A rejection here costs a sale, so the rules below are structural NANP/E.164
 * facts rather than guesses about what "looks real". Anything that could plausibly
 * be a working number is accepted and merely reformatted.
 */

/** NANP national number: area code, central office code, 4-digit line number. */
const NANP_RE = /^([2-9]\d{2})([2-9]\d{2})(\d{4})$/;

/**
 * Trailing extension, in the shapes people actually type ("x12", "ext. 12",
 * "#12", ", 12"). Captured and preserved rather than rejected — the owner needs
 * it to complete the call.
 */
const EXTENSION_RE = /\s*(?:x|ext|extension|#|,|;)\.?\s*(\d{1,6})\s*$/i;

/**
 * N11 codes (211, 311, ... 911) are reserved service codes and are never
 * assigned as an area code or a central office code, so a number containing one
 * cannot ring. This is what rejects placeholders like `111-111-1111`.
 */
function isServiceCode(code: string): boolean {
  return code[1] === '1' && code[2] === '1';
}

function withExtension(base: string, extension: string | null): string {
  return extension ? `${base} x${extension}` : base;
}

/**
 * Returns a canonical, dialable phone number, or `null` if the input cannot be
 * one.
 *
 * - U.S./Canada numbers come back formatted `(239) 404-8505`, with a leading
 *   country code `1` accepted and dropped.
 * - A number entered with an explicit `+` country code is kept as E.164
 *   (`+442071234567`). The `+` is required for international: without it we
 *   cannot tell a foreign number from a typo, and the shop only ships within
 *   the U.S. anyway (see `validateUsShippingAddress`).
 * - A trailing extension is preserved as ` x12`.
 */
export function normalizePhoneNumber(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  let body = raw;
  let extension: string | null = null;
  const extensionMatch = EXTENSION_RE.exec(body);
  if (extensionMatch) {
    extension = extensionMatch[1];
    body = body.slice(0, extensionMatch.index);
  }

  const isInternational = body.trimStart().startsWith('+');
  const digits = body.replace(/\D/g, '');
  if (!digits) return null;

  // `+1` is NANP, so it falls through to the national rules below rather than
  // being kept as an opaque E.164 string.
  if (isInternational && !digits.startsWith('1')) {
    // E.164 allows at most 15 digits including the country code. The floor is a
    // sanity check, not a standard — no reachable international number is
    // shorter than a country code plus a subscriber number.
    if (digits.length < 8 || digits.length > 15) return null;
    return withExtension(`+${digits}`, extension);
  }

  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  const match = NANP_RE.exec(national);
  if (!match) return null;

  const [, areaCode, exchange, lineNumber] = match;
  if (isServiceCode(areaCode) || isServiceCode(exchange)) return null;

  return withExtension(`(${areaCode}) ${exchange}-${lineNumber}`, extension);
}

/** Convenience predicate for form-readiness checks. */
export function isValidPhoneNumber(value: unknown): boolean {
  return normalizePhoneNumber(value) !== null;
}

/**
 * The one phrasing shown when a phone number is rejected, in both locales.
 *
 * Lives here so all five surfaces that collect a phone (checkout plus the four
 * lead/contact forms) share one rule AND one message. `MessageUsForm` and
 * `/api/contact-message` each carried their own copy of a looser "at least 10
 * digits" rule before 2026-08-22 — the same per-surface duplication that let the
 * photo-swipe fix miss the product gallery.
 *
 * The example number uses the 555-01xx range reserved for fictional use.
 */
export function phoneErrorMessage(isEs: boolean): string {
  return isEs
    ? 'Ingrese un número de teléfono válido, por ejemplo (239) 555-0123.'
    : 'Please enter a valid phone number, for example (239) 555-0123.';
}
