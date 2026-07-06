import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// RETIRED. This was the manual "Submit Order" endpoint, superseded by the PayPal
// checkout flow (/api/paypal/create-order + capture-order). It had NO callers in
// the app, yet — being public and unauthenticated — it let anyone flip every
// submitted product to `pending_payment` (removing the whole catalog from sale)
// and spam orders/notifications/email via the create_checkout_order RPC. The body
// has been removed and it now returns 410 Gone. Do not re-add order-creation logic
// here; use the authenticated PayPal routes.
export async function POST() {
  return NextResponse.json({ error: 'This endpoint has been retired.' }, { status: 410 });
}
