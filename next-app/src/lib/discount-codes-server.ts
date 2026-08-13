// Server-side discount code lookup.
//
// Split from discount-codes.ts so the pure math/types module stays free of any
// database access and can be imported by client components (OrderSummary) with
// nothing extra pulled into the browser bundle.
//
// Every function here expects a SERVICE-ROLE client. public.discount_codes is
// admin-only under RLS and is never readable from the browser — a shopper must
// not be able to enumerate codes, only to test one they were given.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DiscountResolver } from '@/lib/checkout-pricing';
import {
  isDiscountType,
  normalizeDiscountCode,
  normalizeDiscountEmail,
  validateDiscountCode,
  type DiscountCodeRecord,
  type DiscountValidationResult,
} from '@/lib/discount-codes';

const DISCOUNT_CODE_COLUMNS =
  'id, code, discount_type, discount_value, min_order_subtotal, expires_at, max_redemptions, times_used, active, notes, created_at, updated_at';

/** Coerce a raw row into the typed record, or null if it is malformed. */
function toDiscountCodeRecord(row: Record<string, unknown> | null): DiscountCodeRecord | null {
  if (!row) return null;
  const discountType = row.discount_type;
  if (!isDiscountType(discountType)) return null;
  const value = Number(row.discount_value);
  if (!Number.isFinite(value)) return null;

  const minOrder = row.min_order_subtotal == null ? null : Number(row.min_order_subtotal);
  const maxRedemptions = row.max_redemptions == null ? null : Number(row.max_redemptions);

  return {
    id: String(row.id),
    code: String(row.code ?? ''),
    discount_type: discountType,
    discount_value: value,
    min_order_subtotal: minOrder != null && Number.isFinite(minOrder) ? minOrder : null,
    expires_at: row.expires_at == null ? null : String(row.expires_at),
    max_redemptions:
      maxRedemptions != null && Number.isFinite(maxRedemptions) ? maxRedemptions : null,
    times_used: Number(row.times_used ?? 0),
    active: Boolean(row.active),
    notes: row.notes == null ? null : String(row.notes),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

/** Look up one code by its normalized (uppercase) string. */
export async function fetchDiscountCode(
  service: SupabaseClient,
  rawCode: string | null | undefined,
): Promise<DiscountCodeRecord | null> {
  const code = normalizeDiscountCode(rawCode);
  if (!code) return null;

  const { data, error } = await service
    .from('discount_codes')
    .select(DISCOUNT_CODE_COLUMNS)
    .eq('code', code)
    .maybeSingle();

  if (error || !data) return null;
  return toDiscountCodeRecord(data as Record<string, unknown>);
}

/**
 * Has this email already redeemed this code?
 *
 * ⚠️ This is a SPEED BUMP, not a guarantee, and the distinction is worth
 * keeping in mind before anyone reports it as a bug. Checkout allows guests, so
 * the only identity available is the email typed at checkout — a second email
 * defeats it, and requiring an account only raises that to a second account.
 * The hard, ungameable control is the code's max_redemptions cap, enforced by
 * the conditional UPDATE in capture_paypal_order.
 */
export async function hasEmailRedeemedCode(
  service: SupabaseClient,
  discountCodeId: string,
  rawEmail: string | null | undefined,
): Promise<boolean> {
  const email = normalizeDiscountEmail(rawEmail);
  if (!email) return false;

  const { data, error } = await service
    .from('discount_code_redemptions')
    .select('id')
    .eq('discount_code_id', discountCodeId)
    .eq('customer_email', email)
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
}

/** Full server-side validation of a code against a known subtotal. */
export async function validateDiscountCodeForOrder(
  service: SupabaseClient,
  rawCode: string | null | undefined,
  rawEmail: string | null | undefined,
  subtotal: number,
): Promise<DiscountValidationResult> {
  const record = await fetchDiscountCode(service, rawCode);
  if (!record) return { ok: false, reason: 'not_found' };

  const alreadyUsedByEmail = await hasEmailRedeemedCode(service, record.id, rawEmail);
  return validateDiscountCode({ record, subtotal, alreadyUsedByEmail });
}

/**
 * Build the resolver buildOrderDraft calls once it knows the authoritative
 * subtotal. Returns null when no code was offered, so an ordinary order does no
 * database work at all.
 *
 * This is THE enforcement point. The checkout page also validates a code when
 * the shopper clicks Apply, but that call is a preview for display only — this
 * resolver re-reads the code from the database at order time and recomputes the
 * amount from the server's own subtotal. A forged request carrying its own
 * discount amount is ignored, because no amount is ever read from the client.
 */
export function makeDiscountResolver(
  service: SupabaseClient,
  rawCode: string | null | undefined,
  rawEmail: string | null | undefined,
): DiscountResolver | null {
  const code = normalizeDiscountCode(rawCode);
  if (!code) return null;
  return (subtotal: number) => validateDiscountCodeForOrder(service, code, rawEmail, subtotal);
}
