/**
 * Full-name composition and validation for checkout.
 *
 * Companion to `lib/phone.ts`, from the same 2026-08-22 order: the buyer typed
 * "Sara" in Full Name and "Catlett" in Phone. Validating the phone stops the
 * unreachable-buyer half, but on its own it would still leave orders — and
 * shipping labels, and the PayPal `fullName` — addressed to a first name only.
 *
 * Checkout now collects First Name and Last Name as **two fields**, so the
 * client guarantees both parts structurally rather than by rejecting a string.
 * These helpers exist to compose them into the single `customer_name` the
 * `orders` table has always stored, and to re-check the result server-side —
 * `/api/paypal/create-order` is reachable directly, so the two-field form is
 * convenience, not enforcement.
 *
 * ⚠️ `parseFullName` is a FALLBACK for legacy/prefill values only (a stored
 * `profiles.full_name`, an older saved order). Splitting a name on whitespace is
 * wrong for plenty of real names — "Juan de la Cruz" is not first="Juan",
 * last="de". It is acceptable only because the buyer sees both fields filled in
 * and can correct them before paying. Never use it on data nobody will review.
 */

/** A token counts as a name part only if it contains a letter. */
const HAS_LETTER = /\p{L}/u;

function collapse(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Joins a first and last name into the single value stored on the order, or
 * `null` if either side is missing.
 */
export function composeFullName(first: unknown, last: unknown): string | null {
  const firstName = collapse(first);
  const lastName = collapse(last);
  if (!HAS_LETTER.test(firstName) || !HAS_LETTER.test(lastName)) return null;
  return `${firstName} ${lastName}`;
}

/**
 * Display join that never returns `null` — for surfaces that render whatever was
 * captured (the on-screen receipt) rather than deciding whether to accept it.
 */
export function formatFullName(first: unknown, last: unknown): string {
  return [collapse(first), collapse(last)].filter(Boolean).join(' ');
}

/**
 * Returns a composed name with whitespace collapsed, or `null` if it is not at
 * least two name parts.
 *
 * ⚠️ **Deliberately the most lenient rule that does the job: two tokens.** No
 * length floor, no character-class rules, no shape heuristics. Do NOT
 * "strengthen" this into a judgement about what a real name looks like — that is
 * how you silently discard paying customers with unusual names. This project has
 * the scar already: the spam threshold set by eye to 4 would have dropped a real
 * customer named `VanDerBeek`.
 */
export function normalizePersonName(value: unknown): string | null {
  const collapsed = collapse(value);
  if (!collapsed) return null;

  const parts = collapsed.split(' ');
  if (parts.length < 2) return null;
  // Guards against "Sara ." and "Sara 123" without constraining real names.
  if (!HAS_LETTER.test(parts[0]) || !parts.slice(1).some((part) => HAS_LETTER.test(part))) {
    return null;
  }

  return collapsed;
}

/** Convenience predicate for form-readiness checks. */
export function isCompletePersonName(value: unknown): boolean {
  return normalizePersonName(value) !== null;
}

/**
 * Best-effort split of a stored full name back into two fields, for PREFILL
 * ONLY (see the file header). Everything after the first token becomes the last
 * name, which keeps multi-word surnames intact.
 */
export function parseFullName(value: unknown): { first: string; last: string } {
  const collapsed = collapse(value);
  if (!collapsed) return { first: '', last: '' };
  const [first, ...rest] = collapsed.split(' ');
  return { first, last: rest.join(' ') };
}
