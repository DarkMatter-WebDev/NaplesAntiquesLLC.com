# Current Status

> Reflects the present state of development. **Update this at the end of every
> work session.** Last updated: **2026-07-09**.

## 2026-07-09 (session 11, fifth addendum) -- 🟡 "Combined" now genuinely means all three audiences (Newsletter + Accounts + Buyers)

Owner asked for "Combined" to actually combine all three — reversing the
deliberate choice from the third addendum to keep it Newsletter+Accounts
only. `buildMarketingAudience('all', ...)` now also pulls from `buyers`
(same `marketing_opt_out`-filtered query the standalone Buyers scope already
uses), merged in alongside subscribers/accounts.

**Fixed a real mislabeling bug this uncovered.** `buildMarketingAudience()`
is shared by the Compose Campaign form *and* the separate `/admin/subscribers`
"Reachable Recipients" page — so buyers now flow into that page too (correctly:
"reachable recipients" should mean everyone a Combined campaign would actually
reach). But `SubscribersManager.tsx`'s source label only knew about
`'subscriber'/'account'/'both'`; a buyer-only row would have silently shown
"Newsletter subscriber" — wrong, since they never subscribed. Given the
Buyers backfill pulled in every historical paid order, overlap with existing
subscribers/accounts is the common case here, not a rare edge case, so this
was worth fixing rather than shipping a wrong label for a lot of real rows.

Replaced the old binary `'both'` value with a deterministic sorted
`'+'`-joined combination (e.g. `'account+buyer'`, `'account+buyer+subscriber'`)
via an exported, now-unit-tested `combineSource()`, and rewrote
`sourceLabel()` to check by substring instead of exact match — every
combination now renders a correct, specific label ("Account holder + Past
buyer", etc.) instead of falling through to a wrong default. Also fixed the
non-manageable-row fallback text (previously always said "Account profile"
regardless of why edit/delete wasn't available).

**Deliberately left alone:** `SubscribersManager.tsx`'s client-side
optimistic-update logic (the temporary local state right after adding/
removing a subscriber, before `router.refresh()` reconciles with the server)
still has narrower `'account'`/`'both'` checks that won't perfectly handle a
buyer-overlap in that split-second window. Not fixed — it self-corrects on
the immediate follow-up refresh already in both flows, and the realistic
trigger (manually adding a newsletter subscription on an email that's
*also* a buyer) is a rare admin action, not a normal user path.

`npx tsc --noEmit`, `npm run lint`, `npm run build` all pass; `npx vitest
run` 171/171 (+4 new tests for `combineSource`). **Not verified live** — same
standing limitation as the rest of the Buyers/marketing work (no admin
session in this environment). No new migration — this only depends on the
`buyers` table/`marketing_opt_out` column from the third addendum's
`marketing-buyers-audience-2026-07.sql`, already required. **Owner action:**
once that migration has run, confirm "Combined" 's recipient count on Compose
Campaign now includes buyers, and spot-check `/admin/subscribers` shows
sensible combined labels (e.g. "Account holder + Past buyer") for anyone who
overlaps. Full detail: `project-docs/DECISIONS.md` 2026-07-09 (session 11,
fifth addendum).

## 2026-07-09 (session 11, fourth addendum) -- 🟢 New gold palm tree favicon (browser tab icon)

Owner dropped a new gold palm tree image (`icon.PNG`, 1536×1024, transparent
background) at the project root and asked to compress it and use it as the
site's browser-tab icon, then delete the leftover file. Checked this Next.js
version's actual supported icon-file conventions first (bundled docs at
`node_modules/next/dist/docs`) — the `icon` special file only accepts
`.ico/.jpg/.jpeg/.png/.svg`, **not `.webp`**, so a literal WebP file would
have silently gone unrecognized with the old favicon staying in place. Used
`sharp` (already a project dependency) to auto-trim the transparent margins
down to the palm tree's real bounding box, pad it back to a small square
canvas with a bit of breathing room (still transparent, so it reads
correctly against both light- and dark-themed browser tab bars), and export
at 64×64 — **4.2 KB**. Replaced `next-app/src/app/favicon.ico` with the new
`next-app/src/app/icon.png` (Next.js auto-generates the `<link rel="icon">`
tag; no manual metadata needed).

**Caught a real bug while wiring this up:** `proxy.ts`'s middleware matcher
excludes `favicon.ico` from locale-prefix rewriting by name, but the new
icon's generated route (`/icon.png?<hash>`) wasn't covered by name — it
happened to still match the matcher's generic file-extension exclusion
(`.*\.(?:...|png|...)`), so it worked either way, but added an explicit
`icon` exclusion alongside `favicon.ico` for the same defensive clarity,
rather than depending on that being incidental.

**Verified live in the preview:** reloaded both `/en` and `/es`, confirmed
the exact same `<link rel="icon" href="/icon.png?...` type="image/png"
sizes="64x64">` tag renders on both, fetched that URL directly and got `200
image/png`, 4250 bytes matching the file on disk, no console errors,
screenshot showed no other regressions. `npx tsc --noEmit`, `npm run lint`,
`npm run build` all pass (`○ /icon.png` in the route manifest as a static
route). Deleted the leftover root `icon.png` after confirming everything
worked. No migration, no owner action. Full detail:
`project-docs/DECISIONS.md` 2026-07-09 (session 11, fourth addendum).

## 2026-07-09 (session 11, third addendum) -- 🔴 Email Campaigns: "Buyers" added as a fourth audience (SQL migration pending)

Owner asked to add **Buyers** as a selectable audience in the admin Email
Campaigns "Compose Campaign" form, alongside the existing Newsletter
subscribers / Account holders options. Straightforward on the UI surface, but
surfaced a real compliance gap along the way: the `buyers` table (session 11)
had no marketing-opt-out concept at all, so a "Buyers" campaign could have
re-emailed someone who had already unsubscribed through a completely
different channel (the newsletter, or their account) — worth catching now
rather than after the first real send.

**Fixed with a new `buyers.marketing_opt_out` column** (default `false`) and
query-time filtering (`buildMarketingAudience('buyers')` only includes rows
where it's `false`), matching exactly how the existing `accounts` scope
already filters on `profiles.marketing_opt_out`. Three supporting pieces:
1. **`suppressMarketingEmail()`** (the function every unsubscribe click
   ultimately calls) now also flips `buyers.marketing_opt_out = true` — so a
   buyer with no newsletter signup and no account (nowhere else to record an
   unsubscribe) still gets suppressed correctly and permanently.
2. **The buyer-upsert trigger now carries forward a pre-existing opt-out** —
   if someone unsubscribed from the newsletter *before* ever buying anything,
   their first paid order won't silently re-add them as mailable; a
   **later** order never resets an existing buyer's opt-out back to false
   (opting back in is a deliberate action, not a side effect of buying again).
3. **`email_campaigns.audience_scope`'s CHECK constraint** (originally only
   `'subscribers'/'accounts'/'all'`) had to be widened to allow `'buyers'` —
   without this, sending a Buyers-scope campaign would have failed at the
   database level the same way the original Buyers-tab grant issue did.

**"Combined" (the "all" scope) intentionally still means Newsletter +
Accounts only** — Buyers is a new, separate, standalone 4th option, not
folded into "Combined." Redefining "Combined" to silently include buyers too
would have changed the size/composition of an option the owner already
relies on, which wasn't asked for.

`npx tsc --noEmit`, `npm run lint`, `npm run build` all pass; `npx vitest run`
unchanged at 167/167 (no new pure logic worth isolating — a SQL trigger
enhancement and query/type wiring). **Not verified live** — same standing
limitation as the rest of the Buyers work: no admin session available in
this environment to click through Compose Campaign. **Owner action:** run
`supabase/marketing-buyers-audience-2026-07.sql` (after
`buyers-2026-07.sql`), then in Email Campaigns confirm a 4th "Buyers" button
appears with a real count, sending a real (or test-scale) Buyers campaign
succeeds, and that someone who previously unsubscribed does NOT receive it.
Full detail: `project-docs/DECISIONS.md` 2026-07-09 (session 11, third
addendum).

## 2026-07-09 (session 11, second addendum) -- 🟢 Buyers tab: select rows + Copy Selected Emails

Owner confirmed the Buyers tab works after the grant fix, then asked for
row selection (individual or all) plus a button to copy the selected emails,
comma-separated. Added to `BuyersManager.tsx`: a checkbox column (per-row +
a header "select all" with a proper indeterminate state when some-but-not-all
rows are checked), and a **Copy Selected Emails** button (shows the count,
disabled when nothing's selected) that joins the selected rows' emails with
`, ` and copies via the existing shared `copyTextToClipboard()` helper
(`@/lib/clipboard` — reused rather than duplicating the clipboard-fallback
logic `SubscribersManager.tsx` has inlined). Deleting a row also prunes it
out of the current selection so the "select all" state stays consistent.
No bulk-delete was added — only what was asked for (select + copy emails);
the existing per-row Delete button is unchanged.

`npx tsc --noEmit`, `npm run lint`, `npm run build` all pass. **Not verified
live** — same standing limitation as the rest of this feature: no admin
session available in this preview environment to click through it. Verified
instead by re-reading the selection/indeterminate-checkbox logic line by
line (a stateful `Set<string>` of selected emails, pruned on delete; "select
all" toggles between empty and full). No schema/migration change — purely
client-side UI over data the Buyers table already returns. Full detail:
`project-docs/DECISIONS.md` 2026-07-09 (session 11, second addendum).

## 2026-07-09 (session 11, addendum) -- 🔴 Buyers migration missing a required grant — "permission denied for table buyers"

Owner ran `buyers-2026-07.sql` and hit **"Could not load buyers: permission
denied for table buyers"** on `/admin/buyers`. Root cause: the migration
enabled RLS and added an admin-only policy, but never granted the base
table-level privilege to the `authenticated` role — in this Supabase project,
Postgres checks table-level grants *before* it ever consults RLS, so a table
with RLS + a policy but no grant denies everyone, admin or not. Every other
admin-managed table already has this (`grant select, insert, update, delete
on public.orders to authenticated;` in `sales-workflow.sql`); the Buyers
migration simply omitted the equivalent line — my mistake, not something the
owner did wrong.

**Fixed:** added `grant select, insert, update, delete on public.buyers to
authenticated;` right after the RLS policy in `supabase/buyers-2026-07.sql`
(the policy still narrows this to admins only — the grant just clears the
table-level gate the policy sits behind). The file is fully idempotent
(`create table if not exists`, `create or replace function`, `drop ... if
exists` before every trigger/policy, backfill on `conflict do nothing`), so
**re-running the whole updated file is safe** — or the owner can run just the
one new `grant` line directly. Full detail: `project-docs/DECISIONS.md`
2026-07-09 (session 11, addendum).

## 2026-07-09 (session 11) -- 🔴 New admin "Buyers" tab — auto-populated customer directory (SQL migration pending)

Owner asked for a new admin tab compiling a table of every buyer who's placed an
order, with the ability to delete entries, and new paid orders automatically
adding a row. Built as a genuinely new, standalone feature (not derived from
`orders` at read-time):

- **New `public.buyers` table** (`supabase/buyers-2026-07.sql`): one row per
  unique customer email, with name, phone, linked `user_id` (nullable, for
  guest buyers), `order_count`, `total_spent`, `first_order_at`, `last_order_at`.
- **Auto-populated via a database trigger on `public.orders`**, not application
  code — deliberate, because this app has **two independent order-creation
  paths** with no shared function: the PayPal flow (`create_paypal_order`/
  `capture_paypal_order` RPCs in `no-reservation-checkout.sql`) and the admin's
  "Create Manual Order" form (a direct client-side insert straight into
  `orders` from `OrdersPanel.tsx`, bypassing PayPal entirely). A table-level
  trigger (`orders_upsert_buyer`, firing `after insert or update of
  payment_status`) is the only mechanism that reliably sees every write
  regardless of which path performed it — including any future one. It fires
  exactly once per order's transition INTO `payment_status = 'paid'` (guards
  against double-counting on a later unrelated edit, e.g. a fulfillment-status
  change) and upserts the buyer's row by normalized email.
- **One-time backfill included in the same migration** — a `group by` over
  every existing paid order populates history that predates this feature, so
  the tab doesn't start empty; safe to re-run (`on conflict do nothing`).
- **Admin UI**: new **Buyers** tab in the main admin nav (between Orders and
  Messages), a new `/admin/buyers` page, and `BuyersManager.tsx` — a simple
  list + confirm-and-delete table (Name/Email/Phone/Orders/Total Spent/Last
  Order/Delete), mirroring the existing Subscribers tab's pattern (plain hard
  delete with a native confirm dialog, no recycle bin — this is a contact-list
  view, not a financial record like Orders). New `DELETE /api/admin/buyers`
  route (admin-gated via the existing `requireAdmin()` helper); there's no
  manual "add" — rows only come from paid orders, by design. Deleting a buyer
  only removes their directory row; their actual orders/invoices are
  completely unaffected, and they're added back as a fresh row if they order
  again.
- **Deliberately simple, not tracked:** refunds do not decrement
  `order_count`/`total_spent` afterward — these are a lifetime-paid summary,
  not a live balance, matching how this app treats refunds elsewhere as an
  explicitly-flagged state rather than unwinding earlier side effects.

`npx tsc --noEmit`, `npm run lint`, `npm run build` all pass; `npx vitest run`
167/167 (unchanged — no new pure logic worth isolating in a table trigger, a
thin delete route, or a plain list UI). **Partially verified live:** started a
fresh preview server and confirmed `/admin/buyers` correctly 307-redirects an
unauthenticated visitor to sign-in with no crash (same behavior as every other
admin route) — could not go further, since this environment has no live admin
credentials to sign in with (same standing limitation as every other
admin-gated feature built in this project).

**🔴 PENDING MANUAL STEP — run `supabase/buyers-2026-07.sql` in Supabase.**
Until it runs, the `/admin/buyers` page will show a "Could not load buyers: …"
error banner (the table doesn't exist yet) instead of a working list — it does
not crash the page. **Owner action after running the SQL:** (1) open
`/admin/buyers` and confirm existing paying customers already appear
(populated by the migration's backfill), with correct order counts/totals;
(2) place one real test order (PayPal or a manual admin order marked Paid) for
a NEW email and confirm a new row appears automatically without any other
action; (3) delete a buyer from the list and confirm their past orders in
`/admin/orders` are untouched; (4) place another order for that same
just-deleted email and confirm they reappear as a fresh row. No app code
change needed for any of this — purely the SQL migration. Full detail:
`project-docs/DECISIONS.md` 2026-07-09 (session 11).

## 2026-07-08 (session 10, ninth addendum) -- 🟡 Buyer receipts/invoices: "Ship to" becomes "Address" for Local Pickup orders

Owner asked that when a buyer chose Local Pickup, the initial email receipt and
any follow-up emails/invoices/notifications not show "Ship to" — a pickup buyer
who optionally filled in the (accordion) address field isn't actually being
shipped anything. Fixed at the single shared source: `buildInvoiceEmailContent()`
in `order-invoice-email.ts` now computes `isPickup = order.shipping_method ===
'pickup'` (the DB-stored value — the checkout's `'local-pickup'` is mapped to
`'pickup'` at order-creation time) and labels the address block **"Address"**
instead of **"Ship to"** when true, in both the plain-text and HTML email
bodies. Because this one function is shared by the automatic on-payment receipt
send, the admin's manual "Email Receipt/Invoice" resend, the admin's live email
preview (`OrderDetailPanel`), and the admin's Print Invoice page, all four
update together — no other file needed a matching fix. Real shipping methods
are completely unchanged (still always "Ship to"). Also updated the checkout's
own on-page/printable "Order Received" receipt (`CheckoutClient.tsx`) the same
way — it previously hid the whole address block for Local Pickup regardless of
whether one was provided; now it shows "Address" (with whatever the buyer
optionally entered) if present, and stays hidden if not, matching the emailed
receipt's behavior.

**Deliberately left unchanged:** the owner's own new-order notification email
(`order-owner-notification.ts`) still says "Ship to" — that email goes to the
owner, not the buyer, so it was out of scope for this request; flagged in case
the owner wants it matched too.

`npx tsc --noEmit`, `npm run lint`, `npm run build` all pass; `npx vitest run`
167/167 (+3 new tests in `order-invoice-email.test.ts` covering pickup-with-
address → "Address", real-shipping → "Ship to" unchanged, and no-address-on-file
→ no block either way). **Not verified live** — another chat's dev server still
holds Next's single-instance lock on this `next-app` directory, so no preview
server could be started this session either. **Owner action:** once free, place
a Local Pickup test order with an address optionally filled in via the
accordion, and confirm the receipt email (and the on-page confirmation) both say
"Address" instead of "Ship to"; place a real-shipping test order and confirm it
still says "Ship to" as before. No migration — purely a display/label change
reading the existing `shipping_method`/`shipping_address` columns. Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 10, ninth addendum).

## 2026-07-08 (session 10, eighth addendum) -- 🟡 Admin Settings: AI Listing Assistant Prompt also collapses into an accordion

Owner asked that the **AI Listing Assistant Prompt** section on `/admin/settings`
collapse into an accordion too, matching the checkout address pattern from the
seventh addendum. Done in `AdminSettingsPanel.tsx`: new `promptExpanded` state
(default `false` — collapsed on load, since the prompt textarea alone is
460px tall and was pushing every other settings panel down); the section header
is now a clickable row (`role="button"`, `tabIndex`, `aria-expanded`/
`aria-controls`, a chevron that flips `expand_more`/`expand_less`) mirroring the
`editor-collapse-header` pattern already used by `AdminShell.tsx`'s product-editor
sections, rather than a plain `<button>` (the header wraps an `<h2>`, which isn't
valid content inside a real `<button>`). The textarea and its Copy/Edit/Save/
Restore controls, notices, and load-error banner only render when expanded; no
other settings section (Storage Cleanup, Shop Visibility, Trade-in Price,
Marketing, Etsy, Carousel) was touched. `npx tsc --noEmit`, `npm run lint`, `npm
run build` all pass. **Not verified live** — another chat's dev server was
already running against this same `next-app` directory, and Next.js refuses to
run two `next dev` instances against one project directory at all (a singleton
lock independent of port), so no preview server could be started this session;
verified instead by reading the full resulting JSX for correct nesting. **Owner
action:** once only one dev server (or the deployed site) is running, open
`/admin/settings` and confirm the AI prompt section loads collapsed, the header
click/keyboard-toggles it (chevron flips), and the prompt editor only appears
once expanded. No migration. Full detail: `project-docs/DECISIONS.md` 2026-07-08
(session 10, eighth addendum).

## 2026-07-08 (session 10, seventh addendum) -- 🟢 Checkout: address collapses behind an "Address (optional)" accordion for Local Pickup

Owner asked that when the shipping method is **Local Pickup**, the address area
collapse behind an accordion button labeled **"Address (optional)"** the buyer can
expand if they want. Done in `CheckoutClient.tsx`: new `addressExpanded` state; the
address inputs render only when `needsShipping || addressExpanded`. For Local
Pickup the header becomes a toggle button (chevron, `aria-expanded`/`aria-controls`)
and the inputs stay optional; for any real shipping method the address is unchanged
(always shown, required, with the ship-to helper). `npx tsc --noEmit`, `npm run
lint`, `npm run build` pass; **verified live in the preview**: shipping default →
address shown + required (no accordion); switch to Local Pickup → collapsed
"ADDRESS (OPTIONAL)" accordion, inputs hidden; expand → optional inputs (no
asterisks, `required=false`), chevron flips; no console errors. No migration. Full
detail: `project-docs/DECISIONS.md` 2026-07-08 (session 10, seventh addendum).

## 2026-07-08 (session 10, sixth addendum) -- 🟢 Owner emailed on every new (paid) order

Owner wasn't getting a direct email on new orders — only the admin Orders list
(the customer already gets a receipt). `finalizePaidOrder` (the shared post-payment
step for both the capture route and the webhook backstop) now also sends a
best-effort **owner notification** email to `info@naplesestatejewelry.co`
(override: env `ORDER_NOTIFICATION_EMAIL`) with the order number, total, customer
contact, line items, totals, fulfillment + ship-to, notes, and a "View order in
admin" link. From `noreply@naplesestatejewelry.co` (verified sender), **reply-to =
the buyer** so the owner can reply directly. Independent of the customer receipt
(doesn't require a buyer email) and best-effort (a mail failure never affects the
payment). New `next-app/src/lib/order-owner-notification.ts`; wired in
`order-finalize.ts`. `npx tsc --noEmit`, `npm run lint`, `npm run build` pass. Not
browser-verifiable (server-side email on real capture) — **owner action:** after
deploy, run a PayPal sandbox/live order and confirm an email arrives at
`info@naplesestatejewelry.co`. Also confirm Resend is allowed to send to that
inbox and that it's monitored. Full detail: `project-docs/DECISIONS.md` 2026-07-08
(session 10, sixth addendum).

## 2026-07-08 (session 10, fifth addendum) -- 🟢 Checkout: escalating card-error guidance on unknown PayPal failures

Owner reported a buyer using PayPal's debit/credit-card form got an error and was
bounced back with no useful guidance (cause unknown — possibly a mistyped card).
Since we can't see PayPal's reason, the generic `onError` path now gives graceful,
escalating card help: **1st** unknown error → "re-enter and double-check your card
number" (hedged with "if you paid by card…", and still notes a sold-out item could
be the cause); **2nd+** consecutive → "try a different card, or call (239)
404-8505." The counter lives in `sessionStorage` (`nej-checkout-unknown-errors`) so
the 2nd-time detection survives a full-page redirect back from the card flow, and
clears on a completed payment. A live stock re-check runs in parallel (so a real
sold-out cause is flagged in the summary instead). Handled errors (availability,
create-order) are unaffected and don't increment the card counter. Pure helpers
moved to `next-app/src/lib/checkout-error-messages.ts` + unit-tested. `npx tsc
--noEmit`, `npm run lint`, `npm run build` pass; `npx vitest run` 164/164 (+5).
**Verified in the preview** the checkout still renders normally (PayPal button + In
stock, no console errors); the actual onError escalation needs a **PayPal sandbox**
card failure to drive live (added to the session-10 fourth-addendum verify item).
Full detail: `project-docs/DECISIONS.md` 2026-07-08 (session 10, fifth addendum).

## 2026-07-08 (session 10, fourth addendum) -- 🟢 Checkout/cart stock awareness + clearer sold-out errors

Owner: buying an already-sold item showed only "Something went wrong with PayPal."
Fixed by surfacing and re-checking availability everywhere:
- **Checkout order summary** now shows per-item **In stock / N available / Sold
  out — no longer available**; if anything is unavailable the PayPal button is
  replaced with a clear "remove it to continue" message (payReady also gates on
  it), so the opaque error is avoided for the common case.
- **Re-check on checkout load and after a PayPal error** (create-order/capture) —
  the summary updates the moment the buyer is returned to the page.
- **Cart drawer re-checks on open**, showing an "Availability changed" banner
  naming sold-out / reduced items and re-clamping quantities to live stock.
- **PayPal error copy** — the generic onError message now notes a just-sold-out
  item may be the cause and to check the summary; availability-caused
  create-order/capture failures show a specific message.

Centralized in `CartContext` (`refreshAvailability` reads live status/quantity,
updates items, records `stockAlerts`; shared `StockAlertBanner` used by drawer +
checkout). Explicit-items pattern avoids a stale-ref race on the hydration commit;
the checkout effect converges (bounded to 2 reads, verified). Degrades gracefully
if `products.quantity` isn't present yet (status-only) — **no migration required**.
`npx tsc --noEmit`, `npm run lint`, `npm run build` pass; `npx vitest run` 159/159.
**Verified live in the preview** (guest checkout, no admin needed): a sold-out
item (simulated via a missing product row) → banner + labels + blocked pay + hidden
PayPal button; all-available cart → normal checkout with PayPal button + "In stock";
cart drawer → banner on open; no console errors, no render loop. Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 10, fourth addendum).

## 2026-07-08 (session 10, third addendum) -- 🔴 Etsy sync: custom tags + title-word broadening (SQL migration pending)

Owner asked for (1) the ability to add custom tags on top of what the Etsy sync
auto-fills, and (2) a fix for important title words (e.g. "charm" from a "…Charm
Bracelet") not appearing in tags.

**Custom tags:** new **Additional tags** field in the product drawer's Etsy
section, persisted per product on `etsy_listings.extra_tags`. `mapTags()` merges
them FIRST (so they're guaranteed within Etsy's 13-tag cap), via the same
clean/dedup/clamp path. New `PUT /api/admin/etsy/tags`; the dry-run preview now
returns the raw custom tags (to prefill the field) and the Tags line shows the
merged result. Uses the same no-effect-derived input pattern as the markup Save
field. **Title-word broadening:** `mapTags()` now also extracts meaningful words
from the title — the product-type phrase first ("charm bracelet"), then
standalone words ("charm", "byzantine"…) — filtering metal/karat/color/unit/
number/grammar noise and the type word itself, capped at 4 standalone words so it
can't crowd out the estate/vintage/antique tags. This half needs no schema change
and works immediately.

**🔴 PENDING MANUAL STEP — run `supabase/etsy-listings-extra-tags-2026-07.sql`**
(adds `etsy_listings.extra_tags text[]`; canonical `supabase/etsy-sync.sql` also
updated for fresh installs). Until it runs, custom tags simply can't be saved
(the title broadening still works). Reads degrade gracefully. `npx tsc --noEmit`,
`npm run lint`, `npm run build` all pass; `npx vitest run` 159/159 (+5 tag
tests); `/api/admin/etsy/tags` in the route manifest. Admin drawer UI is
build/type-verified only (needs an admin login to drive live, per this module's
precedent). Full detail: `project-docs/DECISIONS.md` 2026-07-08 (session 10,
third addendum).

## 2026-07-08 (session 10, second addendum) -- 🟢 Shop mobile/tablet: piece-count pill became a search bar; count moved to the toolbar

Owner asked that on mobile/tablet the long pill under the **Filters** button
(which showed "74 pieces") become a search bar, and the piece count move down
next to the view/sort buttons. Done responsively without touching desktop: the
`.shop-filters-meta` block in `next-app/src/components/shop/ShopFilters.tsx` now
renders a full-width search `<input>` below 1024px and the count pill at ≥1024px
(desktop sidebar unchanged); `next-app/src/app/[locale]/shop/(list)/page.tsx`'s
`.shop-gallery-toolbar` gained a mobile/tablet-only `.shop-toolbar-count` beside
`ShopViewToggle`. The mobile search binds to the same `q` search param as the
sidebar search, and Clear Filters is preserved (appears under the search when a
filter is active). Also fixed a follow-up overflow the new count exposed: the
Sort `<select>` was overflowing its pill on mobile because the base
`.shop-gallery-sort select` min-width rule sits after (and beat) the mobile
`min-width: 0` override — resolved by raising the override's specificity so the
select shrinks to fit. `npx tsc --noEmit`, `npm run lint`, `npm run build` all
pass; **verified live in the preview** at mobile (375px), tablet (768px), and
desktop (1280px) — typing filters live (`?q=ring` → toolbar reads "12 of 78
pieces"), the Sort control no longer overflows, desktop still shows the count in
the sidebar with no toolbar count, no console errors. No migration, no owner
action. Full detail: `project-docs/DECISIONS.md` 2026-07-08 (session 10, second
addendum).

## 2026-07-08 (session 10, addendum) -- 🟢 Fixed a failing deploy: PAYPAL_ENV false-positive in Netlify secrets scan

A deploy failed at the "building site" stage — Netlify's secrets scanner flagged
`PAYPAL_ENV`'s value across hundreds of build-output files and exited non-zero.
`PAYPAL_ENV` is **not a secret**: its only values are `sandbox`/`live`
(`next-app/src/lib/paypal.ts:11`), and the scanner substring-matches that generic
word everywhere it appears in vendored JS + rendered pages. Fixed by adding
`PAYPAL_ENV` to `SECRETS_SCAN_OMIT_KEYS` in root `netlify.toml` (now
`…,PAYPAL_CLIENT_ID,PAYPAL_ENV`) — the same targeted fix already used for
`PAYPAL_CLIENT_ID` on 2026-06-30. The real secret `PAYPAL_CLIENT_SECRET` is NOT
omitted and stays server-side. **Owner action:** re-copy this folder to the deploy
repo and redeploy; keep the `PAYPAL_ENV` var set in Netlify (this only tells the
scanner to ignore it). Full detail: `project-docs/DECISIONS.md` 2026-07-08
(session 10, addendum).

## 2026-07-08 (session 10) -- 🟢 Checkout defaults to shipping (Priority Insured), not local pickup

Owner asked that the buyer checkout assume the average buyer needs the item
shipped: default to a shipping method, require the address up front, and make
local pickup an opt-in. Done with a one-line default change — new
`DEFAULT_SHIPPING_METHOD = 'priority-insured'` export in
`next-app/src/components/checkout/OrderSummary.tsx`, consumed by
`CheckoutClient.tsx`'s `shippingMethod` initial state (was `SHIPPING_OPTIONS[0]`
= `local-pickup`). Because the address fields and totals already gate on
`needsShipping` (method ≠ `local-pickup`), the Street/City/State/ZIP fields are
now required by default and the buyer must deliberately pick **Local Pickup** to
skip them. The Address section also shows a bilingual helper line telling the
buyer their order ships to that address and to switch the shipping method to
Local Pickup if they'd rather collect in person. No server or schema change —
the PayPal create-order route already derives address requirements and pricing
from the submitted method. `npx tsc --noEmit`, `npm run lint`, `npm run build`
all pass; **verified live in the dev preview** (checkout defaults to Priority
Insured, $45 shipping, address fields required, helper line renders, no console
errors). No migration, no owner action. Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 10).

## 2026-07-08 (session 9, twentieth addendum) -- 🟢 Markup→price workflow made explicit + status chips refresh after a sync

Two loose ends from the owner: (1) after changing the Etsy price markup and
re-syncing, live prices didn't update; (2) the admin table's Etsy status chips
went stale after a sync.

**(1) Markup wasn't lost — it was the wrong tool.** Verified live: the markup
DID save (`etsy_connection.price_markup_pct = 10`). But "Sync All to Etsy"
*intentionally skips already-live items* (`enqueueAllEligible` only queues
non-active/draft_review), so it can't re-price them. The correct tool — **"Push
prices to Etsy now"** in Settings → Etsy Sync (`pushPricesBatch`, pushes any
listing whose computed price differs from `last_pushed_price`) — was there but
not discoverable. Fix: `EtsySettingsPanel` now sets a `pricesStale` flag when
the markup is saved to a *new* value; a highlighted gold callout appears above
the push button (which itself turns gold) telling the owner their live prices
still show the old markup until they push, and noting that "Sync All" skips live
items by design. The flag clears once the push completes.

**(2) Chips refresh after a sync.** `AdminShell`'s `/api/admin/etsy/listings`
read (a single local DB call — no Etsy API) is now a reusable `refreshEtsyChips`
callback, still fetched once on mount but also re-run when the bulk modal closes
and after any per-item drawer action (sync / status check / price push, via a
new `onSynced` prop on `EtsyProductPanel`). No extra Etsy API calls — it's the
same local read, just re-invoked at the right moments.

`npx tsc --noEmit`, `npm run lint`, `npx vitest run` (154/154), `npm run build`
all pass. **No migration, no owner action** beyond deploy. **Deployed and
confirmed working live by the owner 2026-07-08.** Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 9, twentieth addendum).

## 2026-07-08 (session 9, nineteenth addendum) -- 🟢 Bulk "Check Etsy statuses" — recovers items stuck in 'error'

The owner had forgotten to set the Etsy env vars in Netlify; a "Sync All" then
errored all 55 non-terminal items ("no API key"). Redeployed with the vars set,
but those 55 were stuck in `error` state — the bulk UI showed "0 eligible · 55
errors" and START was disabled, so no way to recover them. (The items are fine
on Etsy — drafts; the error was a config blip.)

Built the owner's suggested fix: a **"Check Etsy statuses"** button in the
"Sync All to Etsy" modal that reconciles every linked listing's local state to
what Etsy actually reports (read-only, no content re-push). New pure
`reconcileSyncStateFromEtsy` now clears a stale `'error'` (errored draft →
`draft_review`); `checkAllListingStatuses()` + `/api/admin/etsy/verify-all`
apply it across the catalog. Also **enabled START when there are errors** so
they can alternatively be re-synced. Two recovery paths; reconciliation is the
light default.

`npx tsc --noEmit`, `npx vitest run` (154/154, +4 reconcile tests), `npm run
lint`, `npm run build` all pass; route in the manifest. **Owner action:**
deploy → "Sync All to Etsy" → **Check Etsy statuses** → the 55 errors clear to
their real Etsy state. Full detail: `project-docs/DECISIONS.md` 2026-07-08
(session 9, nineteenth addendum).

## 2026-07-08 (session 9, eighteenth addendum) -- 🟡 Bulk "Sync All" showed a generic "Batch sync failed." — made the real error visible + batch resilient

After deploying the seventeenth-addendum fix, the owner re-ran "Sync All" and
got a bare **"Batch sync failed."** Two problems, both fixed; the exact trigger
is not yet confirmed (see below):
1. **The client hid the real error.** `EtsyBulkSyncModal`'s drain loop threw its
   own generic string on any non-OK response, ignoring the server's
   `{ error: … }`. Now it surfaces the server message.
2. **One uncaught throw killed the whole batch.** `runSyncStep` catches its own
   step errors, but a throw from its pre-flight setup (before its try) — e.g. a
   token refresh — propagated through the drain to a 500, failing all 55.
   `drainQueue` now wraps each item: a per-item throw is contained (item marked
   `error` + logged, drain continues); a connection-level error
   (invalid_grant/401/"reconnect") rethrows so the batch stops with an
   actionable message instead of erroring the whole catalog.

**Cause not yet pinned:** the token was valid (expires 20:21, failure was
earlier), the pre-Etsy logic doesn't throw for any of the 55 pending items
(verified), and nothing was written to `etsy_sync_log` — so it was an uncaught
throw in the Etsy-calling path or a transient/function-level blip I can't see
from here. **Owner action:** re-run "Sync All" — the error is now specific
(tells us exactly what failed), and one bad item won't sink the run. Report the
message shown. `npx tsc --noEmit`, `npx vitest run` (150/150), `npm run lint`,
`npm run build` all pass. Full detail: `project-docs/DECISIONS.md` 2026-07-08
(session 9, eighteenth addendum).

## 2026-07-08 (session 9, seventeenth addendum) -- 🔴 Fixed a bulk "Sync All" runaway (unbounded API calls)

Owner reported "Sync all to Etsy" showing "Processed 79 of 55 · 55 remaining"
and climbing without end. Root cause: `enqueueAllEligible` re-enqueues
already-synced items (with `etsy_listing_id`) to `'pending'`, but
`runSyncStep('publish')` does nothing for a `'pending'`-with-listing_id item
(every publish step gates on a later state) — so it stayed `'pending'` and the
drain re-claimed the same items every pass forever.

Fixed in three layers: (1) **root cause** — `runSyncStep` now treats a
`'pending'` item that already has a listing_id as an **update** (`effectiveMode`),
pushing current content via the diff path (image DIFF, not a re-upload) and
moving it to a terminal state; (2) **server** — `drainQueueCore` stops a pass
if it re-claims an item that didn't leave the queue; (3) **client** —
`EtsyBulkSyncModal` stops polling if `remaining` stays flat for 5 polls.

**No migration / no manual data cleanup.** The stuck `'pending'` rows will be
processed correctly by the first drain after this DEPLOYS. **Until deployed,
don't re-run "Sync All"** (Netlify still has the bug — it'll loop). `npx tsc
--noEmit`, `npx vitest run` (150/150, +1), `npm run lint`, `npm run build` all
pass. **Owner action:** deploy → run "Sync All" once (it should finish now, and
the stuck items land in draft_review). Full detail: `project-docs/DECISIONS.md`
2026-07-08 (session 9, seventeenth addendum).

## 2026-07-08 (session 9, sixteenth addendum) -- 🟢 Pre-flight warning for title↔product_type mismatches

Follow-up to the bracelet-mistype fix: the Etsy dry-run now shows a
non-blocking amber warning when a listing's title clearly implies a different
type than its `product_type` (e.g. a "…Bracelet" typed as Necklace) — so future
mistypes are caught before syncing. `titleImpliedJewelryType()` only fires on
an unambiguous single-type title (sets / "Pendant Necklace" / spoons don't
trigger it), and types are grouped so neck-worn swaps (Pendant/Charm/Necklace)
don't nag. It's a warning, never a block, and never auto-corrects
(`product_type` stays owner-controlled). `npx tsc --noEmit`, `npx vitest run`
(149/149, +8 tests), `npm run lint`, `npm run build` all pass. Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 9, sixteenth addendum).

## 2026-07-08 (session 9, fifteenth addendum) -- 🟡 Data fix: 2 bracelets were typed as "Necklace" (mis-categorized on Etsy)

Owner spotted a Cuban-curb-link **bracelet** syncing under Necklaces > Chains
with "necklace" tags. Root cause = a **data** error, not the mapping: its
`product_type` was `Necklace`. Audited the whole catalog for title↔type
mismatches — found 5; **2 were unambiguous** (bracelets typed as Necklace) and
3 were legitimate owner choices (a Mickey "pendant" typed as Charm, two
"Koma Clasp" items). Corrected the 2 via direct service-role UPDATE
(`product_type` + `jewelry_type` → `Bracelet`):
`vintage-tiffany-...-cuban-curb-link-bracelet-26` and
`italian-14k-yellow-gold-figaro-link-bracelet-25`. Verified downstream: they
now map to **Jewelry > Bracelets > Chain & Link Bracelets (1196, exact)** with
bracelet tags ("cuban link bracelet", "solid gold bracelet", …).

**Owner action:** on those 2 listings click **Refresh Preview** then **Sync
Updates** — the update path (`setListingCopy`) pushes `taxonomy_id` + tags, so
the existing Etsy drafts move to the Bracelet category. The public shop
reflects the type change within ~5 min (ISR; the direct DB write bypasses the
app's instant revalidation). The 3 ambiguous items were left as-is (the Mickey
"Charm" vs "Pendant" call is the owner's). Full detail: `DECISIONS.md`
2026-07-08 (session 9, fifteenth addendum).

## 2026-07-08 (session 9, fourteenth addendum) -- 🔴 Site-wide customer trade-in price default (needs a SQL migration)

New Admin → Settings panel **Customer Trade-in Price**: set the "Own gold or
silver? … pay as little as ___" line to a signed % over/under the spot melt
value for ALL items at once (negative = below spot). The existing per-item
override still wins. Resolution centralized in
`resolveAdvertisedTradeInPrice()` (per-item override → site default → plain
melt). Stored on `shop_settings` (`special_price_default_enabled/_percent`);
the shop-settings route now handles a partial patch (visibility toggle still
works). Public product page wired to the new resolver; changes propagate
within ~5 min (ISR, like spot values).

**🔴 PENDING MANUAL STEP — run `supabase/shop-special-price-default-2026-07.sql`
in Supabase** (adds the two columns). Verified live the columns don't exist
yet, so the feature is safely OFF until then — every page shows the plain melt
value (confirmed: a real product page renders its melt value unchanged). Reads
degrade gracefully pre-migration.

`npx tsc --noEmit`, `npx vitest run` (141/141, +5 tests), `npm run lint`, `npm
run build` all pass. Admin panel not driven live (needs login); public
consumer verified. **Owner action:** run the SQL, then enable + set a % in
Admin → Settings → Customer Trade-in Price → Save. Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 9, fourteenth addendum).

## 2026-07-08 (session 9, thirteenth addendum) -- 🟡 Etsy sync: markup Save button + dedicated "Push prices now" (bulk + per-item)

Two re-pricing improvements:
1. **Explicit Save button** on the Etsy price-markup field (was auto-save on
   blur). Controlled field, disabled until changed, no-effect derived pattern.
2. **Dedicated price push** — because the bulk "Sync All to Etsy" *skips*
   already-live listings (so it never re-prices what's up), and the daily push
   is threshold-gated + cron-only. New `pushPricesBatch()` +
   `/api/admin/etsy/push-prices` re-sends the current price of every live
   listing whose price drifted, via the lean price-only path, ignoring the
   threshold; batched/resumable/stall-guarded. Surfaced as a **"Push prices to
   Etsy now"** button in Etsy Sync settings and a per-item **"Push price"**
   button in each product's Etsy drawer.

`npx tsc --noEmit`, `npx vitest run` (136/136), `npm run lint`, `npm run build`
all pass; `/api/admin/etsy/push-prices` in the manifest. **Owner action:**
change markup → Save → "Push prices to Etsy now"; confirm live prices update.
Full detail: `project-docs/DECISIONS.md` 2026-07-08 (session 9, thirteenth
addendum).

## 2026-07-08 (session 9, twelfth addendum) -- 🟡 Etsy sync: fixed the 2 remaining bulk-sync 400s (title "&"-once rule) + made Etsy field-errors legible

Owner bulk-synced after the eleventh-addendum fix — most succeeded, **2 failed
with a bare "Etsy request failed (400)."** Read the real reason from
`etsy_sync_log.detail`: both hit Etsy's rule that **"&" may appear at most once
in a title** (both had two, e.g. "Grape & Scroll … Sterling & England"). Not a
category issue.

Fixed: `mapTitle` now keeps the first "&" and converts the rest to "and"
(confirmed on the two real titles — both drop to 1 "&", maker names intact).
Also fixed the diagnostic gap that hid the reason: `extractEtsyMessage` in
`client.ts` now parses Etsy's numeric-keyed field-error shape, so a
title/tag/field rejection shows its real message instead of a generic 400.

`npx tsc --noEmit`, `npx vitest run` (136/136, +7 tests incl. new
`client.test.ts`), `npm run lint`, `npm run build` all pass. **Owner action:**
re-sync the two silver pieces (Serving Spoon + Oval Gallery Tray) — should
publish now. Full detail: `project-docs/DECISIONS.md` 2026-07-08 (session 9,
twelfth addendum).

## 2026-07-08 (session 9, eleventh addendum) -- 🟢 Etsy sync: the 22 "ineligible" silver items are now all eligible

Owner's "Sync all to Etsy" showed 22 ineligible items. Diagnosed against the
live catalog: **all 22 failed ONLY the taxonomy check** — the owner enters
granular silver product types (Berry Spoon, Cold Meat Fork, Coffee Pot, Salt
Cellar, Koma Clasp, Tray, Napkin Ring, …) that aren't among the ~13 coarse
`ProductJewelryType` keys in `ETSY_TAXONOMY_MAP`, so they had no category and
were blocked.

Fixed with `ETSY_KEYWORD_TAXONOMY` in `mapping.ts` — an Etsy-scoped
keyword→leaf fallback (real ids fetched live) consulted only when the coarse
map misses: flatware → Flatware & Silverware (1048, exact); trays/pots/cellars/
bowls → their closest serveware leaf (approximate); Koma clasps → Brooches
(1201). Doesn't touch app-wide `normalizeProductJewelryType`. **Re-ran the live
pre-flight: 0 ineligible, all 74 available items eligible.** Approximate fits
show "Closest match — review" and can be overridden per item.

Also: the bulk modal's ineligible list now shows the *reason* per item, not
just the name. `npx tsc --noEmit`, `npx vitest run` (129/129, +5 tests), `npm
run lint`, `npm run build` all pass. **Owner action:** reopen "Sync all to
Etsy" (~70 eligible / 0 ineligible now) and spot-check categories in the
preview. Full detail: `project-docs/DECISIONS.md` 2026-07-08 (session 9,
eleventh addendum).

## 2026-07-08 (session 9, tenth addendum) -- 🟡 Etsy sync: Check Etsy Status reconciles draft→active; View on Etsy → shop-manager pages

Two owner-reported fixes after activating a listing on Etsy:
1. **Check Etsy Status now updates the chip.** It used to only *report* Etsy's
   state when the listing still existed (only wrote back on the deleted/404
   case), so activating a draft on Etsy left our chip stuck on "Draft on Etsy
   — needs review". `checkListingStatus()` now writes Etsy's real state back
   (active → "Active on Etsy", inactive/expired/sold_out → delisted, draft →
   keeps our finer draft-family state). The chip flips immediately since the
   client reloads after the check.
2. **"View on Etsy" now opens the owner's shop-manager list**, not the public
   `etsy.com/listing/<id>` URL (which doesn't work for drafts). Active →
   the default listings view; draft/other → the `state=draft` filter. Driven
   by `listing_state`, which fix #1 keeps accurate.

`npx tsc --noEmit`, `npx vitest run` (124/124), `npm run lint`, `npm run
build` all pass. **Not verified live** (needs a live Etsy listing + admin
login). **Owner action:** activate a draft on Etsy → Check Etsy Status →
confirm chip flips to "Active on Etsy" and "View on Etsy" opens the active
manager view. Full detail: `project-docs/DECISIONS.md` 2026-07-08 (session 9,
tenth addendum).

## 2026-07-08 (session 9, ninth addendum) -- 🟡 Etsy sync: manual test windows removed, length/ring size folded into the dry-run preview

Owner asked to drop the separate "Test Length" / "Test Ring Size" windows and
show those values in the dry-run preview for approve-by-sync. Done:
- The two manual-test UI sections (inputs + Test buttons + JSON boxes) are
  gone from `EtsyProductPanel.tsx`.
- The dry-run preview now shows a **Length** row (length-bearing types) or a
  **Ring size** row (Rings) with the computed value that will push ("7.75 in
  · pushes on sync" / "10 1/2 (US/CA) · pushes on sync") or "nothing to push"
  when the source field is empty. Computed in `preview/route.ts` with the
  existing pure parsers — no Etsy calls, so the dry-run stays read/write-free.
- Cleaned up the now-orphaned code: deleted the two experiment API routes and
  the `runLengthExperiment`/`runRingSizeExperiment` manual functions. The
  automatic path (`attemptLengthSync`/`attemptRingSizeSync`) is untouched.

`npx tsc --noEmit`, `npx vitest run` (124/124), `npm run lint`, `npm run
build` all pass. Restarted the dev server to clear a stale compiled chunk
(source verified clean). **Not visually verified in-browser** (admin panel
needs a login the preview lacks) — build/type-check is the proof. **Owner
action:** open a product's Etsy drawer, confirm Length/Ring size show in the
preview, then sync. Full detail: `project-docs/DECISIONS.md` 2026-07-08
(session 9, ninth addendum).

## 2026-07-08 (session 9, eighth addendum) -- 🟡 Etsy sync: Ring size now auto-on too

Owner asked to make ring size automatic like length. Flipped the same gate
in `sync.ts` from opt-in (`ETSY_SYNC_RING_SIZE === 'true'`) to on-by-default
(`!== 'false'`). Ring size now pushes on every Ring sync with no Netlify
change; `ETSY_SYNC_RING_SIZE=false` disables it. Length and ring size are
now both default-on, each independently disable-able. Same safety
(read-back + verify, real chart values only — never a guess).

`npx tsc --noEmit`, `npx vitest run` (124/124), `npm run lint`, `npm run
build` all pass. **Owner action:** sync a Ring and confirm the size lands
automatically. Full detail: `project-docs/DECISIONS.md` 2026-07-08 (session
9, eighth addendum).

## 2026-07-08 (session 9, seventh addendum) -- 🟡 Etsy sync: length auto-on + vintage/antique tags + no mid-word truncation

Three owner asks after the necklace sync worked:

1. **Length auto-pushes now — no Netlify flag needed.** Flipped the code gate
   from opt-in (`ETSY_SYNC_BRACELET_LENGTH === 'true'`) to on-by-default
   (`!== 'false'`) in `sync.ts`, since the owner confirmed it works and I
   can't set Netlify vars myself. Set `ETSY_SYNC_BRACELET_LENGTH=false` to
   turn it back off. Still safe (write→read-back→verify, fails closed). Ring
   size stays opt-in (owner only asked about length).
2. **Vintage/antique tags.** Every item now gets "vintage jewelry" + "antique
   jewelry", plus a metal-specific pair ("vintage sterling"/"antique
   sterling" for silver, "vintage gold"/"antique gold", etc.). Pairs are
   atomic (never a lone "vintage" without "antique", per the owner's rule).
3. **No more chopped tags.** The live "solid silver bracele" bug (a 21-char
   tag hard-cut to 20 mid-word) is fixed — tags now truncate at a word
   boundary ("solid silver").

`npx tsc --noEmit`, `npx vitest run` (124/124, +4 tag tests), `npm run lint`,
`npm run build` all pass. **Owner action:** re-sync a listing and confirm the
new tags + automatic length. Note: "antique" on a 1990s piece is a keyword
stretch (it's a free-text tag, not the accurate `when_made` field) — flagged
in case you want it narrowed later. Full detail: `project-docs/DECISIONS.md`
2026-07-08 (session 9, seventh addendum).

## 2026-07-08 (session 9, sixth addendum) -- 🟢 Etsy sync: necklace sync WORKED live; Necklace now auto-maps to "Chains"

The necklace sync succeeded live after the image-path + SKU fixes — the
original "hung up syncing" incident is resolved. Owner then noticed it
landed under "Pendant Necklaces" (the old closest-match) and asked for
chain-style necklaces to auto-map to **"Chains"** instead, since this
catalog is mostly chains.

Done: `ETSY_TAXONOMY_MAP.Necklace` now points to **Chains (taxonomy_id
1221)** instead of Pendant Necklaces (1229). The real id came from a live
`seller-taxonomy/nodes` fetch (siblings cross-checked against already-pinned
ids), and Chains was confirmed to carry the same Material/Gold solidity/Gold
purity/Length properties this app pushes — so nothing about the property
push changes. Dropped the `approximate` flag too (Pendant is its own product
type, so "Necklace" genuinely means a chain here) → no more "Closest match —
review" nag on necklaces.

**Does not retro-move already-synced necklaces** — only future syncs/
re-syncs send Chains; existing Etsy listings stay under Pendant Necklaces
until re-synced or corrected on etsy.com. `npx tsc --noEmit`, `npx vitest
run` (120/120), `npm run lint`, `npm run build` all pass. **Owner action:**
sync a necklace and confirm it lands under Necklaces › Chains. Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 9, sixth addendum).

## 2026-07-08 (session 9, fifth addendum) -- 🟡 Etsy sync no longer pushes SKU at all (owner's explicit call)

Same necklace, next error after the image-path fix: `Etsy rejected the
request: There was a problem with /sku : cannot be more than 32 characters`
(the product's `sku` field holds its 51-character slug). Owner: *"i dont
need to upload sku to etsy at all (its no use to me)."* Fixed permanently
by no longer sending `sku` in the `updateListingInventory` payload at all
(`next-app/src/lib/etsy/sync.ts`) — not a truncation, a full removal.

**Accepted trade-off (disclosed, not silent):** the original design used
the pushed SKU for a narrow crash-recovery guard (adopt an orphaned Etsy
draft on retry if a prior sync died between Etsy accepting the create call
and our DB write). That guard can never match anything once SKU isn't
pushed, so it was removed outright rather than left as dead API calls on
every publish. Residual risk is low: a sync dying in that exact narrow
window now creates an extra draft instead of adopting one — an easily
spotted, easily deleted stray, not live-listing corruption. Also removed
the now-misleading "SKU" row from the admin dry-run preview (it implied
the value gets pushed, which is exactly the assumption that prompted this
change). `mapSku()` itself is untouched — still feeds the description's
"Inventory #:" line and the content-hash change detector, neither of which
has a length constraint.

`npx tsc --noEmit`, `npx vitest run` (118/118), `npm run lint` (0
problems), `npm run build` all pass. **Not yet re-verified live — owner
action:** retry the necklace sync once more; this should clear both the
image-path error and this SKU error together. Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 9, fifth addendum).

## 2026-07-08 (session 9, fourth addendum) -- 🟡 Fixed the real cause the circuit breaker surfaced — relative legacy image paths

The necklace sync (previous entry) failed fast with a real reason instead of
looping forever: `Failed to parse URL from
/assets/images/shop/shop-14k-heavy-diamond-cut-cuban-chain-04.webp`. Root
cause: this product has an image stored as a relative, same-origin path (a
legacy convention from before photos moved to Supabase Storage) instead of a
full URL. Node's server-side `fetch()` has no implicit page origin, unlike a
browser, so it threw immediately on every attempt — a pre-existing gap in
the original build (the file's header comment always claimed to support
both source types; the code never actually handled the relative case).

**Fixed:** new `resolveImageUrl()` in `next-app/src/lib/etsy/images.ts`
passes absolute URLs through untouched and resolves anything else against
the app's canonical site URL (reused the existing `getSiteUrl()` helper from
`order-email-branding.ts`). `fetchImageBytes` now calls it before fetching.
No database reset needed — the existing retry-from-`error` path and the
circuit breaker's own success-resets-the-counter logic handle it.

`npx tsc --noEmit`, `npx vitest run` (118/118, incl. 4 new regression tests
for this exact path), `npm run lint` (0 problems), `npm run build` all pass.
**Not yet re-verified live — owner action:** retry the necklace sync once
more; this should be the actual resolution of the original "hung up
syncing" report. Full detail: `project-docs/DECISIONS.md` 2026-07-08
(session 9, fourth addendum).

## 2026-07-08 (session 9, third addendum) -- 🟡 Fixed a real infinite-retry loop during image sync (found while testing Length on a Necklace)

Owner tried testing Length on a Necklace and the sync appeared to hang
("Uploading image 4 of 8…" forever). Investigation found this was genuinely
stuck, not just slow: 100+ identical sync calls, zero images ever recorded.
Root cause: the image step already correctly downgrades a single bad photo
to a warning (by design, so one bad image doesn't block a whole sync) — but
nothing distinguished "some images succeeded" from "every image in this
batch failed," so a persistently-failing image got retried forever, and the
warning explaining why was being silently discarded by the client during
polling the entire time.

**Fixed at two independent layers:**
- **Server (`sync.ts`):** tracks real successes vs. attempts; after 5
  consecutive zero-progress batches, stops and marks the listing `error`
  with a clear message instead of looping forever.
- **Client (`EtsyProductPanel.tsx`):** now shows warnings live during
  polling (previously only shown at the very end) and independently stops
  after 5 identical progress responses in a row.

Also hit a **stale dev-server cache** (`ReferenceError: isBracelet is not
defined` — a variable renamed last session; confirmed the actual source is
clean). Fixed by restarting the dev server — this project's known
Turbopack/OneDrive cache quirk, not a code bug.

`npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`, 114 tests
all pass. **🟡 Still unknown:** why this specific necklace's images
actually fail to upload — the fix makes the failure fast and visible
instead of silent and infinite, but doesn't diagnose the root cause yet.
**Owner action:** retry the necklace sync — safe either way now (succeeds,
or fails fast with a real reason within ~5 attempts). Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 9, third addendum).

## 2026-07-08 (session 9, addendum) -- 🟢 Ring size CONFIRMED WORKING live

Owner ran **Test Ring Size** (10.5) on a real draft ring listing — genuine,
independently-verified success:

```
Verified — Etsy's "Ring size" property now reads 10 1/2 (US/CA).
```

`10.5` → `"10 1/2"` → matched a real chart entry (`value_id 1604`, never
invented) → written → read back and confirmed on all three checks (property
name, scale, value). Notably ran against a **manually-overridden** category
("Multi-Stone Rings," not our automatic guess) — a stronger proof than
testing the default path alone. Updated code comments and admin UI copy
from "Experimental" to "confirmed working," matching Length's session 8
treatment. No logic changed — `tsc`/`lint`/114 tests all still pass.

**Still outstanding (unrelated to this result):** confirming the Length
generalization on a non-Bracelet category (a Necklace or Earrings draft) —
Length is proven for Bracelet only so far. **`ETSY_SYNC_RING_SIZE`** is
still unset in Netlify — proven, but turning it on for regular syncs is the
owner's call. Full detail: `project-docs/DECISIONS.md` 2026-07-08 (session
9, addendum).

## 2026-07-08 (session 9) -- 🟡 Etsy sync: Length generalized to 11 categories, Ring size built from scratch — needs live clicks to confirm

Owner asked to generalize the proven Bracelet-length mechanism to other
categories, naming Ring size and Necklace length. These turned out to need
different treatment:

- **Length generalized (near-zero new risk):** the discover/write/verify
  logic never actually depended on Bracelet — only the gating did. Widened
  to every category confirmed to carry a length property: Necklace,
  Bracelet, Pendant, Charm, Earrings, Brooch, Cufflinks, Watch, Coin,
  Bullion, Silverware (all except Ring). Renamed
  `attemptBraceletLengthSync`/`runBraceletLengthExperiment` to generic names
  (route moved `bracelet-length-experiment` → `length-experiment`); the
  `ETSY_SYNC_BRACELET_LENGTH` env var name is unchanged to avoid a needless
  Netlify config edit.
- **Ring size built new** (`next-app/src/lib/etsy/ring-size-experiment.ts`):
  confirmed live this is a genuinely different, enumerated property (real
  sizes like "7 1/2", scoped to a region — US/CA vs UK/AU, which uses
  **letter notation** for physically different sizes). Because every
  standard size already has a real, discoverable value_id, this never needs
  Length's empty-string placeholder — it only ever uses a real matched
  value, and reports "unsupported for this value" (never a guess) when a
  size has no chart match. New `ETSY_SYNC_RING_SIZE` flag (off by default),
  new "Test Ring Size" admin section for Ring products.
- Cleaned up the admin UI's category detection: it used to pattern-match
  `taxonomyPath` display text, which doesn't scale across 11 categories
  spanning 4 different Etsy departments. The preview API now returns an
  authoritative `productType` field instead.

`npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build` all pass.
**114 unit tests pass** (up from 93), including 21 new Ring-size tests using
the real live-fetched chart data. **🟡 Needs live clicks:** "Test Ring Size"
on a draft Ring listing, and "Test Length" on a non-Bracelet category
(Necklace/Earrings/etc.) to confirm the generalization holds outside
Bracelet specifically. Full detail: `project-docs/DECISIONS.md` 2026-07-08
(session 9).

## 2026-07-08 (session 8, third addendum) -- 🟢 Etsy Bracelet length CONFIRMED WORKING — investigation closed

Owner re-ran **Test Bracelet Length** (7.75) after the read-back fix — real,
independently-verified success this time:

```
Verified — Etsy's "Bracelet length" property now reads 7.75 Inches.
```

`verifyLengthReadback` confirmed all three checks itself (property name,
scale, and parsed value all correct) — this is not just "Etsy said 200," the
same standard that caught the "Gray" false-positive would have caught this
if it were wrong too. **Mechanism confirmed:** `value_ids: ['']` (an
empty-string placeholder, never a guessed number) causes Etsy to
auto-generate and assign its own real, shop-scoped `value_id` for the
custom length value — confirmed via the read-back showing a real Etsy-issued
id (`52788369096`) we never supplied ourselves.

**This closes the investigation opened at the start of session 7.**
Materials, Gold solidity, Gold purity, and now Bracelet length are all
confirmed correct live. Updated code comments and the admin UI copy from
"unproven experiment" to "confirmed working." Scope stays deliberately
Bracelet-only (not generalized to other length-bearing categories — not
asked for). **`ETSY_SYNC_BRACELET_LENGTH` is still unset** — the mechanism
is proven, but turning on automatic pushing for every regular sync is the
owner's call; see `etsy-sync-plan/OWNER-SETUP.md`. Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 8, third addendum).

Owner re-synced the bracelet and re-ran the length experiment. Got a 404
that didn't add up (the listing genuinely existed and was fully synced), so
it was investigated rather than accepted. **Root cause: the read-back
verification (`getListingProperty`, the singular endpoint) was built on an
Etsy endpoint whose own spec says "Development... in progress, will only
return a 501"** — it was never going to work, missed when first researched
in session 5/7. Fixed by switching to `getListingProperties` (plural, the
"General Release" list endpoint) in `client.ts`; `length-experiment.ts` now
finds the right entry from the full list. Also split the write and
read-back into separate try/catch blocks so a future failure states clearly
which phase broke.

**Important nuance:** because the OLD code's write and read-back weren't
separated, it's possible the previous run's write (`value_ids: ['']`)
actually succeeded and only the (broken) verification step failed — meaning
we don't know if the live bracelet draft currently has something written to
its Bracelet length field or not. Re-running is safe either way (same value,
idempotent write) and will now give a real, trustworthy answer.

`npx tsc --noEmit`, `npm run lint` (0 problems), 93 tests pass. **🟡 Needs
one more live click:** "Test Bracelet Length" (7.75) on the bracelet again.
Full detail: `project-docs/DECISIONS.md` 2026-07-08 (session 8, second
addendum).

## 2026-07-08 (session 8) -- Etsy Bracelet length: live-tested, safety design confirmed, genuinely unsupported for now

Owner ran the "Test Bracelet Length" experiment (session 7) live: Etsy
rejected it with `Missing input parameter: [value_ids]` — a clean HTTP 400,
**no data written**. This proves the rebuilt safety design works exactly as
intended (loud rejection instead of the old silent "Gray" corruption).
Followed the owner's own rule to stop here rather than guess further.
Bracelet length stays unsupported; `ETSY_SYNC_BRACELET_LENGTH` stays unset.
Also fixed a small UI redundancy (the result was shown twice — top banner +
result box; now only the dedicated result box, which persists instead of
auto-dismissing).

**Same session, addendum:** owner chose to try one more variant —
`value_ids: ['']` (one key, empty string — distinct from the zero-keys case
just confirmed to fail). Implemented (`client.ts`'s `updateListingProperty`
now accepts `(number | '')[]`, `length-experiment.ts`'s fallback changed
from `[]` to `['']`); `npx tsc --noEmit`, `npm run lint` (0 problems), 93
tests pass. **🟡 Not yet run live** — click "Test Bracelet Length" again to
see whether this variant fares any differently. Full detail:
`project-docs/DECISIONS.md` 2026-07-08 (session 8).

## 2026-07-08 (session 7) -- 🟡 Etsy Bracelet length rebuilt as a safe discover-write-verify cycle, still off by default

Rebuilt Bracelet length syncing (removed in session 5 after a hardcoded guess
wrote "Gray" instead of "7.75") to the owner's explicit spec: never hardcode
a property/scale/value id, never derive a value id from the length number,
never trust a 200 response — always read the property back and compare.

- **New `next-app/src/lib/etsy/length-experiment.ts`:** live-discovers the
  Bracelet length property/Inches-scale from Etsy's own
  `getPropertiesByTaxonomyId` response every time (nothing hardcoded), builds
  a safe payload (real `possible_values` match if one exists, otherwise an
  empty `value_ids` array — never a guessed number), writes it, then reads
  the property back and fails closed on any mismatch.
- **New admin action, not automatic:** a "Test Bracelet Length" section in
  each Bracelet product's Etsy panel (`/admin`) — type an inches value, run
  it, see the full discovered property id/scale id/payload/read-back. Hard
  safety rail: refuses to run against an active (live) listing, draft
  listings only.
- **New env var `ETSY_SYNC_BRACELET_LENGTH`** (unset by default) — only once
  the owner has manually proven the experiment succeeds should this be set
  to `true` in Netlify, which turns on automatic Bracelet-length pushing in
  the regular sync pipeline (same discover-write-verify logic, no
  active-listing restriction at that point). A verification mismatch always
  shows as a warning, never a silent success.
- **Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass. **93 unit tests pass** (up from 71) — includes a direct
  regression test asserting `value_ids` is never `[5]` (the exact session-5
  bug) even when the target length coincidentally equals a scale id, and the
  real "Gray" incident replayed against the verification logic and confirmed
  caught.
- **🟡 Not yet run live** — needs the owner to click "Test Bracelet Length"
  on a draft Bracelet listing (I can't drive the admin session myself). Full
  detail: `project-docs/DECISIONS.md` 2026-07-08 (session 7).

## 2026-07-08 (session 6) -- Etsy image pipeline now checks against Etsy's own photo guidance

Owner shared Etsy's seller-help photo tips (2000px both dimensions, first
photo 635px floor for search ranking, keep uploads under 1MB) and asked if
our pipeline matches. `next-app/src/lib/etsy/images.ts`: fixed the existing
2000px check to require the **shortest** edge clear it (was longest-edge
only — a 2400x1200 photo used to pass incorrectly); added a first-photo-only
635px check; added a >1MB warning; added a resize-down-only cap (2400px,
never upscales) so oversized phone photos don't balloon file size/transcode
time while still safely clearing the recommendation. All non-blocking
(warnings only, same as every other property/image check in this pipeline).
**Deliberately not done:** intake-time validation on new photo uploads, or a
catalog-wide audit of existing product photos already below these
thresholds — both are real follow-ups but scoped differently (admin upload
UX / a new report) and weren't asked for. `npx tsc --noEmit`, `npm run lint`
(0 problems), `npm run build` all pass; 71 unit tests pass (up from 64).
Full detail: `project-docs/DECISIONS.md` 2026-07-08 (session 6).

## 2026-07-08 (session 5) -- 🟢🔴 Etsy category properties: Materials/Gold purity/solidity confirmed correct live; Length removed after it silently corrupted a listing

The owner's live bracelet listing confirmed **Materials ("Yellow gold"), Gold
solidity ("Solid gold"), and Gold purity ("14k") all pushed exactly right** —
this part of the properties feature (session 3) is now live-verified, not
just unit-tested.

**Bracelet length showed "Gray" instead of "7.75".** Unlike every other guess
this session, Etsy didn't reject this one with an error — it silently
accepted the malformed `value_ids` and stored a value from a completely
unrelated global vocabulary (a color). Researched Etsy's own tutorial docs
for the correct format: their own example for a scale-based property shows
an opaque, undocumented numeric id with no way to derive or obtain it
ourselves. Given a wrong guess here doesn't fail safely, **removed the Length
property push entirely** (`next-app/src/lib/etsy/mapping.ts`) rather than
risk writing more silently-wrong data. Full reasoning:
`project-docs/DECISIONS.md` 2026-07-08 (session 5).

- **Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass. 64 unit tests pass (down from 69 — 5 Length-specific tests
  removed as no longer applicable).
- **🔴 Owner action needed:** the live bracelet listing still has "Gray" in
  its Bracelet length field — fix it directly on etsy.com (clear it, click
  Etsy's own **"Suggested: + 7.75 Inches"** chip, or type `7.75`). Nothing in
  this app will touch that field going forward.

## 2026-07-08 (session 4) -- 🟡 Etsy sync: fixed a real update-mode bug, added a "Check Etsy Status" reconciliation button

Two follow-ups from live-testing the properties feature (previous entry):

- **Fixed a real live bug:** clicking **Sync Updates** failed with `"Etsy
  rejected the request: Cannot update 'when_made' without 'who_made' and
  without 'is_supply' and vice versa"`. `setListingCopy` in
  `next-app/src/lib/etsy/sync.ts` sent `when_made` alone on the update-mode
  PATCH; Etsy requires the three fields together. Fixed by adding
  `who_made`/`is_supply` (already computed, just not passed here) to that
  call.
- **New: "Check Etsy Status" button.** The owner deleted a draft directly on
  etsy.com to remake it cleanly, and the admin panel kept showing "Draft on
  Etsy" — our DB has no way to learn about an out-of-band deletion by
  itself. Added `checkListingStatus()` (`sync.ts`) + `POST
  /api/admin/etsy/verify-listing`: GETs the real listing, and a 404 (Etsy
  hard-deletes draft listings) resets the local row to not-listed so **Sync
  to Etsy** reappears for a clean remake. New button in
  `EtsyProductPanel.tsx`, shown only when a listing is linked, reusing the
  existing notice-banner pattern.
- **Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass; 69 unit tests still pass (neither change is unit-tested
  directly — both need a live DB + Etsy connection, same as
  `runSyncStep`/`runDelist`, which also have no dedicated tests). **Not yet
  verified live** — no admin session available to click through. **Owner
  action:** click **Sync Updates** again on any previously-active/draft_review
  listing to confirm the who_made/is_supply fix; click **Check Etsy Status**
  on the deleted bracelet draft to confirm it resets to "Not listed" (then
  **Sync to Etsy** should offer a clean fresh publish). Full detail:
  `project-docs/DECISIONS.md` 2026-07-08 (session 4).

## 2026-07-08 (session 3) -- 🟡 Etsy sync: structured category properties (Material/Gold purity/Length) now pushed for every product type — needs one live click to confirm

After the tag-quality refinement (previous entry), the owner asked whether we
could auto-accept Etsy's own "Suggested" attribute chips (Material, Gold
purity, Gemstone, Bracelet width/length, Adjustable) shown in Etsy's listing
editor. The v3 API has no endpoint exposing those UI suggestions — confirmed
by a full spec search (only `suggested_title` exists, a title suggestion, not
attributes). Built the constructive alternative instead: push the same kind
of values ourselves via `updateListingProperty`, using data already on the
product record.

- **New `mapProperties()` in `next-app/src/lib/etsy/mapping.ts`**, wired into
  `sync.ts`'s existing inventory step (`pushListingProperties()`) as an
  additive, best-effort sub-step — never blocks or fails the sync, per-property
  try/catch turns any failure into a `warnings[]` entry instead (already
  surfaced in the admin UI via `EtsyProductPanel.tsx`'s existing notice banner).
  Only pushes: **Material**, **Gold solidity/purity** (Gold items only), and a
  **length-equivalent property** (Bracelet/Necklace length, Small jewelry
  length for Earrings/Brooch, or the generic Length property for everything
  else). Deliberately never guesses Gemstone, Bracelet/Pendant width,
  Adjustable, Closure, Ring size, or Watch band material — none has a source
  column anywhere in the schema.
- **Generalized across every product type per the owner's explicit request**
  ("apply to any product type, including sterling categories like spoons"):
  fetched `getPropertiesByTaxonomyId` live for all 10 unique pinned taxonomy
  ids and found the length-equivalent property is genuinely
  category-dependent (3 distinct property ids, 2 distinct non-Inches
  scale-id namespaces) and that Cufflinks/Coin/Bullion/**Silverware** have no
  Gold purity/solidity property at all — a Bracelet-only implementation
  would have silently mis-mapped every other category. Full reasoning:
  `project-docs/DECISIONS.md` 2026-07-08 (session 3).
- **New client capability:** `next-app/src/lib/etsy/client.ts` gained
  `formUrlEncoded` support on `etsyFetch` (this operation's spec declares
  ONLY `application/x-www-form-urlencoded`, not JSON) and a new
  `updateListingProperty()` call.
- **Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass. **69 unit tests pass** (up from 56) — new
  `describe('mapProperties', ...)` block in `mapping.test.ts` covers every
  pinned product type including the explicitly-requested Silverware/spoon
  case, plus the never-guess list and the vermeil edge case.
- **🟡 Not yet verified live — one detail needs a real click to confirm.**
  Materials/Gold solidity/Gold purity are fully enumerated (zero ambiguity,
  low risk). The length-equivalent property is scale-based with no
  enumerated values, so the exact `value_ids` wire format for it is a
  best-informed guess from the spec's wording, not confirmed against a real
  response (a sandboxed attempt to test this directly via a decrypted-token
  script was correctly blocked — that bypasses the real app's request path,
  so it needs a real logged-in click instead). **Owner action:** click **Sync
  Updates** on the bracelet (`heavy-italian-14k-yellow-gold-cuban-link-bracelet-53-91g-21`,
  already a draft on Etsy) or any product from `/admin`. Since every property
  push is non-blocking, this is low-risk either way: success shows the normal
  "Synced" notice with no property warning; a wrong Length guess shows
  `Category property <id> skipped — <Etsy's real error>` in the notice
  banner, which pinpoints exactly what to fix next. Report back whichever
  happens.

## 2026-07-08 (milestone) -- Etsy sync: first live OAuth connection verified end-to-end

Owner clicked **Connect Etsy** in `/admin/settings` (local dev) and it
worked cleanly on the first real attempt. Verified directly against the live
Supabase data (service-role REST query, not just "no error shown in
browser"): `etsy_connection.status = 'connected'`, real Etsy `shop_id`
(`11326431`, shop name "RugsAnonymous" — **owner should confirm this is the
intended shop** if they have more than one), `scopes` matches the 5
requested exactly, `access_token_enc`/`refresh_token_enc` are properly
AES-256-GCM encrypted (3-part ciphertext, not bare tokens),
`access_token_expires_at` is +1h from connect (matches Etsy's token
lifetime), `etsy_oauth_states` correctly emptied (single-use row consumed),
and `etsy_sync_log` shows exactly one clean `connect`/`ok` row. This is the
first fully-verified item on `etsy-sync-plan/14-verification-checklist.md`'s
Phase 1 list (item 1, now checked off) — confirms the auth-format/API-host
fixes from earlier this session work end-to-end, not just in theory.

**Next:** pick shipping profile / return policy / readiness state defaults
in the Settings panel (checklist item 3), then a dry-run preview on a few
real products (item 4) before attempting a first real draft publish.

## 2026-07-08 (final, confirmed) -- Etsy sync: supabase/etsy-sync.sql ran successfully live

Owner re-ran the corrected migration and confirmed all 5 tables
(`etsy_connection`, `etsy_oauth_states`, `etsy_listings`,
`etsy_listing_images`, `etsy_sync_log`) were created. `etsy-sync-plan/OWNER-SETUP.md`
step 1 is done. Next: click **Connect Etsy** in `/admin/settings` (local dev
env vars are already set in `next-app/.env.local`) to test the OAuth
round-trip — the first real end-to-end write-side test of this feature.

## 2026-07-08 (final) -- Etsy sync: fixed products.id type bug (text, not uuid) hit while running the live migration

Owner ran `supabase/etsy-sync.sql` for real and hit a live error:
`products.id` is `text`, not `uuid` (never directly verified against
`supabase/products.sql` before — inferred incorrectly from the TypeScript
type and other tables' conventions). Fixed all 3 `product_id` columns
(`etsy_listings`, `etsy_listing_images`, `etsy_sync_log`) plus the
queue-claim RPC's return type. The script is idempotent, so re-running it
picks up cleanly from wherever it stopped. Also added a manual per-product
Etsy category override feature (search all real Etsy categories and pick
one, overriding the automatic guess) after the owner spotted that Etsy's
"Rings" category list includes a plain "Bands" option my automated
`ETSY_TAXONOMY_MAP` guess had missed. Full detail:
`project-docs/DECISIONS.md` 2026-07-08 "final" and "latest" entries.

## 2026-07-08 (latest, fourth) -- Etsy sync: taxonomy IDs pinned via a real live call — the biggest remaining blocker is resolved

With the auth fixes confirmed (previous entry), the owner authorized a retry;
`GET seller-taxonomy/nodes` succeeded live (3065 nodes). All 12
`ETSY_TAXONOMY_MAP` entries in `next-app/src/lib/etsy/mapping.ts` are now
pinned to real IDs (6 exact matches, 6 flagged `approximate: true` where
Etsy has no generic leaf for that product type — e.g. no plain "chain
necklace" or "bullion" category exists at all). Pre-flight no longer blocks
every product on this. Full reasoning per approximate pick:
`project-docs/DECISIONS.md` 2026-07-08 (latest). `npx tsc --noEmit`,
`npm run lint`, `npm run build`, 48 unit tests all still pass. Still not
verified: whether Etsy's `createDraftListing` actually accepts each pinned
ID (first real publish attempt will confirm) — everything past the taxonomy
fetch itself (OAuth connect, real draft/image/inventory writes) remains
unexercised live.

## 2026-07-08 (latest, third) -- Etsy sync: fixed two real auth bugs (x-api-key format, API host)

Owner supplied real Etsy credentials plus a full local copy of the OpenAPI
spec (the earlier in-session web fetch had silently truncated). Testing the
credentials surfaced that **every** Etsy API call in the previous pass would
have failed: the `x-api-key` header must be `keystring:shared_secret`
(confirmed from the spec's own text), not the keystring alone, and the API
host is `openapi.etsy.com`, not `api.etsy.com`. Both fixed in
`next-app/src/lib/etsy/client.ts`/`auth.ts`; **`ETSY_SHARED_SECRET` is now
required from day one**, not Phase-3-only — see the updated
`etsy-sync-plan/OWNER-SETUP.md`. Also resolved 2 of the 4 remaining
`TODO(etsy-verify)` items against the full spec (readiness-state endpoint
path confirmed correct, just had wrong response field names — fixed; image
re-rank confirmed to have no cheaper path than delete+re-upload). Only image
upload size/format caps and rate-limit header names remain unresolved (not in
the spec at all). `npx tsc --noEmit` / `npm run lint` / `npm run build` /
48 unit tests all still pass. **Not yet re-verified live** — see
`project-docs/DECISIONS.md` 2026-07-08 "even later" for full detail.

## 2026-07-08 (latest, second) -- 🔴 HANDOFF — Etsy sync built (Phase 1 + Phase 2 code-complete, unverified live)

Implemented the Etsy sync feature end to end per `etsy-sync-plan/BUILD-PROMPT.md`,
following the 17-doc plan in `etsy-sync-plan/` as source of truth. **Full owner
checklist is `etsy-sync-plan/OWNER-SETUP.md` — read that before doing anything
live.** Summary here; do not duplicate the checklist in this file.

- **Built:** `next-app/src/lib/etsy/{client,auth,mapping,images,sync,store}.ts`,
  13 admin route handlers under `/api/admin/etsy/*` (Phase 3's
  `/api/webhooks/etsy` deliberately NOT built, per scope), the Etsy Sync
  settings panel (`EtsySettingsPanel.tsx`, composed into `/admin/settings`),
  a per-product Etsy status chip + drawer section (`EtsyProductPanel.tsx` in
  `AdminShell.tsx`), and a bulk "Sync All to Etsy" modal
  (`EtsyBulkSyncModal.tsx`) with a free pre-flight-summary route. Phase 2
  auto-delist/relist is wired into the existing revalidation chokepoints
  (`adminRevalidateProduct(s)` in `app/actions/admin-products.ts`, PayPal
  `capture-order`, and the PayPal webhook) rather than a new "who changes
  product status" audit, exactly as the plan intended.
- **SQL migration written, NOT run:** `supabase/etsy-sync.sql` (5 tables:
  `etsy_connection`, `etsy_oauth_states`, `etsy_listings`,
  `etsy_listing_images`, `etsy_sync_log`, all RLS-enabled/service-role-only,
  plus a `claim_next_pending_etsy_listing()` atomic-queue-claim RPC for Phase
  2's bulk drain). **This is the first manual owner step — see OWNER-SETUP.md.**
- **New dependencies:** `sharp` (WebP→JPEG transcode; was already a transitive
  dep, now explicit) and `vitest` (this project had no test runner before —
  added `npm run test` / `next-app/vitest.config.ts`).
- **Build-time resolutions (live OpenAPI spec pulled 2026-07-08):** the
  `when_made` enum is now **confirmed** verbatim from the live spec (19
  values, `mapping.ts`) — more precise than the plan's guess. Four items the
  spec fetch could **not** resolve (truncated response) are pinned with
  `TODO(etsy-verify)` and best-guess defaults: image upload size/format caps,
  rate-limit header names, the readiness-state list endpoint path, and
  whether image re-rank needs re-upload. **Taxonomy leaf IDs are deliberately
  left unpinned (`null`)** in `ETSY_TAXONOMY_MAP` — they require a live,
  authenticated `getSellerTaxonomyNodes` call with no `ETSY_API_KEY` available
  in this environment; pre-flight correctly **blocks every product** until a
  developer pins real IDs post-connect. Full list + reasoning:
  `etsy-sync-plan/OWNER-SETUP.md` and `project-docs/features/etsy-sync.md`.
- **Also found/fixed while building:** `mapping.ts`'s vintage-cutoff-year math
  used local-timezone `getFullYear()`, which could drift the 20-year cutoff by
  a year depending on server timezone vs UTC near a year boundary — switched
  to `getUTCFullYear()` (caught by a unit test).
- **Verification:** `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass from `next-app/`. **48 new unit tests pass** (`npm run
  test` — `lib/etsy/__tests__/{mapping,images,sync}.test.ts`): title/tag/
  materials mapping, every `when_made` bucket incl. boundary years and the
  1990s fallback, price flattening (both modes, 8% markup, <$0.20 rejection),
  the private-field allowlist guarantee, WebP↔JPEG transcode (with/without
  alpha, generated in-memory — no binary fixtures committed), image-diff
  planning, price-push threshold logic, and the bulk-drain orchestration loop.
  **Not verified:** anything requiring a live Etsy connection (OAuth
  round-trip, real draft/image/inventory calls, the scheduled price push, the
  Postgres `FOR UPDATE SKIP LOCKED` queue-claim guarantee against a live DB) —
  there is no Etsy sandbox, and this environment has no `ETSY_API_KEY`/tokens.
  Browser UI verification was also not possible this session: the local dev
  server 404s on **every** route right now, including pre-existing pages
  never touched by this work (confirmed by hitting `/` and `/en/about`) — a
  pre-existing local dev-environment condition, not caused by this change.
- **Pending manual steps (owner):** run `supabase/etsy-sync.sql`; set Netlify
  env vars; complete Etsy shop setup (shipping/return/readiness, confirm
  Domestic & Global Pricing off); register redirect URIs; click **Connect
  Etsy**; a developer must then pin real taxonomy IDs and spot-check the four
  `TODO(etsy-verify)` items against the live API. Full ordered steps:
  `etsy-sync-plan/OWNER-SETUP.md`.

## 2026-07-08 (latest) -- Admin carousel: editable visible-count fields + removed show-price toggle

- **Carousel admin "cards visible at once" (desktop/mobile) could not be cleared**
  to type a new value — live clamping snapped back (often to 12). Inputs are now
  plain text you can fully clear; range validation (`3`–`12`) runs on Save with a
  notice if out of range. Removed non-functional **Show price on carousel**
  checkbox; saves always persist `show_price: false`. `npm run lint` pass.

## 2026-07-07 -- Shop list view blank-on-load fixed (CustomerReveal skip)

- **`/shop?view=list` loaded as a blank white page** (header only) until the
  user scrolled. Root cause: site-wide `CustomerReveal` marked the shop content
  wrapper `data-customer-reveal="pending"` (`opacity: 0`) and waited for all 24
  lazy list thumbnails to finish loading. Gallery view was already exempt via
  `.shop-product-grid`; list view was not. Lazy images often do not start until
  scroll, so the reveal never completed. Fix: skip catalog containers with
  `.shop-product-list` (mirror gallery) and exclude `.shop-list-row` /
  `.shop-entry-reveal` from CustomerReveal — the shop page has its own entry
  animations. Verified in dev: direct load + gallery→list toggle; `npm run lint`
  + `npm run build` pass.

## 2026-07-07 -- Icon font 404 regression fixed (v357 alias restored)

- **Icons broke after hard refresh** because the browser was still requesting
  the deleted `material-symbols-subset-v357.woff2` (404 in dev-server logs).
  `font-display: block` then falls back to ligature names as text. Restored
  v357 as an identical alias of the improved v358 subset (both URLs 200); subset
  regen now always emits both files and keeps the full component alphabet.
  Reload the page — no special hard-refresh needed.

## 2026-07-07 -- Icon subset v358 (fixes drag_indicator / multiline JSX icons)

- **Icons showing ligature names again (e.g. `drag_indicator` in admin table).**
  The v357 subset missed icons whose names are multiline JSX text inside
  `material-symbols-outlined` spans — only quoted-string extraction was used.
  Regenerated subset as `material-symbols-subset-v358.woff2` (58KB) with a
  proper scanner + GSUB ligature resolver (`scripts/regenerate-material-symbols-
  subset.py`). Superset of v357 coverage; `drag_indicator` and peers now resolve.
  `@font-face` + preload bumped to v358. `npm run build` + `lint` pass.

## 2026-07-07 -- Customer special pricing: "percentage over spot" override mode

- **The trade-in ("Own gold or silver?… pay as little as ___") override now
  supports a percentage over spot, not just a flat amount.** Admin add/edit shows
  an **Override Type** select when the override is enabled: *Fixed amount ($)*
  (unchanged) or *Percentage over spot*, which advertises
  `meltValue * (1 + percent/100)` and auto-tracks live spot (with a live dollar
  preview in the form). New DB columns `special_price_override_mode`
  (`'amount'` default) + `special_price_override_percent`; resolution centralized
  in `resolveSpecialTradeInPrice(product, meltValue)` (`types/product.ts`), used
  by `shop/[id]/page.tsx`. Existing rows stay on flat-amount behavior.
  **Pending manual step: run `supabase/product-special-price-percent-2026-07.sql`
  in Supabase** (adds the two columns + grants; storefront query column-lists them
  and falls back gracefully if not yet applied). `npm run build` + `lint` pass.

## 2026-07-07 -- First-paint + homepage boot splash + abandoned-checkout cleanup + admin Qty column

- **Faster first paint (esp. mobile) + fixed icon-as-text bug: Material Symbols
  is now self-hosted AND subset.** The icon font was loaded via a render-blocking
  third-party `<link>` to `fonts.googleapis.com` in `[locale]/layout.tsx`.
  Replaced with an inline `@font-face` in `globals.css` pointing at a committed
  same-origin **subset** woff2
  (`public/assets/fonts/material-symbols-subset-v357.woff2`, ~65KB, down from
  2.33MB) that keeps the FILL/opsz/wght axes; `preload`ed in the layout `<head>`.
  This also fixed icons briefly rendering as their ligature names ("shopping_bag",
  etc.) — that was the 2.33MB font exceeding `font-display: block`'s window; the
  65KB subset loads well inside it. Both Google preconnects removed; body fonts
  were already self-hosted by `next/font`, so no runtime Google Fonts connection
  remains. Regeneration steps + the ligature-subset subtlety are in DECISIONS.md.
  Verified: subset served `200 font/woff2` (66,204 bytes), preload in HTML, old
  2.33MB URL 404s, all 156 used icons resolve in the subset.

- **Homepage loading screen now covers cold mobile/tablet loads.** The branded
  `SiteLoadingScreen` is a Suspense fallback (`(home)/loading.tsx`) that only
  fires on soft navigations; because the homepage is statically prerendered, a
  fresh mobile/tablet hard load served the static HTML and never showed it,
  leaving a blank during TTFB + the render-blocking Material Symbols stylesheet.
  New server-rendered `HomeBootSplash` (`components/home/HomeBootSplash.tsx`)
  paints the same branded splash on the first frame across all devices and fades
  out on hydration, with a CSS `home-boot-splash-failsafe` keyframe (6s; 1.2s
  under reduced-motion) so it never sticks. Homepage-scoped and additive.
  (The initial pre-paint lag itself is TTFB/Netlify cold start + the intentional
  render-blocking Material Symbols `display=block` stylesheet — documented, not
  changed here.)

Earlier the same day:

Two small follow-ups after the Quantity feature:

- **Abandoned PayPal checkouts no longer linger as live orders.** Because the
  "no-reservation" flow writes the order row (`unpaid`/`pending`/`open`) at
  PayPal-order creation — *before* the buyer approves — closing the PayPal
  window used to leave that order sitting in the admin as an open sale. New
  route **`/api/paypal/cancel-order`** soft-cancels it, and
  `PayPalCheckoutButton`'s `onCancel` now calls it (fire-and-forget, `keepalive`)
  with the created order id. The cancel is **non-destructive and reversible**:
  it only sets `order_status`/`fulfillment_status` to `cancelled` and never
  touches `payment_status`, so a delayed real capture (client or webhook) still
  finalizes the sale and flips it back to `completed`. The create-order **reuse**
  path resets a resumed order back to `open`/`pending`, so retrying after a
  cancel doesn't leave it stuck as `cancelled`. Guarded against paid/captured
  orders and rate-limited (60/hr per IP). Note: a hard browser/tab kill may skip
  `onCancel`; those rare stragglers still show as `open` and can be trashed in
  the admin. Any order abandoned **before** this fix stays `open` and can be
  deleted from the admin Orders list.
- **Admin master product table** gained a sortable **Qty** column (between
  Status and the row actions), red when stock is `0`.

## 2026-07-07 -- Per-listing Quantity / stock count — Phase 2 (buyer multi-unit purchase + atomic stock decrement) (?? SQL migration pending)

Completed the second half of the Quantity feature: a buyer can now purchase
more than one unit of the same listing, and stock is decremented atomically at
PayPal capture (a product flips to `sold` only when its remaining quantity
reaches `0`). This replaces the old one-of-a-kind-only capture logic.

- **`order_items.quantity`** (integer, default `1`, `check (quantity >= 1)`)
  stores how many units of each line were bought. `price_snapshot` remains the
  **unit** price; every line total is `price_snapshot * quantity`.
- **Cart model (`CartContext`):** `CartItem` gained `purchaseQuantity` (how
  many the buyer wants, distinct from `stockQuantity` = how many exist).
  `add(item, quantity?)` now merges/increments an existing line (capped at
  stock) instead of no-opping; new `setQuantity(id, qty)` clamps to
  `1..stockQuantity`. Cart `count` (header badge) is now total **units**.
  `normalizeCartItem()` backfills/clamps `purchaseQuantity` so stale
  localStorage carts and over-stock values self-correct.
- **Quantity stepper UI** (shared `QuantityStepper` exported from
  `OrderSummary.tsx`): on the product detail page (`CartButton` detail variant),
  in the cart drawer per line, and on the checkout order summary — each capped
  at live stock, with per-line subtotals. Only shows when `stockQuantity > 1`,
  so the one-of-a-kind experience is visually unchanged.
- **Authoritative pricing (`checkout-pricing.ts`):** `buildOrderDraft` now
  accepts quantity-aware lines (`{ productId, quantity }[]`, still tolerant of a
  legacy `string[]`), rejects any line whose quantity exceeds live stock, and
  computes subtotal as `sum(unit * quantity)`. `CheckoutOrderItem` carries
  `quantity`.
- **Checkout payload + routes:** `CheckoutClient` sends
  `items: [{ id, quantity }]`; the create-order route parses it (legacy
  `productIds` still accepted), the reuse-order guard now matches on product+
  quantity, and PayPal line items send the real per-line quantity.
- **Atomic decrement (SQL):** rewrote `capture_paypal_order` to, under the
  existing per-product row lock, verify sufficient remaining stock for every
  line and then decrement `products.quantity` (flip to `sold` at 0), and
  `create_paypal_order` to store per-line quantity + reject over-stock at order
  creation. The item-conflict path now fires on insufficient remaining stock.
- **Display surfaces:** order detail (admin), printable order, invoice/receipt
  emails, and the customer account order views all show `Qty N × unit` and the
  correct line total; line-discount ceilings use the line subtotal, not the
  unit price. The admin manual-order form (`OrdersPanel`) has a per-product
  quantity input (capped at stock) that feeds the same math.
- **?? MANUAL STEP — run `supabase/checkout-quantity-2026-07.sql` in Supabase**
  (adds `order_items.quantity` + rewrites the two PayPal RPCs). Run it AFTER
  `product-quantity-2026-07.sql` (Phase 1). The canonical
  `supabase/no-reservation-checkout.sql` and `supabase/sales-workflow.sql` were
  updated to match for fresh installs. Every order-reading page retries without
  the column pre-migration, so nothing breaks before it runs.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), and
  `npm run build` all pass. Not yet exercised live (needs both SQL migrations
  run first) — see TASKS.md.

## 2026-07-07 (earlier) -- Per-listing Quantity / stock count — Phase 1 (field, admin, AI autofill, storefront gating) (?? SQL migration pending)

Added a real stock count to listings instead of treating every product as
strictly one-of-a-kind. New `products.quantity` column (integer, default `1`,
`check (quantity >= 0)`). This is **Phase 1** of a two-phase plan (user
explicitly chose to sequence it this way): the field itself, admin editing, AI
listing-assistant autofill, and storefront purchasability gating/display ship
now; letting a buyer choose a quantity > 1 in the cart/checkout and
decrementing stock atomically in the PayPal capture RPC is deliberately
deferred to a focused follow-up (that touches the live payment-capture SQL and
checkout math, which warrants its own isolated pass).

- **`isProductPurchasable(status, quantity?)` in `types/product.ts`** now takes
  an optional second `quantity` argument (backward-compatible — existing call
  sites that only pass `status` are unaffected, since a missing quantity
  normalizes to `1` via the new `normalizeProductQuantity()` helper). A
  product is purchasable only when `status === 'available'` AND
  `quantity > 0`. Threaded the quantity argument through every call site that
  has it available: `ProductCard`, `ProductListRow`, `CartDrawer`, the shop
  list's purchasable-first sort, `checkout-pricing.ts#buildOrderDraft`'s
  server-side availability gate, and the admin `OrdersPanel`'s
  available-products filter.
- **`CartItem` gained `stockQuantity`** (units in stock for the product, not
  "how many are in the cart" — that concept doesn't exist yet, every cart line
  is still exactly one listing). Populated wherever a `CartItem` is built from
  a live product row (`ProductCard`, `ProductListRow`, `shop/[id]/page.tsx`);
  `CartButton`'s add-to-cart gate now checks it. The wishlist's stored
  snapshot doesn't carry live stock data (pre-existing limitation, same as its
  existing `status` staleness) so its `CartButton` falls back to the
  always-purchasable default, unchanged from before.
- **Admin New Item / Edit Item form (`AdminShell.tsx`):** new **Quantity**
  number input next to Inventory #, defaulting to 1. Save-time auto-sync is
  one-directional only: saving a listing down to `0` flips `status` from
  `available` to `sold` automatically (so the storefront/admin table reflect
  reality immediately); restocking a `sold` item back above `0` does **not**
  auto-flip status back to `available` — an admin who intentionally marked
  something Sold shouldn't have that silently reversed, they flip Status back
  explicitly. Follows the existing optional-column retry-fallback pattern
  (`OPTIONAL_PRODUCT_COLUMNS`) so saves keep working pre-migration.
- **AI listing assistant:** new `quantity` field in `ai-product-schema.ts`
  (`cleanQuantity()`: integer 1–500, else null) and a new prompt paragraph in
  `ai-product-provider.ts` — the model leaves it null (default: 1) unless the
  seller explicitly states multiple identical units ("I have 3 of these"),
  and is explicitly told a matched pair (e.g. earrings) is one listing with
  quantity 1, not quantity 2. Bumped `PROMPT_VERSION` to
  `product-listing-extraction-v13`.
- **Storefront display:** the shop card badge, the list-view status text, and
  the product detail page now show "N in stock" / "N units in stock" instead
  of the generic "Available" copy whenever `quantity > 1`; unchanged for the
  common one-of-a-kind case.
- **?? MANUAL STEP — run `supabase/product-quantity-2026-07.sql` in Supabase**
  (adds the column + `check (quantity >= 0)` constraint + the anon/
  authenticated column grant needed because the 2026-07 hardening scripts
  replaced blanket `SELECT` on `public.products` with a column allow-list).
  Also updated the canonical `supabase/products.sql` install script. Until the
  migration runs, every read path retries without the column and defaults
  `quantity` to `1` (existing one-of-a-kind behavior), so nothing breaks
  pre-migration.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), and
  `npm run build` all pass. Not yet exercised live (needs the SQL migration
  run first) — see TASKS.md.

## 2026-07-07 (a bit earlier) -- Admin override for the product-page "customer special pricing" line

- Added a per-item manual override for the "Own gold or silver? Put it toward
  this piece and pay as little as ___" trade-in line on `/shop/[id]`. That
  line previously always mirrored the computed scrap/melt value; an admin can
  now check **"Override customer special pricing"** in the edit product form
  and enter a custom dollar amount that replaces just that line's number. The
  **Scrap value / Based on spot box** above it is unaffected either way — it
  always reflects the real computed value.
- New columns: `products.special_price_override_enabled` (boolean, default
  `false`) and `products.special_price_override_amount` (numeric). New
  helper `getSpecialPriceOverrideAmount()` in `types/product.ts` treats an
  enabled-but-empty/zero/negative amount as "no override" (falls back to the
  computed scrap value rather than showing $0). Admin form validates that an
  amount is entered whenever the checkbox is on.
- Follows the same optional-column fallback pattern as `show_spot_price`:
  `shop/[id]/page.tsx`'s product fetch retries without the two new columns if
  they don't exist yet on an un-migrated database, so the page (and the
  trade-in line, via its scrap-value fallback) keeps working before the SQL
  migration runs. Verified live against the current (un-migrated) database —
  `/shop/18k-heraldic-cross-band-ring-01` renders 200 with the trade-in line
  intact.
- **Needs a manual step:** run `supabase/product-special-price-override-2026-07.sql`
  in the live Supabase project to add the columns and grant anon/authenticated
  SELECT on them (same reasoning as the `show_spot_price` grant — see that
  file's comments). Added to TASKS.md.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass. Confirmed the product page still renders correctly today
  (pre-migration) via a live local request.

## 2026-07-07 (a bit earlier) -- Home hero loading spinner + fixed a React 19 console error on /shop

- **Home hero loading spinner:** `HomeHero.tsx` fills the blank spot before
  the carousel/headline content is ready with a small centered spinner, tied
  to the existing `heroReady` state (appears with no flash on first paint,
  disappears the instant content is ready, hidden under
  `prefers-reduced-motion`). Sized 4.5rem per follow-up feedback (was
  2.25rem).
- **Fixed a React 19 dev console error on `/shop`** ("Encountered a script
  tag while rendering React component...") caused by the blocking inline
  `<script>` that skips the shop hero's entry-reveal replay on repeat visits.
  This is a known, currently-unresolved React 19 limitation (any literal
  `<script>` JSX element triggers it on hydration, even correct/necessary
  ones with no first-party replacement API yet — see `facebook/react#34008`,
  `shadcn-ui/ui#10104`). Added `components/shop/ScriptTagWarningGuard.tsx`, a
  tiny client component that filters only that exact known-false-positive
  message text (dev-only), leaving all other console output untouched.
  Verified live: the script itself still runs correctly, and `console.error`
  is confirmed patched with the expected filter logic. See CHANGELOG.md for
  the full writeup.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass for both changes.

## 2026-07-07 (a bit earlier) -- Fixed the recurring "stuck/unresponsive dev server" issue (Turbopack cache vs. OneDrive)

Root-caused and fixed the intermittent dev-server corruption noted in earlier
sessions (2026-07-05 "Dev-infra" note; also hit again at the start of this
session — two orphaned `next dev` processes were holding ports 3000/3001 but
no longer answering requests). Confirmed against a live upstream Next.js/
Turbopack bug (GitHub issue vercel/next.js#95495): the dev cache
(`.next/dev/cache/turbopack`) is a RocksDB-style store that corrupts on
Windows when another process locks it mid-write, and OneDrive's background
sync of this project folder is exactly that. The real engine fix only ships
starting in Next.js `16.3` canary/preview (merged 2026-07-06) — not stable,
not something to adopt on this project's pinned `16.2.9` yet.

- **Fix:** `next-app/.next` is now an **NTFS directory junction** pointing to
  `%LOCALAPPDATA%\dev-cache\NaplesEstateJewelry\next-app\.next` (outside the
  OneDrive-synced tree — OneDrive does not sync junctions), with a matching
  **`node_modules` junction** alongside it (pointing back to the real
  `next-app/node_modules`) — required because Node resolves the relocated
  chunk files to their real path before its `node_modules` upward search, so
  without the second junction every route 500'd
  (`Cannot find module 'react/jsx-runtime'`). Both are local-machine-only
  filesystem state; `.next`/`node_modules` are already `.gitignore`d, so this
  has zero effect on the repo copy or the Netlify build. See DECISIONS.md
  2026-07-07 (later) for the full writeup, including the gotcha.
- **New `predev` safety net:** `next-app/scripts/dev-cache-guard.mjs`
  (wired via `package.json`'s new `"predev"` script) clears the Turbopack
  cache subfolder automatically if it's ever left in the "bookkeeping files
  only, no real data" shape a failed commit leaves behind — so any future lock
  contention self-heals on the next `npm run dev` instead of producing sticky
  500s for the rest of a session.
- Verification: killed the two stuck orphaned dev-server processes, applied
  the junctions, confirmed `npm run dev` starts with no cache-deleted warning
  and `GET /` / `GET /shop` both return `200` live, confirmed real `.sst`/
  `.meta` cache files are landing in the relocated folder (not just empty
  bookkeeping files). `npx tsc --noEmit`, `npm run lint` (0 problems), and
  `npm run build` all pass with the `package.json`/new script in place.
- **Note for future sessions on this machine:** if `next-app/.next` or
  `next-app/node_modules` ever look empty/0-byte in a plain file browser, it's
  because they're junctions to `%LOCALAPPDATA%\dev-cache\NaplesEstateJewelry\next-app\`
  — that's expected, not a bug. Don't delete or "fix" the junctions; if a
  cache-related error ever needs a manual clear, delete the *target* content
  under `%LOCALAPPDATA%\dev-cache\...` (or just the `.next\dev\cache\turbopack`
  subfolder through the junction, same as before). This setup is per-machine —
  it doesn't need to be (and isn't) replicated in the repo or on Netlify.

## 2026-07-07 (a bit earlier) -- Shop page graceful-loading audit: full top-down entry cascade + per-card reveal no longer replays its multi-second wave on reload

Follow-up audit of the whole `/shop` page's loading experience (not just the
hero) per the request to make sure everything "fades in from the top down"
and reloads gracefully every time, while keeping the existing skeleton
loader and inter-page spinner.

- **Extended the entry-reveal cascade to every section, top to bottom.**
  Previously only the hero (`shop-entry-reveal-hero`, 80ms delay) and the
  filter sidebar (was `shop-entry-reveal-filters`, 260ms) faded in; the
  mobile spot-price row, the desktop standalone year filter, and the whole
  results panel (toolbar + product grid + pagination) just popped in with no
  transition at all. Added the same `shop-entry-reveal` treatment (gated on
  `isModern`, same as the hero) to all of them, with two new delay tiers in
  `next-app/src/app/[locale]/shop/(list)/page.tsx`:
  `shop-entry-reveal-secondary` (200ms — mobile spot-price row + desktop
  standalone year filter, whichever is visible at that breakpoint) and
  `shop-entry-reveal-results` (320ms — filter sidebar + results panel
  together, since they sit side by side on desktop and shouldn't stagger
  against each other). Net effect: hero -> spot/year row -> sidebar+grid,
  a genuine top-down wave instead of a two-piece reveal with an abrupt grid
  pop-in beneath it. All of it is still skipped on a repeat visit via the
  existing `shop-repeat-visit` sessionStorage marker (generic selector, so
  it automatically covers the newly-tagged elements too — no script changes
  needed).
- **Fixed a second, grid-level "reload stutter."** `ProductCard.tsx` already
  had its own sophisticated per-card reveal (wait for the real `<img>` to
  finish loading via `requestAnimationFrame` polling of `.complete`, then a
  row/column-based stagger delay — `revealRow * (columns * 90 + 140) +
  revealColumn * 90`) that runs on every mount. For a 4-column, 24-item page
  that's up to ~2.7s of artificial delay for the last row, even though a
  reload has every image already in the browser cache and ready instantly —
  effectively a *second* stutter stacked on top of the hero's (independent
  of it, and not fixed by the earlier hero-only patch). Reused the same
  `shop-repeat-visit` marker: the per-card reveal effect now checks
  `document.querySelector('main')?.classList.contains('shop-repeat-visit')`
  and zeroes out the stagger delay when true, so repeat-visit cards still
  fade in individually via the existing CSS `transition` (snappy, no pop)
  the instant each one's image is ready, instead of riding out the full wave
  again. First-time-this-session loads (and any filter/sort/page change,
  which doesn't set the marker) keep the full cascading reveal unchanged.
- **Confirmed already-graceful pieces stay intact:** the route's
  `loading.tsx` skeleton (layout-matched skeleton cards + header bar,
  streamed instantly on both a fresh navigation and a hard reload while the
  server component awaits the catalog query) and `ShopLoadingOverlay` (the
  client-side spinner shown in `.shop-results-panel` during
  filter/sort/pagination transitions) were not touched — both already cover
  their respective loading phases correctly and compose fine with the wider
  entry cascade.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass (`next-app/`). Not re-verified live in-browser this pass —
  the local dev server/browser tooling was unresponsive during this session,
  so this still needs a manual smoke test (fresh `/shop` load → confirm the
  hero, spot/year row, and sidebar+grid arrive in that order top-down;
  reload → confirm nothing replays/stutters and cards are simply present).

## 2026-07-07 (just before) -- Shop hero "Don't just buy. Invest." no longer re-plays its entry animation on reload

The modern shop hero + filter sidebar have a staggered fade/blur/slide-in CSS
entry animation (`.shop-entry-reveal`, `shop-entry-reveal` keyframes,
`next-app/src/app/[locale]/shop/(list)/page.tsx`) that — since `/shop` is a
dynamic, server-rendered route — replayed from scratch on every single reload
or quick return, which read as a stutter each time rather than a one-time
welcome effect.

- Added a small blocking inline `<script>` right after `<main>` (only when
  `isModern`) that checks `sessionStorage` for a `shopHeroSeen` flag: unset ->
  set it and let the animation play normally (first visit this tab session);
  already set -> add a `shop-repeat-visit` class to the `<main>` element via
  `document.currentScript.parentElement`, which a new CSS rule uses to force
  `.shop-entry-reveal` straight to its end state (`opacity: 1; animation:
  none; transform: none; filter: none;` — mirrors the existing
  `prefers-reduced-motion` rule). Being a plain blocking `<script>` placed
  before the animated elements in document order, it mutates `<main>`'s class
  before the browser paints them, so there's no flash/flicker either way.
  `<main>` carries `suppressHydrationWarning` since this is an intentional
  out-of-band DOM mutation React's hydration isn't meant to reconcile against
  (the same sanctioned pattern libraries like `next-themes` use for
  pre-hydration `<html>` class tweaks).
- Scope is deliberately per-tab-session, not permanent: `sessionStorage`
  persists across reloads and back/forward navigation in the same tab (so a
  reload or "quickly come back to it" no longer stutters) but resets for a
  genuinely new tab/window, so first-time visitors still get the intended
  cascading reveal.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass. Tested live in-browser via CDP against a running dev
  server: confirmed a fresh session plays the animation
  (`animationName: "shop-entry-reveal"`, sets the sessionStorage flag), and
  that reloading the same tab afterward shows `<main>` gaining
  `shop-repeat-visit`, both the hero's and filter sidebar's
  `animationName` computing to `"none"`, and `opacity: 1` immediately — no
  flash, no error overlay, no hydration-warning badge in the Next.js dev
  toolbar.

## 2026-07-07 (a bit later) -- Local dev now reachable from other devices (LAN IP + Netlify Dev live tunnel)

Investigated how to test the app on `localhost` AND `<your-LAN-IP>:port` (e.g.
from a phone on the same Wi-Fi), plus whether Netlify could provide a public
test URL without deploying. `next dev` already binds `0.0.0.0` by default in
this Next.js version, but Next.js 15+/16 blocks cross-origin requests to dev
assets/HMR by default (`allowedDevOrigins`), which silently breaks the page
when loaded from anything other than `localhost`.

- Added `allowedDevOrigins: ['192.168.119.224', '192.168.119.*']` to
  `next-app/next.config.ts` (dev-only setting, no effect on production
  builds/deploys) — this machine's current LAN IP, plus a same-subnet
  wildcard as a hedge against the DHCP lease changing the last octet.
- Documented three testing tiers in `next-app/README.md` (new "Testing from
  another device" + "Testing via a public HTTPS tunnel" sections under
  Development): (1) plain LAN IP over HTTP — works for normal browsing, but
  is NOT a secure context, so the AI listing assistant's microphone
  (Web Speech API) can't be granted there, only `localhost` gets that
  exemption; (2) `next dev --experimental-https` for a self-signed HTTPS LAN
  cert when mic/camera testing from another device is needed; (3) Netlify
  Dev's `netlify dev --live` for a real HTTPS public tunnel
  (`https://<name>--<site>.netlify.live`) that proxies the local dev server —
  usable from any network (not just the same Wi-Fi), shareable, and exercises
  the actual `netlify.toml` redirects/headers, all without deploying/publishing
  anything. Netlify CLI isn't installed/linked yet in this project — the repo
  has no `.netlify/` folder — so first use requires `netlify login` +
  `netlify link` (documented in the README).
- Verification: started `next dev`, confirmed via CDP that the homepage
  loaded fully over `http://192.168.119.224:3001` (the port `next dev` picked
  since 3000 was occupied) with all 46 `/_next/*` resources fetched
  successfully and zero "Blocked cross-origin request" warnings in the server
  log — confirming `allowedDevOrigins` is wired correctly. `npx tsc --noEmit`,
  `npm run lint` (0 problems), `npm run build` all pass with the config
  change in place. Did not install/test the Netlify CLI live-tunnel flow live
  this session (no Netlify login credentials available in this environment).
- Note: `NEXT_PUBLIC_SITE_URL`/`SITE_URL` in `.env.local` are hardcoded to
  `https://naplesestatejewelry.co` — outbound emails (order invoices,
  marketing) generated during local testing will still link to the live
  production site, not the local/tunnel URL. This is expected/unchanged and
  doesn't affect in-browser testing.

## 2026-07-07 (a bit earlier) -- OG/Twitter preview image re-encoded lossy (1.77MB -> 268KB)

Per the user's request, re-encoded `next-app/public/assets/images/pages/og-preview.webp`
(the site-wide social-share preview image, added in an earlier session as a
**lossless** WebP) as a standard **lossy** WebP instead. Decoded the existing
lossless file (pixel-identical to the original PNG, which was already deleted)
and re-encoded with `sharp` at `{ quality: 88, effort: 6 }` — landed at
**267.7 KB** (down from 1,774,538 bytes), comfortably under the project's
300KB page-image guideline. Same filename/path/dimensions (1983×793), so no
change needed in `next-app/src/app/layout.tsx`.
- Verification: visually diffed the new lossy file against the original
  lossless version (both decoded back to PNG and viewed side by side) — no
  visible difference in the logo text, gold gradients, or the dark textured
  background at quality 88. `npx tsc --noEmit`, `npm run lint` (0 problems),
  `npm run build` all pass. No temp conversion/comparison scripts or backup
  files left behind.
- Pending: same as before — no live re-deploy/crawler cache-bust done yet;
  if this URL was already scraped by Facebook/X/etc. under the old (lossless)
  build, it may need a manual "scrape again" via each platform's debugger
  after the next deploy to pick up the smaller file.

## 2026-07-07 (just before) -- AI Listing Agent: place-name "brands" (e.g. Taxco) and agent-controlled "show spot/melt value"

Two refinements to the smart listing assistant (`next-app/src/lib/ai-product-provider.ts`
system prompt, `next-app/src/lib/ai-product-schema.ts` schema/coercion,
`next-app/src/components/admin/AdminShell.tsx` draft-apply wiring). Bumped
`PROMPT_VERSION` to `product-listing-extraction-v12`.

1. **Place-name trade identifiers now count as `brand`.** Previously `brand`
   was extracted strictly from a stated maker, logo, or maker stamp. The
   prompt now also recognizes well-known jewelry-making REGION/PLACE names as
   a brand-equivalent when marked/stamped or stated — the standing example is
   Mexican silver stamped/described as **"Taxco"** (bought and sold in the
   trade as "Taxco jewelry"/"Taxco silver" even though Taxco is a town, not a
   company). Same logic now applies to a handful of other similarly
   recognized place-based identifiers when marked or stated: Navajo/Zuni/Hopi
   for marked Native American silverwork, Bali for Balinese silver, Siam/Siam
   Sterling for vintage Thai niello silver. Explicitly excluded: a generic
   country-of-manufacture stamp with no distinct trade identity of its own
   (e.g. a plain "Italy"/"925 Italy" stamp on a mass-produced chain stays
   `brand: null` unless an actual maker mark/logo is also present) — this
   guards against the model over-applying the new rule to every
   country-stamped import chain.
2. **The AI can now set "Show spot / melt value on storefront" (`show_spot_price`)
   off during intake.** Added `show_spot_price: boolean | null` to
   `ProductAutofillFields` (`ai-product-schema.ts`: new field key, new
   `cleanBoolean()` coercer, wired into `coerceProductAutofill`) and to
   `AdminShell.tsx`'s `applyAiDraftToForm` (new `setField('show_spot_price', ...)`
   case) and `AI_PRODUCT_FIELD_LABELS` ("Show Spot/Melt Value"), plus a small
   `formatAiFieldValue()` helper so the AI-fields review panel prints
   "Shown"/"Hidden (item flagged not solid/priced by weight)" instead of the
   raw `true`/`false`. The prompt instructs the model to leave this field
   `null` (default: shown) unless the seller specifically says the item is
   **not priced by weight**, **not solid** (gold-filled/plated, vermeil, clad
   — vs. stated/marked solid 14K/18K/sterling), or **"weighted"** (the trade
   term for hollow sterling holloware filled with plaster/resin for
   stability, where gross weight overstates actual silver content) — never
   inferred from photos alone, only from what the seller states about
   construction/pricing basis.
   - Confirmed the "Show spot / melt value on storefront" checkbox (added in
     an earlier session) already renders identically on both the **new-item**
     and **edit-item** forms — they share the same `AdminShell.tsx` editor
     modal/state, so no separate new-item-only gap existed here; no UI
     addition was needed for that half of the request, only the AI wiring.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass. Not exercised against a live AI provider call this session (no
  new photos/transcript run through `/api/admin/ai-product-fill`) — the
  coercion path mirrors the existing, already-proven `cleanGender`/
  `cleanPriceMode` string-enum pattern, and `setField`'s null/empty-string
  skip check was confirmed to correctly pass through a literal `false`
  (`false !== null && false !== ''`) so the field only gets skipped when the
  model omits it, not when it deliberately returns `false`.
- Pending: no live smoke test of an actual AI generation run yet exercising a
  Taxco-marked photo or a "this one's weighted" transcript — recommended next
  real intake to confirm end-to-end before relying on it for a real listing.

## 2026-07-07 (earlier) -- Admin listing editor: fixed Product Type field clearing, mobile modal now edge-to-edge and footer-safe

Two related admin `AdminShell.tsx` product editor ("add item"/"edit item")
fixes:

1. **Product Type field couldn't be cleared to type a brand-new type.**
   Root cause was two-fold in `next-app/src/components/admin/AdminShell.tsx`
   and `next-app/src/components/admin/ComboboxInput.tsx`:
   - The field's `onChange` handler coerced an emptied value straight back to
     `'Other'` on every keystroke (`normalizeProductTypeValue(value) ?? 'Other'`),
     so the box could never actually go blank while editing — it now keeps a
     genuinely empty value empty while typing, and only the save path
     (`normalizedJewelryType = normalizeProductTypeValue(jewelryTypeInput) ?? 'Other'`,
     unchanged) still defaults a still-blank field to `'Other'` at save time.
   - The field was wrapped in `<ClearableField>`, whose clear button is
     absolutely-positioned over the right edge of whatever it wraps. That
     landed directly on top of `ComboboxInput`'s own built-in clear/toggle
     button and physically intercepted every click meant for it — confirmed via
     CDP (`Click intercepted by: <button class="clearable-field__button">`).
     Removed the redundant `ClearableField` wrapper; `ComboboxInput` is fully
     self-contained. Also reworked `ComboboxInput`'s own button to always show
     an immediate one-click "x" clear whenever a value is present (previously
     a two-step arm-then-clear dance where the "x" only appeared after a first
     click).
2. **Mobile viewport anchoring for the add/edit item modal.** In the
   `.product-editor-modal` and its overlay:
   - Sized to `h-svh` instead of `h-dvh` on mobile ("small viewport height" —
     the guaranteed-visible area with the browser's address bar/toolbar fully
     expanded — vs. the "dynamic" one that grows the instant the toolbar
     auto-hides). This means the modal footer's Save/Cancel/etc. buttons can
     never end up transiently covered by the browser chrome mid-animation.
   - Added `overflow-x-hidden`/`max-w-[100vw]` on the overlay, modal, and
     `.product-editor-body` as a hard guarantee against any horizontal scroll.
   - Added a body-scroll lock (`document.body.style.overflow = 'hidden'` +
     `overscrollBehavior: 'none'`) for as long as the modal is open, so the
     (much wider than viewport) products table underneath can't be
     panned/scrolled behind the fixed modal on touch devices.
   - Desktop (`md:`) sizing (`max-w-5xl`, `h-auto`) is unchanged.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass. Manually tested live at a 390×700 mobile viewport via CDP: typed
  "Ring" into Product Type, single-clicked its clear button, confirmed the
  field stayed blank and the full unfiltered option list reappeared, then
  typed a brand-new custom type ("Tie Bar") and confirmed it was accepted
  (and its conditional "Height" field appeared correctly). Confirmed
  `document.documentElement.scrollWidth === innerWidth` (no horizontal
  overflow) with 9 photos + all sections expanded, confirmed
  `document.body.style.overflow` locks to `hidden` while the modal is open
  and cleanly resets to `''` on close, and confirmed desktop sizing
  (`max-width: 1024px`, `height: auto`) is unaffected.
- Noted but out of scope: an intermittent React hydration-mismatch dev
  overlay warning tied to the admin header's live "Orders" unread-count badge
  (`AdminHeader.tsx`) — pre-existing, unrelated to these changes, not
  investigated further this session.

## 2026-07-07 (even earlier) -- New site-wide OG/Twitter card image

Replaced the default social-share preview image. User dropped `logo.png`
(1983×793 branded banner: watch, rings, chains, "NAPLES ESTATE JEWELRY —
BUY · SELL · TRADE") at the project root; converted it losslessly to WebP via
`sharp` (`{ lossless: true }`) and wired it up as the new default
`openGraph`/`twitter` image in `next-app/src/app/layout.tsx`, replacing the
old `trust.webp` fallback. Original PNG deleted per instructions; no PNG or
scratch conversion script left behind.

- New asset: `next-app/public/assets/images/pages/og-preview.webp` (1983×793,
  ~1.77MB). Note: this is noticeably larger than other page images because it's
  a **lossless** encode (as explicitly requested) of a highly-textured dark/
  grainy background — lossy WebP would get this well under 300KB if file size
  ever becomes a concern (this image is only ever fetched by link-preview
  crawlers/social platforms, not rendered inline on any page, so it doesn't
  affect Core Web Vitals).
- `next-app/src/app/layout.tsx`'s site-wide `openGraph.images` /
  `twitter.images` now point at `og-preview.webp` (with explicit
  `width`/`height` on the OG variant). This is the fallback used by every page
  except `/shop/[id]`, which still generates its own OG image per-product from
  that product's own photo (unchanged).
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems) pass; visually
  diffed the WebP output against the source PNG (re-decoded to PNG and viewed)
  and confirmed pixel-for-pixel identical, as expected for lossless.
- Pending: no live re-deploy/crawler cache-bust done yet — Facebook/X/etc.
  cache OG images by URL, so if this URL was ever previously scraped under the
  old build it may need a manual "scrape again" via each platform's debugger
  after deploy.

## 2026-07-07 (later still) -- Shop default per-page is now 24

Changed `shop/(list)/page.tsx`'s `DEFAULT_PER_PAGE` from `48` to `24` — a bare
`/shop` (or any filtered view) with no explicit `perPage` param now shows 24
items per page instead of 48. This also fixes a pre-existing mismatch:
`ShopPagination.tsx`'s "Per page" select already treated **24** as the implicit
default (it omits the `perPage` param entirely when 24 is chosen, to keep the
URL clean), even though the page's actual default was 48 — so choosing "24" from
the dropdown looked identical to leaving it at the (then-48) default until you
noticed the count. The two are now consistent.

- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass. Confirmed live: a bare `/shop` renders exactly 24 product cards, 3
  pages of pagination (up from 2 at 48/page), and the "Per page" select shows
  `24` selected by default.

## 2026-07-07 (later) -- Category toggle buttons (Jewelry & Watches / Sterling Silver) now deselect on re-click

The modern-layout sidebar's gold-gradient **Category** buttons (`Jewelry & Watches`
/ `Sterling Silver` — the `.modern-sidebar-gender-button` pills in `ShopFilters.tsx`)
previously always applied the clicked value even if it was already active. Clicking
the currently-active button now clears the category filter entirely (removes
`itemGroup` and its paired `metal`/`metalColor`/`metalType`/`purity` params) instead
of re-pinning the same value, so both buttons show unselected and the catalog
returns to showing every item type/metal.

- **`ShopFilters.tsx` (`updateItemGroupFilter`):** added an early branch — if
  `currentItemGroup === value` (the clicked button is already active), clear
  `itemGroup` + the metal/purity params it pins instead of setting them, then
  return early. Behavior when clicking the *other* (inactive) button is unchanged.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass. Confirmed live on the dev server: clicking **Sterling Silver** sets
  `?itemGroup=everything-else&metal=silver` and marks it active; clicking it again
  returns to bare `/shop` with neither button active; same round-trip verified for
  **Jewelry & Watches** (`?itemGroup=jewelry` → bare `/shop`).

## 2026-07-07 -- Shop filter/sort/pagination navigations now show a loading spinner

Added a lightweight spinner over the shop results panel so changing a filter, the
sort order, the gallery/list view, the year slider, or the per-page/page-number
pagination no longer looks "frozen" while the new page renders on the server.

- **New shared client module `components/shop/ShopNavigationProgress.tsx`:**
  `ShopNavigationProvider` (wraps the catalog section in `shop/(list)/page.tsx`)
  exposes a `push()` that runs `router.push` inside `useTransition`, so `isPending`
  reflects the real RSC round trip for a filter/sort/view/year/per-page change.
  Plain `<Link>` pagination (prev/page-number/next) isn't visible to that
  `useTransition`, so a small `LinkPendingBridge` (using Next's `useLinkStatus`)
  mirrors each pagination link's own pending state into the same shared context.
- **`ShopLoadingOverlay`** renders a small spinner centered over the product
  grid/toolbar/pagination area (`.shop-results-panel`, `position: relative`),
  debounced 150ms so an instant/prefetched navigation never flashes it, and
  disappears the instant the new content commits — no minimum show time.
- **Every filter/sort/view/year/pagination control now calls the shared `push()`**
  instead of its own `useRouter()` directly: `ShopFilters.tsx`, `ShopSortSelect.tsx`,
  `ShopViewToggle.tsx`, `ShopYearFilter.tsx`, `ShopPagination.tsx`. Behavior/URLs are
  unchanged — only the navigation call site moved.
- Same mechanism on desktop and mobile (mobile filter drawer, mobile sort select,
  and mobile pagination all route through the identical shared context); no
  device-specific code branch was needed.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass. Confirmed live on the dev server with CDP network throttling
  (900ms latency): the spinner appears ~150–200ms after a select/dropdown change
  or a pagination click and disappears the instant the new results land, on both
  a desktop (1280px) and a mobile (390px) viewport; an untouched fast/instant
  navigation never shows it.

## 2026-07-06 (even later) -- Shop filter dropdowns no longer self-narrow

Fixed the gallery filter dropdowns (Brand + the dynamic extra Item Type entries) so
picking a value never shrinks what else shows up in that same dropdown (or others)
on the next open — you could set Brand to "Taxco", then reopen the Brand dropdown
and only see "Taxco" + "All brands" instead of the full brand list, forcing a reset
back to "All" before picking a different brand.

- **Root cause:** `/shop`'s catalog read (`queryShopCatalog`) applies the visitor's
  active `status`/`purity`/`metalColor`/`metal`/`brand` filters at the **database**
  level for performance, and the Brand/Item-Type dropdown option lists were being
  computed from that *already-filtered* result set — so an active filter fed back
  into narrowing the very dropdowns used to change it.
- **Fix (`shop/(list)/page.tsx`):** facet option lists (`brandOptions`,
  `itemTypeOptions`) now come from a second, always-unfiltered catalog fetch (same
  `unstable_cache`-backed `loadShopCatalog`, called with every DB-level filter key
  null) instead of the visitor's filtered `collectionProducts`. When the visitor has
  no filters active, that's the exact same cache entry as the main read, so there's
  no extra DB round trip in the common case; filtered views add one cheap, shared
  (across all visitors) cached lookup for the unfiltered facet list.
- Every other dropdown (Item Type's static list, Link Type, Metal, Metal Color,
  Purity, Gender, Sort) was already a fixed/static option list not derived from the
  filtered product set, so they weren't affected by this bug and needed no change.
  Metal Color/Purity are still intentionally scoped by the selected Metal (gold vs
  silver — a structural pairing, not the reported self-narrowing bug), and
  Brand/Item-Type are still scoped by the Jewelry-vs-Sterling-Silver category tab,
  same as before.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build` all
  pass. Confirmed live on the dev server: `GET /shop?brand=Taxco` renders the Brand
  `<select>` with the full 16-brand list (not just Taxco + "All brands").

## 2026-07-06 (later) -- Per-item "Show spot/melt value" toggle (?? SQL migration pending)

Added a per-listing admin toggle so items that aren't 100% precious metal (mixed
metal, gemstones, plating…) don't show a misleading melt/scrap value on the
storefront. New `products.show_spot_price` boolean column, default `true` (every
existing listing keeps its current behavior).

- **Admin edit/New Item form:** new **"Show spot / melt value on storefront"**
  checkbox in the pricing section, with helper copy explaining when to turn it off.
  Carries through Clone and the AI/quick-fill draft merge unchanged (only touched by
  its own checkbox).
- **Storefront (`/shop/[id]`):** the "Scrap gold/silver value" + "Based on spot
  $/oz" callout box, and the paired "Own gold or silver? Put it toward this piece…"
  store-credit line, are now gated on `show_spot_price !== false`. When off (and the
  item still has weight+purity, so the box would otherwise have shown), the page
  shows a short note instead: *"This piece isn't 100% gold or silver, so spot
  pricing doesn't apply directly to this item"* (EN/ES). The actual selling price
  ("Your price") and its computation are unaffected — this only controls the melt/
  scrap-value disclosure, not pricing.
- Follows the existing optional-column fallback pattern (like `item_year`): if the
  live DB doesn't have the column yet, the product page and admin save both retry
  without it and default to `true` (current behavior), so nothing breaks pre-migration.
- **?? MANUAL STEP — run `supabase/product-show-spot-price-2026-07.sql` in Supabase.**
  Also updated the canonical `supabase/products.sql` install script (both the
  `create table` and the "add columns introduced after initial deploy" section) so a
  fresh install includes the column. **The migration must also `grant select
  (show_spot_price) on public.products to anon, authenticated`** — the 2026-07
  hardening scripts locked anon/authenticated SELECT to a static column list, so a
  new column isn't readable by the storefront until explicitly granted; the migration
  file includes this grant.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), and `npm run build`
  all pass from `next-app/`. Confirmed live on the dev server (:3002, pre-migration
  DB): a product page returns 200 and still renders the melt-value box via the
  optional-column fallback (defaults to `true`). The admin checkbox itself was not
  exercised in-browser (admin route requires an owner sign-in not available here);
  code path mirrors the existing "Featured in shop" checkbox exactly.

## 2026-07-06 -- Manual Reserved item status removed

Removed the manual **Reserved** product lifecycle from the active admin app. Product
Admin no longer shows a Reserved metric card, status dropdown option, row action, or
quick-fill status token; the AI listing prompt no longer suggests Reserved as an
allowed status; and legacy stored `reserved` values normalize to `available` in the app
layer so old data does not keep a hidden hold state alive. Public shop visibility
continues to use available/sold only, with `pending_payment` used for unpaid admin
order holds. No destructive database cleanup was run; removing old vestigial columns or
rewriting historical SQL install scripts should be handled as a separate confirmed
Supabase cleanup. Verification: `npm run lint` and `npm run build` from `next-app/`
both pass; browser preview confirmed the admin Products page shows Total/Available/Sold
only, row actions do not include Reserve, and the New Item status dropdown has Draft,
Available, Pending Payment, Sold, and Archived only.

## 2026-07-06 -- ? Manual fixed pricing uses Price Label only + Quick Add

Removed the visible **Asking Price** input from the shared New Item/Edit Item admin
product form. Manual/fixed pricing now uses **Price Label** as the entered value:
quick-fill aliases such as "price", "manual price", and the old "asking price" label
map into `manual_price_label`; AI values that arrive as `asking_price` are formatted
into `manual_price_label`; and admin product saves clear `asking_price` to `null` so a
hidden stale value cannot override the visible label. Bare numeric manual price labels
are normalized centrally (`1` -> `$1`, `1200` -> `$1,200`) across admin entry, shop
display, cart, checkout totals, and order snapshots. New Item also has a **Quick add**
checkbox that switches the product to manual fixed pricing and bypasses spot-pricing
requirements (purity/weight/multiplier) while still requiring a title, inventory
number, and price label. Checkout now hydrates stale cart rows from the live product row
when the stored cart price is unparseable, preventing manual-priced items from turning
into dash totals after a product is corrected. Verification: `npm run lint` and
`npm run build` from `next-app/` both pass.

## 2026-07-06 -- ? Orders badge now means unseen active orders

Changed the admin **Orders** nav badge from a paid/pending-fulfillment counter to a
notification-style unseen-order counter. It now counts active orders (`deleted_at is
null`) created after the current admin/browser last viewed the active Orders area, and
viewing `/admin/orders` or an order detail page records a last-seen timestamp and clears
the badge. Recycle Bin orders do not count. Verification: `npm run lint` and
`npm run build` pass from `next-app/`; browser preview confirmed `/admin/orders`
clears the old "Orders 8" badge and it remains cleared after navigating back to
`/admin`.

## 2026-07-05 -- ?? Full UX walkthrough audit (browser-driven, no code changed)

Walked every major public user path on the dev server (:3002) with browser
control: home, nav, /auctions, shop (filters/sort/search/sold view), product
detail (EN+ES), add-to-cart ? cart drawer ? guest checkout (shipping switch,
required-field gate, PayPal button enable — **not** clicked, no orders created),
free-evaluation form, contact + INQUIRE prefill, sign-in/sign-up/reset-password,
saved-items drawer, FAQ accordions, admin gating, all legal pages, redirects,
mobile viewport (no horizontal overflow; hamburger + call button work). Verified
`/api/metal-prices` healthy (`source: "api"`). Findings (full report delivered in
session; top items added to TASKS Backlog):

- **? 2026-07-05 (orders recycle bin) — build-shipped, SQL applied.** Admin Orders now
  uses soft delete: active deletes set `orders.deleted_at`, `/admin/orders?view=trash`
  shows a Recycle Bin with Restore and Delete Forever, and order-detail delete was
  switched to the same soft-delete path. Added `supabase/orders-recycle-bin.sql`
  (idempotent; adds `orders.deleted_at` + active/trash indexes). Owner ran the SQL in
  Supabase and the verify query returned `deleted_at` / `timestamp with time zone`;
  non-destructive route verification now shows `/admin/orders` and
  `/admin/orders?view=trash` return 200 with the migration notice gone. Also fixed the
  paid-order return-to-inventory warning so the delete modal closes before the alert is
  shown. Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build`; browser/
  HTTP preview checked `/admin/orders` + `/admin/orders?view=trash`. Remaining: test
  delete/restore/delete-forever with a deliberate unpaid test order.
- **? 2026-07-05 (invoice generation) — build-shipped.** Orders now generate an
  idempotent invoice row through `upsertOrderInvoice`: new PayPal checkout orders get a
  draft invoice during create-order, paid capture upgrades it to `paid`, and new manual
  admin orders call the same admin invoice endpoint after creation. Order detail now has
  a **Generate Invoice / Refresh Invoice** button for legacy/test orders that are missing
  an invoice row. Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build`;
  preview confirmed the paid test order `NEJ-20260704-VPBG0` shows "No invoice generated
  yet" plus the new **Generate Invoice** button. The button was not clicked because it
  writes to the live database.
- **? 2026-07-05 (admin order print preview) — build-shipped.** Order detail now has a
  **Print Order** action that opens `/admin/orders/[id]/print` in a popup/tab. The route
  is admin-authenticated and shows a paper-style preview with order statuses, customer/
  address data, item snapshots, discounts, totals, notes, and a Print toolbar button.
  Print CSS hides the toolbar and shared cookie/cart/wishlist chrome. Verification:
  `npm run lint`, `npx tsc --noEmit`, `npm run build`; browser preview confirmed
  `NEJ-20260704-VPBG0` opens the preview route with the paper and Print button visible.
- **? 2026-07-05 (admin inventory restore override) — build-shipped.** Order detail now
  has a **Restore item to inventory** action that marks linked products `available`
  without changing order/payment state, even for completed paid sales. Delete confirmation
  now has two choices: Recycle Bin only, or Recycle Bin + return linked products to
  inventory. Paid orders are no longer blocked from the Recycle Bin path. Verification:
  `npm run lint`, `npx tsc --noEmit`, `npm run build`; browser UI verification was
  blocked by admin sign-in redirect in the in-app browser, so exercise on a deliberate
  test order while signed in.
- **? FIXED 2026-07-05 — E04 product soft-404.** Root cause was the
  `shop/loading.tsx` **ancestor** streaming boundary wrapping `[id]` (not just
  `[id]/loading.tsx`). Fixed by moving the shop-list page + skeleton into a
  `shop/(list)/` route group (scopes the loading boundary to `/shop` only, off
  `[id]`), removing `shop/[id]/loading.tsx`, and adding an early `notFound()` in
  the product `generateMetadata`. Unknown/hidden product URLs now return a real
  404 (EN+ES); `/shop` keeps its skeleton; `npm run build` passes. See CHANGELOG.
- **? FIXED 2026-07-05 — sold product detail page.** No longer shows the live
  price captioned "? This is your price"; sold items now show a "Sold — one of a
  kind" caption and keep an Inquire/Call CTA (no Add to Cart). See CHANGELOG.
- **? FIXED 2026-07-05 — UX-friction batch.** Free-evaluation photos now optional
  (photo-or-description guard); sign-in shows friendly localized errors instead of
  raw Supabase strings; saved-items drawer now shows the live computed price;
  ES nav "Tienda / Tienda" ? "Tienda ? Catálogo / Subastas"; cart/checkout
  "1 item(s)" ? proper singular/plural. Checkout address `*` + missing-field
  naming turned out to be **already handled** (dynamic `*` + click-to-reveal alert;
  the audit's DOM query missed the asterisks) — left the owner-verified pay-gate
  as-is. Open business/legal question: 7% FL sales tax on out-of-state orders. See
  CHANGELOG.
- **? 2026-07-05 (checkout UX) — guest sign-in gate + printable order confirmation.**
  "Proceed to Checkout" now shows signed-out shoppers a **Log In / Create Account /
  Continue as Guest** modal (signed-in users go straight through) — verified live. The
  post-PayPal confirmation keeps what it showed and adds a **View & Print Order Details**
  button (guest) revealing a printable receipt (items/totals via read-only `OrderSummary`
  + contact/ship-to + Print button; snapshotted client-side before the cart clears so
  guests can print). Built + build-verified; the live PayPal?print round-trip needs a
  sandbox buyer login (owner to run). Also verified live signed in as admin: the
  Create-Order tax (FL 6% / CA $0) and that the Reopen button renders conditionally
  (absent on open orders; no cancelled orders existed to click-test). See CHANGELOG + TASKS.
- **? 2026-07-05 (final batch) — tax?6%, Reopen button, lint?0, query dedup + env note.**
  Owner-directed: FL sales tax is now **6% everywhere when taxable** (was 7%/6.5% —
  centralized into a single `FL_TAX_RATE` in `checkout-pricing.ts`, imported by
  cart/checkout/admin); the out-of-state exemption still applies (verified live: FL 6%,
  CA $0). Added an admin **Reopen Order** button (`OrderDetailPanel`, shows on cancelled
  orders; build-verified, needs owner admin login to exercise). **Lint is now at 0
  problems** (5 hook errors + 1 font warning resolved: sign-in `nextUrl`?ref, the other
  4 are documented intentional patterns given scoped suppressions). Product page double
  DB query deduped via `React.cache`. **Owner env note:** all working env is in Netlify
  (PayPal sandbox, AI, etc.); `.env.local` is **stale**; remaining testing is live-post-
  deploy and owner-owned — this likely clears the old PayPal Netlify-credential blocker.
  `chris@naplesestatejewelry.co` confirmed real. Bigger shop-perf refactors + image
  re-encodes deliberately left for a focused pass (need live/visual verification). See
  CHANGELOG + TASKS.
- **? 2026-07-05 (later still) — Lint cleanup.** Cleared the 6 dead-code /
  stale-directive lint warnings (unused `setInvoices`/`hasDrawerFilters`/`LOCALES`, two
  stale `eslint-disable` comments, and the unused/never-wired `reopenOrder()` admin
  function). Lint now reports only the 5 `react-hooks/set-state-in-effect` **errors** +
  1 `google-font-display` warning, all deferred as a tracked follow-up (none block the
  build). tsc/build clean; `/shop` filters re-verified live. See TASKS + CHANGELOG.
- **? FIXED 2026-07-05 (later still) — Saved Items drawer gets an Add to Cart
  button, plus a real crash bug found and fixed along the way.** Owner clarified the
  earlier "add-to-cart affordance for the saved drawer" note and asked for it. Reused
  `CartButton` (`variant="icon"`) fed a minimal `CartItem` from what the wishlist
  stores; checkout's existing field-backfill effect fills in the rest. **While
  verifying this, found a real bug:** `[locale]/layout.tsx` nested
  `WishlistProvider` around `CartProvider`, but `WishlistProvider` renders
  `<WishlistDrawer>` as a *sibling* to its children, not inside them — so
  `WishlistDrawer` sat outside the `CartContext` tree entirely. The new
  in-drawer `CartButton` (which calls `useCart()`) crashed the whole app to a blank
  "page couldn't load" screen the instant a saved item rendered. Fixed by swapping the
  provider order (`CartProvider` now wraps `WishlistProvider`; confirmed no reverse
  dependency — `CartDrawer` never calls `useWishlist()`). Re-verified live: save ?
  open drawer ? Add to Cart works, item stays saved, cart badge updates, checkout
  renders the full spec line for the item, no console errors, and a full EN+ES route
  sweep still returns 200. `tsc`/build clean.
- **? FIXED 2026-07-05 (later) — FL sales tax no longer charged on out-of-state
  shipments (owner decision).** Authoritative fix in `lib/checkout-pricing.ts`
  (`buildOrderDraft` + new `isFloridaState`/`chargesFlSalesTax` helpers): tax now
  applies only for local pickup or a Florida shipping address; out-of-state shipments
  are untaxed. Threaded through `/api/paypal/create-order` (both the fresh-order and
  reuse-recompute paths) and the checkout page's own live estimate (`OrderSummary` +
  `CheckoutClient`), so the displayed total matches what's actually charged. The admin
  manual-order form (`OrdersPanel.tsx`) got the same exemption logic (its separate,
  pre-existing 6.5% rate was left as-is — untouched by this fix, not verified live,
  see TASKS). The header mini-cart (`CartDrawer.tsx`) intentionally keeps its flat 7%
  pre-checkout estimate — it has no address input, so it can't know the destination.
  Verified live on dev: CA address ? $0 tax / correct total; FL ? 7% tax restored;
  Local Pickup ? always taxed regardless of state field. No orders were created during
  testing (confirmed via network log — the PayPal button's `createOrder` only fires on
  an actual click, which wasn't triggered). `tsc`/build clean.
- **? FOLLOW-UP 2026-07-05 — account auth pages localized.** `/es/account/sign-in`,
  `sign-up`, and `reset-password` were fully English; now bilingual (labels, buttons,
  placeholders, validation, success screens). Fixed a latent missing-`/es` prefix on
  the sign-in "Create one" link. A **final full EN+ES walkthrough passed** (all routes
  200, garbage product 404, redirects + metal feed live, shop/cart/checkout/sold/saved
  flows and localized auth all confirmed, no console errors, `npm run build` clean).
- **Dev-infra:** Turbopack JSON cache corruption produced sticky 500s across
  routes mid-session (fixed by deleting `.next`); OneDrive sync is a plausible
  aggravator — see the walkthrough report / dev-server-gotchas memory.

## 2026-07-04 (later) -- ?? Pre-launch security audit round 2 (code shipped, ?? 4 SQL files pending)

A five-agent pre-launch audit (API routes, DB/RLS, payments/lifecycle, perf/cost,
client/secrets) surfaced a new **CRITICAL** and several HIGHs on top of the earlier
2026-07-04 findings. **Code fixes are shipped and verified (`tsc`/`eslint` clean,
`npm run build` passes).** Deploy the code, then run the SQL below.

- **?? CRITICAL (SQL only) — PUBLIC execute on payment RPCs.** Postgres grants
  EXECUTE to `PUBLIC` by default; the hardening file only revoked from
  `anon,authenticated`, so anon may still call `capture_paypal_order` /
  `apply_paypal_order_event` / `create_paypal_order` / `create_checkout_order` via
  PostgREST — i.e. mark orders paid + products sold without paying. **Fix: run
  `supabase/revoke-public-execute-2026-07.sql`** (revokes PUBLIC execute + default
  privileges; includes a `pg_proc.proacl` verification probe). No code change needed.
- **Code shipped this round:**
  - Deleted the dead, anonymous `/api/checkout/order` order-creation path ? now a
    410 stub (it let anyone flip the whole catalog to `pending_payment`).
  - `webhooks/resend` now **fails closed** when the signing secret is unset (was
    fail-open ? arbitrary unsubscribe).
  - PayPal **webhook** now verifies captured amount+currency before marking paid
    (mirrors capture-order; mismatch ? `pending` + admin notification).
  - Checkout now **rejects spot-linked items when the metal feed is on fallback**
    (`buildOrderDraft`, source==='fallback' ? 503 "call us") — no more selling gold
    off the hardcoded $3300 fallback during an API outage.
  - **Shipping method whitelisted** in `buildOrderDraft` (unknown method was $0 =
    free insured shipping).
  - **JSON-LD `</script>` breakout escaped** via new `lib/json-ld.ts#jsonLdHtml`
    (shop/[id], [locale]/layout, faq).
  - **IP rate limiting** on `/api/inquire`, `/api/contact-message`, `/api/subscribe`,
    `/api/unsubscribe`, `/api/paypal/create-order` via new `lib/rate-limit.ts`
    (**fails open until `supabase/rate-limiting-2026-07.sql` is run**). Honeypot +
    length caps added to the inquire JSON path; `productIds` capped at 50.
  - `/api/inquiries/[id]` PATCH now `requireAdmin()` (was any-signed-in-user).
  - `adminRevalidateProduct(s)` server actions now `requireAdmin()` (their action
    ids ship in public JS).
  - `server-only` import added to `lib/supabase/service.ts` + `lib/paypal.ts`
    (added the `server-only` dep) so a future client import fails the build.
  - Shop catalog **cache-key hardened**: free-text `?brand=` capped to 60 chars and
    `metal` constrained to gold/silver so junk querystrings can't spawn unbounded
    cache entries / DB reads.
- **Round 2b — the earlier "not yet coded" items are now DONE (code, build-verified):**
  - `item_conflict` race loser now raises a de-duped admin notification (refund
    reminder) from both capture paths — new `lib/order-finalize.ts#notifyItemConflict`.
  - Invoice + auto-receipt now fire on the **webhook-backstop** capture too (browser
    death after approval) — factored into `lib/order-finalize.ts#finalizePaidOrder`,
    called from both `capture-order` and the webhook.
  - Admin paid-order guards: `OrderDetailPanel` blocks delete / line-discount edits /
    mark-unpaid on paid orders (and delete now returns only held pending_payment
    products to available, never un-sells a sold item); `OrdersPanel`
    return-to-inventory refuses paid orders.
  - Partial-refund handling: `apply_paypal_order_event` now accumulates
    `refund_amount` and only marks fully `refunded` when cumulative = total, else
    `partially_refunded` (**SQL** — see manual steps; also folded into
    no-reservation-checkout.sql canonical).
  - profiles `internal_notes`/`account_type` SELECT restriction (**SQL**).
  - profiles.email **write-restriction (M3)** — the account form no longer writes
    `email` (now read-only, set from auth at signup) + column revoke (**SQL**).
- **?? MANUAL STEPS — run in Supabase, in this order (code-first, already deployed here):**
  1. `supabase/security-hardening-2026-07.sql` *(still pending from round 1)*
  2. `supabase/products-internal-columns-authenticated-2026-07.sql` *(round 1)*
  3. **`supabase/revoke-public-execute-2026-07.sql`** *(the CRITICAL)*
  4. **`supabase/rate-limiting-2026-07.sql`** *(enables rate limits; no-op until run)*
  5. **`supabase/profiles-column-restrictions-2026-07.sql`** *(M1 — internal_notes read)*
  6. **`supabase/orders-partial-refund-2026-07.sql`** *(M4 — partial refunds; needs
     orders-refund-amount.sql already applied)*
  7. **`supabase/profiles-email-write-restriction-2026-07.sql`** *(M3 — deploy the
     account-form change first)*
  Then the deferred `VALIDATE CONSTRAINT` lines in security-hardening-2026-07.sql.
- **Still open (deferred by choice):** env vars set in Netlify
  (`RESEND_WEBHOOK_SECRET`, `PAYPAL_WEBHOOK_ID`); verify CSP/HSTS reach SSR pages
  post-deploy. Perf quick-wins: ProductCard renders all images, product-detail
  double-query + `React.cache`, drop `unoptimized` on `/assets/` images, Material
  Symbols subset.
- **Dependency added:** `server-only` (npm) — guards `lib/supabase/service.ts` +
  `lib/paypal.ts` against client import.

## 2026-07-04 -- ?? Security hardening from full-site audit (?? SQL migration pending)

A three-pass audit (live site, admin flow, codebase) confirmed several issues via
live-DB probes. Remediation landed for the top server-side holes:

- **Code shipped** (build + `tsc`/`eslint` clean, not yet exercised live):
  `/api/checkout/order` calls `create_checkout_order` through the **service-role**
  client; `lib/checkout-pricing.ts#buildOrderDraft` rejects any **$0/negative line
  item** (409) for both manual + PayPal checkout.
- **?? MANUAL STEP — run `supabase/security-hardening-2026-07.sql` in Supabase.**
  Until it runs, the holes are still open (e.g. any logged-in customer can
  self-promote to admin, CODE-S01 Critical). **Deploy-order matters: ship the code
  first, then run the SQL.** The route now calls the RPC via the service-role client,
  which works before *and* after the revoke — but if the SQL runs while the old
  code is still live, the old cookie-client RPC call hits permission-denied and
  manual checkout breaks. The file is idempotent + has a rollback block.
- **Confirmed by live SQL probes:** CODE-S01 (is_admin self-writable), CODE-S02/D03
  (create_checkout_order granted to anon), CODE-D04 (anon reads cost_basis/
  minimum_price/internal_notes), CODE-D07 (only 3 CHECK constraints). No-reservation
  migration confirmed applied (reserve fns dropped). No live $0/pending_payment/
  fake-paid data found.
- **CODE-D04 residual — now fixed in code (?? 2nd SQL pending).** Admin product
  read moved to the service role (`admin/page.tsx`) and the `AdminShell` insert no
  longer `.select()`s, so `authenticated` no longer needs SELECT on the internal
  columns. **Run `supabase/products-internal-columns-authenticated-2026-07.sql`**
  (after the code deploys — same code-first ordering) to revoke those columns from
  `authenticated`. Verified on dev: admin table loads all 59 rows via service role.
- **Owner answers folded in:** no trade-in/store-credit build (phone-only); brand
  standardized to "Naples Estate Jewelry"; `naplesestatejewelry.com` not owned
  (can't 301); no license to display; Resend webhook secret is set.
- **SEO + technical batch shipped (code-only, build/tsc clean, verified on dev).**
  Canonical + hreflang on all content + product pages (`lib/seo.ts`), `html lang="en"`,
  de-doubled/seller-intent titles, product Breadcrumb/priceValidUntil/absolute-image/
  seller + locale-aware meta, FAQPage schema, global OG, sitemap hreflang+lastmod,
  robots hardening + `/shop-modern` noindex, `/sell`?`/free-evaluation` & `/cart`?`/shop`
  redirects, footer email, `error.tsx`, Netlify `/assets` cache fix. See CHANGELOG.
  **Deferred items — now all DONE** (see CHANGELOG 2026-07-04 final batch): real Google
  reviews swapped in; per-locale `<html lang>` shipped (html moved to `[locale]/layout`,
  root not-found self-contained, fonts in `lib/fonts.ts`); returns policy rewritten
  (all-sales-final + 5-day misrepresentation refund); "100%" badge replaced; H1 hygiene;
  mobile call button; CSP **enforced**; server-rendered spot price on gold/silver-services;
  new-listing re-slug (redirects + SQL). Auctions/Store nav left as-is (owner explained
  they may be real services — pending owner decision on copy, not removed).
  **?? Two new manual steps:** (1) run `supabase/reslug-new-listing-products-2026-07.sql`
  and deploy together with the next.config redirects; (2) after deploy, verify the
  enforced CSP on the live site (home, /gold-services TradingView chart, /checkout) —
  one-line rollback to Report-Only is commented in `netlify.toml`.
- **Guest checkout + remaining ecommerce-flow (PUB-E) items — DONE** (see CHANGELOG):
  `/checkout` no longer requires an account (guest checkout; optional sign-in nudge);
  shop counter reworded ("59 pieces"); `/wishlist`,`/saved` redirects; sign-up benefit
  line (password stays min-6); product-page trust line + rewritten Shipping policy.
  **The "signature required" shipping claim was removed** (owner: not always applicable)
  — product trust line now reads "Ships fully insured · Authenticity guaranteed" and the
  Shipping policy no longer promises signature-on-delivery. Only open PUB-E item is E04
  (garbage-product-URL soft-404: returns 404 on dev; verify on the live Netlify deploy).

## 2026-07-04 -- Checkout UX polish (owner-verified) + no-reply email wording

- **Pay-button validation is graceful now (owner-tested, works).** Clicking pay
  before the required "confirm your information" checkbox is checked no longer
  jolts/flashes the PayPal window. `PayPalCheckoutButton` dims the button and puts an
  invisible click-swallowing overlay over it while `!ready`, so PayPal is never
  invoked — it just shows an **inline red reminder above the button** that explicitly
  says to check the box (replaced the old full-screen modal; the checkbox is tracked
  via a `needsInfoConfirmation` prop). Owner confirmed the whole flow works
  2026-07-04.
- **No-reply customer emails no longer invite a reply.** The receipt/invoice and
  fulfillment-update emails (sent from `noreply@…`) said "reply to this email"; now
  they say "Call or text (239) 404-8505" only.

Both `tsc`/`eslint` clean. Other no-reply customer emails checked — none invite
replies. See CHANGELOG 2026-07-04.

## 2026-07-03 -- Auto-receipt on payment + paid-aware invoice/receipt email

On a successful PayPal capture, `capture-order` now **auto-emails the buyer their
receipt** (best-effort; only on the fresh capture, so no duplicates; never fails the
capture). The invoice email content is **paid-aware** (`buildInvoiceEmailContent`):
paid ? **Receipt** wording + "PAID IN FULL" badge + "Total Paid"; unpaid ? **Invoice**.
A shared `lib/order-invoice-mailer.ts#sendOrderInvoiceEmail` (fetch ? build ? send ?
log to `order_emails`) backs both the admin *Email Invoice/Receipt* button and the
auto-send. The admin button/modal relabel to Receipt for paid orders.

The auto-receipt **email sends regardless of the `order_emails` migration**; it's just
not logged to the Email History card until `supabase/order-emails.sql` is run (see the
per-order-email entry below — same pending migration). **Verified:** `npm run build`
passes, `tsc`/`eslint` clean. Not exercised live (needs a PayPal sandbox capture +
admin view + the migration). See DECISIONS 2026-07-03.

## 2026-07-03 -- Order detail: per-order email history

The admin order detail page (`/admin/orders/[id]`) now records every email sent from
it (invoice + fulfillment-update) and shows them in a new **Email History** card
under the Summary block on the right. New table `order_emails`
(`supabase/order-emails.sql`); the two email routes best-effort insert a row after a
successful send; the page loads the history and `OrderDetailPanel` prepends each
just-sent email optimistically.

?? **Manual step: run `supabase/order-emails.sql` in Supabase.** Until then the table
is missing ? history reads empty and the routes' logging insert no-ops (emails still
send fine — graceful). **Verified:** `npm run build` passes, `tsc`/`eslint` clean
(only pre-existing OrderDetailPanel warnings). Not exercised live (admin session had
lapsed; owner credentials not entered; table not yet migrated). After running the SQL,
verify by sending an invoice + a fulfillment-update email from an order and confirming
both appear in the Email History card. See DECISIONS 2026-07-03.

## 2026-07-03 -- Admin toggle: show/hide sold items in the shop gallery

Added an admin setting (in `/admin/settings` ? new **Shop Visibility** section) to
choose whether SOLD products appear in the public shop gallery. Available items are
always shown. Implementation follows the app's single-row-settings + admin-gated-API
pattern:
- **New table `shop_settings`** (`supabase/shop-settings.sql`) — single row, column
  `show_sold_items boolean default true`. Anon/authenticated SELECT (storefront
  reads it), writes only via the admin API's service-role client.
- **New API `/api/admin/shop-settings`** (GET/PUT, `requireAdmin`-gated, service-role
  read/write). PUT busts the `shop-catalog` cache tag so the change shows immediately.
- **New store lib** `src/lib/shop-settings.ts` (`fetchShowSoldItems` degrades to
  `true` on any error incl. missing table; `saveShowSoldItems`).
- **Admin UI** `src/components/admin/AdminShopVisibilityPanel.tsx` (checkbox),
  rendered by `AdminSettingsPanel`.
- **Shop query** (`shop/page.tsx#queryShopCatalog`) reads the setting and filters to
  `AVAILABLE_ONLY_SHOP_PRODUCT_STATUSES` (new export in `types/product.ts`) when the
  toggle is off, else the existing available+sold set.

? **Migration applied + feature verified end-to-end (2026-07-03).** `supabase/shop-settings.sql`
was run in Supabase. Verified live signed-in as admin: with the toggle ON `/shop`
showed 59/59 (7 sold visible); toggling OFF (PUT ? 200) dropped it to 52/52 with
`?status=sold` empty (the 7 sold hidden from results + total + facets); toggling back
ON restored 59/59. The setting was **restored to `true`** (its default) after testing
so production shows sold as before. `npm run build` passes, `tsc`/`eslint` clean. See
DECISIONS 2026-07-03.

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
  after it). **?? Manual step: run `no-reservation-checkout.sql` in Supabase**
  (after `paypal-checkout.sql`) — see the SQL-migrations section below.
- **App copy:** the checkout subtitle no longer says "reserve the items" (now
  "check out the items"); a stale "double-reserve" comment was corrected.
- Vestigial `reserved_until`/`reserved_order_id` columns are left in place (always
  null) to avoid a destructive schema change. The manual admin **Reserved** product
  status has since been removed from the active app (2026-07-06).

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
delete-order return-to-inventory, create-order status updates, archive/hard-delete)
happened via the browser Supabase client and never revalidated the `shop-catalog`
tag, so the gallery stayed stale up to 5 min. All now call the new bulk
`adminRevalidateProducts()` server action. Verified live on dev (signed-in):
Mark Paid ? bracelet left /shop in ~3s; Cancel ? back in ~3s. Convention: any
client-side `products` write must be followed by `adminRevalidateProduct(s)`.
Note: the Test 7 leftover order `a565d7f4…` is now `cancelled` (used for this
verification); the cleanup SQL below still applies.

## 2026-07-02 — PayPal approval-return hardening (reload/eviction resume)

> ?? **Superseded 2026-07-03.** The confirm-on-return screen and the
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
route registered; endpoint probed live on dev :3002 (no param ? 400; unknown
order ? `{state:'none'}`).
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
record on /checkout mount; create ? order-status `pending`; same-payload retry
reuses the order id; changed-shipping retry returns a fresh order id.

?? **Leftover test rows from this verification** (products were never reserved —
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

## ?? HANDOFF — PayPal checkout: where testing stands (2026-06-30)

**The site is deployed and the checkout page renders, but PayPal checkout fails on the
deployed site with "Something went wrong with PayPal. Please try again." Root cause
identified — see the Netlify env-var fix below.** Code is complete and verified on the
local dev server. Full technical runbook: `project-docs/features/paypal-checkout.md`.

### ?? BLOCKER: Netlify has the wrong PayPal app credentials

The deployed site serves `PAYPAL_CLIENT_ID = AcSsWn15M34eZNC-2OksAzaKof6Uj4dC6p-TgwSUVlr0AKKwvRcowHnFIJts92cKrA9qaL_73xtNhR5g`
(extracted from live checkout HTML), but the verified working sandbox app in
`next-app/.env.local` has `PAYPAL_CLIENT_ID = AbscNftOUogWVeuutMWwSWjnjtmqn5k3r9F3AXGl5PW27mR4Tx1xd-hzUHX5qbcvnZZtYF3mD_eo0eMm`.
**These are different PayPal apps.** The server's `getAccessToken()` call (Basic
auth with the Netlify-set id+secret) receives `401 invalid_client` from PayPal
? `createPayPalOrder` throws ? route returns 502 ? the client shows the error.

**Fix (requires Netlify dashboard access):** Update all 4 PayPal env vars to the
working sandbox set from `next-app/.env.local`, then trigger a redeploy:
- `PAYPAL_CLIENT_ID` = `AbscNftOUogWVeuutMWwSWjnjtmqn5k3r9F3AXGl5PW27mR4Tx1xd-hzUHX5qbcvnZZtYF3mD_eo0eMm`
- `PAYPAL_CLIENT_SECRET` = the `EG0py…` value from `next-app/.env.local`
- `PAYPAL_ENV` = `sandbox`
- `PAYPAL_WEBHOOK_ID` = `64C82950G8312001A`

?? **All 4 must belong to the same PayPal app and environment.** Mixing id/secret
from different apps, or setting `PAYPAL_ENV=live` with sandbox creds (or vice versa),
causes the same `401 ? 502`. See DECISIONS (2026-06-30, PayPal credential-set rule).

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
| 1 | Successful payment | ? **PASSED live (local dev)** end-to-end (create ? approve ? capture ? `paid`/`completed`, product `sold`, capture idempotent) — predates the no-reservation change; re-run recommended |
| 5 | Concurrent-buyers race (no reservation) | ? **NOT run** — new model (2026-07-03): two buyers both approve the same one-of-one, both capture; first wins (`sold`), second gets `item_conflict` ? order flagged `failed` for manual refund + 409 message. Needs the `no-reservation-checkout.sql` migration + two sandbox approvals. (Replaces the old "reserve returns 409" test.) |
| — | Validation/error paths + webhook signature gate | ? PASSED (empty cart, missing contact, bad ids ? correct 400/404; unsigned webhook ? 401) |
| 3 | Failed/denied capture | ? Partial — graceful 502 + order stays unpaid on an unapproved capture is verified; the `PAYMENT.CAPTURE.DENIED` **webhook** branch is NOT live-tested (needs deploy) |
| 6 | Amount mismatch | ? Logic verified (capture compares amount+currency ? flags order `pending` + admin notification, no auto-sell); NOT forced live |
| 2 | Canceled checkout | ? NOT run live (onCancel handler exists) |
| 4 | Duplicate webhook | ? NOT run — needs deployed site + PayPal "Resend"/simulator (idempotency is coded via `webhook_events` unique `event_id`) |
| 7 | Reload-during-approval resume | ? **N/A — feature removed 2026-07-03.** The confirm-on-return screen + sessionStorage resume route were reverted in favor of capture-on-approve; there is no longer a client screen to restore across a reload. With no reservation, a tab evicted mid-capture just leaves the item available. |

### What's left to do, in order
1. **Fix the Netlify credential mismatch** (see BLOCKER above): update the 4 PayPal vars in
   the Netlify dashboard to the verified sandbox set, then redeploy (env-var changes only take
   effect on a new deploy).
2. ~~Re-run `supabase/paypal-checkout.sql`~~ Done -- owner confirmed re-run 2026-07-03;
   paid orders no longer post to the Messages center.
3. **Register the sandbox webhook** in the PayPal Developer dashboard ? URL `https://naplesestatejewelry.co/api/paypal/webhook`, events `PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED/REVERSED` + `CUSTOMER.DISPUTE.CREATED`; confirm its id matches `PAYPAL_WEBHOOK_ID`.
4. **Finish the sandbox tests on the deployed site:** Test 2 (cancel), Test 3 (denied capture — sandbox negative testing or the webhook simulator's DENIED event), Test 4 (duplicate webhook via "Resend"). Optionally force Test 6 by editing `orders.total` while the PayPal popup is open.
5. **Only after sandbox passes ? go LIVE:** create a Live PayPal app, swap in live client/secret/webhook id, set `PAYPAL_ENV=live`, redeploy, and run one real low-value order.

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
- Test orders/reservations were created and cleaned up via the Supabase service role (PostgREST). To inspect old tests: query `orders` (filter `payment_method=eq.paypal`) and products linked through `order_items`. To clean a test order: set its unpaid product(s) back to `status='available'` (+ null `reserved_until`/`reserved_order_id` if present) and delete the order (order_items cascade).
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

?? **One SQL migration is outstanding as of 2026-07-03:**
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
  Sold items leave the shop gallery promptly; new/unseen active orders surface as a
  badge on the admin **Orders** tab (not Messages); the order detail page + invoice show the
  shipping address. **Pending go-live steps** (run `no-reservation-checkout.sql`, set
  Netlify env, register webhook, run sandbox test matrix) — see the HANDOFF section
  above and TASKS.
- **Admin Orders** (`/admin/orders`, `/admin/orders/[id]`) with create/manage,
  delete (with optional return-to-inventory), and an unseen active-orders nav badge.
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
  return-to-inventory, create-order status updates, archive/hard-delete) via the new
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
- **2026-06-13 ? 2026-06-24:** The legacy static HTML site was fully removed
  and the Next.js/Supabase app (`next-app/`) became the sole deploy target;
  sales workflow (orders/invoices/lifecycle statuses), the AI listing
  assistant, compliance/legal pages, and a broad shop/responsive/performance
  pass were all built out. See `CHANGELOG.md` for the day-by-day detail.

## Current Priorities

1. **Bring PayPal checkout live** — see the ?? HANDOFF section above for the
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
  credentials — see the ?? HANDOFF section above.
- No CI beyond Netlify's `npm run build` on deploy.

## Verification

- Last known good local commands from `next-app/`:
  `npx tsc --noEmit`, `npm run lint` (0 problems as of 2026-07-07), and
  `npm run build` — all pass.
