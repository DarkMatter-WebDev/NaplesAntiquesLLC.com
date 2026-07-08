# Tasks

> Move tasks between sections as work progresses. Keep it current at the end of
> every session. Newest/most important first within each section.

## Backlog

- **🔴 Deploy the bulk-sync runaway fix, then re-run "Sync All" (2026-07-08,
  session 9, seventeenth addendum):** The bulk "Sync all to Etsy" was looping
  forever on already-synced items ("Processed 79 of 55 · 55 remaining",
  climbing) — fixed in `sync.ts`/`drainQueueCore`/`EtsyBulkSyncModal`. **Until
  this deploys to Netlify, do NOT re-run "Sync All"** — the live code still has
  the bug and will loop. After deploy, run "Sync All" once: the ~55 items stuck
  in `'pending'` (they show as "Not listed" in the admin until then) will be
  re-synced as updates (image diff, not a re-upload) and land in
  draft_review; the run should finish with processed ≈ item count, not
  climbing. No migration, no manual DB cleanup. Full detail: `DECISIONS.md`
  2026-07-08 (session 9, seventeenth addendum).

- **🟡 Re-sync 2 corrected bracelets to Etsy (2026-07-08, session 9, fifteenth
  addendum):** Two bracelets were mistyped as `Necklace` (data error) and
  corrected to `Bracelet` in the DB (`vintage-tiffany-...-cuban-curb-link-bracelet-26`,
  `italian-14k-yellow-gold-figaro-link-bracelet-25`). Their existing Etsy
  drafts still show the old Necklaces > Chains category until re-synced.
  **Action:** on each, click **Refresh Preview** (confirm it now reads
  "Bracelets > Chain & Link Bracelets" with bracelet tags) then **Sync
  Updates**. Optional/owner's call: a Mickey Mouse "Pendant" is typed `Charm`
  (Charm vs Pendant — change it if you prefer Pendant). **Done (sixteenth
  addendum):** the dry-run now shows a non-blocking warning when a title
  implies a different type than `product_type`, to catch future mistypes
  before syncing.

- **🔴 Run `supabase/shop-special-price-default-2026-07.sql` in Supabase
  (2026-07-08, session 9, fourteenth addendum):** Adds
  `shop_settings.special_price_default_enabled` + `special_price_default_percent`
  for the new site-wide **Customer Trade-in Price** default (Admin → Settings).
  Verified live the columns don't exist yet — the feature is safely OFF and
  every product page shows the plain melt value until this runs (reads degrade
  gracefully). After running: Admin → Settings → Customer Trade-in Price →
  enable + set a % (negative = below spot) → Save; a product page reflects it
  within ~5 min (ISR). The canonical `supabase/shop-settings.sql` was updated
  too (fresh installs get the columns). Full detail: `DECISIONS.md` 2026-07-08
  (session 9, fourteenth addendum).

- **🟡 Etsy sync — verify the mapping + preview changes live (2026-07-08,
  session 9, seventh–twelfth addenda):** Owner-requested changes, code done,
  not yet re-synced/reviewed in-browser: (1) **length AND ring size auto-push now**
  with no Netlify flag (`ETSY_SYNC_BRACELET_LENGTH=false` /
  `ETSY_SYNC_RING_SIZE=false` disable them); (2) **vintage/antique tags** on
  every item ("vintage jewelry"/"antique jewelry" + metal-specific
  "vintage sterling"/"antique sterling" etc., always paired); (3) **no more
  mid-word tag truncation** ("solid silver bracele" → word-boundary cut);
  (4) **manual "Test Length"/"Test Ring Size" windows removed** — length/ring
  size now appear in the **dry-run preview** ("7.75 in · pushes on sync" /
  "10 1/2 (US/CA) · pushes on sync"), approve by syncing;
  (5) **Check Etsy Status now reconciles draft→active** (it used to leave the
  chip stuck on "Draft on Etsy — needs review" after activating on Etsy);
  (6) **"View on Etsy" now opens the shop-manager list** (active → default
  listings view, draft → `state=draft` filter) instead of the public
  `etsy.com/listing/<id>` URL;
  (7) **the 22 "ineligible" silver items now all sync** — they only failed the
  taxonomy check (granular types like "Berry Spoon"/"Coffee Pot"/"Koma Clasp"
  weren't mapped); a keyword→Etsy-leaf fallback (`ETSY_KEYWORD_TAXONOMY` in
  `mapping.ts`, real ids) maps flatware→Flatware & Silverware (exact),
  holloware→closest serveware leaf (approximate), Koma→Brooches. Live pre-flight
  re-run confirms 0 ineligible now;
  (8) **two bulk-sync 400s fixed** — Etsy allows "&" at most once in a title;
  two sterling pieces had two, so `mapTitle` now keeps the first "&" and spells
  the rest "and". Also `extractEtsyMessage` (`client.ts`) now parses Etsy's
  field-error shape so future title/tag rejections show the real reason, not a
  bare "400". Re-sync those two pieces (Serving Spoon + Oval Gallery Tray);
  (9) **markup Save button + dedicated price push** — the markup field now has
  an explicit Save; new "Push prices to Etsy now" (settings) + per-item "Push
  price" (product drawer) use a lean price-only path (ignores the daily
  threshold) because bulk "Sync All" skips already-live listings. **Verify:**
  change markup → Save → "Push prices to Etsy now" → confirm live prices update.
  Also: open a product's Etsy drawer,
  confirm Length/Ring size show in the preview (no separate test box), re-sync
  any listing (and a Ring) and confirm the new tags render with no chopped
  words + length/ring size land automatically; activate a draft on Etsy →
  Check Etsy Status → confirm the chip flips to "Active on Etsy" and "View on
  Etsy" opens the active manager view; and reopen "Sync all to Etsy" to confirm
  it now reads ~70 eligible / 0 ineligible (spot-check a few silver-piece
  categories in the preview, override any approximate holloware fit that's
  wrong). **Note for owner:** "antique" on a genuinely-1990s piece is a keyword
  stretch (free-text search tag, not the accurate `when_made` field) — say if
  you want it narrowed to older items only. Full detail: `DECISIONS.md`
  2026-07-08 (session 9, seventh–twelfth addenda).
- **🟢 Etsy sync — necklace sync RESOLVED + Necklace now maps to "Chains"
  (2026-07-08, session 9, fourth–sixth addenda):** The "hung up syncing"
  incident is fully resolved — the necklace synced live after three
  compounding fixes surfaced one-by-one: (1) a legacy relative image path
  Node's `fetch()` couldn't resolve (`resolveImageUrl()` in `images.ts`),
  (2) Etsy rejecting the 51-char `sku`/slug — now SKU is never pushed at all
  (`sync.ts`), and (3) owner's follow-up: the **Necklace** product type now
  auto-maps to **Chains (1221)** instead of the old "Pendant Necklaces"
  closest-match, and no longer shows the "review" badge (Pendant is its own
  product type). **Remaining optional owner action:** any necklace already
  synced under Pendant Necklaces won't move to Chains automatically — re-sync
  it, or fix its category on etsy.com, if you want it moved. New necklaces
  land under Chains from the next sync. Full detail: `DECISIONS.md`
  2026-07-08 (session 9, fourth / fifth / sixth addenda).
- **🟢 Etsy sync — Ring size CONFIRMED WORKING + now auto-on (2026-07-08,
  session 9, addendum + eighth addendum):** Live-verified: size 10.5 →
  matched real chart entry `value_id 1604` → written → read back and
  confirmed correct ("Ring size", "US/CA", "10 1/2"). Ran against a
  manually-overridden category, a stronger proof than the default path
  alone. **Now automatic** (session 9, eighth addendum) — ring size pushes
  on every Ring sync by default, no Netlify change; set
  `ETSY_SYNC_RING_SIZE=false` to disable. The manual "Test Ring Size" button
  keeps working either way.
- **🟡 Etsy sync — one more live click to confirm the Length generalization
  (2026-07-08, session 9):** Click **Test Length** on a non-Bracelet,
  non-Ring product (a Necklace or Earrings draft) — the mechanism is proven
  for Bracelet only so far; this confirms it also holds for another
  category's own property id. Safe regardless of outcome (write-then-verify,
  never silently trusts a 200). Full detail: `project-docs/DECISIONS.md`
  2026-07-08 (session 9).
- **🟢 Etsy sync — Bracelet length CONFIRMED WORKING (2026-07-08, session 8) —
  optional next step, owner's call:** Investigation closed. Live-verified:
  `value_ids: ['']` (an empty-string placeholder, never a guessed number)
  causes Etsy to auto-generate its own real value_id for the custom length
  value; read back and independently confirmed correct (property "Length",
  scale "Inches", value "7.75" — not a repeat of the old "Gray" bug).
  Materials/Gold solidity/Gold purity remain separately confirmed correct
  (session 5). **Optional next step:** set `ETSY_SYNC_BRACELET_LENGTH=true`
  in Netlify to turn on automatic Bracelet-length pushing for every regular
  sync — no code changes needed, purely an env var flip when ready. Not
  urgent; the manual "Test Bracelet Length" button in each Bracelet
  product's Etsy panel keeps working regardless. Full detail:
  `project-docs/DECISIONS.md` 2026-07-08 (session 8, third addendum).
- **🔴 Etsy sync — manually fix "Gray" in the bracelet's Bracelet length field
  (2026-07-08, session 5):** A bad property-push guess wrote the literal text
  "Gray" into the live bracelet listing's Bracelet length field instead of
  "7.75" — Etsy accepted it silently rather than rejecting it, so the app
  never saw an error. The buggy code path is now removed (`mapProperties()`
  no longer pushes Length at all — see `DECISIONS.md` 2026-07-08 session 5),
  so this is a one-time cleanup, not a recurring risk. Fix it directly on
  etsy.com: clear the field and either type `7.75` or click Etsy's own
  **"Suggested: + 7.75 Inches"** chip shown right below it.
- **🟡 Etsy sync — two more live clicks needed (2026-07-08, sessions 3-4):**
  1. The bracelet draft (`heavy-italian-14k-yellow-gold-cuban-link-bracelet-53-91g-21`)
     was **deleted directly on etsy.com** by the owner. Click **Check Etsy
     Status** on it first — should reset it to "Not listed" (etsy_listing_id
     cleared) — before trying **Sync to Etsy** for a clean fresh publish.
  2. On any *other* already-listed product, click **Sync Updates** to confirm
     the `who_made`/`is_supply` PATCH fix (was erroring live with "Cannot
     update 'when_made' without 'who_made' and without 'is_supply'").
  Materials/Gold purity/solidity are now confirmed correct live (owner's
  screenshot, session 5) — no longer an open question. Full detail:
  `CURRENT_STATUS.md`/`DECISIONS.md` 2026-07-08 (sessions 3-5).
- **🟢 Etsy sync — core pipeline live-verified (2026-07-08):** OAuth connect,
  `supabase/etsy-sync.sql`, and a first real draft sync (bracelet, now
  `draft_review` on Etsy) all succeeded live this session — see
  CURRENT_STATUS.md's 2026-07-08 entries for each. Taxonomy IDs are pinned
  from a real `getSellerTaxonomyNodes` call (6 of 12 are best-fit
  approximations flagged `approximate: true` in `ETSY_TAXONOMY_MAP` —
  optional owner review, not a blocker). **Still unverified live:** token
  refresh, the scheduled price push, delist/relist, resume-after-interrupt,
  and a dry-run across more than one product — full remaining checklist in
  `etsy-sync-plan/14-verification-checklist.md`. Do not treat unit-test-green
  as live-verified for anything still unchecked there.
- **Run BOTH Quantity migrations in the live Supabase project, in order:**
  `supabase/product-quantity-2026-07.sql` (Phase 1 — `products.quantity`), then
  `supabase/checkout-quantity-2026-07.sql` (Phase 2 — `order_items.quantity` +
  the rewritten `create_paypal_order`/`capture_paypal_order` RPCs). Then verify:
  - **Phase 1 field:** (1) column exists and anon/authenticated can select it
    (product pages keep working, no "permission denied for column" errors);
    (2) set a test listing to Quantity 3, save, confirm `/shop/[id]` and the
    shop card show "3 in stock"; (3) set Quantity 0 on an `available` listing,
    save, confirm `status` auto-flips to `sold` and it leaves the purchasable
    sort / "Add to Cart" disables; (4) a `sold` item restocked above 0 does NOT
    auto-flip back to `available`.
  - **Phase 2 multi-unit purchase:** (5) on a listing with stock ≥ 2, the
    detail page, cart drawer, and checkout summary show a quantity stepper
    capped at stock with correct per-line subtotals; (6) buy 2 of a stock-3
    listing via PayPal and confirm capture succeeds, the order/invoice/receipt
    show `Qty 2 × unit`, and `products.quantity` drops to 1 (item stays
    `available`); (7) buy the last unit and confirm it flips to `sold`; (8) a
    line whose requested quantity exceeds live stock is rejected at checkout
    with a clear message; (9) the admin manual-order form's per-product quantity
    input produces correct totals. See `CURRENT_STATUS.md` + `DECISIONS.md`
    2026-07-07 (latest two entries).
- **Run `supabase/product-special-price-override-2026-07.sql` in the live Supabase project**
  and then verify the new per-item **"Override customer special pricing"** admin checkbox:
  (1) confirm both columns exist and anon/authenticated can select them (product pages keep
  working, no "permission denied for column" errors); (2) edit a test listing, check the box,
  enter a custom dollar amount, save, and confirm its `/shop/[id]` page's "Own gold or
  silver…" line shows that custom amount instead of the computed scrap value (the Scrap
  value/Based on spot box above it should still show the real computed value, unchanged);
  (3) uncheck the box and confirm the line reverts to the computed scrap value. See
  `CURRENT_STATUS.md` + `DECISIONS.md` 2026-07-07 (latest).
- **Optional:** if OneDrive sync load/lag is still noticeable during dev
  (separate from the now-fixed cache-corruption bug), also relocate
  `next-app/node_modules`'s *real* content off OneDrive the same way
  `.next` was (junction it to a local `%LOCALAPPDATA%` folder too, instead of
  just having the reverse-pointing junction that exists today). Deferred
  2026-07-07 — see DECISIONS.md same date; not needed for the corruption fix
  itself, just a possible further perf/battery win.
- **Watch for Next.js `16.3` stable release**, then evaluate upgrading — it
  contains the upstream engine fix (vercel/next.js#95497) for the Windows
  Turbopack dev-cache `Access is denied` bug that the 2026-07-07 junction
  workaround (see CURRENT_STATUS.md / DECISIONS.md) works around today. Not
  urgent since the workaround is stable, but the junction setup could
  eventually be removed if the upstream fix makes it unnecessary.
- **Run `supabase/product-show-spot-price-2026-07.sql` in the live Supabase project**
  and then verify the new per-item **"Show spot / melt value on storefront"** admin
  checkbox: (1) confirm the column exists and anon/authenticated can select it
  (product pages keep working, no "permission denied for column" errors); (2) edit a
  mixed-metal test listing, uncheck the box, save, and confirm its `/shop/[id]` page
  shows the short note instead of the Scrap value/Based on spot box (and the "Own
  gold or silver…" line disappears too); (3) re-check the box and confirm the melt
  box returns. See `CURRENT_STATUS.md` + `DECISIONS.md` 2026-07-06 (later).

> **Standing note (owner, 2026-07-05):** all working env is in **Netlify** (PayPal
> sandbox, AI assistant, service role, webhook secrets, etc.). `next-app/.env.local`
> is **stale — do not rely on it** for credentials. Remaining testing is done **live
> after deployment**, and the **owner owns that testing** (don't attempt live
> PayPal/AI/email tests from here). This likely clears the old PayPal "Netlify has the
> wrong credentials" blocker — confirm on the next deploy.

- **Verify live invoice row creation on deliberate test orders.** Code now creates
  invoices idempotently at order creation and can recover missing legacy invoices from
  order detail. Next deliberate tests: on the paid test order `NEJ-20260704-VPBG0`,
  click **Generate Invoice** and confirm an invoice row appears/link opens; create one
  new manual admin order and confirm it gets a draft invoice automatically; run one
  PayPal sandbox order after deploy and confirm create-order makes a draft invoice and
  capture upgrades it to `paid`.
- **Verify the explicit order-detail inventory restore controls while signed in.**
  The code is build-verified, but browser UI verification redirected to sign-in in this
  session. On a deliberate test order, confirm **Restore item to inventory** marks linked
  product rows `available` without changing order/payment state; then test Delete Order
  -> **Yes, Move to Recycle Bin** leaves inventory alone, while **Move to Recycle Bin and
  return to inventory** marks linked products `available` before soft-delete.
- **Verify Orders Recycle Bin behavior post-migration.** `supabase/orders-recycle-bin.sql`
  is applied (owner screenshot 2026-07-05; verify query returned `deleted_at` /
  `timestamp with time zone`) and `/admin/orders` + `/admin/orders?view=trash` now
  return 200 with no migration notice. Next deliberate test: delete an unpaid test
  order from `/admin/orders` → it disappears from active Orders and appears in
  `/admin/orders?view=trash`; Restore returns it to active Orders without changing
  product inventory statuses; Delete Forever permanently removes it after confirmation.
  Also re-test a paid order with "Return its products to Available inventory" checked:
  the modal should close before the warning appears.
- **Verify the guest checkout → PayPal → printable confirmation round-trip live.** The
  post-payment "Order Received" screen now has a **View & Print Order Details** button
  (guest) / **View Order Details** (signed in) that reveals a printable receipt with a
  Print button. Built + build-verified, but the full round-trip needs a **PayPal
  sandbox buyer login** (not available in this environment). Run one sandbox order as a
  guest, click View & Print, and confirm the receipt shows the right items/totals/
  contact and prints cleanly (header/footer/buttons hidden). *(The guest sign-in gate
  before checkout is already verified live — see CHANGELOG.)*
- **Verify the admin Reopen Order button click live.** The 6% / out-of-state tax on the
  admin Create-Order form is now **verified live** (FL → 6%, CA → $0). The **Reopen
  Order** button on `OrderDetailPanel` is verified to render conditionally (absent on
  open orders); its click wasn't exercised because there were **no cancelled orders** to
  test on. Next time: cancel any order → the Reopen button should appear → click it →
  order returns to `open`/`pending` and unpaid products to `pending_payment` (leaving
  the public gallery again).
- **Bring PayPal checkout live (sandbox → production).** Canonical, up-to-date
  status/steps live in the **🔴 HANDOFF — PayPal checkout** section at the top
  of `CURRENT_STATUS.md` — read that first, not this file, for the current
  blocker and ordered go-live steps. (Do not duplicate the checklist here; it
  goes stale the moment the two copies diverge — see DECISIONS 2026-07-02.)
- **Run `supabase/order-emails.sql` in the live Supabase project** to enable the
  per-order email history on `/admin/orders/[id]` (new **Email History** card under
  the Summary) and the logging of auto-sent receipts. Until run, history reads empty
  and the logging insert no-ops — **emails still send** (including the new
  auto-receipt on payment). Idempotent. After applying, verify: (a) complete a PayPal
  sandbox order and confirm the buyer gets a paid **Receipt** email automatically and
  a "Receipt … Sent automatically" row appears in Email History; (b) from an order,
  use **Email Receipt/Invoice** (paid → Receipt wording + "Paid in full") and a
  fulfillment-update email, and confirm both log to the history. See
  `CURRENT_STATUS.md` 2026-07-03 + DECISIONS 2026-07-03.
- **Verify Messages Recycle Bin behavior post-migration.**
  `supabase/admin-notifications-recycle-bin.sql` has been applied (owner
  confirmed 2026-07-03), adding `admin_notifications.deleted_at` and the
  `trash_/restore_/delete_admin_notifications` RPCs. Confirm "Delete Selected"
  in `/admin/messages` now soft-deletes to the Recycle Bin (instead of the old
  permanent-delete behavior) and that the Recycle Bin link is visible and
  restore/permanently-delete both work.
- **Run the current `supabase/no-reservation-checkout.sql` in the live Supabase
  project — by itself.** This is the no-reservation checkout model ("whoever pays
  first gets the item"). An earlier copy is confirmed applied (a 2026-07-03
  `paypal-checkout.sql` re-run hit `42P13` on `capture_paypal_order`, proving the
  live function already has the `item_conflict` return), but the file was enhanced
  2026-07-03 to also **drop** the old `reserve_paypal_order` +
  `release_expired_paypal_reservations` functions and rewrite
  `apply_paypal_order_event`. Do **not** re-run `paypal-checkout.sql` first — it is
  fully applied, and re-running it downgrades the capture function (it now has a
  drop guard so it no longer 42P13s, but no-reservation must then run again).
  Idempotent. Until run, the orphaned 30-min reservation functions still exist in
  the DB (unused). After PayPal go-live,
  verify the concurrent-buyers race: two sandbox buyers approve the same
  one-of-one, both capture → first wins (`sold`), second gets `item_conflict`
  (order flagged `failed` + 409). See `features/paypal-checkout.md`.
- **Verify `admin_notifications.image_urls` behavior post-migration.**
  `supabase/admin-notifications-image-urls.sql` has been applied (owner
  confirmed 2026-07-03), so the column should now exist and photos attached to
  "Message Us Directly" submissions should persist + render in
  `/admin/messages`. Also confirm `inquiries.uploaded_image_urls` exists (from
  `sales-workflow.sql`) so inquiry/free-eval photos show in
  `/admin/inquiries`. Submit a message + an inquiry with photos and confirm
  thumbnails render.
- **Verify `products.public_notes_es` behavior post-migration.**
  `supabase/product-public-notes-es.sql` has been applied (owner confirmed
  2026-07-03). Edit a product, confirm Notes (ES) saves and auto-translates
  from Notes (EN), and confirm it renders on the `/es` product detail page.
- **Verify `products.item_year` behavior post-migration.**
  `supabase/product-item-year.sql` and the `supabase/admin-notifications-checkout.sql`
  re-run have been applied (owner confirmed 2026-07-03) — this dropped the old
  `item_date` column (clearing the incorrect listing-creation dates that had
  been backfilled into it). Confirm the Product Admin Date (Year Made) field
  persists on `products.item_year`, order items snapshot it
  (`order_items.item_year_snapshot`), and checkout still succeeds end to end.
- **Verify `shop-new-listing-jpg-to-webp.sql` behavior post-migration.** Applied
  (owner confirmed 2026-07-03) — confirm product rows that referenced
  `shop-new-listing-06-04.jpg` / `-05.jpg` now point at the `.webp` files and
  render correctly (the JPGs were already deleted from `public/`; Netlify 301s
  were the interim safety net).
- **Promote CSP from Report-Only to enforcing.** Root `netlify.toml` ships
  `Content-Security-Policy-Report-Only`. After deploy, watch the browser
  console / a report endpoint across the main pages; once clean, rename the
  header key to `Content-Security-Policy`. Current policy: default-src
  'self'; img-src 'self' data: + Supabase; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' + fonts.googleapis.com; font-src 'self' +
  fonts.gstatic.com; connect-src 'self' + Supabase + api.gold-api.com;
  frame-ancestors 'none'.
- **Verify the security headers, caching, and 410 bot rules live** after the
  next Netlify deploy (`curl -I` the site + a `/wp-login.php` probe → 410).
  These come from root `netlify.toml` and cannot be exercised by the local
  dev server.
- **Verify the contact + free-evaluation lead forms end to end.** Submit a
  real test on `/contact` (submit-item) and `/free-evaluation` and confirm it
  appears in `/admin/inquiries`, the owner notification + customer
  confirmation emails send (needs `RESEND_API_KEY`), and photos upload to the
  `product-images/inquiries/` path (needs `SUPABASE_SERVICE_ROLE_KEY`).
  Without the service-role key, the inquiry text still saves but photos are
  skipped.
- **Verify the create-account duplicate-email + password-reset flow end to
  end.** In Supabase confirm Auth → URL Configuration Redirect URLs allow
  `…/account/reset-password` for prod + localhost + 127.0.0.1 (the existing
  `/**` entries already cover it). Then, signed out, try Create Account with
  a **known confirmed** account email and confirm the "This email already has
  an account" notice + Reset Password button appear. Click Reset Password,
  open the emailed link, and confirm `/account/reset-password` shows "Set a
  New Password" and that updating the password then lets you sign in.
- **Optionally** push `silver.webp` (394KB) and `money.webp` (323KB) under the
  300KB guideline (they stayed slightly over at the requested q80/2048
  because they are large detailed photos) — drop to q75 or cap ~1600px if
  desired.
- **Remaining shop performance work (deferred — higher risk, left for a
  focused follow-up):**
  1. **DB-side pagination/faceting.** `shop/page.tsx` still fetches ALL public
     rows (including `images`/`tags` arrays) then filters/sorts/slices in JS
     to build facets. Push the visible page to `.range(start,
     start+perPage-1)` and compute brand/price/count facets via a separate
     lightweight aggregate query or materialized view, rather than over the
     full row set each request.
  2. **Make bare `/shop` (no query params) static/ISR** instead of fully
     dynamic. It awaits `searchParams` for filters, which opts the whole
     route into dynamic SSR even for the no-filter external-link case. Split
     the default catalog into a statically generated segment + client-side
     URL filtering, or render the no-filter view from a `'use cache'`
     segment.
  3. **Server-render `ProductCard`'s static markup**; isolate only the
     interactive bits (cart/wishlist buttons, hover carousel, rAF image-load
     poll) into small client islands.
  4. **Re-encode oversized `/public` page images** that violate the
     2048px/WebP rule: `shop-new-listing-06-05.jpg` (~1.07 MB), `money.webp`
     (~882 KB), and regenerate the brand `logo.webp` source (491 KB) smaller.
  5. Consider self-hosting/subsetting the Material Symbols icon glyphs
     actually used (~12) to drop the third-party render-blocking font
     stylesheet entirely. (The `google-font-display` lint warning it used to
     cause is already resolved — a scoped suppression on the `<link>` explains
     that `display=block` is intentional for an icon font; this item is now a
     pure perf optimization, no longer a lint fix.)
  6. **Done 2026-07-05:** product-detail double DB query deduped via `React.cache`
     on `fetchPublicProduct` (generateMetadata + page now share one query).
- Migrate the remaining legacy local-only product photos to Supabase Storage
  so product image bytes live consistently outside the app bundle. Current
  audit: 19 local-only products plus 1 mixed product still reference local
  `/assets/...` product images, now as optimized WebP paths where applicable.
- `chris@naplesestatejewelry.co` is confirmed a real mailbox (owner, 2026-07-05).
  Still worth confirming **Resend allows sending FROM** that address/domain (SPF/DKIM
  verified in Resend) if any mail is sent from it. Optionally set `MARKETING_CHRIS_FROM`,
  `MARKETING_CHRIS_REPLY_TO`, and `MARKETING_NOREPLY_FROM` if the default sender labels
  should differ.
- Have business owner/counsel review the new Privacy Policy, Terms of
  Service, Returns & Refunds, Shipping Policy, Auction Terms, Vendor Terms,
  and Accessibility Statement before relying on them in production.
- AI assistant environment variables are set in Netlify (owner, 2026-07-05:
  "all working env in Netlify … includes sandbox, ai assistant, etc."). Verify live
  generation works after deploy. Vars: `AI_PROVIDER`, `AI_MODEL`, the provider API key
  / local endpoint, and optional `AI_MODEL_FAST`, `AI_MAX_IMAGES`, `AI_RATE_LIMIT_HOURLY`,
  `AI_RATE_LIMIT_DAILY`.
- Correct the current duplicate live inventory `#21` product row if it's
  still present (flagged 2026-06-15).
- Verify Supabase **Auth → URL configuration** redirect URLs include
  `https://naplesestatejewelry.co/**`, `http://localhost:3000/**`, and
  `http://127.0.0.1:3000/**`.
- Fill in unknowns in `CLIENTS.md` (Netlify site name/ID, DNS registrar,
  maintenance plan, billing status, credential locations) — confirmed still
  blank as of 2026-07-02.
- Expand shop beyond gold (silver / diamonds / antiques categories) when
  inventory is ready.
- Add basic analytics if not already present.
- Confirm whether a self-hosted metal-price API key/rate limit is needed for
  production traffic.

> **Note on older migration items:** a large batch of "apply supabase/X.sql"
> items from the 2026-06-15 → 06-20 sessions (product type/metal/brand/
> jewelry-type variants, homepage subscribers, sales workflow, admin profile
> read policy, order-item line discounts, admin notifications checkout,
> carousel + AI-settings setup) was removed from this list on 2026-07-02 —
> those features are confirmed live in "What Is Currently Working"
> (`CURRENT_STATUS.md`) and their completion is recorded in `CHANGELOG.md`.
> If one of those ever turns out to still need a live-DB migration, re-add it
> here with the specific broken behavior observed.

## In Progress

- (None)

## Completed

> Full dated history lives in `CHANGELOG.md` (newest first, back to project
> start) — this section is intentionally just a short pointer, not a mirror
> of it.

- **2026-07-07 (later):** The Category sidebar buttons (Jewelry & Watches /
  Sterling Silver) now deselect when re-clicked while active, clearing
  `itemGroup` + its paired metal/purity params instead of re-pinning the same
  value. `npm run lint`/`tsc`/`npm run build` pass; confirmed live.
- **2026-07-07:** Added a lightweight loading spinner over the shop results panel
  for filter/sort/view/year/pagination navigations (shared `useTransition`-backed
  context + `useLinkStatus` for `<Link>` pagination), debounced 150ms so instant
  navigations never flash it. `npm run lint`/`tsc`/`npm run build` pass; confirmed
  live on desktop + mobile with network throttling.
- **2026-07-06 (even later):** Fixed `/shop` filter dropdowns (Brand, dynamic Item
  Type entries) so an active filter no longer narrows what shows up in that (or
  another) dropdown next time it's opened — options now come from an always-
  unfiltered catalog read. `npm run lint`/`tsc`/`npm run build` pass; confirmed live.
- **2026-07-06 (later):** Added a per-item **"Show spot / melt value on storefront"**
  admin toggle (`products.show_spot_price`, default true) for items that aren't 100%
  precious metal; the product page shows a short note instead of the melt/scrap-value
  box when off. `npm run lint`/`tsc`/`npm run build` pass. SQL migration + live
  verification tracked in Backlog.
- **2026-07-06:** Removed the admin product form's **Asking Price** input from New Item
  and Edit Item. Manual fixed pricing now uses **Price Label** as the visible source of
  truth; quick-fill/AI asking-price values fold into `manual_price_label`, product
  saves clear `asking_price`, bare numeric labels normalize centrally (`1` -> `$1`),
  cart/checkout/order snapshots parse the same helper, and New Item has a **Quick add**
  checkbox for title + fixed-price listings without spot-pricing requirements. `npm run
  lint` and `npm run build` pass.
- **2026-07-06:** Removed the manual **Reserved** product status from Product Admin:
  no Reserved metric card, status option, row action, or quick-fill token. Legacy stored
  `reserved` values normalize to `available`, and docs/AI prompt/current SQL constraint
  were updated to the active status lifecycle. `npm run lint`, `npm run build`, and
  browser preview verification passed.
- **2026-07-06:** Changed the admin **Orders** nav badge to count unseen active orders,
  not paid/pending-fulfillment orders. It ignores Recycle Bin rows and clears when the
  active Orders area or an order detail page is viewed. `npm run lint`, `npm run build`,
  and browser preview verification passed.
- **2026-07-05 (invoice generation):** Added idempotent invoice generation for PayPal
  create-order, paid capture, and manual admin order creation; added
  `POST /api/admin/orders/[id]/invoice`; and added the order-detail **Generate Invoice /
  Refresh Invoice** recovery button for older orders with no invoice row. Lint/tsc/build
  clean; preview confirmed the missing-invoice paid test order shows the new button.
- **2026-07-05 (admin order print preview):** Added a direct **Print Order** action on
  order detail, backed by `/admin/orders/[id]/print`, with an admin-authenticated
  paper-style preview window and a Print toolbar button. Lint/tsc/build clean; browser
  preview confirmed the route opens and layout chrome is hidden from the preview.
- **2026-07-05 (admin inventory restore override):** Added **Restore item to inventory**
  on order detail, changed delete confirmation to include **Move to Recycle Bin and
  return to inventory**, and allowed paid/completed orders through the soft-delete path.
  Lint/tsc/build clean; UI click verification remains in Backlog because admin preview
  redirected to sign-in.
- **2026-07-05 (orders recycle bin):** Added soft-delete Orders Recycle Bin UI and SQL
  migration, switched list/detail deletes to `orders.deleted_at`, and fixed the paid
  return-to-inventory warning so it is no longer shown behind the modal overlay. Code
  is lint/tsc/build clean; owner applied the SQL and non-destructive route verification
  passed. Behavior verification with a deliberate test order remains in Backlog.
- **2026-07-05:** Fixed two shop bugs + a batch of UX-friction items from the UX
  walkthrough. Bugs: (1) product soft-404 (unknown `/shop/[id]` now returns a real
  404 via a `shop/(list)/` route group that scopes the loading boundary off `[id]`
  + an early `notFound()` in product `generateMetadata`); (2) sold product pages no
  longer show "This is your price" and now keep an Inquire/Call CTA. UX friction:
  free-evaluation photos now optional (photo-or-description guard); sign-in shows
  friendly localized errors; saved-items drawer shows the live computed price;
  ES nav "Tienda/Tienda" → "Tienda ▸ Catálogo"; cart/checkout item pluralization;
  and (follow-up) the account auth pages (sign-in/sign-up/reset-password) are now
  fully localized for /es. A final full EN+ES walkthrough passed with no console
  errors. Build/tsc clean. See `CHANGELOG.md` 2026-07-05.
- **2026-07-05 (later):** FL sales tax no longer charged on out-of-state shipments
  (owner decision) — fixed in `checkout-pricing.ts` (authoritative), threaded through
  `/api/paypal/create-order` and the checkout page's live estimate, plus the admin
  manual-order form. Added an Add to Cart button to the Saved Items drawer, and fixed
  a real crash bug found while verifying it (provider nesting had `WishlistDrawer`
  outside the `CartContext` tree). See `CHANGELOG.md` 2026-07-05 (later) entries.
- **2026-07-05 (final batch):** FL tax standardized to **6% everywhere** (centralized
  `FL_TAX_RATE`); admin **Reopen Order** button added; **lint driven to 0 problems**
  (was 12); product-page double query deduped via `React.cache`. See `CHANGELOG.md`
  2026-07-05 (final batch).
- **2026-07-05 (checkout UX):** Signed-out shoppers now get a **Log In / Create Account
  / Continue as Guest** gate when they click Proceed to Checkout (verified live); the
  post-PayPal confirmation gained a **View & Print Order Details** printable receipt for
  guests (build-verified; live round-trip needs a PayPal sandbox buyer). Admin
  out-of-state/6% tax verified live. See `CHANGELOG.md` 2026-07-05 (checkout UX).
- **2026-07-02:** PayPal checkout hardened (reload/eviction resume, stale-total
  retry fix) + shop-gallery cache now purged after every admin order-flow
  product write. See `CHANGELOG.md` 2026-07-02 entries.
- **2026-06-29:** PayPal Orders API v2 checkout wired into `/checkout`,
  sandbox Test 1 passed end-to-end, admin order delete/return-to-inventory
  added. See `CHANGELOG.md` 2026-06-29.
- **2026-06-13 → 2026-06-25:** Legacy static site fully removed, Next.js/
  Supabase app became the sole deploy target; sales workflow, AI listing
  assistant, compliance/legal pages, unified admin inbox, and a broad shop/
  responsive/performance pass were built out. See `CHANGELOG.md` for the
  day-by-day detail.
