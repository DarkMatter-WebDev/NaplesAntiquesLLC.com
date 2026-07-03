# Current Status

> Reflects the present state of development. **Update this at the end of every
> work session.** Last updated: **2026-07-03**.

## 2026-07-03 -- Checkout inventory: no reservation (whoever pays first gets the item)

Removed the 30-minute inventory reservation from PayPal checkout. Items now stay
`available` all the way through the PayPal window — no hold is placed — so multiple
buyers can check out the same one-of-one piece at once and the sale is decided at
**capture** (first payment to capture wins). Most of this was already in the app
code (`create-order` calls `create_paypal_order`; `capture-order` handles the
`item_conflict` race); this change finishes it by tearing down the orphaned
reservation machinery and correcting the docs:
- **SQL (`supabase/no-reservation-checkout.sql`)** now also **drops**
  `reserve_paypal_order` + `release_expired_paypal_reservations` and rewrites
  `apply_paypal_order_event`'s `denied` branch to not release a reservation.
  `supabase/paypal-checkout.sql` got a header pointing to it (that file still
  defines the reservation functions for a re-run, so no-reservation must be run
  after it). **⚠️ Manual step: run `no-reservation-checkout.sql` in Supabase**
  (after `paypal-checkout.sql`) — see the SQL-migrations section below.
- **App copy:** the checkout subtitle no longer says "reserve the items" (now
  "check out the items"); a stale "double-reserve" comment was corrected.
- Vestigial `reserved_until`/`reserved_order_id` columns are left in place (always
  null) to avoid a destructive schema change. The manual admin **Reserved** product
  status is unrelated and unchanged.

**Verified:** `npx tsc --noEmit` clean and `npm run build` passes (app copy change
only — no route/type change); the SQL is not exercisable from here (needs a Supabase
run + PayPal sandbox approval to see the race). See DECISIONS 2026-07-03.

## 2026-07-03 -- PayPal checkout: capture-on-approve (confirm-on-return removed)

Reverted the 2026-07-02 confirm-on-return flow. The sale now completes when the
buyer hits **Pay Now** in the PayPal window (capture runs in the Buttons
`onApprove` callback); on return to our tab they land directly on the "Order
Received" confirmation. Removed: the intermediate "Confirm Your Order" review
screen, the client-side capture-on-confirm, and the sessionStorage hand-off
(`nej-paypal-pending`) + `GET /api/paypal/order-status` resume route +
`getPayPalOrder()` in `lib/paypal.ts` that existed only to restore that screen
after a mobile tab eviction. With no reservation (see the no-reservation entry
above), a tab evicted mid-capture just leaves the item available; the
`PAYMENT.CAPTURE.COMPLETED` webhook still reconciles any capture that landed.
**Verified:** `rm -rf .next && npm run build` passes (order-status route gone
from the route list; create/capture/webhook remain), `npx tsc --noEmit` clean,
`eslint` clean on the three changed files
(`CheckoutClient.tsx`, `PayPalCheckoutButton.tsx`, `lib/paypal.ts`). The button
UI itself was not exercised live — `/checkout` is auth-gated (redirects to
sign-in) and no test-account credentials were available this session; the
capture path also needs a PayPal sandbox approval. See DECISIONS 2026-07-03.

## 2026-07-03 -- All pending Supabase SQL migrations applied

Owner confirmed all previously outstanding Supabase SQL migrations have now
been run in the live project (`evzluixourmsefwdsieu`): `paypal-checkout.sql`
(with the `service_role` grants and the capture-to-Messages-notification
removal re-run), `admin-notifications-recycle-bin.sql`,
`admin-notifications-image-urls.sql`, `product-public-notes-es.sql`,
`product-item-year.sql` (with the `admin-notifications-checkout.sql` re-run),
and `shop-new-listing-jpg-to-webp.sql`. No SQL migrations are known to be
outstanding. This does not change the PayPal go-live blocker, which is a
Netlify environment-variable mismatch, not a database migration — see the
HANDOFF section below. App-level verification of the newly-applied migrations'
behavior (recycle bin, image URLs, ES notes, item-year persistence) is not yet
done; tracked in `TASKS.md`.

## 2026-07-02 (later) — shop-gallery cache now purged by admin order actions

Fixed the report "cancelled order items show available in admin but stay sold in
the public gallery": order-flow product writes (cancel/reopen/mark-paid,
delete-order return-to-inventory, create-order reserve, archive/hard-delete)
happened via the browser Supabase client and never revalidated the `shop-catalog`
tag, so the gallery stayed stale up to 5 min. All now call the new bulk
`adminRevalidateProducts()` server action. Verified live on dev (signed-in):
Mark Paid → bracelet left /shop in ~3s; Cancel → back in ~3s. Convention: any
client-side `products` write must be followed by `adminRevalidateProduct(s)`.
Note: the Test 7 leftover order `a565d7f4…` is now `cancelled` (used for this
verification); the cleanup SQL below still applies.

## 2026-07-02 — PayPal approval-return hardening (reload/eviction resume)

> ⚠️ **Superseded 2026-07-03.** The confirm-on-return screen and the
> sessionStorage + `order-status` resume machinery described below were removed in
> favor of capture-on-approve (see the 2026-07-03 entry above). The **stale-total
> reuse fix** further down in this entry still stands. Kept as a record.

Investigated the report "after PayPal authorization the user lands on a random
other tab" (mobile). Conclusion: the tab-focus behavior is the mobile OS/browser's
app hand-off quirk, not app code (checkout has no `return_url`, `window.open`, or
tab logic — the PayPal JS SDK owns the whole round-trip). But the audit surfaced a
real defect: all post-approval state was React-only, so a mobile tab eviction or
reload during/after approval silently dropped an APPROVED-but-never-captured
payment (buyer taps "Pay Now", returns to a blank form).

**Shipped:** sessionStorage hand-off record (`nej-paypal-pending`) + new
`GET /api/paypal/order-status` resume route + `getPayPalOrder()` in `lib/paypal.ts`.
Details in `features/paypal-checkout.md` (Flow §4).
**Verified:** `npx tsc --noEmit` clean; changed files eslint-clean (5 pre-existing
errors elsewhere: `react-hooks/set-state-in-effect` in an admin editor,
unused-vars in `OrderDetailPanel`/`ShopFilters`); `npm run build` passes with the
route registered; endpoint probed live on dev :3002 (no param → 400; unknown
order → `{state:'none'}`).
**Test 7 (approved-branch resume) PASSED live** the same day: owner approved in
the sandbox window, a full reload of /checkout restored the Confirm screen with
the payer email re-fetched from PayPal and no console errors. The unfinished
approval left order `858bbf06-358a-4ba6-8a10-d3505521ca11` (unpaid, approved at
PayPal — expires on its own if never captured); included in the cleanup below.

**Also fixed same day: stale-total reuse bug.** The create-order reuse path used
to rebuild the PayPal order from the original order rows even if the buyer had
edited the cart/shipping after cancelling — wrong charge. Now it recomputes the
draft and reuses only on an exact product-set + totals match, else cancels the
stale order and falls through to a fresh one; the client also drops the reusable
order id when the cart/shipping fingerprint (`payloadKey` in `nej-paypal-pending`)
diverges. **Verified live signed-in on dev :3002:** resume 'none' branch clears the
record on /checkout mount; create → order-status `pending`; same-payload retry
reuses the order id; changed-shipping retry returns a fresh order id.

⚠️ **Leftover test rows from this verification** (products were never reserved —
create no longer holds inventory before capture): orders
`cc3c6996-6853-421d-ac13-91e3777b1b67` (cancelled) and
`a565d7f4-7f49-4f56-adbb-b80593210409` (unpaid), both `payment_method='paypal'`,
`customer_email='resume-test@example.com'`, plus the Test 7 order
`858bbf06-358a-4ba6-8a10-d3505521ca11` (unpaid, approved-never-captured), all
created 2026-07-02. Clean up in Supabase:
```sql
DELETE FROM orders WHERE customer_email = 'resume-test@example.com';
DELETE FROM orders WHERE id = '858bbf06-358a-4ba6-8a10-d3505521ca11';
```

## 🔴 HANDOFF — PayPal checkout: where testing stands (2026-06-30)

**The site is deployed and the checkout page renders, but PayPal checkout fails on the
deployed site with "Something went wrong with PayPal. Please try again." Root cause
identified — see the Netlify env-var fix below.** Code is complete and verified on the
local dev server. Full technical runbook: `project-docs/features/paypal-checkout.md`.

### 🚨 BLOCKER: Netlify has the wrong PayPal app credentials

The deployed site serves `PAYPAL_CLIENT_ID = AcSsWn15M34eZNC-2OksAzaKof6Uj4dC6p-TgwSUVlr0AKKwvRcowHnFIJts92cKrA9qaL_73xtNhR5g`
(extracted from live checkout HTML), but the verified working sandbox app in
`next-app/.env.local` has `PAYPAL_CLIENT_ID = AbscNftOUogWVeuutMWwSWjnjtmqn5k3r9F3AXGl5PW27mR4Tx1xd-hzUHX5qbcvnZZtYF3mD_eo0eMm`.
**These are different PayPal apps.** The server's `getAccessToken()` call (Basic
auth with the Netlify-set id+secret) receives `401 invalid_client` from PayPal
→ `createPayPalOrder` throws → route returns 502 → the client shows the error.

**Fix (requires Netlify dashboard access):** Update all 4 PayPal env vars to the
working sandbox set from `next-app/.env.local`, then trigger a redeploy:
- `PAYPAL_CLIENT_ID` = `AbscNftOUogWVeuutMWwSWjnjtmqn5k3r9F3AXGl5PW27mR4Tx1xd-hzUHX5qbcvnZZtYF3mD_eo0eMm`
- `PAYPAL_CLIENT_SECRET` = the `EG0py…` value from `next-app/.env.local`
- `PAYPAL_ENV` = `sandbox`
- `PAYPAL_WEBHOOK_ID` = `64C82950G8312001A`

⚠️ **All 4 must belong to the same PayPal app and environment.** Mixing id/secret
from different apps, or setting `PAYPAL_ENV=live` with sandbox creds (or vice versa),
causes the same `401 → 502`. See DECISIONS (2026-06-30, PayPal credential-set rule).

**Diagnostic confirmation:** `reserve_paypal_order` RPC and all Supabase grants are
confirmed working on the live DB (probe returned 502, not 503 — the RPC succeeded;
the failure was the downstream PayPal API call). The bracelet reservation was
automatically rolled back. One leftover `cancelled` diagnostic order row remains in
the `orders` table (created 2026-06-30, `payment_method='paypal'`); clean it up in
Supabase with:
```sql
DELETE FROM orders
WHERE payment_method = 'paypal'
  AND payment_status = 'cancelled'
  AND created_at::date = '2026-06-30';
```
`order_items` cascades; products are already back to `available`.

### Environment / config state
- **Code:** complete. Routes `/api/paypal/{create-order,capture-order,webhook}`, `lib/paypal.ts`,
  `lib/checkout-pricing.ts`, `components/checkout/PayPalCheckoutButton.tsx`, and the
  checkout/admin-orders UI are all in place. `tsc` clean; `npm run lint` shows only the 3
  known pre-existing issues.
- **Credentials:** SANDBOX creds are in `next-app/.env.local` (`PAYPAL_ENV=sandbox`,
  `PAYPAL_WEBHOOK_ID=64C82950G8312001A`) and verified to authenticate against the sandbox
  endpoint. (An earlier set of LIVE creds was swapped out — Live creds fail against the
  sandbox endpoint with `401 invalid_client`.) **Netlify has a DIFFERENT set** — see blocker above.
- **Supabase migrations:** `order-item-line-discounts.sql` applied. `paypal-checkout.sql`
  applied **with** the `service_role` grants, the ambiguous-`order_id` fix, and the
  re-run that drops the capture-to-Messages notification insert (owner confirmed all
  pending SQL migrations run 2026-07-03) -- a real capture no longer posts a "Paid
  order" row to `/admin/messages`; it only shows on the Orders-tab badge.
- **Deployed:** the app is live on Netlify. The Netlify secrets-scan issue was fixed
  (added `PAYPAL_CLIENT_ID` to `SECRETS_SCAN_OMIT_KEYS` in root `netlify.toml` — it is
  intentionally public per PayPal's design). PayPal checkout is broken only because of the
  credential mismatch; all other site features work.
- **Note:** one orphaned sandbox capture sits in the PayPal sandbox account from an earlier
  tangled attempt — harmless test funds, no action needed.

### Sandbox test matrix
| # | Test | Status |
|---|------|--------|
| 1 | Successful payment | ✅ **PASSED live (local dev)** end-to-end (create → approve → capture → `paid`/`completed`, product `sold`, capture idempotent) — predates the no-reservation change; re-run recommended |
| 5 | Concurrent-buyers race (no reservation) | ⬜ **NOT run** — new model (2026-07-03): two buyers both approve the same one-of-one, both capture; first wins (`sold`), second gets `item_conflict` → order flagged `failed` for manual refund + 409 message. Needs the `no-reservation-checkout.sql` migration + two sandbox approvals. (Replaces the old "reserve returns 409" test.) |
| — | Validation/error paths + webhook signature gate | ✅ PASSED (empty cart, missing contact, bad ids → correct 400/404; unsigned webhook → 401) |
| 3 | Failed/denied capture | ◐ Partial — graceful 502 + order stays unpaid on an unapproved capture is verified; the `PAYMENT.CAPTURE.DENIED` **webhook** branch is NOT live-tested (needs deploy) |
| 6 | Amount mismatch | ◐ Logic verified (capture compares amount+currency → flags order `pending` + admin notification, no auto-sell); NOT forced live |
| 2 | Canceled checkout | ⬜ NOT run live (onCancel handler exists) |
| 4 | Duplicate webhook | ⬜ NOT run — needs deployed site + PayPal "Resend"/simulator (idempotency is coded via `webhook_events` unique `event_id`) |
| 7 | Reload-during-approval resume | ⬜ **N/A — feature removed 2026-07-03.** The confirm-on-return screen + sessionStorage resume route were reverted in favor of capture-on-approve; there is no longer a client screen to restore across a reload. With no reservation, a tab evicted mid-capture just leaves the item available. |

### What's left to do, in order
1. **Fix the Netlify credential mismatch** (see BLOCKER above): update the 4 PayPal vars in
   the Netlify dashboard to the verified sandbox set, then redeploy (env-var changes only take
   effect on a new deploy).
2. ~~Re-run `supabase/paypal-checkout.sql`~~ Done -- owner confirmed re-run 2026-07-03;
   paid orders no longer post to the Messages center.
3. **Register the sandbox webhook** in the PayPal Developer dashboard → URL `https://naplesestatejewelry.co/api/paypal/webhook`, events `PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED/REVERSED` + `CUSTOMER.DISPUTE.CREATED`; confirm its id matches `PAYPAL_WEBHOOK_ID`.
4. **Finish the sandbox tests on the deployed site:** Test 2 (cancel), Test 3 (denied capture — sandbox negative testing or the webhook simulator's DENIED event), Test 4 (duplicate webhook via "Resend"). Optionally force Test 6 by editing `orders.total` while the PayPal popup is open.
5. **Only after sandbox passes → go LIVE:** create a Live PayPal app, swap in live client/secret/webhook id, set `PAYPAL_ENV=live`, redeploy, and run one real low-value order.

### How to verify the fix without touching the UI
After updating Netlify env vars and redeploying, run this probe — a working config
returns a `paypalOrderId` (the reservation self-cleans on rollback):
```bash
curl -s -i -X POST https://naplesestatejewelry.co/api/paypal/create-order \
  -H "Content-Type: application/json" \
  -d '{"productIds":["italian-milor-14k-rose-gold-semi-solid-fancy-link-bracelet-24"],"shippingMethod":"local-pickup","customer":{"name":"Diag Test","email":"diag@example.com","phone":"2390000000"}}'
```
A 200 with `paypalOrderId` = credentials are correct. A 502 = still wrong credentials.

### How to verify/clean during testing
- Test orders/reservations were created and cleaned up via the Supabase service role (PostgREST). To inspect: query `orders` (filter `payment_method=eq.paypal`) and `products` (`status=eq.reserved`). To clean a test order: set its product(s) back to `status='available'` (+ null `reserved_until`/`reserved_order_id`) and delete the order (order_items cascade).
- A successful sandbox payment marks a REAL product `sold` and creates a real order — revert it after testing unless you want to keep an example.

## Supabase SQL migrations -- all applied (confirmed by owner 2026-07-03)

All previously pending migrations have been run in the live Supabase project
(`evzluixourmsefwdsieu`), owner-confirmed 2026-07-03:

- `supabase/paypal-checkout.sql` (including the `service_role` grants and the
  re-run that drops the capture-to-Messages notification insert)
- `supabase/admin-notifications-recycle-bin.sql`
- `supabase/admin-notifications-image-urls.sql`
- `supabase/product-public-notes-es.sql`
- `supabase/product-item-year.sql` and the `admin-notifications-checkout.sql` re-run
- `supabase/shop-new-listing-jpg-to-webp.sql`

⚠️ **One SQL migration is outstanding as of 2026-07-03:**
`supabase/no-reservation-checkout.sql` — the no-reservation checkout model. An
earlier copy of it **is confirmed applied on the live DB**: a 2026-07-03 attempt to
re-run `paypal-checkout.sql` failed with `42P13: cannot change return type of
existing function` on `capture_paypal_order`, which proves the live function is the
newer no-reservation version (with the `item_conflict` return column). But the file
was **enhanced 2026-07-03** to also drop the old `reserve_paypal_order` +
`release_expired_paypal_reservations` functions and rewrite
`apply_paypal_order_event` — so **run the current copy once, by itself** (do NOT
re-run `paypal-checkout.sql` first; it is fully applied and re-running it downgrades
the capture function, requiring no-reservation to be run again — it now carries a
`drop function` guard so a re-run at least no longer errors with 42P13). Until the
current copy runs, the orphaned 30-min reservation functions still exist in the DB
(unused by the app, but present).

App-level verification of the other applied migrations (recycle bin, image URLs
rendering, ES notes, item-year persistence) is tracked separately in `TASKS.md`.


## Current App

- The current deploy target is the **Next.js app in `next-app/`**.
- Root `netlify.toml` sets `base = "next-app"`, runs `npm run build`, and
  publishes `.next` with `@netlify/plugin-nextjs`.
- The retired root static HTML site has been removed: root `*.html`, `es/`,
  `scripts/`, root `assets/`, `tools/`, and old `netlify/functions/` are gone.
- Keep runtime code and public assets under `next-app/`.

## What Is Currently Working

- **Localized marketing site** with EN/ES routes for home, about, contact, free
  evaluation, FAQ, privacy, and service/category pages.
- **Online shop** (`/shop`, `/shop/[id]`) backed by Supabase `products`, with
  filters, product detail pages, local/Supabase image support, and live metal
  pricing.
- **Online checkout + payments via PayPal** on `/checkout` (Orders API v2,
  **sandbox**): create-order computes authoritative totals and creates the order
  **without holding inventory** (no reservation — items stay available through the
  PayPal window), the sale captures the moment the buyer hits **Pay Now** in the
  PayPal window (capture verifies amount/currency, marks the order paid + products
  sold, and resolves the concurrent-buyer race so the first payment wins), and a
  signed idempotent webhook reconciles capture/denied/refund. On return the buyer
  lands directly on the "Order Received" confirmation — no confirm-on-return step.
  Sold items leave the shop gallery promptly; paid orders surface as a badge on the
  admin **Orders** tab (not Messages); the order detail page + invoice show the
  shipping address. **Pending go-live steps** (run `no-reservation-checkout.sql`, set
  Netlify env, register webhook, run sandbox test matrix) — see the HANDOFF section
  above and TASKS.
- **Admin Orders** (`/admin/orders`, `/admin/orders/[id]`) with create/manage,
  delete (with optional return-to-inventory), and the new Orders-tab badge.
- **Live metal pricing** via
  `next-app/src/app/api/metal-prices/route.ts`,
  `next-app/src/lib/spot-price.ts`, and `next-app/src/lib/pricing.ts`.
- **Customer accounts** through Supabase Auth and Next routes
  `/account/sign-in`, `/account/sign-up`, and `/account`.
- **Admin, users, and inquiries** through Next admin pages and API routes under
  `next-app/src/app/[locale]/admin*` and `next-app/src/app/api/inquir*`.
- **SEO** through Next metadata, `robots.ts`, and `sitemap.ts`.
- **Carousel hero** on the home page — a windowed/infinite 3D ring of curated
  pieces with a per-photo White/Black swept background, `next/image` optimization
  + preloading, offscreen pause, and admin-configurable selection, ordering, group
  colors, show-price, and desktop/mobile ring sizes. See
  `project-docs/features/carousel-hero.md`.

## What Was Recently Completed

> Full dated history lives in `CHANGELOG.md` (newest first, back to project start).
> This section keeps only the last few sessions as a quick-scan summary.

- **2026-07-02 (later):** Shop-gallery cache now purged after every admin
  order-flow product write (cancel/reopen/mark-paid, delete-order
  return-to-inventory, create-order reserve, archive/hard-delete) via the new
  `adminRevalidateProducts()` action — fixes items staying "sold" in the public
  gallery after being returned to available in admin.
- **2026-07-02:** PayPal checkout hardened against mobile tab eviction during
  the approval round-trip (sessionStorage hand-off + `GET /api/paypal/order-status`
  resume route) and a stale-total bug in the create-order retry path (now
  recomputes and re-validates totals before reusing an order). Also
  investigated and closed out the "returned to a random tab after PayPal"
  report — confirmed to be mobile OS/browser tab-focus behavior, not app code.
- **2026-06-29:** PayPal Orders API v2 checkout wired into `/checkout`
  (replacing the old manual "Submit Order"), with server-side authoritative
  pricing, one-of-one inventory reservation, signed/idempotent webhook, and
  admin Orders-tab delete/return-to-inventory. Sandbox Test 1 (successful
  payment) passed end-to-end. See the PayPal HANDOFF section above for full
  status and `features/paypal-checkout.md` for the technical runbook.
- **2026-06-25:** A four-phase web performance/security + compliance pass —
  fixed silently-failing contact/free-evaluation forms (moved off Netlify
  Forms onto `/api/inquire`), unified the admin inbox across
  inquiries/messages/orders, added the "Message Us Directly" contact form,
  bilingual product notes, a full Spanish orthography sweep, create-account
  duplicate-email handling, and a shop gallery/list view toggle.
- **2026-06-13 → 2026-06-24:** The legacy static HTML site was fully removed
  and the Next.js/Supabase app (`next-app/`) became the sole deploy target;
  sales workflow (orders/invoices/lifecycle statuses), the AI listing
  assistant, compliance/legal pages, and a broad shop/responsive/performance
  pass were all built out. See `CHANGELOG.md` for the day-by-day detail.

## Current Priorities

1. **Bring PayPal checkout live** — see the 🔴 HANDOFF section above for the
   exact blocker (Netlify credential mismatch) and ordered steps. This is the
   top priority; everything else in `TASKS.md` Backlog is secondary to it.
2. ~~Apply the pending Supabase SQL migrations~~ Done -- all confirmed applied
   2026-07-03 (see "Supabase SQL migrations" section above).
3. See `TASKS.md` Backlog for the full prioritized list of deferred shop
   performance work and app-level verification follow-ups for the newly
   applied migrations — it is kept in sync with this file and is the source
   of truth for backlog ordering.
4. Fill in the remaining unknowns in `CLIENTS.md` (Netlify site name/ID, DNS
   registrar, maintenance plan, billing status, credential locations) —
   confirmed still blank as of 2026-07-02.

## Active Blockers

- **PayPal checkout cannot process real payments on the deployed site** until
  the Netlify PayPal env vars are corrected to match the verified sandbox
  credentials — see the 🔴 HANDOFF section above.
- No CI beyond Netlify's `npm run build` on deploy.

## Verification

- Last known good local commands from `next-app/`:
  `npx tsc --noEmit`, `npm run lint` (3 known pre-existing issues:
  `AdminShell.tsx` state-in-effect error, `ShopFilters.tsx` unused-variable
  warning, `app/layout.tsx` font-display warning), and `npm run build`.
