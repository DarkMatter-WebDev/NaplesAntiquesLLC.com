# PayPal Checkout

Live PayPal payment processing on the existing `/checkout` page. Replaced the old
manual "Submit Order" (unpaid contact-to-buy) button. **Status: sandbox** — see the
go-live checklist below and the Backlog item in `TASKS.md`.

## Flow

1. **Checkout page** (`src/app/[locale]/checkout/page.tsx`) reads
   `process.env.PAYPAL_CLIENT_ID` server-side and passes it to `CheckoutClient` as
   the `paypalClientId` prop (the id ships to the browser inside the SDK URL, but is
   not a `NEXT_PUBLIC_*` var).
2. **`CheckoutClient`** collects name/email/phone + shipping (cart comes from the
   `nej-cart` localStorage cart context). It renders
   `components/checkout/PayPalCheckoutButton.tsx` only when the cart has items and
   the three contact fields are filled (`payReady`).
3. **PayPalCheckoutButton** loads the PayPal JS SDK (`components=buttons`, gold pill,
   PayPal + card; PayLater/credit disabled) and wires the Buttons callbacks. It never
   sends prices.
   - `createOrder` → `POST /api/paypal/create-order` with `{ productIds, customer,
     shippingMethod, orderId }`. Stores the returned internal `orderId` (reused if the
     buyer cancels and retries, so we don't double-reserve). Returns the PayPal order id.
   - `onApprove` → `POST /api/paypal/capture-order` with `{ paypalOrderId }`.
   - `onSuccess` → `CheckoutClient` clears the cart and shows the existing inline
     "Order Received" confirmation (order number).
   - `onCancel`/`onError` → clean message; the order stays unpaid and items stay
     reserved until the hold expires.

## Routes (`src/app/api/paypal/*`)

- **`create-order`** (server/cookie client): builds the authoritative order via
  `lib/checkout-pricing.ts#buildOrderDraft` (loads products, verifies all are
  purchasable, computes subtotal + 7% FL tax + shipping snapshot prices), calls the
  `reserve_paypal_order` RPC (atomic order create + inventory hold), creates the
  PayPal order with line items, saves `paypal_order_id`, and returns it. On a PayPal
  API failure it releases the hold it just took. A `orderId` in the body takes a
  retry path that re-asserts the hold and recreates the PayPal order for the existing
  unpaid order.
- **`capture-order`** (service-role client): finds the internal order by
  `paypal_order_id` (idempotent if already paid), captures via the PayPal API,
  verifies `COMPLETED` + amount within 1¢ + currency `USD`, then calls
  `capture_paypal_order`. On amount/currency mismatch it records the capture, sets
  `payment_status='pending'`, posts an admin notification, and does **not** auto-sell.
- **`webhook`** (service-role client): `verifyPayPalWebhook` (calls PayPal's
  verify-webhook-signature with `PAYPAL_WEBHOOK_ID`; fails closed if unset), logs to
  `webhook_events` (unique `(provider, event_id)` → duplicates are a no-op), then
  applies `PAYMENT.CAPTURE.COMPLETED` (backstop capture), `.DENIED` (release + fail),
  `.REFUNDED`/`.REVERSED` (refund), and `CUSTOMER.DISPUTE.*` (note).

## Server library — `src/lib/paypal.ts`

OAuth token (cached ~9h), `createPayPalOrder`, `capturePayPalOrder` (sends
`PayPal-Request-Id` for idempotency), `verifyPayPalWebhook`. Base URL switches on
`PAYPAL_ENV` (`sandbox` → `api-m.sandbox.paypal.com`, else live). Server-only.

## Inventory / concurrency

Items can be one-of-one, so `reserve_paypal_order` (SECURITY DEFINER) `SELECT … FOR
UPDATE` row-locks the products, releases expired holds, requires each to be
`available`, creates the order (`unpaid`/`pending`/`open`) + items, and flips
products to `reserved` with a 30-minute `reserved_until` + `reserved_order_id`.
Concurrent buyers serialize on the lock; the loser gets a 409. The public shop
already hides `reserved` items. `capture_paypal_order` flips them to `sold` and the
order to `payment_status='paid'` + `order_status='completed'` (mirrors admin "Mark
Paid"). `release_expired_paypal_reservations()` frees lapsed holds (run inline by
reserve; can also be scheduled).

The public shop only shows `available`/`sold` (`isProductVisibleInShop`), so a
`reserved` item is excluded at query time. The `/shop` catalog read is wrapped in
`unstable_cache` (tag `shop-catalog`, `revalidate: 300`), so reserve/capture/release
and the denial/refund webhook call `revalidateTag('shop-catalog', 'max')` (Next 16
two-arg form) to refresh the gallery promptly instead of waiting out the 300s TTL —
stale-while-revalidate, so it clears within a refresh cycle (~1-2s). Note: the
admin "Delete order → return to inventory" path is a client-side write and does not
bust the cache, so a released item reappears within the normal 300s window.

## Database — `supabase/paypal-checkout.sql`

`orders`: `paypal_order_id` (unique), `paypal_capture_id`, `payment_response`,
`paid_at`, `reserved_until`. `products`: `reserved_until`, `reserved_order_id`. New
`webhook_events` table (admins read; service role writes). RPCs:
`reserve_paypal_order`, `capture_paypal_order`, `apply_paypal_order_event`,
`release_expired_paypal_reservations`. Run after `sales-workflow.sql` and
`admin-notifications-checkout.sql`. Idempotent / safe to re-run.

## Environment variables

`next-app/.env.local` (and Netlify): `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
`PAYPAL_ENV` (`sandbox`/`live`), `PAYPAL_WEBHOOK_ID`. The client id is also passed to
the browser via the checkout page prop.

**The credential set must match `PAYPAL_ENV`.** A Live app's client id/secret only
authenticate against `api-m.paypal.com`; a Sandbox app's only against
`api-m.sandbox.paypal.com`. Using Live creds with `PAYPAL_ENV=sandbox` (or vice
versa) yields `401 invalid_client` ("Client Authentication failed") at the token
step and every create-order returns 502. Sandbox creds come from PayPal Developer →
*Apps & Credentials → Sandbox → your app*. After editing `.env.local`, restart the
dev server (env is read at boot).

## Troubleshooting

- **create-order 502 with PayPal `422 UNPROCESSABLE_ENTITY` ("failed business
  validation")** — the `amount.breakdown` didn't reconcile. All money is rounded to
  cents at the source (`checkout-pricing.ts#round2` in `buildOrderDraft`) and the
  PayPal `value` is derived from the rounded `item_total + tax_total + shipping`
  (`paypal.ts#createPayPalOrder`), so item lines, the order total, and the PayPal
  amount always agree. Don't reintroduce an independently-rounded total.
- **capture-order 500 with `42702 column reference "order_id" is ambiguous`** — a
  PL/pgSQL function that `RETURNS TABLE(order_id …)` must qualify any table
  `order_id` in its body (e.g. `order_items.order_id`) so it doesn't collide with
  the output column. Fixed in `capture_paypal_order`. Symptom: PayPal captures the
  money but the order never flips to paid; the `PAYMENT.CAPTURE.COMPLETED` webhook
  is the backstop that reconciles it.
- **`401 invalid_client` / create-order 502** — credential/env mismatch (see above).
- **`42501 permission denied for table orders/products/webhook_events`** — the
  service_role table grants at the bottom of `paypal-checkout.sql` weren't applied.
  Re-run the migration (idempotent). Without them, capture/webhook fail and a
  failed create-order can leave a product stuck `reserved` (its hold still expires
  after 30 min, or run `select release_expired_paypal_reservations();` once the
  hold lapses).

## Go-live checklist

1. Run `supabase/paypal-checkout.sql`.
2. Set the four env vars in Netlify.
3. Register the webhook at `https://naplesestatejewelry.co/api/paypal/webhook`
   (capture completed/denied/refunded/reversed + dispute created); match
   `PAYPAL_WEBHOOK_ID`.
4. Sandbox test matrix: success, cancel, denied capture, duplicate webhook,
   item-already-sold (409 on reserve), amount mismatch (flagged, not sold).
5. Swap to a live PayPal app, set `PAYPAL_ENV=live`, redeploy, re-test once.
