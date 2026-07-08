# Build Prompt — Etsy Sync Implementation

> Hand this entire prompt (everything below the line) to the implementing AI
> agent, verbatim. Added 2026-07-08 after all planning decisions were made and
> the Etsy app was approved.

---

## Mission

Implement the Etsy sync feature for this project, end to end, using the
planning folder **`etsy-sync-plan/`** at the project root as the **100%
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
   `project-docs/TASKS.md`, `project-docs/DECISIONS.md` (2026-07-08 entry =
   the Etsy decisions summary).
3. The entire `etsy-sync-plan/` folder — all 17 docs. `README.md` is the
   index; `13-open-questions.md` contains the **final owner decisions** (all
   11 decided — treat them as requirements, not suggestions);
   `12-phased-rollout.md` defines build order and exit criteria.
4. Existing code the plan tells you to mirror: `next-app/src/lib/paypal.ts`
   (API client pattern), `next-app/src/app/api/paypal/*` and
   `next-app/src/app/api/admin/ai-settings/route.ts` (route + admin-gating
   patterns), `next-app/src/lib/pricing.ts` (price computation you must call,
   never reimplement), `next-app/src/app/actions/admin-products.ts` (the
   product-write chokepoints Phase 2 hooks into),
   `next-app/src/types/product.ts` (product contract).

## Scope

- **Build Phase 1 fully, then Phase 2 fully**, exactly as scoped in
  `etsy-sync-plan/12-phased-rollout.md`.
- **Do NOT build Phase 3** (Etsy order webhooks / `/api/webhooks/etsy`). The
  owner decided manual handling of Etsy sales is fine short-term (Q10).
  Leave the seams the plan describes (e.g. `webhook_events` reuse is
  documented, not implemented).
- Phase 0 items that are owner-manual (Etsy UI shop setup, Netlify env
  values, running SQL in Supabase, OAuth connect click) are **not yours** —
  collect them into the final owner checklist instead (see "Ending
  protocol").

## Hard rules (violating any of these is failure)

1. **No git commands, ever.** No commits, branches, stashes, status — nothing.
2. **No secrets.** Env var *names* only (per
   `etsy-sync-plan/04-oauth-and-secrets.md`). Never write values, never
   commit `.env*`, never log tokens; implement the redaction rules in
   `etsy-sync-plan/11-error-handling.md`.
3. **SQL is written, never executed.** Write the migration exactly per
   `etsy-sync-plan/08-database-schema.md` to `supabase/etsy-sync.sql`
   (additive only, RLS-enabled service-role-only tables, following the style
   of existing `supabase/*.sql` scripts). Running it in the live Supabase
   project is an owner action — flag it loudly, per project convention.
4. **No image blobs in Postgres.** URLs/paths only, exactly as the plan and
   the project's optimization defaults require.
5. **Supabase `products` stays source of truth.** Nothing ever writes our
   catalog from Etsy data.
6. **Follow the plan's file layout exactly**: `next-app/src/lib/etsy/`
   (`client.ts`, `auth.ts`, `mapping.ts`, `images.ts`, `sync.ts`,
   `store.ts`), routes per `etsy-sync-plan/09-api-routes.md`, admin UI per
   `etsy-sync-plan/07-admin-ux.md`, tables per
   `etsy-sync-plan/08-database-schema.md`.
7. **Decisions from `13-open-questions.md` are law**, including: draft-for-
   review default (Q1); the owner-attested `when_made: '1990s'` fallback for
   `item_year > 2006` or missing, applied in the Etsy payload only, database
   untouched, flagged in dry-run (Q2); EN-only (Q3); daily ≥1%-threshold
   price push (Q4); 8% Etsy price markup default, site prices untouched
   (Q5); assume single-price shop, warn + pause price push if regional
   pricing detected (Q6); everything `available` eligible incl. Coin/Bullion,
   best-effort taxonomy, per-item errors never block a batch (Q7); no
   reconciliation UI — the sync only touches listings recorded in
   `etsy_listings` (Q8); deactivate, never auto-delete (Q9); mirror-site
   shipping/returns noted in owner checklist (Q11).
8. **The only sanctioned judgment calls** are the spots the plan explicitly
   marks "verify at build time": exact `when_made` enum strings, image
   size/format caps, rate-limit header names, readiness-state endpoint path,
   whether image re-rank needs re-upload, and taxonomy leaf IDs. Resolve them
   from the live public OpenAPI spec
   (`https://www.etsy.com/openapi/generated/oas/3.0.0.json`) and record each
   resolution (what the plan assumed vs. what the spec says) in your final
   report and in the code where pinned. If a verification requires an
   authenticated API call and no `ETSY_API_KEY` is available in your
   environment, pin your best-supported value from the spec, mark it with a
   `TODO(etsy-verify)` comment, and add it to the owner checklist.

## Working style

- **Do not stop to ask questions.** Every product decision is already made.
  When something is impossible without owner input (credentials, live shop,
  Netlify dashboard), build everything around it, stub nothing silently —
  gate it with a clear runtime error/admin message — and put it on the owner
  checklist. Keep going until Phases 1 and 2 are code-complete.
- Keep the folder pristine: no scratch files, no logs, no one-off scripts
  left behind. Temp work goes in your scratchpad, not the repo.
- Match existing conventions: TypeScript, App Router route handlers,
  next-intl EN/ES for any user-facing admin strings if the surrounding admin
  UI is localized (inspect first; match what `AdminShell.tsx` does).

## Testing between phases (do everything that doesn't need live Etsy)

The buildable-now test list is `etsy-sync-plan/14-verification-checklist.md`
§"While app approval is pending" — the app is now approved, but you still
have no tokens, so the same boundary applies to you:

- **After Phase 1 code:** unit tests for `mapping.ts` (title truncation, tag
  rules 13×20, materials, `when_made` buckets incl. boundary years and the
  1990s fallback, price flattening for both price modes incl. 8% markup and
  <$0.20 rejection, and the allowlist guarantee that private fields —
  `cost_basis`, `minimum_price`, `internal_notes`, etc. — can never appear in
  any payload). Image transcode tests against local WebP fixtures (with and
  without alpha). Dry-run/preview exercised against the local dev server
  (port 3002 convention) with a disconnected state — verify pre-flight
  messages render. `npm run lint` and `npm run build` from `next-app/` must
  pass cleanly. Record results.
- **After Phase 2 code:** same build/lint gate, plus unit tests for content-
  hash change detection, queue drain compare-and-set (two concurrent drains
  can't grab the same product), threshold logic for the price push, and the
  delist hooks firing from the product-status chokepoints (test at the
  function level).
- Every live-Etsy verification item in `14-verification-checklist.md`
  (OAuth round-trip, first draft, idempotency clicks, delist/relist, price
  push observation) goes on the owner checklist as post-setup steps —
  **clearly marked untested by you**. Never claim them done.

## Documentation duties (part of the work, not optional)

- Update `project-docs/CURRENT_STATUS.md`, `TASKS.md`, `CHANGELOG.md`,
  `DECISIONS.md` (any build-time resolutions), and `ARCHITECTURE.md` (new
  tables/routes/module).
- Create `project-docs/features/etsy-sync.md` distilled from the plan +
  what you actually built (per the Phase 1 exit criteria). The plan folder
  stays untouched except: you may add ✅/deviation annotations to
  `14-verification-checklist.md` items you completed.
- Record the exact verification commands run and their results.

## Ending protocol

Finish with a single file, `etsy-sync-plan/OWNER-SETUP.md`, containing the
complete ordered list of everything the owner must do manually, each item
with exact locations (file:line for anything to copy/run, dashboard paths for
Netlify/Etsy):

1. Run `supabase/etsy-sync.sql` in the live Supabase project (say exactly
   how to verify it worked).
2. Set the Netlify env vars (names from `04-oauth-and-secrets.md`, incl. how
   to generate `ETSY_TOKEN_ENC_KEY`).
3. Register the redirect URIs on the Etsy app (exact URLs).
4. Etsy UI setup: shipping profile / return policy / processing time
   mirroring `/shipping` + `/returns-refunds`; confirm Domestic & Global
   Pricing off.
5. Click **Connect Etsy** in `/admin/settings`, pick the defaults.
6. Then the live verification checklist (Phase 1 §1–11 and Phase 2
   highlights from `14-verification-checklist.md`), in order, with what to
   look for at each step.

Plus an honest final report: what is code-complete, what is verified vs.
unverified, every `TODO(etsy-verify)`, and every place you had to interpret
the plan (with the plan reference and your reasoning).
