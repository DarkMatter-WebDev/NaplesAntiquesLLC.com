import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { refundPayPalCapture } from '@/lib/paypal';
import { buildPayPalRefundPlan } from '@/lib/paypal-refunds';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

interface Props {
  params: Promise<{ id: string }>;
}

type PaymentResponse = Record<string, unknown> | null;

function captureIdFromResponse(response: PaymentResponse): string | null {
  if (!response) return null;

  const resource = response.resource as Record<string, unknown> | undefined;
  if (resource && typeof resource.id === 'string' && response.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    return resource.id;
  }

  const purchaseUnits = response.purchase_units;
  if (!Array.isArray(purchaseUnits)) return null;
  for (const unit of purchaseUnits) {
    if (!unit || typeof unit !== 'object') continue;
    const payments = (unit as Record<string, unknown>).payments as Record<string, unknown> | undefined;
    const captures = payments?.captures;
    if (!Array.isArray(captures)) continue;
    for (const capture of captures) {
      if (capture && typeof capture === 'object' && typeof (capture as Record<string, unknown>).id === 'string') {
        return (capture as Record<string, unknown>).id as string;
      }
    }
  }
  return null;
}

export async function POST(req: Request, { params }: Props) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const targetRefundAmount = Number(body?.targetRefundAmount);
  const service = createServiceClient();

  // Never move money until the idempotent local refund ledger is available.
  // Without it, a response/database failure could make a retry double-refund.
  const { data: hardeningReady, error: readinessError } = await service.rpc('paypal_refund_hardening_ready');
  if (readinessError || hardeningReady !== true) {
    return NextResponse.json(
      { error: 'PayPal refunds are unavailable until paypal-checkout-hardening-2026-07.sql is applied.' },
      { status: 503 },
    );
  }

  const { data: order, error: orderError } = await service
    .from('orders')
    .select('id, order_number, total, refund_amount, payment_status, order_status, payment_method, payment_reference, paypal_capture_id, payment_response')
    .eq('id', id)
    .maybeSingle();
  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? 'Order not found.' }, { status: 404 });
  }
  if (order.payment_method !== 'paypal') {
    return NextResponse.json({ error: 'This order was not paid through PayPal.' }, { status: 400 });
  }

  const captureId = order.paypal_capture_id
    ?? order.payment_reference
    ?? captureIdFromResponse(order.payment_response as PaymentResponse);
  if (!captureId) {
    return NextResponse.json({ error: 'No PayPal capture ID is recorded for this order. Review it in PayPal before refunding.' }, { status: 409 });
  }

  let plan;
  try {
    plan = buildPayPalRefundPlan(id, Number(order.refund_amount ?? 0), Number(order.total), targetRefundAmount);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid refund amount.' }, { status: 400 });
  }

  const { data: pendingRefunds, error: pendingRefundsError } = await service
    .from('paypal_refunds')
    .select('request_key, paypal_refund_id')
    .eq('order_id', id)
    .eq('status', 'PENDING');
  if (pendingRefundsError) {
    return NextResponse.json({ error: `Could not verify pending PayPal refunds: ${pendingRefundsError.message}` }, { status: 500 });
  }
  const conflictingPending = pendingRefunds?.find((refund) => refund.request_key !== plan.requestId);
  if (conflictingPending) {
    return NextResponse.json(
      {
        error:
          `PayPal refund ${conflictingPending.paypal_refund_id} is still pending. ` +
          'Wait for it to complete or fail before starting a different refund amount.',
      },
      { status: 409 },
    );
  }

  try {
    const refund = await refundPayPalCapture({
      captureId,
      amount: plan.refundAmount,
      currency: 'USD',
      requestId: plan.requestId,
    });
    if (refund.currency !== 'USD' || Math.abs(refund.amount - plan.refundAmount) > 0.01) {
      throw new Error(`PayPal returned ${refund.amount} ${refund.currency}; expected ${plan.refundAmount} USD.`);
    }

    const { data: appliedData, error: applyError } = await service.rpc('apply_paypal_refund', {
      p_order_id: id,
      p_refund_id: refund.id,
      p_capture_id: captureId,
      p_amount: refund.amount,
      p_currency: refund.currency,
      p_status: refund.status,
      p_request_key: plan.requestId,
      p_payload: refund.raw,
    });
    if (applyError) {
      console.error('PayPal refund persistence failed:', applyError);
      return NextResponse.json(
        {
          error: 'PayPal accepted the refund, but the local order update failed. Do not refund again; retry this same action or reconcile the order in PayPal.',
          paymentRefunded: refund.status === 'COMPLETED',
          paypalRefundId: refund.id,
        },
        { status: 500 },
      );
    }

    const applied = Array.isArray(appliedData) ? appliedData[0] : appliedData;
    if (refund.status !== 'COMPLETED') {
      return NextResponse.json({
        success: true,
        pending: true,
        paypalRefundId: refund.id,
        message: `PayPal refund is ${refund.status.toLowerCase()}. The order will update when PayPal confirms it.`,
      });
    }

    return NextResponse.json({
      success: true,
      paypalRefundId: refund.id,
      refundAmount: Number(applied?.refund_amount ?? plan.targetAmount),
      paymentStatus: applied?.payment_status ?? (plan.targetAmount >= Number(order.total) ? 'refunded' : 'partially_refunded'),
      orderStatus: plan.targetAmount >= Number(order.total) ? 'refunded' : order.order_status,
    });
  } catch (error) {
    console.error('PayPal admin refund failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not refund the PayPal capture.' },
      { status: 502 },
    );
  }
}
