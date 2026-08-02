# Build Prompt — eBay Sync Implementation

> Hand this entire prompt (everything below the line) to the implementing AI
> agent, verbatim. Added 2026-07-09 after all 16 planning decisions were made
> ([13-open-questions.md](13-open-questions.md), incl. Q16 added mid-session).
> Companion file: [OWNER-SETUP.md](OWNER-SETUP.md) — the owner's manual
> checklist. **Steps 1 and 7 are already done live** against the real eBay
> account (keysets exist; all four Business Policies exist, including the
> new Q16 express-shipping tier) — the implementing agent finalizes the rest
> of the file (see "Ending protocol").

---

## Mission

Implement the eBay sync feature for this project, end to end, using the
planning folder **`ebay-sync-plan/`** at the project root as the **100%
source of truth**. Do not deviate from it. Do not redesign, simplify,
substitute libraries or architecture, rename proposed tables/routes/modules,
or "improve" decisions — every architectural and product decision has already
been made and approved by the owner. If you believe the plan contains an
error, do not silently work around it: implement what is buildable, and
record the discrepancy in your final report instead of deviating.

## Read first, in this order (before writing any code)

1. `AGENTS.md` (project root) — hard project rules. Note especially: **this
   folder is NOT a git working copy — never run any git command**, keep the
   folder pristine, cite file:line evidence for claims, never mark something
   done without verification.
2. `project-docs/PROJECT_OVERVIEW.md`, `project-docs/CURRENT_STATUS.md`,
   `project-docs/TASKS.md`, `project-docs/CHANGELOG.md` (2026-07-09
   session 13 entries = the eBay plan + decisions summary).
3. The entire `ebay-sync-plan/` folder — all docs. `README.md` is the index;
   `13-open-questions.md` contains the **final owner decisions** (all 16
   decided — treat them as requirements, not suggestions);
   `12-phased-rollout.md` defines build order and exit criteria. Note that
   `12-phased-rollout.md` and `OWNER-SETUP.md` already show Phase 0's
   registration + keyset step and the Business Policies step as **done**
   against the real account — don't redo them or ask the owner to.
4. **The shipped Etsy integration — your primary implementation reference.**
   The plan deliberately mirrors it: `next-app/src/lib/etsy/` (`client.ts`,
   `auth.ts`, `mapping.ts`, `sync.ts`, `store.ts` — study the throttle/
   backoff/typed-error shape, the AES-GCM token encryption, the allowlist
   mapper, the step machine, the queue-drain guards),
   `next-app/src/app/api/admin/etsy/*` (route + admin-gating patterns),
   `EtsySettingsPanel.tsx` / `EtsyProductPanel.tsx` / `EtsyBulkSyncModal.tsx`
   (admin UI patterns), `supabase/etsy-sync.sql` (migration style; note
   `products.id` is **text**, not uuid), and
   `project-docs/features/etsy-sync.md` (what production taught the Etsy
   build — the bulk-runaway fixes, chip-staleness fixes, markup-save UX).
   **Read the Etsy code to copy its shape; never modify it** (see hard
   rule 9).
5. Existing code the plan tells you to call, never reimplement:
   `next-app/src/lib/pricing.ts` (`calcSpotPriceValue`,
   `parseManualPriceLabelValue`), `next-app/src/types/product.ts` (product
   contract incl. `normalizeProductQuantity`, `inferProductJewelryType`,
   `normalizeProductLengthSizeValue`),
   `next-app/src/app/actions/admin-products.ts` (the product-write
   chokepoints Phase 2 hooks into).

## Scope

- **Build Phase 1 fully, then Phase 2 fully**, exactly as scoped in
  `ebay-sync-plan/12-phased-rollout.md`. Phase 0's one code artifact — the
  **marketplace account-deletion webhook**
  (`/api/webhooks/ebay-account-deletion`, GET challenge + POST
  signature-verified ack per `09-api-routes.md` and `15-compliance.md`) —
  is **in scope and must be built first**; the owner cannot activate the
  production keyset without it deployed.
- **Do NOT build Phase 3** (eBay order ingest / `orders-poll`). The owner
  decided manual handling of eBay sales is fine (Q15). Leave the seams the
  plan describes (`ebay_connection.orders_cursor` column exists in the
  migration; the route does not).
- Phase 0 items that are owner-manual are **not yours** — they live in
  [OWNER-SETUP.md](OWNER-SETUP.md), which you finalize (see "Ending
  protocol"). Two of them are **already done** (Developers Program
  registration + keysets; all four Seller Hub Business Policies, including
  the Q16 express tier) — don't ask the owner to redo them. Still pending
  and still not yours: RuName configuration, the account-deletion portal
  subscription, Netlify env values, running SQL in Supabase, the OAuth
  connect click.

## Hard rules (violating any of these is failure)

1. **No git commands, ever.** No commits, branches, stashes, status — nothing.
2. **No secrets.** Env var *names* only (per
   `ebay-sync-plan/04-oauth-and-secrets.md`). Never write values, never
   commit `.env*`, never log tokens or the `Authorization` header; implement
   the redaction rules in `ebay-sync-plan/11-error-handling.md`. The OAuth
   authorization `code` is never logged or stored.
3. **SQL is written, never executed.** Write the migration exactly per
   `ebay-sync-plan/08-database-schema.md` to `supabase/ebay-sync.sql`
   (additive only, RLS-enabled service-role-only tables, `products.id` FK as
   **text**, claim RPC included, following the style of
   `supabase/etsy-sync.sql`). Running it in the live Supabase project is an
   owner action — flag it loudly, per project convention.
4. **No image bytes anywhere.** The eBay design never touches image bytes at
   all — `product.imageUrls` gets absolutized public HTTPS URLs per
   `ebay-sync-plan/05-image-pipeline.md`. Do not build a transcode/upload
   pipeline; do not add the Media API fallback (it is documented, not
   scoped).
5. **Supabase `products` stays source of truth.** Nothing ever writes our
   catalog from eBay data.
6. **Follow the plan's file layout exactly**: `next-app/src/lib/ebay/`
   (`client.ts`, `auth.ts`, `mapping.ts`, `sync.ts`, `store.ts` — note: no
   `images.ts`), routes per `ebay-sync-plan/09-api-routes.md`, admin UI per
   `ebay-sync-plan/07-admin-ux.md`, tables per
   `ebay-sync-plan/08-database-schema.md`.
7. **Decisions from `13-open-questions.md` are law**, including:
   review-first default — sync stops at `review`, publish is a distinct
   explicit `publish-live` action whose UI copy says the listing goes public
   immediately (Q1); admin-variable markup seeded 15%, with the Etsy panel's
   exact save/stale-callout/push-now interaction (Q2); daily ≥1%-threshold
   price push via `bulkUpdatePriceQuantity` (Q3); vermeil →
   Fashion Jewelry categories, solid pieces → modern Fine Jewelry leaves
   (Q4/Q4b); condition `USED_EXCELLENT` + one standard
   `conditionDescription` template for all items (Q5); **Coin/Bullion
   product types are ineligible** — pre-flight marks them with a clear
   owner-decision message, never an error; Silverware IS eligible (Q6/Q6b);
   sold-on-site → quantity-zero hide (Out-of-Stock Control), withdraw only
   for archived/deleted (Q7); flat-rate policies — no `packageWeightAndSize`
   in payloads (Q8a); `bestOfferTerms` omitted entirely (Q9); the
   account-deletion webhook is built and registered, no opt-out (Q10);
   `ebay_sku = products.id` verbatim (Q11); no store categories
   (`storeCategoryNames` unused, Q12); no reconciliation UI — the sync only
   touches listings recorded in `ebay_listings` (Q13); selling-limit
   surfaces are informational only, never gates (Q14); no Phase 3 (Q15);
   **price-tiered express shipping (Q16, added mid-session 2026-07-09):**
   `offer.listingPolicies.fulfillmentPolicyId` is resolved at mapping time
   by comparing the flattened price against
   `ebay_connection.high_value_shipping_threshold` (admin-editable, seeded
   $1000) — over threshold uses `express_fulfillment_policy_id`, else the
   standard `fulfillment_policy_id`; both policies already exist live on
   the eBay account ("NEJ Insured Flat Rate", "NEJ Express High-Value" —
   see `OWNER-SETUP.md` step 7) so no Seller Hub work is needed, only the
   settings-panel pickers/threshold field and the mapper branch; the
   resolved policy ID must be part of the content hash so a price crossing
   the threshold triggers an update push.
8. **The only sanctioned judgment calls** are the spots the plan explicitly
   marks `TODO(ebay-verify)`: exact category leaf IDs + required-aspect
   tables + allowed condition IDs (resolve via live Taxonomy
   `getCategorySuggestions`/`getItemAspectsForCategory` and Metadata
   `getItemConditionPolicies` calls — these accept an application token from
   the client-credentials grant, so they work with just the keyset, no user
   consent), the `bulkUpdatePriceQuantity` request batching shape, the
   current fee schedule figures shown in the settings panel help text, the
   Authenticity Guarantee threshold note, whether user tokens survive a
   Cert ID reset, and localhost RuName acceptance. **Fetch each API's full
   published OpenAPI contract locally before coding against it** — the Etsy
   build was bitten twice by truncated spec reads (wrong auth-header format,
   wrong API host); do not repeat that. Record each resolution (what the
   plan assumed vs. what the contract says) in your final report and in the
   code where pinned. If a verification requires credentials you don't have,
   pin your best-supported value, mark it `TODO(ebay-verify)` in code, and
   add it to OWNER-SETUP.md.
9. **Never modify the Etsy integration.** `lib/etsy/*`, `/api/admin/etsy/*`,
   `Etsy*.tsx`, `supabase/etsy-sync.sql` are read-only reference. The single
   sanctioned shared edit is Phase 2's status-change hook: add the eBay call
   **next to** the existing Etsy call at the chokepoints listed in
   `ebay-sync-plan/03-sync-lifecycle.md` Flow 3, changing no Etsy behavior.
   If you extract any tiny shared utility (e.g. the AES-GCM helpers),
   prefer copying into `lib/ebay/` over refactoring `lib/etsy/` — keeping
   the live channel untouched outweighs DRY.

## Working style

- **Do not stop to ask questions.** Every product decision is already made.
  When something is impossible without owner input (credentials, live
  account, Netlify dashboard), build everything around it, stub nothing
  silently — gate it with a clear runtime error/admin message — and put it
  on OWNER-SETUP.md. Keep going until the webhook + Phases 1 and 2 are
  code-complete.
- Keep the folder pristine: no scratch files, no logs, no one-off scripts
  left behind. Temp work goes in your scratchpad, not the repo.
- Match existing conventions: TypeScript, App Router route handlers, admin
  UI English-only (matching `AdminShell.tsx` / the Etsy panels — inspect
  first), errors as `{ error: { code, message } }`.

## Testing between phases (do everything that doesn't need live eBay)

The buildable-now list is `ebay-sync-plan/14-verification-checklist.md`
§"Buildable before any eBay account exists". You have no tokens, so the
same boundary applies to you:

- **After the Phase 0 webhook:** unit-test the challenge hash (exact
  concatenation order `challengeCode + verificationToken + endpoint`, hex
  SHA-256, JSON body shape) and the signature-verify failure path (412).
- **After Phase 1 code:** unit tests for `mapping.ts` (80-char word-boundary
  title truncation incl. boundary cases; aspect mapping incl. SELECTION_ONLY
  matching and the metal/purity Fine-vs-Fashion routing incl. vermeil;
  Coin/Bullion ineligibility; condition + template; price flattening for
  both price modes incl. the markup; image URL absolutization for both URL
  shapes; the allowlist guarantee that private fields — `cost_basis`,
  `minimum_price`, `internal_notes`, etc. — can never appear in any
  serialized payload). Dry-run/preview exercised against the local dev
  server (port 3002 convention) in a disconnected state — verify pre-flight
  messages render. `npm run lint` and `npm run build` from `next-app/` must
  pass cleanly; run the existing vitest suite and keep it green. Record
  results.
- **After Phase 2 code:** same gates, plus unit tests for content-hash
  change detection, queue-drain claim/compare-and-set (two concurrent
  drains can't grab the same product; a re-enqueued item with an existing
  offer/listing id reaches a terminal state — port the Etsy runaway-fix
  tests' intent), price-push threshold logic, and the hide/withdraw hooks
  firing from the product-status chokepoints (function level) **without
  disturbing the Etsy hook** (assert both fire).
- Every live-eBay verification item in `14-verification-checklist.md`
  (keyset activation, sandbox lifecycle, production OAuth, first real
  publish, idempotency clicks, hide/restore, price push observation) goes
  in OWNER-SETUP.md as post-setup steps — **clearly marked untested by
  you**. Never claim them done.

## Documentation duties (part of the work, not optional)

- Update `project-docs/CURRENT_STATUS.md`, `TASKS.md`, `CHANGELOG.md`,
  `DECISIONS.md` (any build-time resolutions), and `ARCHITECTURE.md` (new
  tables/routes/module).
- Create `project-docs/features/ebay-sync.md` distilled from the plan +
  what you actually built (per the Phase 1 exit criteria), following the
  shape of `project-docs/features/etsy-sync.md`.
- The plan folder stays untouched except: you may add ✅/deviation
  annotations to `14-verification-checklist.md` items you completed, and
  you must finalize `OWNER-SETUP.md` (below).
- Record the exact verification commands run and their results.

## Ending protocol

Finalize **`ebay-sync-plan/OWNER-SETUP.md`** (it exists in draft, written at
planning time): keep its structure, correct anything the build changed, fill
in every `file:line` reference to real built code, and annotate each step
with exactly how to verify it worked. It must remain the complete ordered
list of everything the owner does manually — database migration, Netlify
env vars (incl. generation commands for `EBAY_TOKEN_ENC_KEY` /
`EBAY_VERIFICATION_TOKEN` / `EBAY_CRON_SECRET`), Developers Program +
keyset + account-deletion subscription + RuName steps, Seller Hub policy
setup per Q8, program opt-ins, the **Connect eBay** click, and the live
verification checklist (Phase 1 §1–10 and Phase 2 highlights from
`14-verification-checklist.md`) in order, with what to look for at each
step.

Plus an honest final report: what is code-complete, what is verified vs.
unverified, every `TODO(ebay-verify)`, and every place you had to interpret
the plan (with the plan reference and your reasoning).
