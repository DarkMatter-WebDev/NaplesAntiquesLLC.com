export type RefundPlan = {
  currentAmount: number;
  targetAmount: number;
  refundAmount: number;
  requestId: string;
};

function toCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}

export function buildPayPalRefundPlan(
  orderId: string,
  currentRefundAmount: number,
  orderTotal: number,
  targetRefundAmount: number,
): RefundPlan {
  const currentCents = toCents(currentRefundAmount);
  const totalCents = toCents(orderTotal);
  const targetCents = toCents(targetRefundAmount);

  if (!orderId || !Number.isFinite(orderTotal) || totalCents <= 0) {
    throw new Error('The order total is invalid.');
  }
  if (!Number.isFinite(targetRefundAmount) || targetCents <= currentCents) {
    throw new Error('The refund must be greater than the amount already refunded.');
  }
  if (targetCents > totalCents) {
    throw new Error('The refund cannot exceed the order total.');
  }

  const orderKey = orderId.replace(/[^a-z0-9]/gi, '').slice(0, 16);
  return {
    currentAmount: currentCents / 100,
    targetAmount: targetCents / 100,
    refundAmount: (targetCents - currentCents) / 100,
    requestId: `refund-${orderKey}-${targetCents}`.slice(0, 38),
  };
}

