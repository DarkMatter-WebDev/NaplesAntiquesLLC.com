# 14 — Verification Plan & Checklists

> Planning only. Per project rules: nothing gets marked done without citable
> verification; every phase ends with `npm run build` (+ `npm run lint` for
> TS/React changes) from `next-app/`, and results recorded in
> `project-docs/CURRENT_STATUS.md`.

## Reality check: there is no Etsy sandbox

Etsy v3 has **no sandbox environment** — testing happens against the real
API and the owner's real shop. The safety levers are: draft listings are
private until activated, dry-run needs no Etsy calls at all, and listing fees
are $0.20 apiece (cheap test budget). Plan accordingly:

| Test tier | Needs app approval? | Cost |
| --- | --- | --- |
| Unit tests on `mapping.ts` (pure functions) | No | Free |
| Dry-run preview end-to-end | No (no Etsy calls) | Free |
| OAuth + read endpoints (`getMe`, taxonomy, shipping profiles) | **Yes** | Free |
| Draft listing lifecycle (create → images → inventory → delete) | Yes | $0.20 per draft… **verify at build time whether the fee applies at creation or activation**; either way trivial |
| Activation / live listing | Yes | $0.20 + it's publicly visible — use a real product intended for sale |

## While app approval is pending (buildable now)

- [x] ✅ **2026-07-08** Write `mapping.ts` + unit tests: title truncation (140), tag rules
      (13 × 20 chars, prefix stripping), materials, `when_made` buckets incl.
      boundary years and the `1990s` fallback for post-2006/missing years
      (Q2), price flattening for both `price_mode`s incl. the 8% Etsy markup
      (Q5) and `< $0.20` rejection, allowlist guarantee (assert private fields
      like `cost_basis` can never appear in any payload).
      — `next-app/src/lib/etsy/mapping.ts` +
      `next-app/src/lib/etsy/__tests__/mapping.test.ts` (28 tests, all pass).
- [x] ✅ **2026-07-08** Pre-flight logic + dry-run route + admin preview UI (no Etsy needed).
      — `buildPreflightChecks`/`buildMappedPayload` in `mapping.ts`,
      `POST /api/admin/etsy/preview`, dry-run UI in `EtsyProductPanel.tsx`.
- [x] ✅ **2026-07-08** (deviation) Image transcode path against local fixtures (WebP w/ and w/o alpha →
      JPEG; format sniffing; oversized file guard).
      — `next-app/src/lib/etsy/__tests__/images.test.ts` (11 tests). **Deviation:**
      fixtures are generated in-memory via `sharp` inside the test file rather
      than committed as local binary files, per `AGENTS.md`'s "keep the folder
      pristine" rule — still exercises the real WebP encode/decode path.
      Format sniffing is implicit (sharp reads magic bytes, not extensions).
      The oversized-file guard (`MAX_UPLOAD_BYTES` in `images.ts`) is
      implemented but not unit-tested (it requires a live fetch); the cap
      itself is an unverified placeholder — see the OWNER-SETUP.md TODO.
- [x] ✅ **2026-07-08** (partial) Supabase migration script drafted (not run) + RLS verified in a scratch
      project if desired.
      — `supabase/etsy-sync.sql` written (5 tables + a queue-claim RPC), RLS
      enabled with no anon/authenticated policies. **Not run against any
      project** (live or scratch) — no Supabase scratch project was available
      in this build environment; this is the first item on
      `etsy-sync-plan/OWNER-SETUP.md`.
- [x] ✅ **2026-07-08** (partial) Pull the live OpenAPI JSON; pin: `when_made` enum values, image
      constraints, rate-limit header names, error body shape. Record findings
      in `project-docs/features/etsy-sync.md` when it's created.
      — Fetched `https://www.etsy.com/openapi/generated/oas/3.0.0.json`.
      `when_made` enum: **confirmed**, 19 values (see `mapping.ts` + 
      `project-docs/DECISIONS.md` 2026-07-08). Error body shape: reasonably
      inferred from what the fetch returned (`{error, error_description}` for
      OAuth; a `message`/`error` field on other 4xx). **Image constraints,
      rate-limit header names, and the readiness-state endpoint path could
      NOT be resolved** — the tool's fetch of this large spec truncated
      before reaching those sections. Pinned with `TODO(etsy-verify)`
      comments and best-guess defaults in `images.ts`/`client.ts`/
      `shop-profiles/route.ts`; findings recorded in
      `project-docs/features/etsy-sync.md` and `OWNER-SETUP.md`.
      **Addendum, same day:** the owner supplied a full local spec copy
      (the web fetch above had silently truncated), which resolved the
      readiness-state endpoint path (confirmed correct) and the image-rerank
      question (confirmed: no such endpoint exists) — down to 2 genuinely
      unresolved items (image constraints, rate-limit headers). It also
      surfaced two real bugs the truncated fetch had missed entirely: the
      `x-api-key` header format (`keystring:shared_secret`, not the
      keystring alone) and the API host (`openapi.etsy.com`, not
      `api.etsy.com`) — both fixed. Taxonomy IDs were then pinned via a real,
      successful `getSellerTaxonomyNodes` call. See
      `project-docs/DECISIONS.md` 2026-07-08 "even later" and "latest".

## Phase 1 verification (first real connection — owner's shop)

Order matters; stop at the first failure.

1. [x] ✅ **2026-07-08 — verified live.** OAuth round-trip: connected from
       `/admin/settings` → callback succeeded → `etsy_connection.status =
       'connected'`, real `shop_id`/`shop_name` populated, `scopes` matches
       the 5 requested exactly, `etsy_sync_log` shows one `connect`/`ok` row.
       Confirmed via direct Supabase REST query (service role): both
       `access_token_enc` and `refresh_token_enc` are 3-part
       `iv.tag.ciphertext` (not bare tokens), `access_token_expires_at` is
       exactly +1h from `connected_at` (matches Etsy's documented token
       lifetime), and `etsy_oauth_states` has 0 rows (the handshake row was
       consumed on callback, as designed).
2. [ ] **Token refresh:** force-expire `access_token_expires_at`, run a
       status read, confirm silent refresh + rotated refresh token persisted.
3. [ ] **Defaults:** shipping profile / return policy / readiness state
       dropdowns populate from the real shop and save.
4. [ ] **Dry-run vs reality:** preview 5 products spanning cases (spot-priced
       chain, manual-priced item, ring with size-in-`length`, no-year item
       showing the flagged `1990s` fallback, >10-images item warned).
5. [ ] **First draft publish (test product):** pick a cheap real item →
       Sync → verify **on Etsy**: draft exists, all photos in order and
       primary correct (WebP→JPEG artifacts eyeballed), price/qty/SKU right,
       attributes right, `etsy_listings` + `etsy_listing_images` rows match.
6. [ ] **Idempotency:** click Sync again → zero new Etsy objects, zero
       duplicate images (log shows no-op/skips).
7. [ ] **Resume:** interrupt an image-heavy sync mid-way (close tab) →
       reopen → Sync → completes without duplicates.
8. [ ] **Update path:** change title + price + swap a photo → Sync updates →
       only the changed things pushed (log confirms), Etsy reflects all three.
9. [ ] **Delist/relist:** mark test product sold on-site → Delist button →
       listing inactive on Etsy; revert to available → Reactivate.
10. [ ] **Error paths:** image-less product blocked at pre-flight with a
        clear message; disconnect mid-flight → `needs_reauth` banner, no
        `error` states on products; bogus price (< $0.20) surfaces the mapped
        message.
11. [ ] `npm run build` + `npm run lint` clean; docs updated.

## First LIVE listing checklist (before activating anything public)

- [ ] Owner reviewed the draft on Etsy and approves copy/photos/price.
- [ ] Shipping profile is real (insured, correct handling time) — a live sale
      is a real contractual commitment.
- [ ] Return policy on Etsy matches `/returns-refunds`.
- [ ] Item is genuinely available on-site (`available`, qty ≥ 1) and the
      owner knows a site sale still needs a **manual** Etsy delist in Phase 1.
- [ ] Price sanity: Etsy price = site price × 1.08 (Q5 markup); spot items:
      owner accepts price staleness until Phase 2 scheduling.
- [ ] Item's real age honestly supports the vintage claim; if it pushed with
      the `1990s` fallback, owner has eyeballed that this specific piece is
      genuinely 20+ years old (Q2 attestation).
- [ ] Trademark attribution present in the admin panel ([15-compliance.md](15-compliance.md)).
- [ ] Activate → verify public listing renders correctly → record listing
      URL + verification note in `project-docs/CURRENT_STATUS.md`.

## Phase 2 verification highlights

- [ ] Bulk pre-flight summary matches a hand-count of eligible items;
      supervised full publish → count listings on Etsy = eligible count, no
      duplicates (SKU audit via `getListingsByShop`).
- [ ] Live site sale (real PayPal capture) auto-delists on Etsy — timed.
- [ ] Price push: observed push on >1% spot move, observed skip on quiet day
      (log evidence for both); Etsy price matches `calcSpotPriceValue` ×
      markup.
- [ ] Refresh token stays warm across a week of scheduled runs.

## Phase 3 verification highlights

- [ ] Webhook signature: valid accepted, tampered rejected (401).
- [ ] Replay the same event id twice → second is a no-op (`webhook_events`).
- [ ] Test purchase on Etsy (owner buys own $-cheap item or uses a helper) →
      product `sold` on site within seconds, gone from `/shop` (cache
      revalidated), log row written.
- [ ] Conflict drill: mark item sold on-site, then process its Etsy receipt →
      admin notification, no silent overwrite.

## Ongoing audit (monthly, manual, 5 minutes)

- [ ] `getListingsByShop(state=active)` count vs `etsy_listings` `active`
      rows — investigate strays (orphaned listings, hand-made listings).
- [ ] `etsy_sync_log` errors reviewed; quota-headroom entries sane.
