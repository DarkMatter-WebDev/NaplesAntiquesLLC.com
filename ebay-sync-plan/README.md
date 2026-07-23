# eBay Sync — Architecture Plan

> **Status: PLANNING ONLY — nothing here is implemented.** Written 2026-07-09.
> Modeled deliberately on `etsy-sync-plan/` (built and confirmed live
> 2026-07-09) so the two channel integrations stay structurally identical.
> **All 16 owner decisions were made 2026-07-09** (recorded in
> [13-open-questions.md](13-open-questions.md), incl. Q16's price-tiered
> express shipping added mid-session) — the remaining gate is the build
> itself. **Phase 0 progress is real, not hypothetical:** the eBay app
> ("PostnSync") and both keysets already exist, and all four Business
> Policies (two shipping tiers, return, payment) are live on the owner's
> account — see [OWNER-SETUP.md](OWNER-SETUP.md) steps 1 and 7.

## Purpose

Plan for syncing the Naples Estate Jewelry catalog (Supabase `products`, the
single source of truth) to the owner's eBay seller account as a **secondary,
downstream sales channel** — the same shape as the live Etsy sync. One-way
push (site → eBay) is the primary scope; ingesting eBay sales back into our
inventory is an optional later phase (polling-based on eBay, not webhooks).

Research basis: eBay's RESTful API guide
(<https://developer.ebay.com/develop/guides-v2/using-ebay-restful-apis>) and
every referenced doc area — OAuth, Sell Inventory / Account / Fulfillment /
Metadata, Commerce Taxonomy / Media / Notification, call limits, sandbox,
compliance. Facts are cited per-doc; anything unverifiable is flagged
`TODO(ebay-verify)` exactly like the Etsy plan did.

## Recommended approach (one paragraph)

Keep Supabase as the source of truth and treat eBay as a mirror driven
entirely from our admin, mirroring the Etsy architecture: a small eBay module
in `next-app/src/lib/ebay/`, admin-only route handlers under
`/api/admin/ebay/*`, and four new Supabase tables (OAuth connection,
product↔listing mapping with a sync-state machine and content hash, sync log,
transient OAuth-state rows). OAuth 2.0 authorization-code (no PKCE — eBay
requires a confidential client with Basic auth, so the exchange is
server-side only) connects the owner's seller account once from
`/admin/settings`; tokens live encrypted in Supabase (never in the browser,
never in git); eBay's refresh token is **non-rotating and ~18 months long** —
simpler than Etsy's. The sync itself is dramatically cheaper than Etsy's:
eBay's Inventory API takes our **public HTTPS image URLs directly (WebP
accepted — no transcode, no multipart uploads)**, so a full publish is ~3–4
API calls per product (`createOrReplaceInventoryItem` → `createOffer` →
`publishOffer`) instead of Etsy's ~12. The same checkpointed step machine,
dry-run preview, content-hash change detection, scheduled threshold-gated
price push (via `bulkUpdatePriceQuantity`), and auto-delist hooks carry over
unchanged in shape. The two structural differences from Etsy: **eBay has no
draft-for-review state** (publishing is live immediately — the unpublished
*offer* is our review gate instead), and **one-time account prerequisites are
heavier** (business-policy opt-in, inventory location, and a marketplace
account-deletion notification endpoint required before the production keyset
even activates). **All 16 owner decisions were made 2026-07-09** (recorded in
[13-open-questions.md](13-open-questions.md) — notably: review-first
publishing, an admin-variable eBay markup seeded at 15%, **coins/bullion
excluded from eBay** (jewelry/watches/silverware only — narrower than the
Etsy full-catalog decision), quantity-zero + Out-of-Stock Control for sold
items, 30-day buyer-pays returns with flat-rate insured shipping and
immediate payment, SKU = `products.id`, the owner's existing eBay account
whose selling limits comfortably hold the catalog, and — added mid-session
— **Q16's price-tiered express shipping**: items over an admin-editable
threshold (seeded $1000) automatically use a second, faster shipping policy
instead of the standard one, a decision made entirely in our sync code
since eBay's Business Policies have no conditional logic of their own).

## How to read these docs

Start with [01-architecture-overview.md](01-architecture-overview.md), then
[03-sync-lifecycle.md](03-sync-lifecycle.md) and
[12-phased-rollout.md](12-phased-rollout.md). Everything else is reference
depth. [13-open-questions.md](13-open-questions.md) records the owner's
decisions (all 16 answered 2026-07-09). **Phase 0 manual setup is already
partly done live** — see [OWNER-SETUP.md](OWNER-SETUP.md) steps 1 and 7.

## File index

| File | Contents |
| --- | --- |
| [01-architecture-overview.md](01-architecture-overview.md) | System diagram, components, data flow, source of truth, ID mapping |
| [02-field-mapping.md](02-field-mapping.md) | Supabase `products` → eBay inventoryItem/offer field map, aspects, gaps & transforms |
| [03-sync-lifecycle.md](03-sync-lifecycle.md) | Create / update / end / order-ingest flows; sync state machine |
| [04-oauth-and-secrets.md](04-oauth-and-secrets.md) | OAuth 2.0 authorization-code grant, RuName, token storage & refresh, env var names |
| [05-image-pipeline.md](05-image-pipeline.md) | URL-based image handoff (no upload pipeline), EPS behavior, change detection |
| [06-account-prerequisites.md](06-account-prerequisites.md) | One-time eBay setup: keyset activation, business policies, inventory location, selling limits, category strategy |
| [07-admin-ux.md](07-admin-ux.md) | Admin screens: connect, sync one/all, status, errors, dry-run — mirrors the Etsy panels |
| [08-database-schema.md](08-database-schema.md) | Proposed Supabase tables (DDL-style, **not applied**) |
| [09-api-routes.md](09-api-routes.md) | Proposed Next.js route handlers, auth, request/response shapes |
| [10-rate-limits-and-quotas.md](10-rate-limits-and-quotas.md) | Calls-per-product math vs eBay quotas, the revision cap, selling limits, fees |
| [11-error-handling.md](11-error-handling.md) | Partial failures, retries, idempotency, logging, operator-visible errors |
| [12-phased-rollout.md](12-phased-rollout.md) | Phase 0–3 scope and exit criteria |
| [13-open-questions.md](13-open-questions.md) | Owner decisions — **all 16 DECIDED 2026-07-09**, with original reasoning kept |
| [14-verification-checklist.md](14-verification-checklist.md) | Sandbox + production test plan; first-live-listing checklist |
| [15-compliance.md](15-compliance.md) | eBay API License Agreement, account-deletion notifications, marketplace policies (jewelry/bullion/coins) |
| [rest-endpoints-used.md](rest-endpoints-used.md) | Every eBay REST endpoint the integration would call, with method + scope |
| [BUILD-PROMPT.md](BUILD-PROMPT.md) | Verbatim handoff prompt for the implementing AI agent (added 2026-07-09 after all decisions were made) |
| [OWNER-SETUP.md](OWNER-SETUP.md) | Ordered manual checklist for the owner/developer — **DRAFT at planning time**; the implementing agent finalizes it at build time |

## Ground rules baked into this plan

- Supabase `products` stays the source of truth; eBay never writes our
  catalog (except the optional, explicitly-scoped Phase 3 order ingest).
- No image blobs in Postgres — URLs/paths only, same as today (easier here:
  eBay ingests our URLs itself).
- No secrets in git; env names only in these docs, values live in Netlify.
- Match existing conventions: TypeScript route handlers, `lib/ebay/` module
  mirroring the shipped `next-app/src/lib/etsy/` file-for-file where the
  concepts map, admin gating via the same check `/api/admin/etsy/*` uses,
  docs in `project-docs/`.
- **Do not touch the Etsy integration.** The only shared edit is Phase 2's
  auto-delist hook, which adds an eBay call *next to* the existing Etsy call
  at the already-documented product-status chokepoints (see
  [03-sync-lifecycle.md](03-sync-lifecycle.md) §Flow 3 for the exact list).
- Netlify serverless constraints shape the step-wise sync design exactly as
  they did for Etsy — even though eBay needs far fewer calls per product
  ([10-rate-limits-and-quotas.md](10-rate-limits-and-quotas.md)).
