type PayPalResource = Record<string, unknown>;

type PayPalMoney = {
  value?: unknown;
  currency_code?: unknown;
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function captureIdFromLinks(resource: PayPalResource): string | null {
  if (!Array.isArray(resource.links)) return null;

  for (const link of resource.links) {
    if (!link || typeof link !== 'object') continue;
    const row = link as Record<string, unknown>;
    if (row.rel !== 'up') continue;
    const href = nonEmptyString(row.href);
    const match = href?.match(/\/v2\/payments\/captures\/([^/?#]+)/i);
    if (match?.[1]) return match[1];
  }

  return null;
}

/**
 * `PAYMENT.CAPTURE.*` events whose `resource` is a REFUND, not the capture.
 *
 * This distinction is the whole reason this set exists. Most PAYMENT.CAPTURE.*
 * events (COMPLETED, DENIED, DECLINED, PENDING) deliver the capture itself, so
 * `resource.id` IS the capture id. REFUNDED and REVERSED instead deliver a
 * Refund object, whose `id` is the REFUND id — reading it as a capture id sends
 * a refund id into `apply_paypal_refund`, which then correctly refuses the
 * write with "PayPal capture % does not match order %" and the refund never
 * gets recorded.
 *
 * Found 2026-08-12 by the first live refund this system had ever processed:
 * PayPal completed it, the order stayed `paid` with a null refund_amount, and
 * the webhook row landed as `status = 'error'`. The correct capture id was in
 * the payload the whole time, under `links[rel="up"]` — the fall-through below
 * already parses it, but the early return fired first and never let it.
 */
const REFUND_SHAPED_CAPTURE_EVENTS = new Set([
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
]);

export function relatedPayPalCaptureId(eventType: string, resource: PayPalResource): string | null {
  if (eventType.startsWith('PAYMENT.CAPTURE.') && !REFUND_SHAPED_CAPTURE_EVENTS.has(eventType)) {
    return nonEmptyString(resource.id);
  }

  const supplementaryData = resource.supplementary_data as
    | { related_ids?: { capture_id?: unknown } }
    | undefined;
  const supplementaryCaptureId = nonEmptyString(supplementaryData?.related_ids?.capture_id);
  if (supplementaryCaptureId) return supplementaryCaptureId;

  const directCaptureId = nonEmptyString(resource.capture_id);
  if (directCaptureId) return directCaptureId;

  const linkedCaptureId = captureIdFromLinks(resource);
  if (linkedCaptureId) return linkedCaptureId;

  if (Array.isArray(resource.disputed_transactions)) {
    for (const transaction of resource.disputed_transactions) {
      if (!transaction || typeof transaction !== 'object') continue;
      const disputedCaptureId = nonEmptyString(
        (transaction as Record<string, unknown>).seller_transaction_id,
      );
      if (disputedCaptureId) return disputedCaptureId;
    }
  }

  return null;
}

export function payPalCumulativeRefund(resource: PayPalResource): {
  amount: number;
  currency: string;
} | null {
  const receivable = resource.seller_receivable_breakdown as
    | { total_refunded_amount?: PayPalMoney }
    | undefined;
  const payable = resource.seller_payable_breakdown as
    | { total_refunded_amount?: PayPalMoney }
    | undefined;
  const money = receivable?.total_refunded_amount ?? payable?.total_refunded_amount;
  const amount = Number(money?.value);
  const currency = nonEmptyString(money?.currency_code);

  if (!Number.isFinite(amount) || amount < 0 || !currency) return null;
  return { amount, currency };
}
