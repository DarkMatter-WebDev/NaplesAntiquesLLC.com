# 14 — Verification Plan & Checklists

> Planning only. Per project rules: nothing gets marked done without citable
> verification; every phase ends with `npm run build` (+ `npm run lint` +
> unit tests for TS/React changes) from `next-app/`, and results recorded in
> `project-docs/CURRENT_STATUS.md`.

## Reality check: eBay HAS a sandbox (unlike Etsy) — but a leaky one

`api.sandbox.ebay.com` + `sandbox.ebay.com` is a real self-contained test
environment with developer-created test users (`TESTUSER_*`) and fake money.
The full Inventory/Account call sequence works there. Known gaps that matter
to us (from eBay's own unsupported-features list): **gallery/images render
unreliably**, catalog/category data is partial, fees don't match production,
search is mostly non-functional, and no emails send. So:

| Test tier | Environment | Cost |
| --- | --- | --- |
| Unit tests on `mapping.ts` (pure functions) | local | Free |
| Dry-run preview end-to-end | local/prod build, no eBay calls | Free |
| OAuth round-trip, policy reads, location create, item+offer create, **publish**, withdraw | **Sandbox** (test seller user) | Free |
| Account-deletion endpoint challenge + test notification | Production keyset (portal "Send Test Notification") | Free |
| Final listing quality (photos, aspects, description rendering, fees) | **Production, one real cheap item** — publish is public and buyable, so use a genuinely-for-sale low-value piece | ~$0 to list (within free allocation); FVF only if it sells |

The production smoke test replaces Etsy's "no sandbox, $0.20 drafts" plan:
sandbox proves the *mechanics*, one real listing proves the *quality*.

## Buildable before any eBay account exists

- [x] **Done 2026-07-09 (session 14).** `mapping.ts` + 49 unit tests: 80-char
      word-boundary title truncation (boundary cases incl. exact-80 and a
      single unbroken 90-char word), aspect mapping, Fine-vs-Fashion/vermeil
      routing, Coin/Bullion ineligibility, condition selection, price
      flattening for both `price_mode`s incl. the eBay markup, image URL
      absolutization for both shapes, **allowlist guarantee** (asserts
      `cost_basis`/`minimum_price`/`internal_notes`/etc. never appear in any
      serialized payload). Deviation: SELECTION_ONLY matching against real
      eBay aspect-value lists could NOT be verified/implemented — no live
      Taxonomy access in the build environment; aspect values are best-effort
      and flagged with a permanent informational pre-flight warning instead.
      See `project-docs/features/ebay-sync.md` gap #2.
- [x] **Done 2026-07-09 (session 14).** Pre-flight logic
      (`buildPreflightChecks`) + dry-run route (`POST /api/admin/ebay/preview`)
      + admin preview UI (`EbayProductPanel.tsx`) — no eBay calls.
- [x] **Done 2026-07-09 (session 14).** `supabase/ebay-sync.sql` drafted, not
      run — 4 tables + claim RPC, `products.id` FK as `text`.
- [x] **Done 2026-07-09 (session 14).** Account-deletion webhook route
      (`/api/webhooks/ebay-account-deletion`) with the challenge-echo hash,
      unit-tested (9 tests) incl. the exact SHA-256 concatenation order
      (`challengeCode + verificationToken + endpoint`) and the
      signature-verify failure path (412). Deviation: the POST path's
      `X-EBAY-SIGNATURE`/`getPublicKey` parsing is implemented from
      commonly-documented conventions, not a live-verified contract — see
      `ebay-sync-plan/OWNER-SETUP.md` step 9.

## Phase 0/1 verification (sandbox first, then owner's real account)

Order matters; stop at the first failure.

1. [ ] **Keyset activation:** portal shows the production keyset enabled
       after the account-deletion subscription; "Send Test Notification"
       arrives, verifies signature, acks, and lands in `webhook_events` +
       `ebay_sync_log`.
2. [ ] **Sandbox OAuth round-trip:** connect with a `TESTUSER_` seller →
       callback → `ebay_connection.status='connected'`, tokens stored
       3-part-encrypted (`iv.tag.ciphertext`), `access_token_expires_at`
       ≈ +2h, `refresh_token_expires_at` ≈ +18 months, state row consumed.
3. [ ] **Token refresh:** force-expire `access_token_expires_at`, run a
       status read, confirm silent refresh; **refresh token unchanged**
       (non-rotating — assert it was NOT overwritten with `"N/A"` or empty).
4. [ ] **Defaults:** policies + location round-trip (create policies on the
       sandbox test user via Seller Hub sandbox or API; dropdowns populate
       and save; `createInventoryLocation` idempotent on re-run).
5. [ ] **Sandbox publish lifecycle:** item PUT → offer create →
       `getListingFees` → publish → `listingId` saved → `updateOffer`
       revises → `bulkUpdatePriceQuantity` price change → quantity-0 hide
       (if Q7=A) → restore → withdraw → re-publish gives a NEW listingId and
       the row updates correctly.
6. [ ] **Idempotency drills:** re-run every step against already-done state
       (second item PUT converges; second `createOffer` adopts via
       `getOffers?sku=`; second publish adopts via `getOffer`) — zero
       duplicate offers/listings.
7. [ ] **Production OAuth + first real publish (owner's account):** dry-run
       5+ products spanning cases (spot chain, manual-priced, ring size,
       vermeil→Fashion routing per Q4, a Coin/Bullion item showing clean Q6
       ineligibility, a silverware item per Q6b, **an item priced over
       $1000 showing it resolves to the "NEJ Express High-Value" policy
       rather than "NEJ Insured Flat Rate" per Q16**); publish ONE cheap
       real item review-first; verify on ebay.com: photos in order (WebP
       ingested), gallery correct, title ≤80 reads well, aspects
       (Metal/Purity/Length) shown, condition "Pre-owned" with the Q5
       template text, price = site × (1 + markup), and (on the high-value
       item, once published) the listing's shipping section actually shows
       FedEx 2Day / 1-business-day handling.
8. [ ] **Error paths:** missing-purity fine-jewelry item blocked at
       pre-flight; disconnect mid-flight → `needs_reauth` banner, product
       states stay `pending`. (Selling-limit rejection mapping exists as a
       safety net but isn't expected to be triggerable on this account —
       Q14; verify the message copy by unit test instead.)
9. [ ] **Delist/relist:** mark the test product sold on-site → hide/withdraw
       per Q7 → verify on eBay; revert to available → restore/republish.
10. [ ] `npm run build` + `npm run lint` + `npx vitest run` clean; docs
        updated (`project-docs/` + `features/ebay-sync.md`).

## First LIVE listing checklist (before publishing anything public)

- [ ] Owner reviewed the dry-run payload (title, photos, price, aspects,
      condition wording) — remember: **publish = live and buyable
      immediately**, there is no platform-side draft.
- [ ] Shipping policy is real (insured/signature for gold, correct handling
      time) — a live sale is a contractual commitment; eBay seller
      protection on high-value items depends on tracked/signature delivery.
- [ ] Return policy content matches what the owner will actually honor.
- [ ] Item is genuinely available on-site (`available`, qty ≥ 1) and the
      owner knows a site sale needs a **manual** eBay hide in Phase 1.
- [ ] Price sanity: eBay price = site price × (1 + Q2 markup); spot items:
      owner accepts staleness until Phase 2 scheduling.
- [ ] Selling-limit headroom confirmed for this item's value.
- [ ] If fine jewelry above the Authenticity Guarantee threshold
      (`TODO(ebay-verify)` the current threshold): owner understands the
      AG shipping flow before publishing such items.
- [ ] Publish → verify the public listing renders correctly → record listing
      URL + verification note in `project-docs/CURRENT_STATUS.md`.

## Phase 2 verification highlights

- [ ] Bulk pre-flight summary matches a hand-count (eligible / ineligible —
      incl. every Coin/Bullion item under the Q6 reason / up-to-date /
      errors); supervised full publish → listings on eBay = eligible count,
      no duplicates (SKU audit via `getOffers` paging).
- [ ] Live site sale (real PayPal capture) auto-hides on eBay — timed; and
      the Etsy auto-delist still fires (no regression at the shared
      chokepoints — explicit check).
- [ ] Price push: observed push on >1% spot move, observed skip on a quiet
      day (log evidence for both); eBay price matches `calcSpotPriceValue` ×
      eBay markup; revision-count logging sane.
- [ ] Compliance sweep returns zero `ASPECTS_ADOPTION` violations (or they
      surface as warnings with actionable text).
- [ ] A full week unattended with no `error`-state surprises on either
      channel.

## Phase 3 verification highlights

- [ ] Poll cursor advances; replaying a window twice is a no-op
      (`order_ingest` idempotency).
- [ ] Test purchase on eBay (sandbox first, then a real cheap item) →
      product `sold` on site within one poll interval, gone from `/shop`
      (cache revalidated), log row written.
- [ ] Conflict drill: mark item sold on-site, then let the poll ingest its
      eBay order → admin notification, no silent overwrite.

## Ongoing audit (monthly, manual, 5 minutes)

- [ ] `getOffers` published count vs `ebay_listings` `published` rows —
      investigate strays (orphaned listings, manual listings are expected
      strays per Q13).
- [ ] `ebay_sync_log` errors reviewed; selling-limit snapshot refreshed;
      reconnect countdown checked (18-month horizon).
- [ ] Compliance violations summary clean.
