import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  buildOrderDraft,
  isOrderDraftError,
  normalizeOrderLines,
  type OrderLine,
} from '@/lib/checkout-pricing';
import { validateDiscountCodeForOrder } from '@/lib/discount-codes-server';
import {
  discountRejectionMessage,
  normalizeDiscountCode,
  MAX_DISCOUNT_CODE_LENGTH,
} from '@/lib/discount-codes';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * Checkout discount-code PREVIEW.
 *
 * ⚠️ This endpoint is NOT the enforcement point. It exists so the shopper can
 * see the discount before paying. The authoritative discount is recomputed in
 * buildOrderDraft when the order is actually created (see
 * makeDiscountResolver in the create-order route) — this response is never
 * trusted as an input to anything.
 *
 * It is rate limited because it is an oracle: without a limit it lets anyone
 * brute-force the code space. It also never distinguishes "no such code" from
 * any other unusable state in a way that would help enumeration — every refusal
 * returns the same 200 shape.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`discount-code:${ip}`, 20, 3600))) {
    return NextResponse.json(
      { error: 'Too many discount code attempts. Please try again later.' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const code = normalizeDiscountCode(typeof body.code === 'string' ? body.code : null);
  if (!code || code.length > MAX_DISCOUNT_CODE_LENGTH) {
    return NextResponse.json({ error: 'A discount code is required.' }, { status: 400 });
  }

  const isEs = body.locale === 'es';

  const rawLines: OrderLine[] = Array.isArray(body.items)
    ? body.items.map((entry: { id?: unknown; quantity?: unknown }) => ({
        productId: String(entry?.id ?? ''),
        quantity: Number(entry?.quantity ?? 1),
      }))
    : [];
  const orderLines = normalizeOrderLines(rawLines);
  if (orderLines.length === 0) {
    return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
  }

  const shippingMethod = String(body.shippingMethod ?? 'local-pickup');

  // Recompute the subtotal server-side. The browser never tells us the order
  // value — a minimum-order rule that trusted a client-sent subtotal would be
  // trivially bypassed.
  const supabase = await createClient();
  const draft = await buildOrderDraft(supabase, orderLines, shippingMethod, body.shippingState ?? null);
  if (isOrderDraftError(draft)) {
    return NextResponse.json({ error: draft.error, code: draft.code ?? null }, { status: draft.status });
  }

  const service = createServiceClient();
  const result = await validateDiscountCodeForOrder(service, code, body.email ?? null, draft.subtotal);

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      reason: result.reason,
      message: discountRejectionMessage(result.reason, isEs, result.minOrderSubtotal),
    });
  }

  return NextResponse.json({ ok: true, discount: result.discount });
}
