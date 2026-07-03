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
     shippingMethod, orderId }`. Stores the returned internal `orderId` in an in-memory
     ref (reused if the buyer cancels and retries in the same tab, so we don't
     double-reserve; invalidated if the cart/shipping changes after cancel). Returns
     the PayPal order id.
   - `onApprove` (fires when the buyer hits **Pay Now** in the PayPal window) →
     `POST /api/paypal/capture-order` with `{ paypalOrderId }`. The sale is captured
     here — there is no separate confirm-on-return step.
   - `onSuccess` → `CheckoutClient` clears the cart and shows the existing inline
     "Order Received" confirmation (order number).
   - `onCancel`/`onError` → clean message; the order stays unpaid. Nothing is held
     (no reservation), so the item simply remains available to any buyer.

   **Capture-on-approve (2026-07-03).** The sale completes when the buyer clicks Pay
   Now in the PayPal window; on return to our tab they land directly on the "Order
   Received" screen. There is no intermediate "Confirm Your Order" review screen and
   no client-side capture-on-confirm. This replaced the 2026-07-02 approach (a
   review/confirm screen plus a sessionStorage hand-off + `GET /api/paypal/order-status`
   resume route to restore that screen after a mobile tab eviction) — see DECISIONS
   2026-07-03. If a tab is evicted after approval but before the capture fetch
   finishes, nothing is captured and — since there is no reservation — the item just
   stays available (the buyer can retry, or another buyer can purchase it); the
   `PAYMENT.CAPTURE.COMPLETED` webhook still reconciles any capture that did land.

## Routes (`src/app/api/paypal/*`)

- **`create-order`** (server/cookie client): builds the authoritative order via
  `lib/checkout-pricing.ts#buildOrderDraft` (loads products, verifies all are
  purchasable, computes subtotal + 7% FL tax + shipping snapshot prices), calls the
  `create_paypal_order` RPC (creates the order + items — **no inventory hold**; the
  products stay `available`), creates the PayPal order with line items, saves
  `paypal_order_id`, and returns it. On a PayPal API failure it cancels the order
  record it just created. A `orderId` in the body takes a retry path that recreates
  the PayPal order for the existing unpaid order.
- **`capture-order`** (service-role client): finds the internal order by
  `paypal_order_id` (idempotent if already paid), captures via the PayPal API,
  verifies `COMPLETED` + amount within 1¢ + currency `USD`, then calls
  `capture_paypal_order`. On amount/currency mismatch it records the capture, sets
  `payment_status='pending'`, posts an admin notification, and does **not** auto-sell.
  If the RPC returns `item_conflict` (another buyer's capture sold the item first),
  the order is flagged `failed` for a manual refund and the buyer gets a clear 409
  "just purchased by another buyer" message.
- **`webhook`** (service-role client): `verifyPayPalWebhook` (calls PayPal's
  verify-webhook-signature with `PAYPAL_WEBHOOK_ID`; fails closed if unset), logs to
  `webhook_events` (unique `(provider, event_id)` → duplicates are a no-op), then
  applies `PAYMENT.CAPTURE.COMPLETED` (backstop capture), `.DENIED` (mark failed),
  `.REFUNDED`/`.REVERSED` (refund), and `CUSTOMER.DISPUTE.*` (note).

## Server library — `src/lib/paypal.ts`

OAuth token (cached ~9h), `createPayPalOrder`, `capturePayPalOrder` (sends
`PayPal-Request-Id` for idempotency), `verifyPayPalWebhook`. Base URL switches on
`PAYPAL_ENV` (`sandbox` → `api-m.sandbox.paypal.com`, else live). Server-only.

## Inventory / concurrency — whoever pays first gets the item (2026-07-03)

**There is no inventory reservation.** Estate pieces are one-of-one, but checkout
does **not** hold them — items stay `available` all the way through the PayPal
window, so any number of buyers can be in checkout for the same piece at once. The
sale is decided at **capture**: whoever's payment captures first gets it.

`create_paypal_order` (SECURITY DEFINER) does a snapshot availability check (no
lock) and creates the order (`unpaid`/`pending`/`open`) + items, leaving the
products `available`. `capture_paypal_order` is where the race is resolved: it
`SELECT … FOR UPDATE` row-locks the product rows so concurrent captures for the
same item serialize, then — if the item is already `sold` to a different order —
returns `item_conflict=true`, flags this order `failed` with a "manual PayPal
refund required" note, and does **not** sell. The winning capture flips the products
to `sold` and the order to `payment_status='paid'` + `order_status='completed'`
(mirrors admin "Mark Paid"). This is a rare edge (two buyers paying for the same
one-of-one within seconds); the loser's money is captured and refunded manually.

The old 30-minute `reserve_paypal_order` hold + `release_expired_paypal_reservations`
sweep were removed (`supabase/no-reservation-checkout.sql`); the vestigial
`reserved_until`/`reserved_order_id` columns are left in place (always null) to avoid
a destructive schema change. The admin **Reserved** product status is unrelated — it
is a manual, indefinite merchandising status the owner can set, not a checkout hold.

The public shop only shows `available`/`sold` (`isProductVisibleInShop`), so an
item stays visible until its capture sells it. The `/shop` catalog read is wrapped in
`unstable_cache` (tag `shop-catalog`, `revalidate: 300`), so capture and the
denial/refund webhook call `revalidateTag('shop-catalog', { expire: 0 })`
(Next 16 two-arg form, immediate expiration) to refresh the gallery promptly
instead of waiting out the 300s TTL. **As of 2026-07-02, every admin order-flow
write to `products` also busts this cache** — cancel/reopen/mark-paid/unpaid,
delete-order return-to-inventory, create-order, and archive/hard-delete
all call `adminRevalidateProduct(s)` from
`next-app/src/app/actions/admin-products.ts` right after the write (those are
client-side Supabase writes, which otherwise can't reach a server cache).
See `project-docs/DECISIONS.md`/`CHANGELOG.md` 2026-07-02 for the bug this fixed
(items stayed "sold" in the public gallery after being returned to available in
admin).

## Database — `supabase/paypal-checkout.sql`

`orders`: `paypal_order_id` (unique), `paypal_capture_id`, `payment_response`,
`paid_at`, `reserved_until` (vestigial). `products`: `reserved_until`,
`reserved_order_id` (both vestigial — always null now). New `webhook_events` table
(admins read; service role writes).

**Run order:** `paypal-checkout.sql` (after `sales-workflow.sql` and
`admin-notifications-checkout.sql`), **then `supabase/no-reservation-checkout.sql`.**
The second file is the current inventory model: it adds `create_paypal_order`,
replaces `capture_paypal_order` (adds the `item_conflict` return) and
`apply_paypal_order_event`, and **drops** the old `reserve_paypal_order` +
`release_expired_paypal_reservations` reservation functions. Both are idempotent;
if you ever re-run `paypal-checkout.sql` (which recreates the reservation
functions), re-run `no-reservation-checkout.sql` afterward to drop them again.

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
  Re-run the migration (idempotent), then re-run `no-reservation-checkout.sql`.
- **`function create_paypal_order(...) does not exist` / create-order 500** —
  `supabase/no-reservation-checkout.sql` hasn't been applied. Run it (after
  `paypal-checkout.sql`).

## Go-live checklist

1. Run `supabase/paypal-checkout.sql`, then `supabase/no-reservation-checkout.sql`.
2. Set the four env vars in Netlify.
3. Register the webhook at `https://naplesestatejewelry.co/api/paypal/webhook`
   (capture completed/denied/refunded/reversed + dispute created); match
   `PAYPAL_WEBHOOK_ID`.
4. Sandbox test matrix: success, cancel, denied capture, duplicate webhook,
   concurrent-buyers race (two captures for the same item → second gets
   `item_conflict` 409, flagged for refund), amount mismatch (flagged, not sold).
5. Swap to a live PayPal app, set `PAYPAL_ENV=live`, redeploy, re-test once.
