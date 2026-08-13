// Discount codes: shared types, normalization, and the discount math.
//
// This module is deliberately directive-free (no 'use client'/'use server') and
// has no Supabase import, so the SERVER pricing path (checkout-pricing.ts) and
// the CLIENT display path (OrderSummary.tsx) can both import the same math.
// That is the same discipline FL_TAX_RATE follows: the displayed discount and
// the charged discount cannot drift because there is only one implementation.
//
// ⚠️ The client's copy is for DISPLAY ONLY. The authoritative discount is
// recomputed server-side in buildOrderDraft from the code string alone — the
// browser never sends an amount. See the `?returnTo=` rule in DECISIONS: a
// client-supplied value is never an authorization signal.

// `calculateDiscountAmount` lives in checkout-pricing.ts beside round2 and the
// rest of the money math, and is re-exported here so callers have one import
// for everything discount-related. Keeping the dependency one-directional
// (discount-codes -> checkout-pricing at runtime, checkout-pricing -> this file
// for TYPES only) is what avoids a module cycle; checkout-pricing.ts must keep
// using `import type` for the types below.
import { calculateDiscountAmount } from '@/lib/checkout-pricing';

export { calculateDiscountAmount };

export type DiscountType = 'percent' | 'fixed';

export function isDiscountType(value: unknown): value is DiscountType {
  return value === 'percent' || value === 'fixed';
}

/** A discount code row as stored. Mirrors supabase/discount-codes-2026-08.sql. */
export type DiscountCodeRecord = {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_subtotal: number | null;
  expires_at: string | null;
  max_redemptions: number | null;
  times_used: number;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** The resolved discount attached to an order. */
export type AppliedDiscount = {
  code: string;
  type: DiscountType;
  /** The code's configured value: a percentage (1-100) or a dollar amount. */
  value: number;
  /** The resolved dollar amount actually taken off, already clamped + rounded. */
  amount: number;
};

/**
 * Machine-readable reason a code was refused. The client maps these to bilingual
 * copy rather than pattern-matching English (same approach as
 * OrderDraftErrorCode).
 */
export type DiscountRejectionCode =
  | 'not_found'
  | 'inactive'
  | 'expired'
  | 'exhausted'
  | 'below_minimum'
  | 'already_used';

export type DiscountValidationResult =
  | { ok: true; discount: AppliedDiscount }
  | { ok: false; reason: DiscountRejectionCode; minOrderSubtotal?: number };

/** Codes are stored and compared uppercase, so `thankyou` === `THANKYOU`. */
export function normalizeDiscountCode(input: string | null | undefined): string {
  return (input ?? '').trim().toUpperCase();
}

/** Emails are compared lowercased/trimmed for the per-email reuse check. */
export function normalizeDiscountEmail(input: string | null | undefined): string {
  return (input ?? '').trim().toLowerCase();
}

export const MAX_DISCOUNT_CODE_LENGTH = 40;

/** Letters, digits, dashes and underscores only — no whitespace or punctuation
 * that would make a code awkward to text to someone or type at checkout. */
export function isValidDiscountCodeFormat(code: string): boolean {
  return /^[A-Z0-9][A-Z0-9_-]*$/.test(code) && code.length <= MAX_DISCOUNT_CODE_LENGTH;
}

/** Has the code passed its expiry? Null expiry never expires. */
export function isDiscountExpired(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() <= now.getTime();
}

/** Has the code hit its redemption ceiling? Null max is unlimited. */
export function isDiscountExhausted(record: Pick<DiscountCodeRecord, 'max_redemptions' | 'times_used'>): boolean {
  if (record.max_redemptions == null) return false;
  return record.times_used >= record.max_redemptions;
}

/**
 * Full validation of a code against an order subtotal. Pure — the caller does
 * the database lookup and the per-email check, then passes the result in.
 *
 * Note the order of checks. `below_minimum` is deliberately LAST of the
 * code-state checks so a shopper whose cart is simply too small is told that,
 * rather than being told the code is invalid.
 */
export function validateDiscountCode({
  record,
  subtotal,
  alreadyUsedByEmail = false,
  now = new Date(),
}: {
  record: DiscountCodeRecord | null | undefined;
  subtotal: number;
  alreadyUsedByEmail?: boolean;
  now?: Date;
}): DiscountValidationResult {
  if (!record) return { ok: false, reason: 'not_found' };
  if (!record.active) return { ok: false, reason: 'inactive' };
  if (isDiscountExpired(record.expires_at, now)) return { ok: false, reason: 'expired' };
  if (isDiscountExhausted(record)) return { ok: false, reason: 'exhausted' };
  if (alreadyUsedByEmail) return { ok: false, reason: 'already_used' };

  if (record.min_order_subtotal != null && subtotal < record.min_order_subtotal) {
    return { ok: false, reason: 'below_minimum', minOrderSubtotal: record.min_order_subtotal };
  }

  const amount = calculateDiscountAmount(record.discount_type, record.discount_value, subtotal);
  if (!(amount > 0)) return { ok: false, reason: 'below_minimum' };

  return {
    ok: true,
    discount: {
      code: record.code,
      type: record.discount_type,
      value: record.discount_value,
      amount,
    },
  };
}

/** "15% off" / "$50.00 off" — the label beside the discount row and in admin. */
export function formatDiscountValue(type: DiscountType, value: number, isEs = false): string {
  if (type === 'percent') {
    const percent = Number.isInteger(value) ? String(value) : String(value);
    return isEs ? `${percent}% de descuento` : `${percent}% off`;
  }
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return isEs ? `${amount} de descuento` : `${amount} off`;
}

/** Bilingual copy for a refusal. */
export function discountRejectionMessage(
  reason: DiscountRejectionCode,
  isEs: boolean,
  minOrderSubtotal?: number,
): string {
  switch (reason) {
    case 'not_found':
      return isEs
        ? 'Ese código de descuento no es válido. Verifique la ortografía e intente de nuevo.'
        : 'That discount code isn’t valid. Please check the spelling and try again.';
    case 'inactive':
      return isEs
        ? 'Ese código de descuento ya no está activo.'
        : 'That discount code is no longer active.';
    case 'expired':
      return isEs
        ? 'Ese código de descuento ha expirado.'
        : 'That discount code has expired.';
    case 'exhausted':
      return isEs
        ? 'Ese código de descuento ya alcanzó su límite de usos.'
        : 'That discount code has reached its usage limit.';
    case 'already_used':
      return isEs
        ? 'Ese código de descuento ya se usó con esta dirección de correo electrónico.'
        : 'That discount code has already been used with this email address.';
    case 'below_minimum': {
      if (minOrderSubtotal != null) {
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(minOrderSubtotal);
        return isEs
          ? `Ese código requiere un subtotal mínimo de ${formatted}.`
          : `That code requires a minimum order subtotal of ${formatted}.`;
      }
      return isEs
        ? 'Ese código no se puede aplicar a este pedido.'
        : 'That code can’t be applied to this order.';
    }
    default:
      return isEs ? 'No se pudo aplicar ese código.' : 'That code couldn’t be applied.';
  }
}
