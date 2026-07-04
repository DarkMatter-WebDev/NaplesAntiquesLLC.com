# Decisions Log

> Running log of important technical, design, and business decisions. Newest at
> the top. Use the format below for every entry.
>
> ```
> ## YYYY-MM-DD — Short title
> **Decision:** ...
> **Reason:** ...
> **Alternatives considered:** ...
> ```

## 2026-07-03 — Auto-send receipt on payment; one paid-aware invoice/receipt email

**Decision:** When a PayPal order is captured (becomes paid), automatically email the
buyer their **receipt** from the `capture-order` route — best-effort (a send/log
failure never fails the capture) and only on the fresh capture (an already-paid order
short-circuits earlier in the route, so no duplicate receipt). Use **one** email
builder (`buildInvoiceEmailContent`) that is **paid-aware**: a paid order renders as a
"Receipt" (subject/header wording, a "PAID IN FULL" badge, "Total Paid", paid intro/
note); an unpaid order renders as an "Invoice". Both the admin *Email Invoice/Receipt*
button and the auto-send go through a shared `lib/order-invoice-mailer.ts`
(`sendOrderInvoiceEmail`: fetch order+items → build content → Resend → log to
`order_emails` with `email_type` `'receipt'|'invoice'`). Auto-sends record with a null
`sent_by` (the history shows "Sent automatically"); admin sends record the admin.

**Reason:** The customer's "order placed" moment online is the capture (payment
succeeds), so that's the natural trigger and it's always a paid receipt there. A single
paid-aware builder keeps one source of truth for the document and means the admin
"resend" button automatically produces the right wording. Best-effort send/log keeps
the payment path reliable — the money is already captured, so nothing about the email
may block it. The shared mailer removes the duplicated fetch/build/send/log that
otherwise lived in the admin route.

**Terminology:** paid = "Receipt", unpaid = "Invoice" (the owner was fine calling it a
receipt when paid). The stored `invoices` row + INV-number are unchanged; only the
customer-facing email wording switches on payment status.

**Alternatives considered:** (1) Send on order *creation* (`create_paypal_order`) —
rejected: the order is unpaid then (it'd be an invoice for a not-yet-paid order and
could fire on abandoned checkouts). (2) Also send from the webhook backstop capture —
deferred: the client capture covers the normal path; adding webhook send needs the
same idempotency guard and can be added later if backstop-only captures need it.
(3) Two separate builders (invoice vs receipt) — rejected: one paid-aware builder is
less to maintain and keeps the admin preview and the sent email identical.

## 2026-07-03 — Per-order email history: dedicated `order_emails` table, best-effort logging

**Decision:** Record every admin-sent email from the order detail page (invoice +
fulfillment-update) in a new **`order_emails`** table (order_id FK, email_type,
recipient, subject, status, sent_by/sent_by_email, created_at) and render it in an
**Email History** card under the Summary block on `/admin/orders/[id]`. The two email
routes insert the row **after** a successful Resend send, **best-effort** — a logging
failure (including the table not being migrated) is caught and never fails the email
or the request. Reads/writes run as the authenticated admin (cookie server client)
gated by RLS via the existing `is_admin_user()` helper. The client panel prepends each
just-sent email optimistically so the history updates without a reload; the server
record is the source of truth on next load.

**Reason:** A dedicated table matches the app's one-table-per-concern convention and
keeps email history queryable per order (indexed on `(order_id, created_at)`) without
overloading `admin_notifications` (the message center) or stuffing a JSON blob on
`orders`. Best-effort logging keeps the primary action (sending the email) reliable
and makes the feature safe to ship before the migration is applied. Attributing the
insert to the authenticated admin (not service role) gives a natural `sent_by` and
needs only a simple admin RLS policy.

**Alternatives considered:** (1) A `jsonb` column on `orders` — simpler migration but
unqueryable, races on concurrent writes, and bloats the order row. (2) Reuse
`admin_notifications` — wrong surface (that's the message inbox) and mixes concerns.
(3) Fail the request if logging fails — rejected: the email already went out, so the
send must report success regardless. (4) Service-role insert — avoids an RLS policy
but loses easy `sent_by` attribution; the admin cookie client already runs these
routes.

## 2026-07-03 — Admin "show sold items in shop" toggle: own single-row table + service-role writes

**Decision:** Add an admin setting to show/hide SOLD products in the public shop
gallery, stored in a **new single-row `shop_settings` table** (`show_sold_items
boolean default true`) rather than reusing an existing settings table. Public shop
reads it with the cookie-free anon client (RLS `select using(true)` + anon grant);
writes go **only** through the admin API route (`/api/admin/shop-settings`,
`requireAdmin`-gated) using the **service-role client**, so no admin RLS write policy
/ `is_app_admin()` dependency is needed. The shop's cached catalog read
(`unstable_cache`, tag `shop-catalog`) reads the setting inside the cached function;
the PUT route busts the `shop-catalog` tag so a toggle takes effect promptly.
Available items are always shown; only `sold` is gated. Default and all failure paths
degrade to **showing** sold (historical behavior), so the site is unchanged until the
migration is applied and the admin opts to hide.

**Reason:** Matches the app's established one-table-per-concern settings pattern
(`ai_settings`, `carousel_settings`, `marketing_settings`) and its "service-role write
behind a `requireAdmin` gate" convention (used by marketing/contact routes), which
avoids adding an RLS write policy. Reading inside the cached function keeps the shop's
single-DB-round-trip caching intact; tag invalidation on write is the same mechanism
product writes already use. Defaulting to show-sold means the feature is additive and
safe pre-migration.

**Alternatives considered:** (1) Add a column to `carousel_settings` — rejected:
semantically unrelated, and its admin-write policy is email-based (`is_carousel_admin`).
(2) Read the setting outside the cache and key the cache by it — cleaner cache
correctness but adds an uncached per-request DB read on a cached public page; the
tag-bust approach avoids that. (3) A client-side filter only — rejected: sold rows
would still ship to the browser and appear in facet counts; filtering at the query is
correct. (4) Drop `sold` from `PUBLIC_SHOP_PRODUCT_STATUSES` globally — rejected: the
product **detail** page and admin previews still legitimately render sold items.

## 2026-07-03 — Checkout inventory: no reservation, whoever pays first gets the item

**Decision:** Remove the 30-minute inventory reservation from PayPal checkout
entirely. Products stay `available` all the way through the PayPal window — no hold,
no `reserved` status set by checkout — so any number of buyers can check out the
same one-of-one piece at once. The sale is decided at **capture**:
`capture_paypal_order` row-locks the product rows and, if the item was already
`sold` by a first buyer, returns `item_conflict=true`, flags the losing order
`failed` with a "manual PayPal refund required" note, and does not sell; the winning
capture flips the products to `sold`. `create_paypal_order` replaces
`reserve_paypal_order` in the create path (order + items, no hold). The old
`reserve_paypal_order` hold and `release_expired_paypal_reservations` sweep are
dropped (`supabase/no-reservation-checkout.sql`), and `apply_paypal_order_event`'s
`denied` branch no longer releases a reservation. The vestigial
`reserved_until`/`reserved_order_id` columns are left in place (always null) to
avoid a destructive schema change.

**Reason:** The owner wants the simplest possible model — first to complete checkout
gets the item — with no timed holds that take a piece off the market for someone who
may never pay. Reservations added real complexity (a hold RPC, an expiry sweep, a
`reserved` lifecycle state, cache-busting on release) to defend against a rare
double-sale; recomputing the winner at capture with a row lock defends the same case
without holding inventory. The trade-off is that two buyers can occasionally both pay
for the same one-of-one within seconds — the loser is captured and refunded manually,
which the owner accepts as rare and cheaper than the reservation machinery.

**Scope:** This is the automatic **checkout** reservation only. The manual admin
**Reserved** product status (an indefinite merchandising hold the owner sets by hand)
is unrelated and unchanged, as is the admin-created-order flow that moves products to
`pending_payment`.

**Alternatives considered:** (1) Keep the 30-min hold — rejected by the owner as
taking items off the market and adding complexity. (2) Reserve only for a very short
window — still a hold + expiry sweep; same category of complexity. (3) Auto-refund
the losing buyer on `item_conflict` instead of flagging for manual refund — deferred;
the conflict is rare and a human refund is safer than an automatic money movement for
now (could be automated later).

**Supersedes:** the "Inventory model" portion of the 2026-06-29 "PayPal is the
checkout payment processor" decision below (the server-side authoritative-pricing and
capture-verification portions of that decision still stand).

## 2026-07-03 — PayPal: capture on approve, drop the confirm-on-return + resume flow

**Decision:** Capture the PayPal payment in the Buttons `onApprove` callback (the
moment the buyer hits **Pay Now** in the PayPal window), and on return to our tab
send the buyer straight to the existing "Order Received" confirmation. Removed the
2026-07-02 machinery that split approval from capture: the intermediate "Confirm
Your Order" review screen, the client-side capture-on-confirm button, the
sessionStorage hand-off record (`nej-paypal-pending`), the
`GET /api/paypal/order-status` resume route, and `getPayPalOrder()` in
`lib/paypal.ts`. `PayPalCheckoutButton` lost its `onApproved` hand-off prop and now
always captures in `onApprove`. The in-memory order-id reuse (cancel-then-retry
without double-reserving, in the same tab) is kept.

**Reason:** The owner wanted the standard, simplest PayPal UX — the sale finalizes
in the PayPal window and the customer just sees a confirmation when they come back,
with no extra "confirm to complete" step on our site. The 2026-07-02 confirm screen
existed to let a mobile tab-eviction be resumed, but it added a second click to
complete every purchase and a fair amount of state/route surface; the owner judged
the extra step worse than the rare eviction edge case.

**Trade-off / backstops:** If a mobile OS evicts the tab after approval but before
the `onApprove` capture fetch completes, the client can no longer resume and finish
the capture. Because nothing is reserved (see the 2026-07-03 no-reservation
decision above), that just leaves the item available — the buyer can retry or
another buyer can purchase it — and the `PAYMENT.CAPTURE.COMPLETED` webhook still
reconciles any capture that did land. An approved-but-uncaptured PayPal order also
voids on its own.

**Alternatives considered:** (1) Keep the confirm screen but auto-click it on
return — still leaves the resume route + sessionStorage surface and a UI flash; the
owner wanted it gone. (2) Keep the resume route as a silent reconciliation on mount
(no visible confirm screen) — rejected as unneeded now that the webhook already
reconciles capture server-side. (3) Leave `onApproved` on the button as an unused
option — rejected to avoid dead reachable code (AGENTS.md: no stray/dead artifacts).

**Supersedes:** the 2026-07-02 "PayPal approval-return hardening (reload/eviction
resume)" work (the stale-total reuse fix from that same day still stands).

## 2026-07-02 — Project-docs cleanup: CHANGELOG.md is the one full-history log

**Decision:** `CURRENT_STATUS.md`'s "What Was Recently Completed" section and
`TASKS.md`'s "Completed" section were trimmed from a near-complete duplicate
of the entire project history (both had grown to 1700-2300+ lines, mirroring
`CHANGELOG.md` back to 2026-06-13) down to a handful of recent highlights
plus a pointer to `CHANGELOG.md`. `TASKS.md`'s Backlog also had its full
PayPal go-live checklist replaced with a pointer to the 🔴 HANDOFF section in
`CURRENT_STATUS.md` (the single more-detailed, more-current copy), and ~15
"apply supabase/X.sql" items for 2026-06-15→06-20 migrations were removed
where the corresponding features are confirmed live (see the note left in
`TASKS.md` Backlog for the list and how to re-add one if it turns out wrong).
Several `DECISIONS.md` entries describing now-replaced approaches (static
site, Jotform/Netlify Forms, code-based catalog, `/es/` static pages,
`item_date`) were annotated **⚠️ Superseded** with a pointer to the
superseding entry, rather than deleted — this is a decisions *log*, so
history stays but a reader no longer mistakes it for current guidance.

**Reason:** Requested project-wide documentation refresh. Three files
carrying the same history meant every session paid the cost of reading (or
skipping) thousands of duplicate lines, and the duplication had already
drifted — e.g. `TASKS.md`'s PayPal checklist still described "set the 4 env
vars" as an open investigation after `CURRENT_STATUS.md` had already
diagnosed the exact credential-mismatch root cause on 2026-06-30.

**Alternatives considered:** Leave the duplication and just append new
entries each session (status quo — guarantees the copies re-diverge); delete
history outright instead of trimming-with-pointer (loses the record;
`CHANGELOG.md` is deliberately kept as the single canonical full history so
nothing is actually lost).

## 2026-06-30 — PayPal: id, secret, and PAYPAL_ENV must form one consistent set

**Decision:** The three PayPal credential variables (`PAYPAL_CLIENT_ID`,
`PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`) must always come from the **same PayPal app and
environment** — mixing them (id from app A, secret from app B, or `PAYPAL_ENV=sandbox`
with live creds) causes `401 invalid_client` from PayPal's token endpoint. The server
route catches this and returns 502, which the client surfaces as "Something went wrong
with PayPal. Please try again." The symptom gives no hint that credentials are mismatched.

**Root-cause incident (2026-06-30):** After the first successful Netlify deploy (fixing
the secrets-scan issue), PayPal checkout failed on the live site with the above error.
Diagnosis: the live checkout page served `PAYPAL_CLIENT_ID = AcSsWn15M34…` (Netlify's
stored value), but the verified working sandbox creds in `.env.local` use
`PAYPAL_CLIENT_ID = AbscNftOUog…`. These are **different PayPal apps.** Netlify's
`PAYPAL_CLIENT_SECRET` was the secret for the `AcSsWn15M34` app; the server was trying
to authenticate as that app, which the sandbox rejected. The DB side (inventory reserve
RPC) succeeded; only the PayPal API call failed.

**Rule for go-live (and any future credential rotation):** change all 4 PayPal vars
together in one Netlify update — never update id without updating secret (and vice
versa), and always match `PAYPAL_ENV` to the app's environment:
- Sandbox: `PAYPAL_ENV=sandbox` + sandbox id + sandbox secret + sandbox `PAYPAL_WEBHOOK_ID`
- Live: `PAYPAL_ENV=live` + live id + live secret + live `PAYPAL_WEBHOOK_ID`

**Reason:** `lib/paypal.ts → getAccessToken()` uses Basic auth `clientId:clientSecret` —
if those two belong to different apps, PayPal returns 401 regardless of which endpoint
is hit. There is no way to detect this from the client-side error.

**Alternatives considered:** Check the id/secret pairing at server startup — impractical;
we'd need to call the token endpoint on cold boot. Add a `/api/paypal/check-config` admin
probe — useful but optional; the diagnostic curl in CURRENT_STATUS.md does the same.

## 2026-06-30 — Netlify secrets scan: omit PAYPAL_CLIENT_ID (public by design)

**Decision:** Add `PAYPAL_CLIENT_ID` to `SECRETS_SCAN_OMIT_KEYS` in root
`netlify.toml` (alongside the `NEXT_PUBLIC_*` keys). The PayPal **client id** is a
public identifier — it ships to the browser inside the PayPal JS SDK URL, so it
necessarily appears in the built `checkout.html`/`.rsc` output. Netlify's secrets
scanner flagged it and failed the deploy; omitting the key tells the scanner it is
intentionally public. `PAYPAL_CLIENT_SECRET` is **not** omitted and was not found
in build output (it stays server-side); it must never be added to this list.

**Reason:** The deploy failed with "Secret env var PAYPAL_CLIENT_ID's value
detected" across the checkout HTML/RSC. The client id is public per PayPal's design
(it's how the browser SDK is initialized), so the correct fix is to whitelist that
one key in the scanner, not to remove it from the build. This mirrors how the
project already handles the public Supabase URL/anon key and site URL.

**Alternatives considered:** (1) `SECRETS_SCAN_OMIT_PATHS` to exclude the checkout
build files — rejected: broader than needed and would suppress scanning of other
secrets in those files. (2) `SECRETS_SCAN_ENABLED=false` — rejected: disables the
safety net entirely. (3) Rename it `NEXT_PUBLIC_PAYPAL_CLIENT_ID` — rejected: the
project deliberately delivers the id via a server prop (see the 2026-06-29 PayPal
decision); the omit-key is the targeted fix without changing that contract.

## 2026-06-30 — Paid orders notify on the Orders tab, not the Messages center

**Decision:** A paid PayPal order no longer writes an `admin_notifications` row.
It surfaces as a count badge on the admin **Orders** nav (`AdminOrdersLink`,
counting `payment_status='paid'` + `fulfillment_status='pending'` orders), which
self-clears as orders are fulfilled. The Messages center is reserved for contact
messages and inquiries. Separately, the customer's shipping address (already
stored on the order) is now rendered on the order detail page and the invoice email.

**Reason:** The owner wanted incoming orders to appear with the orders, not mixed
into the message inbox. A derived count (vs. an unread-notification row) needs no
read-state machinery and reflects real fulfillment work. `capture_paypal_order`
dropped its notification insert (idempotent migration re-run).

**Alternatives considered:** (1) Keep writing order notifications but filter
`type='order'` out of Messages and mark-read on Orders view — more moving parts
(per-page unread counts + read-marking). (2) Email the owner on capture — not done
yet; could be added alongside the badge.

## 2026-07-03 — Checkout: address always shown in Contact Details, required only for shipping

**Decision:** The buyer's address fields (street, apt, city, state, ZIP, country)
now always render inside the **Contact Details** panel, directly under Email —
regardless of the delivery method. They are **required/enforced only when a shipping
method other than local pickup is selected** (`needsShipping`): when shipping, the
labels show `*`, the inputs are `required`, and `payReady`/`missingFieldLabels` block
payment until street+city+state+ZIP are filled; for local pickup the same fields are
shown with an "Optional for local pickup" hint, no `*`, and never block payment. The
address the buyer types is **always** sent in the create-order payload (captured as a
contact record on the order via `buildAddressObject`); the server still only
*requires* a complete address when the shipping method needs one.

**Reason:** The owner wants to collect the customer's address as part of their
contact information on every order (useful contact/record data), while only forcing a
complete address when it's actually needed for delivery.

**Supersedes** the 2026-06-30 decision below (address block in the left review
column, rendered only when shipping is selected).

## 2026-06-30 — Checkout layout: shipping selector on the Order Summary, address under it

> ⚠️ **Superseded 2026-07-03** — the address now lives in the Contact Details panel
> and is always shown (required only for shipping); see the entry above. The
> delivery-method `<select>` staying on the Order Summary's "Shipping" row still
> holds.

**Decision:** The delivery-method picker lives on the Order Summary's "Shipping"
row as an inline `<select>`; the Shipping Address block sits in the left review
column directly under the Order Summary (matching its width) and renders only when
a shipping method is selected. The PayPal/card buttons render up front and validate
contact (and, when shipping, address) fields in PayPal's `onClick` before opening.

**Reason:** Iterated with the owner toward a conventional, compact layout — three
radio cards ate too much vertical space, and grouping the shipping method + address
with the order review reads cleaner than splitting them across columns.

**Alternatives considered:** delivery method as radio cards in the form (rejected:
too tall); a separate delivery-method field in the form (rejected: redundant with
the summary's Shipping row).

## 2026-06-29 — PayPal is the checkout payment processor; amounts computed server-side

**Decision:** Wire PayPal (JS SDK on the client, Orders API v2 on the server) into
the existing `/checkout` page as the final payment step, **replacing** the old
manual "Submit Order" (unpaid contact-to-buy) button. The browser never sends
prices: `POST /api/paypal/create-order` recomputes the authoritative subtotal/tax/
shipping/total from the DB (shared `lib/checkout-pricing.ts`, reused by the legacy
`/api/checkout/order` route), creates the internal order, reserves inventory, then
creates the PayPal order. `POST /api/paypal/capture-order` captures server-side,
verifies the captured amount+currency equal the internal order, then marks the
order paid (`payment_status='paid'`, `order_status='completed'` — same state as the
admin "Mark Paid" action) and the products `sold`. A signed PayPal webhook
(`/api/paypal/webhook`) is the idempotent backstop (logged in `webhook_events`).
The PayPal client id is read server-side in `checkout/page.tsx` and passed as a
prop (it ships to the browser inside the SDK URL, but is not a `NEXT_PUBLIC_*`
var). On success the existing inline "Order Received" confirmation is reused.

**Reason:** Estate pieces are one-of-one, so trusting client amounts or skipping a
reservation would risk underpayment or double-sale. Recomputing server-side and
reserving with a row-locking RPC closes both. Mirroring the admin "Mark Paid"
status keeps the admin orders UI consistent. Reusing the existing order RPC
pattern, Supabase service client, and the Resend webhook's verify/idempotency
shape kept the change additive rather than a checkout rebuild.

**Inventory model:** ⚠️ **Superseded 2026-07-03** — see "Checkout inventory: no
reservation, whoever pays first gets the item" at the top of this log. Reservation
was removed; the description below is the original 30-minute-hold design, kept as
history. *`reserve_paypal_order` (SECURITY DEFINER) `SELECT … FOR UPDATE` locks the
product rows, releases any expired holds, verifies each item is `available`, creates
the order + items, and flips products to `reserved` with a 30-minute `reserved_until`.
Concurrent buyers serialize on the lock; the loser gets "no longer available".
`release_expired_paypal_reservations` frees lapsed holds (called inline and exposable
to a cron). The public shop already hides `reserved` items, so a hold removes the
piece from the storefront immediately.*

**Amount mismatch:** if a capture's amount/currency doesn't match the order, the
money is captured but the order is **not** auto-fulfilled — it's set to
`payment_status='pending'` with an admin notification for manual review.

**Alternatives considered:** (1) Put PayPal on the placeholder `/payment` page —
rejected: the live checkout is `/checkout`; `/payment` has no order linkage. (2)
Keep the manual unpaid-order button alongside PayPal — rejected by the owner
(two order-creation paths on one page invites double orders). (3) Trust the
client cart total / set products `sold` at order creation — rejected: enables
underpayment and overselling one-of-one stock. (4) `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
— avoided; the id is delivered via a server prop instead. (5) Add the
`@paypal/react-paypal-js` dependency — rejected: the script-tag SDK + fetch
against the REST API needs no new npm packages.

## 2026-06-25 — Lead forms post to /api/inquire, not Netlify Forms

**Decision:** Fix the silently-failing `/contact` (submit-item) and
`/free-evaluation` forms by submitting them via `fetch` to the existing
`/api/inquire` route (Resend + Supabase `inquiries` + `/admin/inquiries`),
instead of Netlify Forms. `/api/inquire` now branches on content-type: JSON keeps
the original product-inquiry contract (InquiryForm, unchanged); multipart handles
the lead forms with required photo uploads. Photos upload server-side via the
service-role client to the `product-images` bucket under `inquiries/…` and are
recorded in `inquiries.uploaded_image_urls` (the column the Storage-GC reference
scan already tracks), with graceful fallback to message text if the column is
absent. Did **not** create `public/__forms.html`.

**Reason:** Netlify's form detector only parses static HTML at deploy time, so it
never sees client-rendered React forms — submissions were lost while the UI faked
success. The project already has a proven Resend+Supabase inquiry pipeline, so
reusing it is more reliable, fully testable locally, keeps all leads in one admin
inbox, and (unlike `application/x-www-form-urlencoded`) preserves the required
photo uploads. Server-side upload via service role avoids needing an anonymous
Storage policy.

**Alternatives considered:** (1) Netlify Forms with multipart `FormData` —
rejected: unverifiable without a deploy, AJAX file uploads to Netlify are
unreliable, and it splits leads across a second inbox. (2) Netlify Forms with
urlencoded exactly as first specified — rejected: cannot carry the photos, which
are the point of these forms. (3) A brand-new `/api/inquiries` POST route —
rejected: `/api/inquire` already exists with the email logic to reuse.

## 2026-06-25 — Ship CSP in Report-Only first; consolidate to one netlify.toml

**Decision:** Add the security headers and Content-Security-Policy via the **root**
`netlify.toml` `[[headers]]` (deleting the duplicate `next-app/netlify.toml`), and
deploy the CSP as `Content-Security-Policy-Report-Only` before enforcing. Caching
is immutable 1y for `/_next/static/*` and `/assets/*` with a short
`must-revalidate` catch-all; 410 `force` redirects block common probe paths.

**Reason:** Two netlify.toml files invite config drift; the root file is the one
Netlify reads (`base = "next-app"`). A CSP tight enough to matter can break inline
scripts/styles, Google Fonts, or Supabase calls; Report-Only logs violations
without breaking the site so the policy can be validated against real pages first.

**Alternatives considered:** (1) Enforce CSP immediately — rejected: high risk of
breaking the icon font / inline JSON-LD / Supabase before real-traffic validation.
(2) Keep both toml files — rejected: drift risk. (3) Use a `public/_headers` file —
equivalent, but `[[headers]]` keeps headers, redirects, and caching in one file.

## 2026-06-25 — Unified admin inbox: inquiries also post to the message center

**Decision:** Every inquiry submission (`/api/inquire` — Free Evaluation, Submit
Your Item, product inquiry) writes an `admin_notifications` row (`type: 'inquiry'`,
photos attached) in addition to its `inquiries` row, so the message center
(`/admin/messages`) is a single inbox for all incoming submissions (lead forms,
"Message Us Directly" messages, and order notifications). Inquiries still also live
in `/admin/inquiries` (their status workflow) and still email the owner. A shared
`lib/admin-notify.ts` (`createAdminNotification`) does the insert; it is best-effort
(a failure never fails the submission) and reused by `/api/contact-message`.

**Reason:** The owner wanted one place to see everything coming in. Layering a
notification on top of the existing `inquiries` record (rather than moving inquiries
into `admin_notifications`) keeps the inquiry status workflow intact while giving the
message center full coverage, including the unread badge.

**Alternatives considered:** (1) Replace the `inquiries` table with
`admin_notifications` — rejected: loses the inquiry status workflow and the
`/admin/inquiries` management view. (2) A DB trigger that mirrors inquiries into
notifications — rejected: harder to attach the already-uploaded photo URLs and to
keep best-effort/non-blocking semantics; the app-layer helper is simpler and shared
with the message form.

## 2026-06-25 — Public lead inserts run as anon; service role is for Storage + admin tables only

**Decision:** `/api/inquire` inserts inquiry rows using the **anon** client
(`createPublicClient()`), not the service-role client. The service-role client is
reserved for the Storage photo upload (RLS bypass) and for writing RLS-restricted
admin tables. For `admin_notifications` (no public-insert path), the service role is
kept but must be granted INSERT explicitly (`service-role-insert-grants.sql`).

**Reason:** `inquiries` is designed for public submission — it has a `with check
(true)` insert policy and `grant insert … to anon`. The service role bypasses RLS
but, in Postgres, still needs a table-level INSERT grant, which it didn't have here
(grants were scoped to anon/authenticated). The route's `db = service ?? createClient()`
preferred the service role once a service key existed, producing 42501 "permission
denied for table inquiries". Inserting as anon matches the table's intended access
and needs no new grant. Using anon (cookie-free) instead of the cookie-based server
client also avoids the `authenticated` role, which likewise lacks the INSERT grant —
so logged-in submitters work too.

**Alternatives considered:** (1) `GRANT INSERT ON inquiries TO service_role` and keep
inserting as service — works, but adds a migration for a table that already supports
anon insert by design. (2) Keep the cookie-based server client — rejected: a
logged-in submitter runs as `authenticated`, which has no INSERT grant. For
`admin_notifications` there is no anon path, so the grant (or a SECURITY DEFINER RPC)
is unavoidable; chose the grant for simplicity.

## 2026-06-25 — Surface customer photos in the admin panel (inquiries + messages)

**Decision:** Show uploaded customer photos as thumbnails in the admin panel.
Inquiries already store photo URLs in `inquiries.uploaded_image_urls`, so
`/admin/inquiries` now selects and renders them. For the "Message Us Directly"
form, added optional photo upload: the route uploads to the existing
`product-images` Storage bucket under a new `messages/` prefix and stores the URL
strings in a new `admin_notifications.image_urls` (jsonb) column, which
`/admin/messages` renders. Thumbnails use `next/image` with `unoptimized` (admin-
only, avoids image-domain config and the `no-img-element` lint rule) and link to
the full-size image.

**Reason:** Photo bytes stay in Storage and rows store only URL strings (the
project's standard). Reusing the `product-images` bucket avoids a new bucket +
policies. Because this is a **new upload destination**, the column was added to the
Storage GC reference scan (`/api/admin/storage-gc`) so message photos are never
deleted as orphans (per the GC reference-set rule).

**Alternatives considered:** (1) A separate Storage bucket for messages — rejected
as unnecessary; the prefix is enough. (2) Stuffing photo URLs into the notification
`body` text — rejected: they wouldn't render as images (kept only as a degraded
fallback when the `image_urls` column is missing pre-migration). (3) Raw `<img>` —
rejected: trips the `no-img-element` lint rule.

**Dependency:** run `supabase/admin-notifications-image-urls.sql`. Reads and writes
degrade gracefully before it's applied (messages page falls back to no-photos; the
route falls back to keeping photo links in the body text).

## 2026-06-25 — "Message Us Directly" contact form posts to the admin message center

**Decision:** Add a public "Message Us Directly" form below the hero on `/contact`
(name, email, optional phone, large message) that delivers straight into the admin
message center. The new `/api/contact-message` route inserts a `type: 'message'`
row into `admin_notifications` using the **service-role** client (server-side), and
also sends a best-effort owner email (reply-to the sender) as a backup. The new
`MessageUsForm` is rendered above the existing "Submit Your Item" (`ContactForm`)
in the non-inquiry contact view.

**Reason:** `admin_notifications` RLS allows only admins to read/update — there is
no public insert. The existing contact flow already depends on the service-role
client (for inquiry photo uploads), so a server-side service-role insert reaches
the message center with **no new SQL migration**, and keeps the key off the
browser. The email backup means a message is never lost if the service role or the
`admin_notifications` table is unavailable.

**Alternatives considered:** (1) A `SECURITY DEFINER` RPC granted to anon (like
`create_checkout_order`) — architecturally clean and service-role-free, but adds a
new migration the owner must run; rejected for friction since service-role is
already required here. (2) Insert into the `inquiries` table and surface it under
Messages — rejected: the owner specifically wanted it in the message center, and
inquiries are a separate lead/intake concept. (3) Email only — rejected: the
request was explicitly to land it in admin messages.

**Dependencies:** `SUPABASE_SERVICE_ROLE_KEY` and the `admin_notifications` table
(`admin-notifications-checkout.sql`). If the table isn't present, the insert fails
and only the owner email fires (the form still reports success).

## 2026-06-25 — Product listing notes are bilingual; "Internal Notes" replaced by "Notes (ES)"

**Decision:** Make the product listing's public notes bilingual, matching the
title/description EN/ES pattern. The add/edit listing form's two notes fields are
now **Notes (EN)** (`products.public_notes`, unchanged column) and **Notes (ES)**
(new `products.public_notes_es` column), which replaces the old admin-only
**Internal Notes** form field. The Spanish (/es) product detail page shows
`public_notes_es` when present, falling back to the English `public_notes` (like
`description_es` → `description`). Notes (ES) auto-translates from Notes (EN) on
save via the existing translate flow, and is also manually editable.

**Scope:** products only. The legacy `products.internal_notes` column is kept (it
still preserves folded legacy `details` on save) but is no longer surfaced in the
UI; no internal-notes data is migrated into the public field, so previously-private
notes are never exposed. The separate admin `internal_notes` on **orders /
inquiries / profiles** is intentionally left unchanged — those are unrelated
admin-only fields (e.g. checkout auto-writes an English admin string into
`orders.internal_notes`), so relabeling them "Notes (ES)" would be wrong and would
ripple through the checkout RPC.

**Reason:** The goal was to show a Spanish version of the public notes on the ES
product pages. Repurposing the rarely-used Internal Notes form slot into the public
Spanish note delivers that with the established EN/ES localization pattern. Reads
(product detail) and writes (admin save) degrade gracefully before the migration is
applied (generalized missing-optional-column fallback covering `item_year` and
`public_notes_es`).

**Alternatives considered:** (1) Rename `internal_notes` → notes_es on every table —
rejected after finding it's semantically wrong and checkout-affecting for
orders/inquiries/profiles. (2) Drop `products.internal_notes` — rejected to avoid a
destructive migration and to keep the legacy `details` fold working. (3) Keep notes
English-only — rejected; the owner wants Spanish notes on the ES pages.

## 2026-06-25 — AI listing prompt is a single editable value, not default+override

**Decision:** Present and treat the AI listing-assistant prompt as **one** prompt
that the admin edits in `/admin/settings`. The saved value in `ai_settings` IS the
prompt; the code constant `PRODUCT_EXTRACTION_SYSTEM_PROMPT` is only its **built-in
starting value**, used until an edit is saved (and recoverable via a "Restore
Built-In" action). Removed the "Custom vs Default" badge and the
`isCustom`/`defaultPrompt`/"override" framing from the API (`/api/admin/ai-settings`
now returns `systemPrompt` + `builtInPrompt`), the store
(`fetchStoredSystemPrompt`/`saveSystemPrompt`), and the panel UI.

**Reason:** The owner wants a single prompt they can edit so the edit permanently
becomes the prompt — not a default layered under a separate override. The previous
framing (NULL = default, set = override; "Custom"/"Default" badge) implied two
prompts and could show a stored value that diverged from "the implemented prompt."
The underlying mechanism is unchanged (saved value wins, blank clears it); only the
model, naming, and UI were collapsed to one prompt.

**Alternatives considered:** (1) Keep the default+override duality as-is — rejected:
the owner explicitly wants one prompt. (2) Remove the `ai_settings` table and make
the code constant the only source — rejected: that would lose runtime editability
without a deploy, which is the whole point of the editable prompt. (3) Drop the
"Restore Built-In" action entirely — rejected: keeping a recovery path to the
shipped baseline operates on the same single value and avoids a footgun.

**Refines:** the 2026-06-18 "Store the editable AI prompt in an admin-only
`ai_settings` table" decision — same table and persistence, single-prompt framing.

## 2026-06-25 — Detect duplicate sign-up via Supabase's empty-identities signal

**Decision:** On the Create Account form, detect an already-registered email
client-side from the `supabase.auth.signUp` response — a returned user whose
`identities` array is empty means the email already belongs to a **confirmed**
account (Supabase's anti-enumeration obfuscation when "Confirm email" is on) —
with a fallback that also treats an explicit "already registered" error as a
duplicate. On a hit, show an in-form notice with a **Reset Password** button
(`resetPasswordForEmail` → emailed recovery link) and a Go to Sign In link.
Password recovery is handled by a new dual-mode `/account/reset-password` page
(request-email vs. set-new-password when a recovery session is present).

**Reason:** Keeps the existing fully client-side auth flow (only the anon key
ships to the browser) — no new server route or service-role lookup, and no email
enumeration endpoint. The empty-`identities` check is Supabase's documented way
to detect a duplicate without a privileged query, and it does not send a second
confirmation email to the real owner of an existing confirmed account.

**Alternatives considered:** (1) A server route using the service-role key to
look up the email before signup — rejected: adds a privileged, enumerable
endpoint for a check the signUp response already encodes. (2) Rely only on the
"already registered" error — rejected: that error is only returned when email
confirmation is disabled; with confirmation on (this project), the empty-identities
signal is required. (3) Reuse the in-app `updateUser` password change only —
rejected: that needs an existing session, which a locked-out user does not have,
so an emailed recovery link is necessary.

**Caveat:** An existing but **unconfirmed** account is not flagged (Supabase
resends its confirmation instead), which is acceptable. Live verification of the
duplicate notice + reset email is pending (see TASKS) and depends on the Supabase
redirect-URL allowlist including `…/account/reset-password`.

## 2026-06-25 — Shop list view as a separate component behind a URL param

**Decision:** Add the gallery/list view choice as a `view=list` URL search param
(defaulting to gallery), and render list mode with a brand-new `ProductListRow`
component selected inside `ShopProductGrid`, rather than adding a layout mode to
the existing `ProductCard`. The gallery `ProductCard` and grid markup/CSS are
left completely untouched.

**Reason:** The requirement was explicitly "do not change how the gallery cards
look and are arranged." A separate list component guarantees the gallery path is
byte-identical and isolates the list-only CSS, while the URL param keeps the
choice shareable, back-button safe, and consistent with the existing `sort`
control pattern. List CSS lives once in `ShopProductGrid`'s list branch.

**Alternatives considered:** (1) Add a `layout="list"` prop to `ProductCard` and
branch its JSX/CSS — rejected: the card already carries a large reveal/hover/mobile
`<style>` block, and conditionally restructuring it risked regressing the gallery
look. (2) Persist the choice in localStorage instead of the URL — rejected: not
shareable and would flash the default on first server render.

## 2026-06-24 — Cache the shop catalog read instead of making /shop static

**Decision:** Keep `/shop` as dynamic SSR for now, but wrap the expensive catalog
read (the column-narrowed product scan + total-inventory count) in
`unstable_cache`, keyed by the DB-level filter set (`status`, `purity`,
`metalColor`, `metal`, `brand`). Also cap the upstream metal-price fetch with a
1.5s `AbortSignal.timeout`, and let next/image optimize the header logo (drop
`unoptimized`).

**Reason:** The cold-load slowness came from two things every external visitor
paid for: a full-table product scan and a render-blocking live call to
`api.gold-api.com`. Caching the catalog lets concurrent cold visitors share one
DB round trip per 300s window; the fetch timeout stops a slow upstream from
holding TTFB hostage. These are low-risk and preserve the existing faceted
filtering exactly (verified: `metal=gold` still returns 47/54 vs 48/54 bare).

**Alternatives considered:** (1) Make bare `/shop` fully static/ISR — higher
value but requires extracting filtering/faceting/pagination out of the server
component (the page awaits `searchParams`), which is a larger refactor logged in
TASKS. (2) DB-side `.range()` pagination — deferred for the same reason: facets
and live spot-price sorting are computed over the full row set today. (3) Leave
the metal fetch unbounded — rejected; it was the single worst-case TTFB spike.

**Decision:** Anonymous public data reads should use a cookie-free Supabase
client, and the proxy should refresh Supabase sessions only on routes that
actually need user state (`account`, `admin`, `checkout`, and `payment`). The
localized layout should seed `next-intl` with static locale params so public
marketing/legal/service pages can prerender.

**Reason:** Reading request cookies for anonymous product/marketing pages was
forcing request-time rendering without adding personalization. Cart and wishlist
badges are already client/local-storage driven, so public HTML can be cached
independently from logged-in account/admin flows.

**Alternatives considered:** Keep the cookie-backed server client everywhere,
or try to force all shop routes static immediately. The first preserves
unnecessary dynamic rendering; the second would require a larger shop filtering
refactor because `/shop` currently combines URL params, live spot pricing,
derived item groups, and pagination on the server.

## 2026-06-22 - De-duplicate repeated shop card styles before deeper shop rewrites

**Decision:** Render the modern product-card and card-cart-button CSS once per
shop grid instead of once per product card, while leaving the current
server-filtered shop behavior intact.

**Reason:** Production probes showed `/shop` was compressed but very large.
Repeated inline card styles were an immediate payload bottleneck that could be
removed without changing visible behavior or the product data contract.

**Alternatives considered:** Reduce the default product count per page or remove
multi-image card behavior. Those would alter storefront behavior. A larger
client-filtered cached shell remains a backlog item.

## 2026-06-22 - Customer-facing reveal gates fail open

**Decision:** Homepage hero and shop card reveal animations should wait briefly
for data, fonts, and images, but must reveal after a bounded fallback even if a
load event stalls or is missed.

**Reason:** The reveal animation is polish, while the hero and product grid are
core content. A failed readiness signal should not leave customer-facing
sections at opacity 0.

**Alternatives considered:** Remove reveal animations entirely, or keep waiting
for every readiness promise to settle. Removing the animations would discard the
intended polish, while strict waiting already caused invisible hero/shop states
in local preview.

**Update (2026-06-22):** Homepage carousel fallback photos are now a hard
fallback, not a temporary visible state. The hero waits longer for the live
curated selection, and if fallback has already been revealed, late live results
are ignored for that page load to avoid a visible product-image swap.

## 2026-06-22 - Standardize responsive layout primitives

**Decision:** Add shared responsive layout components/classes for containers,
sections, stacks, grids, card grids, form grids, tables, hero sections, and
responsive typography instead of continuing to tune every page with one-off
fixed-width Tailwind combinations.

**Reason:** The site has many public, shop, checkout, account, and admin
surfaces that need consistent behavior from 320px through ultrawide desktop.
Shared clamp/minmax/container patterns reduce drift, prevent accidental
horizontal overflow, and give future pages a standard mobile-first structure.

**Alternatives considered:** Patch only the pages that visibly overflowed, or
hide horizontal overflow globally. One-off fixes would keep the layout system
fragile, while blanket hiding could mask real clipped controls and tables.

## 2026-06-21 - Duplicate Clear Filters controls share one clear-all path

**Decision:** The top and bottom Clear Filters controls in the shop filter
panel use the same `clearAll()` behavior and only render as active controls
when filters are applied.

**Reason:** The top control improves ergonomics for filtered browsing while
keeping URL state, pagination reset, and visible behavior identical to the
existing clear link.

**Alternatives considered:** Add a separate top-only clear implementation;
rejected because it could drift from the existing bottom control.

## 2026-06-21 - Share shop sort state across sidebar and gallery controls

**Decision:** The left filter-menu Sort dropdown and the gallery-top Sort
dropdown use the same `ShopSortSelect` client control and the same URL-backed
`sort` parameter.

**Reason:** Shoppers expect a visible sort control above product grids, while
the existing filter menu still needs to expose sorting alongside other filters.
Sharing one control keeps labels, behavior, pagination reset, and selected
state synchronized.

**Alternatives considered:** Build a separate gallery-only sort menu; rejected
because duplicate option lists would drift. Remove Sort from the left filter
menu; rejected because the owner asked for the gallery dropdown in addition to
the existing sort button.

## 2026-06-21 - Public shop shows only available/sold products

**Decision:** Treat `available` and `sold` as the only statuses visible in the
public storefront. Draft, reserved, pending-payment, and archived products are
excluded from `/shop` queries, public counts, filter option derivation, and
normal shopper product-detail access. Admin/account return links may still
preview detail pages for operational context.

**Reason:** Draft and reserved inventory should not be discoverable by shoppers,
while sold items can remain visible as historical/merchandising examples and
available items remain purchasable.

**Alternatives considered:** Hide only draft/reserved and leave archived items
visible; rejected because archived is also not a public merchandising state.
Block admin detail previews too; rejected because the admin table uses the
public detail route as a convenient preview surface.

## 2026-06-20 - Shop era/year filter: standard estate eras, hide blank years

**Decision:** The shop's Era/Year slider uses the standard non-overlapping
estate-jewelry eras from 1837 to the current year — Victorian (1837), Edwardian
(1901), Art Deco (1915), Retro (1935), Mid-Century (1950), Modern (1970),
Contemporary (2000). At full span it shows all items; once narrowed it shows
only items whose `item_year` is in range and hides items with no year.

**Reason:** Owner chose year-only provenance and the common estate vocabulary so
buyers can shop by period. Hiding blank-year items on narrow is standard filter
behavior; full-span-shows-all keeps the catalog complete by default while years
are still being backfilled.

**Alternatives considered:** Include Georgian (1714) — rejected as a long sparse
early stretch; 20th-century-only span — rejected as too narrow for estate stock;
always keep blank-year items visible — rejected as imprecise once years exist.

**Update (2026-06-20):** Made the era display multi-level so overlapping
movements can coexist with the contiguous primary row, rendered in stacked rows
above it (one level per row so they never collide). All rows use the same
line-based band styling (no pill); overlapping bands add small end-cap ticks at
their exact edges since they don't align to the primary tick marks. Each era
title is clickable and snaps the range to that era; the `level` field in
`jewelry-eras.ts` allows more overlapping eras later.

**Update (2026-06-20, revision):** Owner trimmed the scheme to a single
overlapping era — **Art Nouveau (1890–1910)**. Belle Époque, Arts & Crafts, and
Georgian were removed (Georgian had extended the floor to 1714); the slider's
left bound is back to 1837. The left end is now labeled "1837 & earlier" and
imposes **no** lower filter limit, so the floor handle captures pre-Victorian
pieces. A bound is only enforced when its handle sits strictly inside the full
span (`yearLowerLimit` / `yearUpperLimit` in `shop/page.tsx`).

## 2026-06-20 - Item Date is a year (`item_year`), not a calendar date

**Decision:** Replace the `products.item_date` (`date`) column and its
`order_items.item_date_snapshot` with `products.item_year` (`smallint`, range
1-2200) and `order_items.item_year_snapshot`. The Product Admin "Date" field is
now a 4-digit year input ("Date (Year Made)", e.g. 1930). Internally the field
stays "Date"; buyer-facing it is labeled "Ca." (circa) in both locales, so
customers see "Ca. 1930" on cards, the detail spec, cart, checkout, and invoice.
Migration `supabase/product-item-year.sql` drops the old column (clearing the
values).

**Reason:** The field describes when the physical piece was made, which for
estate/antique jewelry is a year, not a precise calendar day. The prior `date`
column had also been backfilled with each listing's `created_at`, so every
product appeared to show its listing-creation date. A year integer matches how
the owner enters provenance and removes the meaningless month/day.

**Alternatives considered:** Free-text era ("circa 1930", "Victorian") — more
flexible but unsortable and unvalidated; year + "circa" flag — more structure
than needed right now. Owner chose year-only.

## 2026-06-20 - Store item Date separately from audit/acquisition dates

> ⚠️ **Superseded later the same day** by "Item Date is a year (`item_year`),
> not a calendar date" above — `item_date` was replaced by `item_year`. The
> separate-from-audit-dates reasoning below still holds.

**Decision:** Add nullable `products.item_date` for the item's Date, meaning
the date the piece was created, and snapshot it as
`order_items.item_date_snapshot` for orders/invoices. Keep it separate from
Postgres row `created_at` and the older internal `acquisition_date`.

**Reason:** Admins need an intake/edit field that describes the item itself and
can appear site-wide. Row `created_at` only records when the database row was
created, while `acquisition_date` describes business intake history and was
previously removed from the active product form.

**Alternatives considered:** Reuse `created_at`, which would conflate item
history with database audit timing; or revive `acquisition_date`, which would
mix customer-facing item metadata with internal buying workflow.

---

## 2026-06-20 - Keep this folder repo-ready without git operations

**Decision:** Treat `C:\Users\rcman\OneDrive\Documents\NaplesEstateJewelry.co`
as the single source-of-truth project folder. Its contents should be exactly
what belongs in the repository copy; future agents must not run git operations
here, must clean up generated artifacts, and must keep ignore rules current for
build output, caches, logs, and secrets.

**Reason:** The human periodically wipes the separate GitHub repo folder and
copies this folder wholesale into it. Any stray archive, temp file, log, or stale
artifact left here can be copied into the repo; git deltas are irrelevant to
that workflow.

**Alternatives considered:** Manage this working folder like a normal git
checkout or produce transfer manifests for later copying. Both were rejected
because the operating model is a wholesale folder replacement handled by the
human outside this project folder.

---

## 2026-06-20 - Product image cleanup must be dry-run-first and reference-aware

**Decision:** Clean product images from Supabase Storage only when the app can
prove the object path is no longer referenced by the current product, other
products, order item snapshots, or inquiry upload URLs. Bulk orphan cleanup is
admin-only and dry-run-first from `/admin/settings`, with objects younger than
24 hours skipped.

**Reason:** Product images are live inventory assets. Reference-aware deletion
prevents shared photos or saved product images from disappearing, while the
24-hour cutoff gives abandoned uploads and interrupted form sessions a recovery
window before GC.

**Alternatives considered:** Delete every replaced URL immediately, or run an
automatic background sweep. Immediate deletion risks breaking a product when an
admin cancels after crop/replace, and automatic sweeps are harder to audit for
valuable inventory photos.

---

## 2026-06-20 - Remove verified stale local artifacts

**Decision:** Keep current docs and active app files as the source of truth, and
delete redundant local artifacts once traced: loose root image references, the
standalone email-marketing handoff, and the unused `AdminShell` Quick Fill
archive copy. Runtime logs are junk but may need to wait until the preview
process releases them; they must remain ignored.

**Reason:** These files were adding dirty-tree noise or stale guidance after the
current Next/Supabase docs and public assets already covered the useful
information. Removing them reduces confusion for future agents.

**Alternatives considered:** Keep the files as informal backups, or move them
into another archive folder. That would preserve more clutter and duplicate
older guidance without improving recovery because the active code, public
assets, and memory docs already contain the current state.

---

## 2026-06-20 - Product images store bytes outside product rows

**Decision:** Product image bytes should live in Supabase Storage for uploaded
inventory photos, or in `next-app/public/assets` for legacy/local site assets.
The `products` table should store only URL/path references plus display
metadata such as image padding.

**Reason:** Keeping binary image payloads out of Postgres keeps product rows
small, avoids bloating database backups/API responses, and matches the current
admin upload flow, public rendering path, and Supabase Storage bucket policy.

**Alternatives considered:** Store base64/data-URI image payloads directly in
`products.images` or move all images into the app bundle. Inline payloads would
make rows and API responses heavy; app-bundled inventory photos make live
inventory edits require file/deploy work instead of storage-backed admin
uploads.

---

## 2026-06-19 - Product types may be custom catalog values

**Decision:** Keep a curated shared product type list for common choices such
as Cufflinks, but allow admins and AI fill to save concise new product type
strings when the item form is clear and not already listed. Public shop Item
Type filters derive additional options from visible inventory.

**Reason:** Forcing unlisted forms into Other hides real inventory from useful
filters and can keep items from appearing in expected shop browsing paths.
Custom values preserve the catalog signal while still keeping common types
standardized.

**Alternatives considered:** Require every new item type to be added in code
before it can be used. That keeps the taxonomy tighter, but it slows intake and
caused Cufflinks to be misclassified as Other.

---

## 2026-06-19 - Use `/shop` as the only storefront entry route

**Decision:** Remove the intermediate `/store` category chooser and the
dedicated `/silver-tableware` route. Header Shop, the Shop dropdown Store item,
and homepage shopping CTAs should point directly to `/shop`.

**Reason:** The extra category page and special tableware route added friction
and split the storefront. The owner wants the previous direct-shop flow back,
with one normal shop page as the browsing surface.

**Alternatives considered:** Keep `/store` as a chooser and keep
`/silver-tableware` as a category route. That was more segmented, but it made
the shopping path less direct.

---

## 2026-06-19 - Keep sterling tableware as a merchandising route, not a catalog lock

**Decision:** `/silver-tableware` should keep tableware-specific hero copy and
use a tableware-first Item Type dropdown order: Silverware / Sterling, Bullion,
Coins, Watches, Brooches, the remaining jewelry categories, and All items last.
Plain visits should default to Silverware / Sterling + Silver, while the route
still uses the full public shop catalog and allows shoppers to select any item
type, including an explicit All items choice.

**Reason:** The page is a useful entry point from Store for sterling
tableware, but shoppers who arrive there should be able to continue browsing
jewelry and other inventory without having to navigate back to the main shop.

**Alternatives considered:** Keep forcing the route to Silverware / Sterling and
Silver only. That was cleaner as a strict category page, but it blocked the
owner's desired cross-browsing behavior.

---

## 2026-06-19 - Give sterling tablewares a dedicated shop route

**Decision:** Add `/silver-tableware` as a separate modern shop route that
reuses the existing shop renderer but locks the catalog context to Silverware /
Sterling and Silver.

**Reason:** Sterling tablewares are a distinct shopping path from silver
jewelry. A dedicated URL gives the Store page a clean destination, keeps filter
clearing from drifting back into general jewelry inventory, and gives SEO and
future merchandising a clearer category page.

**Alternatives considered:** Link the Store tile to `/shop?itemType=silverware`
or add more product types under the main shop only. A query link works, but it
is less durable as a category destination and easier for shoppers to clear out
of accidentally.

---

## 2026-06-19 - Campaign analytics read from recorded Resend webhook events

**Decision:** Show admin campaign-history analytics by aggregating the local
`email_campaign_events` table that is populated by Resend webhooks.

**Reason:** Webhook records are the site's durable audit trail for Resend
delivery, open, click, bounce, and complaint events. Reading them on the admin
page keeps the table fast, avoids exposing provider credentials to the browser,
and avoids calling Resend for every history render.

**Alternatives considered:** Query Resend directly on each admin page load or
store analytics only as static campaign totals. Direct provider reads would add
latency and credential handling, while static totals would miss per-event
changes after the original send.

---

## 2026-06-19 - Email marketing uses opt-out model for account holders

**Decision:** Follow the email-marketing handoff recommendations:
newsletter subscribers remain explicit opt-in, while registered account holders
are eligible for marketing by default unless `profiles.marketing_opt_out = true`.
Every marketing send goes through one audience builder and includes an
unsubscribe link plus the admin-configured physical mailing address.

**Reason:** This matches the common US ecommerce retail pattern the owner chose,
keeps the local database as the consent source of truth, and keeps the UI
low-friction while preserving unsubscribe enforcement.

**Alternatives considered:** Keep opt-in only for account holders. That is lower
risk in stricter jurisdictions but was rejected for this deployment in favor of
the handoff's ecommerce-default recommendation.

---

---

## 2026-06-19 - Standardize public UI on the rounded shop radius scale

**Decision:** Public-facing site surfaces should use the rounded shop aesthetic:
`var(--radius-lg)`, `var(--radius-xl)`, `rounded-2xl`, or pill actions instead
of small 6px/8px legacy corners and sharp square cards. Admin-only utility
screens may remain denser and more utilitarian unless specifically redesigned.

**Reason:** The customer-facing experience should read as one modern luxury
retail site across marketing, selling, account, and shopping flows. The admin
surface has different density and workflow needs.

**Alternatives considered:** Leave small-radius controls in account/shop
because they were technically usable, or force every admin utility surface into
the same luxury styling immediately. The first kept visible visual drift; the
second would create a larger admin redesign outside the customer-facing request.

---

## 2026-06-19 - Use the shop aesthetic for contact and Sell pages

**Decision:** Bring the contact form family and primary Sell-category pages
into the same rounded, lighter visual system used by the shop: rounded cards,
soft borders/shadows, pill CTAs, and modern SVG/material icons instead of sharp
square panels and emoji-style glyphs.

**Reason:** The site should feel like a modern luxury ecommerce experience
across lead capture and sell-service education, not like separate legacy
templates. A shared visual language also makes future page cleanup easier.

**Alternatives considered:** Leave the Sell pages as darker, sharper service
pages, or redesign each page independently. The first kept the mismatch the
owner called out; the second would increase maintenance and visual drift.

---

## 2026-06-19 - Add a small-business compliance foundation without enterprise consent tooling

**Decision:** Add practical legal/policy pages, footer links, form disclosures,
account age/Terms/Privacy consent, an essential cookie/storage notice, and a
homepage-subscriber unsubscribe workflow. Treat the current site as a small
Florida business with ecommerce/order requests, accounts, auction guidance, and
possible future vendor workflows, but do not claim certifications or implement a
large enterprise consent-management platform.

**Reason:** The site collects real customer, account, inquiry, order, and
subscriber information, so it needs clear disclosures and acceptance records.
Source review found no active ad/behavioral tracking pixels, so a lightweight
essential-cookie notice and Cookie Preferences page is more accurate than a
full opt-in tracker manager.

**Alternatives considered:** Add only static placeholder legal pages, or add a
heavy CMP with analytics toggles. Placeholder pages would not satisfy the
actual data flows, while a large CMP would imply optional tracking systems that
are not present.

---

## 2026-06-18 - Float Store category choices over the hero image

**Decision:** Keep `/store` as a simple category chooser, but remove the
separate hero text and card sections in favor of two large square category
controls floating over the hero image. Estate Jewelry is an active link to
`/shop`; Sterling Silver Tablewares stays disabled until that inventory path is
ready.

**Reason:** The page is only choosing a shopping path, so letting the two
choices be the whole first-viewport interface keeps the page direct and makes
the category actions feel more prominent.

**Alternatives considered:** Keep the original full-width category header plus
large image cards below the hero, or add a separate floating card panel over the
image. The old structure felt too split for a two-choice page, and a large panel
would cover too much of the store image.

---

## 2026-06-18 - Carousel hero: windowed ring + two-block swept background

**Decision:** Make the home hero the 3D carousel and rebuild it as a **windowed
(infinite) ring** — render only `visibleCount` cards (admin-set, default 6 desktop /
4 mobile) on a tight radius and cycle the full list through them as cards pass the
hidden back. Drive the per-photo background as a **two-block sweep**: each photo is
a White or Black group, `groupByBackground()` orders them into one white arc + one
black arc, and the hero background is a per-frame horizontal gradient (seam projected
by `sin` of its net angle) painted **imperatively** to `section.style.background`.
The text theme flips via React state only when the centered color changes.

**Reason:** The ring radius is derived from item count (`cardSize / tan(180°/N)`),
so a long list pushes the camera far back. Windowing keeps the close, intimate feel
at any length while bounding the composited-layer cost. Two contiguous blocks give
exactly two seams (long solid fields, one clean sweep each) instead of the busy
left/right thrash that arbitrary per-photo colors would cause. Painting the gradient
imperatively avoids a React re-render every animation frame.

**Alternatives considered:** (1) Shrink the radius with all N cards on the ring —
rejected: cards pile on top of each other. (2) Uniform background fade triggered when
a photo reaches center — rejected: no anticipatory/directional sweep, and it lagged.
(3) Free per-photo colors (no blocks) — offered but rejected with the owner for the
thrashy result. (4) CSS `transition` on the section background — rejected: it lags
the per-frame sweep.

---

## 2026-06-18 - Carousel images via next/image with an off-screen preloader

**Decision:** Render carousel photos through `next/image` (`fill`, viewport-based
`sizes`, `quality 90`; `formats: ['image/avif','image/webp']`, `qualities:[75,90]`
in `next.config.ts`) and warm the next cycle's images with a hidden off-screen layer
that uses identical `sizes` so the browser fetches the exact same optimized variant
ahead of time. Pause the spin + rAF loop offscreen via `IntersectionObserver`.

**Reason:** Source images were already WebP but served raw at full resolution through
a plain `<img>`, so a ~1200px image decoded for a ~500px card. Right-sizing cuts
decode/GPU memory ~4–6× with no visible quality change — the real enabler for larger
lineups, especially on mobile. The preloader prevents pop-in when a card's photo
swaps at the hidden back; offscreen-pause makes item count nearly irrelevant to
scroll/battery once the hero is out of view.

**Alternatives considered:** (1) Keep raw `<img>` — rejected: full-res decode is the
mobile bottleneck. (2) Lossless re-encode — rejected: little benefit; sizing is the
lever and `quality 90` is already visually lossless. (3) No preload (rely on the
~half-revolution lead time) — kept as the safety net but added preloading per the
owner's request.

---

## 2026-06-18 - Carousel settings: separate desktop/mobile counts, resilient columns

**Decision:** Store ring size per breakpoint (`carousel_settings.visible_count` =
desktop, `visible_count_mobile` = mobile) and the per-photo background on
`carousel_selection.bg_color`. `HomeHero` picks desktop vs mobile via `matchMedia`.
All carousel reads/writes use **tiered fallbacks** so a not-yet-migrated optional
column degrades quietly (per-photo colors don't persist; mobile mirrors desktop)
instead of breaking the carousel or blocking a save.

**Reason:** Phones want a tighter ring than wide desktops. Tiered fallbacks let the
code ship and run before the owner has applied each Supabase migration, which has
repeatedly been the lag point — the live carousel must never break in the interim.

**Alternatives considered:** (1) One shared count — rejected: desktop/mobile want
different densities. (2) Hard-fail when a column is missing — rejected: it broke the
live hero / blocked saves before migrations were run.

---

## 2026-06-18 - Store the editable AI prompt in an admin-only `ai_settings` table

**Decision:** Make the live AI listing-assistant system prompt editable from
`/admin/settings` by storing an optional override in a single-row `ai_settings`
table (NULL = use the built-in default). The provider keeps
`PRODUCT_EXTRACTION_SYSTEM_PROMPT` as the exported default and accepts a
`systemPrompt` override; the fill route reads the override per request through
the server Supabase client and falls back to the default if the read fails. A
new `is_app_admin()` SECURITY DEFINER function (over `profiles.is_admin`) plus
RLS/GRANTs restrict read/write to admins, and the admin-gated
`/api/admin/ai-settings` route is the only edit path.

**Reason:** The Settings prompt editor was a leftover from the disabled Quick
Fill workflow and controlled nothing. Routing the real prompt through a table +
admin API lets the owner tune assistant behavior without a code deploy, while
the default-fallback keeps generation working before/if the table is absent.

**Alternatives considered:** (1) Keep the prompt hardcoded and require a code
change/deploy to edit it — rejected as too slow for an operator. (2) Store it in
browser localStorage like the old Quick Fill prompt — rejected because the
prompt is consumed server-side and must be shared across sessions/devices.
(3) Gate writes by email like the carousel's `is_carousel_admin()` — rejected
in favor of the more robust `profiles.is_admin` mechanism.

---

## 2026-06-18 - Use carousel selection/settings tables for Store hero curation

**Decision:** Build the Store Carousel Hero admin controls on top of the
supplied `carousel_selection` and `carousel_settings` helpers, while keeping
the previous hardcoded Store hero items as a storefront fallback until the
carousel tables are installed and populated.

**Reason:** The supplied widget already defines an ordered selection model,
background setting, show-price setting, and RLS-protected admin write path.
Using those keeps the admin form aligned with the handoff while the fallback
prevents the public Store hero from going blank during setup or empty
selection states.

**Alternatives considered:** Store carousel choices in browser local storage or
add fields directly to `products`. Local storage would not affect shoppers, and
product-level flags would mix hero curation with inventory metadata while still
needing a separate order/settings mechanism.

---

## 2026-06-18 - Store manual-order line discounts on order items

**Decision:** Add `order_items.discount` for per-line manual order discounts
and keep `orders.discount` as the aggregate total discount used for order and
invoice totals.

**Reason:** Line discounts need to travel with the immutable item snapshot so
the admin can edit existing orders and invoices can show original price,
line-level discount, and adjusted line total. Keeping the aggregate on
`orders.discount` preserves existing summary and invoice calculations.

**Alternatives considered:** Store only an order-level discount, or create a
separate invoice-only adjustment table. Order-level only cannot explain which
item was discounted; an invoice-only table would leave order totals and invoice
emails out of sync.

---

## 2026-06-18 - Use cards for mobile admin orders

**Decision:** Keep the dense Orders table for desktop admin work, but render
orders as stacked cards on mobile screens.

**Reason:** The table needs many columns for desktop scanning, but on phones it
forces horizontal scrolling and makes key order context hard to read. Cards let
mobile admins see order number, total, customer, items, statuses, and the View
Order action without sideways scrolling.

**Alternatives considered:** Keep the existing horizontal overflow table on all
screen sizes or hide lower-priority columns on mobile. Horizontal overflow was
awkward and visually clipped; hiding columns would remove important admin
context.

---

## 2026-06-17 - Store per-photo image padding overrides

**Decision:** Keep `products.image_padding` as the product-level fallback and
add `products.image_padding_by_image` as a JSON map keyed by image URL for
per-photo padding overrides.

**Reason:** Existing listings and cart/wishlist payloads already depend on the
single fallback value. A JSON override map lets admins tune individual photos
without breaking older products or requiring separate image records.

**Alternatives considered:** Replace `image_padding` with a structured value or
create a separate product-images table. Replacing the field would break current
displays and saved carts; a separate table is more normalized but too heavy for
the current hand-curated product image workflow.

---

## 2026-06-17 - Lead checkout with a full-width order review

**Decision:** Make checkout start with a full-width Order Summary before the
contact form, and let cart items carry optional product descriptions for richer
checkout/cart review.

**Reason:** High-value estate pieces need more confirmation context than a
compact sidebar can provide. Showing complete titles, prices, and brief
descriptions first helps customers review exactly what they are reserving
before entering contact details.

**Alternatives considered:** Keep the previous two-column checkout with the
summary in a narrow sidebar. That was compact, but it truncated item context and
made the customer form visually dominate the review step.

---

## 2026-06-17 - Scope purity filters by selected metal

**Decision:** In shop and Product Admin filters, Silver metal selections expose
only silver-designated purity options such as `925 Sterling`, while Gold keeps
karat options.

**Reason:** Karat purity labels do not apply to silver inventory and should not
be selectable once the Metal filter is explicitly Silver.

**Alternatives considered:** Leave all purity options visible and rely on
filter results to show no matches for invalid combinations. That made the UI
less clear and allowed contradictory filter states.

---

## 2026-06-17 - Restrict Silverware / Sterling filters to Silver

**Decision:** When Silverware / Sterling is selected in shop or Product Admin
filters, the Metal dropdown exposes only Silver.

**Reason:** Silverware / Sterling implies a silver catalog path, so offering
All Metals or Gold creates invalid filter combinations and unnecessary admin
cleanup.

**Alternatives considered:** Keep All/Gold visible while auto-selecting Silver.
That preserved broader manual control, but still allowed contradictory filter
states after a single extra click.

---

## 2026-06-17 - Treat Silverware as a Silver filter shortcut

**Decision:** When Silverware is selected as the shop Item Type or admin Product
Type filter, automatically set the broad Metal filter to Silver. In Product
Admin, also set Metal Type to Silver and clear incompatible gold-only Metal
Color selections.

**Reason:** Silverware inventory belongs in the silver browsing path, and the
filter UI should prevent a contradictory Silverware + Gold filter state.

**Alternatives considered:** Leave Silverware independent from Metal and rely on
admins/shoppers to choose Silver manually. That preserved total flexibility but
made an obviously implied filter require an extra step.

---

## 2026-06-17 - Keep admin product filters collapsed by default

**Decision:** Hide the full Product Admin table filter system behind a Filters
button by default, while keeping search, Add Product, and result count visible
in the toolbar.

**Reason:** The filter system is useful but visually heavy. Collapsing it keeps
the product table easier to scan during normal admin work while preserving quick
access and showing an active-filter count when filters are applied.

**Alternatives considered:** Leave the full filter row always visible. That made
all controls immediately available, but it consumed too much vertical space for
the common inventory-scanning workflow.

---

## 2026-06-17 - Align admin product filters with shop filtering

**Decision:** Order the main Product Admin table filters around the same
catalog hierarchy used on the shop: Gender, Product Type, Brand, Metal, Metal
Type, Metal Color, Purity, then product-type-scoped Link Type and Length/Size,
with admin-only Status, Location, and Featured controls after the catalog
filters.

**Reason:** Admins should manage inventory through the same taxonomy shoppers
use to browse it, while still having operational controls that do not belong on
the public shop.

**Alternatives considered:** Keep the previous operational-first order with
Status and Pricing Metal leading the row. That kept admin controls prominent but
made the filter row less consistent with the public shop and kept Link
Type/Length visible even when they did not apply.

---

## 2026-06-17 - Store length and size as bare numerics

**Decision:** Normalize Product Admin Length/Size values to bare numeric
strings, stripping inch-unit text from manual entries, Quick Fill values, and AI
listing drafts before they are displayed or saved.

**Reason:** The admin product table needs consistent scan-friendly Size values
such as `7.75`, regardless of whether an entry came in as `7.75 in`, `7.75in`,
`7.75 inches`, or `7.75"`. Buyer-facing surfaces can still add units when the
product type needs them.

**Alternatives considered:** Continue storing necklace/bracelet lengths with
`in` and strip units only in the admin table. Normalizing before save keeps the
database and tags cleaner and avoids future table/filter inconsistencies.

---

## 2026-06-16 - Isolate AI listing providers behind configuration

**Decision:** Build the integrated product listing assistant through a
provider-neutral internal API (`generateProductDraft`) and keep all provider
names, model names, API keys, request construction, response parsing, and
central prompt text inside `next-app/src/lib/ai-product-provider.ts`.

**Reason:** The store needs freedom to switch between OpenAI, Anthropic,
Google, or local/self-hosted models based on cost, speed, and accuracy without
rewriting admin UI, form population, database code, validation, or business
logic. Environment variables choose the active provider/model.

**Alternatives considered:** Call a specific AI provider directly from the
admin component or API route. That is faster to wire up initially, but it would
spread provider assumptions through the app and make future model changes
riskier than a config-only change.

---

## 2026-06-16 - Store custom image padding colors as hex metadata

**Decision:** Extend `products.image_padding` to accept six-digit hex colors
such as `#f2efe8` in addition to `none`, `white`, and `black`.

**Reason:** The admin needs to match photo side padding to colors sampled from
the first image without creating new image files or changing the rendering path.
Keeping the custom color in the existing display metadata field lets shop
cards, product detail galleries, and admin thumbnails share one helper.

**Alternatives considered:** Add separate `image_padding_color` and
`image_padding_mode` columns, or bake sampled colors into generated image
assets. Separate columns are more verbose for the current need, and baked-in
assets would make color changes destructive and harder to revise.

---

## 2026-06-16 - Store image padding as product display metadata

**Decision:** Add a per-product `image_padding` display preference with
`none`, `white`, and `black` values instead of modifying uploaded product image
files.

**Reason:** Some product photos are vertical and reveal the containing image
frame on shop cards and detail pages. A metadata setting lets admins choose the
best frame color per listing without destructively editing or duplicating image
assets.

**Alternatives considered:** Crop or re-export each photo with baked-in side
bars. That gives fixed control per file, but it is slower, destructive, and
harder to change if the same image needs a different presentation later.

---

## 2026-06-16 - Add Product Type and Metal Type additively

**Decision:** Add nullable `products.product_type` and `products.metal_type` as
the new inventory hierarchy while keeping `jewelry_type`, `category`,
`metal_variant`, and existing pricing/order fields in place.

**Reason:** The catalog is expanding beyond gold/silver jewelry into watches,
coins, bullion, loose stones, silverware, estate lots, and future categories.
An additive migration lets the admin UI move to Product Type first and Metal
Type second without breaking current shop pages, pricing, orders, invoices, or
legacy product rows.

**Alternatives considered:** Rename or repurpose `jewelry_type` and `category`
directly. That would be cleaner eventually, but it risks breaking live pricing
and product filters because `category` still powers Gold/Silver spot-pricing
logic.

---

## 2026-06-16 - Keep Quick Fill custom values as direct field values

**Decision:** Add `products.brand` as a real product field, but keep Quick Fill
custom Brand, Link Type, and Length/Size entries as direct free-text field
values instead of promoting them into permanent dropdown option lists.

**Reason:** Admins need flexibility to enter a specific maker, style, or
measurement without letting every one-off value expand the controlled option
menus and filters.

**Alternatives considered:** Automatically add every new Brand, Link Type, or
Length/Size value to future chooser lists. That would make repeated values easy
to select, but the option menus would drift and grow too quickly for a small,
curated inventory workflow.

---

## 2026-06-15 - Show spot basis on product detail pricing

**Decision:** Item detail pages show the raw scrap/melt value, the current
site-wide spot value per ounce used for that calculation, and a countdown to
the next five-minute price refresh.

**Reason:** Buyers can see not only the selling price and melt value, but also
the exact market baseline behind the calculation and when it will update next.

**Alternatives considered:** Keep showing only the scrap value. That was
simpler but did not explain which current spot value the item price was based
on or when the pricing context would refresh.

---

## 2026-06-15 - Separate Jewelry Type from Link Type

**Decision:** Add `products.jewelry_type` for the broad item form and keep the
existing `products.chain_type` as Link Type, scoped only to necklaces and
bracelets.

**Reason:** Necklace/bracelet/ring/pendant/earrings are merchandising item
types, while Cuban/Figaro/Rope/Byzantine/etc. describe link style. Separating
them prevents values like "Cuban link bracelet" from becoming one ambiguous
category and lets necklace and bracelet link filters remain distinct.

**Alternatives considered:** Keep using one combined Chain Type/Jewelry Type
field. That was simpler but kept mixing item form with link style and made
filtering less precise.

---

## 2026-06-15 - Model metal color/type as a product subtype

**Decision:** Keep `products.category` as the broad pricing category (`Gold` or
`Silver`) and add `products.metal_variant` for Yellow Gold, White Gold, Rose
Gold, Tricolor Gold, Bicolor Gold, Silver, and Vermeil. Bicolor Gold is stored
as a Gold subtype but appears under both broad Gold and Silver shop filters.

**Reason:** Pricing and melt-value logic depend on the broad metal category, but
admins and shoppers need a finer merchandising/filtering distinction. A subtype
field preserves current spot-pricing behavior while giving the catalog room to
separate gold colors and silver/vermeil.

**Alternatives considered:** Add every color/type as a top-level category. That
would make filters simple but would blur the pricing category and increase the
risk of breaking gold/silver spot calculations.

---

## 2026-06-15 - Checkout creates unpaid admin-follow-up orders

**Decision:** Public checkout creates an unpaid order, snapshots the cart into
`order_items`, moves products to `pending_payment`, inserts an admin
notification, and emails the configured order recipient.

**Reason:** The store does not have live card capture yet, but inventory still
needs to be held immediately and the owner needs a reliable order trail plus a
visible admin inbox item.

**Alternatives considered:** Keep checkout as a front-end confirmation only;
send only an email without writing an order; route directly to payment before
creating inventory holds. All three options risk missed orders or overselling
single-piece inventory.

---

## 2026-06-15 - Manual orders drive product lifecycle

**Decision:** Manual admin orders snapshot item details into `order_items` and
drive product status transitions from the order detail screen.

**Reason:** Sales history needs immutable item details, while the live product
record can continue changing for merchandising. Product lifecycle transitions
keep the public shop from selling the same item twice.

**Alternatives considered:** Leave order creation disconnected from product
status; update only live product records without order item snapshots. Both
options weaken sales history and inventory safety.

---

## 2026-06-15 - Add sales workflow schema additively

**Decision:** Introduce orders, order item snapshots, invoices, saved items, and
richer product lifecycle fields through additive Supabase SQL while keeping the
existing `products` table and admin component.

**Reason:** The store already has live inventory, product admin, checkout/cart,
and public product pages depending on the current product shape. Additive fields
let the site gain sales-processing behavior without a risky rewrite or data
cutover, and order item snapshots preserve the sold item details even if product
records change later.

**Alternatives considered:** Replace the product schema outright; build a
separate inventory table. Additive migration is safer for the current live shop
and keeps public routes compatible during rollout.

---

## 2026-06-15 - Admin users view reads profiles

**Decision:** Build the admin account-users table from Supabase `profiles`
instead of browser-side Auth admin APIs.

**Reason:** `profiles` is already the app-owned account/contact table, includes
the fields needed for the dashboard, and can be protected with an authenticated
admin RLS policy. Auth admin APIs require a service-role key and should not be
called from client code.

**Alternatives considered:** Add a service-role server client and list
`auth.users`; expose profile reads through a custom route handler. The profile
table keeps the feature aligned with existing account and checkout data.

---

## 2026-06-13 - Keep Auctions under Shop

**Decision:** Keep Auctions as a submenu option under the main Shop navigation,
alongside Store. Store links to `/shop`; Auctions links to `/auctions`.

**Reason:** Auctions is related to shopping/buying inventory but should not
compete as a top-level header destination.

**Alternatives considered:** Keep Auctions as a standalone top-level nav item;
rename the existing Shop route. A submenu keeps the header cleaner without
changing route URLs.

---

## 2026-06-13 - Treat root static site as legacy

**Decision:** Use `next-app/` as the current application surface and treat the
root static HTML/CSS/vanilla-JS site as legacy cleanup material.

**Reason:** Root `netlify.toml` builds from `next-app`, the Next build passes,
and the Next app owns the current app routes, Supabase-backed product catalog,
admin, inquiries, sitemap, robots, and metal-price API.

**Alternatives considered:** Keep both sites indefinitely; promote `next-app/`
to the repository root immediately. Promotion is cleaner long term but should
happen as a separate, deliberate move after legacy deletion is reviewed.

---

## 2026-06-12 — Lead form uses Netlify Forms

> ⚠️ **Superseded 2026-06-25** — Netlify Forms was found to silently fail on
> this client-rendered React app and was replaced by `/api/inquire`. See the
> 2026-06-25 "Lead forms post to /api/inquire, not Netlify Forms" entry above.

**Decision:** Replace the Jotform embed with static Netlify Forms on the English
and Spanish contact pages. Keep the `#submit-item` destination, use a large
square photo-upload target, open a details modal after photo selection, and let
Netlify handle submissions, uploaded photos, spam honeypot, and notifications.

**Reason:** This removes the third-party Jotform implementation while preserving
the seller lead workflow and photo upload requirement in the existing static
Netlify hosting model.

**Alternatives considered:** Keep Jotform; rebuild a custom serverless handler;
route photo submissions through text/email only.

---

## 2026-06-10 — Homepage announcement is compact and header-tucked

**Decision:** Add the monthly buying/evaluation announcement as a small fixed
banner on the EN/ES homepages, delayed one second and positioned below the fixed
site header with a higher header z-index.

**Reason:** The message gets attention on load without taking over the hero or
adding permanent layout height.

**Alternatives considered:** A large modal/popup; an inline hero notice; a
site-wide banner on every page.

---

## 2026-06-10 — Homepage hero video owns first paint

**Decision:** Do not use the old homepage still image as the `<video>` poster.
The hero video should preload normally and the still image should remain hidden
unless the visitor has `prefers-reduced-motion: reduce`.

**Reason:** The poster image can paint before the MP4 first frame is ready,
causing the retired hero image to flash during page load.

**Alternatives considered:** Generate a new poster from the video first frame;
keep the old poster and fade it out with JavaScript.

---

## 2026-06-01 — Spanish translation via separate `/es/` pages

> ⚠️ **Superseded by the Next.js rebuild (2026-06-13)** — there is no `/es/`
> static folder anymore; localization is `next-intl` App Router routes
> (`localePrefix: 'as-needed'`) under `next-app/src/app/[locale]`. The
> single-source-catalog and native-review intent below still holds. See
> `features/spanish-translation.md` for the current model.

**Decision:** Add a full Spanish version of the site as separate pages in a
`/es/` subdirectory, paired with English via `hreflang`, with a one-click EN/ES
header toggle. Spanish copy will be AI-drafted and reviewed by a native speaker
before publishing. Shop products stay single-source (add `*_es` fields, not a
duplicate catalog). Full plan in `features/spanish-translation.md`.

**Reason:** Separate, indexable Spanish URLs capture real Spanish-search leads in
Southwest Florida's large Spanish-speaking market, read professionally for a
luxury/trust brand, and fit the static + Netlify setup with no build step.

**Alternatives considered:** JS text-swap toggle (no Spanish SEO, flash of
untranslated text, heavy tagging); Google Translate widget / browser
auto-translate (inaccurate, unprofessional, no SEO value).

---

## 2026-06-01 — Lead form uses Jotform (recorded for the record)

> ⚠️ **Superseded 2026-06-12** by static Netlify Forms, itself **superseded
> 2026-06-25** by `/api/inquire`. See that entry above for the current model.

**Decision:** The "Submit Your Item" lead form is an embedded Jotform (form id
`261379265677068`) on `contact.html`. This was **already implemented and working
before this documentation session** — recorded here so future sessions don't
mistake it for unfinished. The earlier custom files (`submit-item-form.*`) are
legacy/unused.

**Reason:** Jotform provides hosted delivery, spam handling, and **photo
uploads** out of the box, with no custom backend to maintain.

**Alternatives considered:** Formspree (file uploads paid-only); FormSubmit;
finishing the custom form with a self-hosted handler.

---

## 2026-06-01 — Adopt a Markdown project-memory system

**Decision:** Maintain persistent project context in `project-docs/` (overview,
status, architecture, decisions, tasks, changelog, per-feature docs, meeting
notes, and a Dark Matter `CLIENTS.md`).

**Reason:** Preserve decisions and state across AI sessions / chat resets / new
contributors, and reduce repeated re-explanation. Documentation is treated as
part of the implementation, not optional.

**Alternatives considered:** A single README; an external wiki/Notion; relying on
chat history alone.

---

## 2026-06-01 — Add Dark Matter Web Services footer credit

**Decision:** Show a "Powered by Dark Matter Web Services" badge (linking to
`darkmatterwebdev.com`) in the footer of every page; bumped theme cache version
to `darkmatter-credit-20260601`.

**Reason:** Agency attribution + lightweight marketing for the builder.

**Alternatives considered:** No credit; text-only credit.

---

## (Earlier) — Reorganize assets and scripts with redirects

**Decision:** Move images under `assets/images/{branding,pages,shop}/` and group
scripts under `scripts/{shared,shop,account,forms}/`, adding 301 redirects in
`netlify.toml` from all legacy root URLs.

**Reason:** Cleaner repo structure without breaking previously published/indexed
URLs.

**Alternatives considered:** Leaving files at the root; breaking old URLs.

---

## (Earlier) — Keep the product catalog in code, not a database

> ⚠️ **Superseded by the Next.js rebuild (2026-06-13)** — the catalog moved
> to the Supabase `products` table (see `STRUCTURE.md` "Single sources of
> truth"). `window.SHOP_PRODUCTS` no longer exists.

**Decision:** Store products as a static `window.SHOP_PRODUCTS` array in
`scripts/shop/shop-products.js`. Supabase holds only customer-account data
(profiles, favorites, carts).

**Reason:** Small, hand-curated inventory; editing in code (with AI assistance)
is simpler than a CMS/DB and keeps the catalog versioned with the site. Avoids
the cost/complexity of Shopify or an admin dashboard.

**Alternatives considered:** Shopify; a custom admin + product table in Supabase;
a headless CMS.

---

## (Earlier) — Live gold-spot pricing via a Netlify Function

> ⚠️ **Superseded by the Next.js rebuild (2026-06-13)** — the fetch/cache
> logic moved to `next-app/src/lib/spot-price.ts`, exposed via
> `next-app/src/app/api/metal-prices/route.ts`. The design intent (server-side
> fetch, 5-min cache, fallback) carried over unchanged.

**Decision:** Compute shop prices from live gold spot. A Netlify Function
(`metal-prices.js`) fetches XAU from `gold-api.com`, caches 5 min, adds CORS and a
fallback; each product price = `meltValue × pricingMultiplier`.

**Reason:** Prices stay fair and current with the gold market automatically; the
upstream API key/endpoint and rate limits are hidden behind the function, and a
fallback keeps the shop usable if the API fails.

**Alternatives considered:** Hard-coded manual prices; calling the price API
directly from the browser; a paid pricing widget.

---

## (Earlier) — Supabase for customer accounts

**Decision:** Use Supabase (Postgres + Auth) for sign-in, profiles, favorites,
and saved carts, with RLS so users only see their own data. Ship only the anon
key to the browser.

**Reason:** Managed auth + Postgres + RLS with minimal backend code; fits a
static site without running our own server.

**Alternatives considered:** Firebase; a custom Node/Express backend; no accounts
(guest-only).

---

## (Earlier) — Static multi-page site with Tailwind CDN + PowerShell sync

> ⚠️ **Superseded 2026-06-13** — the site was rebuilt as the Next.js app in
> `next-app/` (React/TypeScript, Tailwind via PostCSS build, shared layout
> components instead of PowerShell sync). See `project-docs/LEGACY_REMOVAL_REPORT.md`
> and the "Docs updated for Next cleanup" changelog entry.

**Decision:** Build as plain HTML pages styled with Tailwind (CDN) + custom
editorial CSS, and keep shared header/theme consistent using PowerShell sync
scripts instead of a templating/build framework.

**Reason:** Maximum simplicity, speed, and SEO; no build pipeline to maintain;
easy to host anywhere static.

**Alternatives considered:** A framework (Next.js/Astro/11ty); a CMS; manual
per-page header edits.
