# Etsy Sync — Architecture Plan

> **Status: PLANNING ONLY — nothing here is implemented.** Written 2026-07-08.
> Owner review required before any code, SQL, or Etsy-side setup happens.

## Purpose

Plan for syncing the Naples Estate Jewelry catalog (Supabase `products`, the
single source of truth) to the owner's Etsy shop as a **secondary, downstream
sales channel**. One-way push (site → Etsy) is the primary scope; ingesting
Etsy sales back into our inventory is an optional later phase.

Etsy developer app: `naples-estate-jewelry-sync` (Personal, **✅ approved
2026-07-08**), limits **5 QPS / 5,000 calls per sliding 24h**.

## Recommended approach (one paragraph)

Keep Supabase as the source of truth and treat Etsy as a mirror driven entirely
from our admin. Add a small Etsy module in `next-app/src/lib/etsy/`, admin-only
route handlers under `/api/admin/etsy/*`, and four new Supabase tables (OAuth
connection, product↔listing mapping with a sync-state machine and content
hash, per-image mapping, and a sync log). OAuth 2.0 + PKCE connects the owner's
shop once from `/admin/settings`; tokens live server-side in Supabase (never in
the browser, never in git). Sync runs as small, resumable, idempotent steps
(create draft → upload images → set inventory → activate) so Netlify function
timeouts and the 5 QPS cap are never a problem; the admin UI orchestrates and
shows per-product status with a dry-run preview. Spot-priced items get a
scheduled daily price push (Etsy has no formula pricing). Phase 1 is a manual
single-product sync with draft-for-review on Etsy; Phase 2 adds bulk +
automatic delist-on-sold + scheduled price refresh; Phase 3 optionally ingests
Etsy orders via webhooks. **All 11 owner decisions were made 2026-07-08**
(recorded in [13-open-questions.md](13-open-questions.md) — notably: 8% Etsy
price markup, everything-available eligible incl. coins/bullion, and an
owner-attested `1990s` `when_made` fallback for mislabeled/missing years).
The Etsy app was **approved 2026-07-08**; the only remaining gate is the
Phase 0 shop setup ([06-shop-prerequisites.md](06-shop-prerequisites.md)).

## How to read these docs

Start with [01-architecture-overview.md](01-architecture-overview.md), then
[03-sync-lifecycle.md](03-sync-lifecycle.md) and
[12-phased-rollout.md](12-phased-rollout.md). Everything else is reference
depth. [13-open-questions.md](13-open-questions.md) records the owner's
decisions (all 11 answered 2026-07-08).

## File index

| File | Contents |
| --- | --- |
| [01-architecture-overview.md](01-architecture-overview.md) | System diagram, components, data flow, source of truth, ID mapping |
| [02-field-mapping.md](02-field-mapping.md) | Supabase `products` → Etsy listing/inventory/property field map, gaps & transforms |
| [03-sync-lifecycle.md](03-sync-lifecycle.md) | Create / update / delist / order-ingest flows; sync state machine |
| [04-oauth-and-secrets.md](04-oauth-and-secrets.md) | OAuth 2.0 + PKCE, token storage & refresh, env var names, redirect URIs |
| [05-image-pipeline.md](05-image-pipeline.md) | Supabase Storage → binary upload to Etsy; WebP→JPEG transcode, ordering, change detection |
| [06-shop-prerequisites.md](06-shop-prerequisites.md) | One-time Etsy shop setup: shipping profile, return policy, readiness state, sections, taxonomy |
| [07-admin-ux.md](07-admin-ux.md) | Admin screens: connect, sync one/all, status, errors, dry-run |
| [08-database-schema.md](08-database-schema.md) | Proposed Supabase tables (DDL-style, **not applied**) |
| [09-api-routes.md](09-api-routes.md) | Proposed Next.js route handlers, auth, request/response shapes |
| [10-rate-limits-and-quotas.md](10-rate-limits-and-quotas.md) | Calls-per-product math vs 5 QPS / 5K QPD, throttling, backoff |
| [11-error-handling.md](11-error-handling.md) | Partial failures, retries, idempotency, logging, operator-visible errors |
| [12-phased-rollout.md](12-phased-rollout.md) | Phase 0–3 scope and exit criteria |
| [13-open-questions.md](13-open-questions.md) | Owner decisions needed, with recommended defaults |
| [14-verification-checklist.md](14-verification-checklist.md) | Test plan while app approval is pending; first-live-listing checklist |
| [15-compliance.md](15-compliance.md) | Etsy API Terms, caching, trademark attribution, data handling |
| [openapi-endpoints-used.md](openapi-endpoints-used.md) | Every Etsy v3 endpoint the integration would call, with method + scope |
| [BUILD-PROMPT.md](BUILD-PROMPT.md) | Verbatim handoff prompt for the implementing AI agent (added after decisions + app approval) |

## Ground rules baked into this plan

- Supabase `products` stays the source of truth; Etsy never writes our catalog
  (except the optional, explicitly-scoped Phase 3 order ingest).
- No image blobs in Postgres — URLs/paths only, same as today.
- No secrets in git; env names only in these docs, values live in Netlify.
- Match existing conventions: TypeScript route handlers, `lib/` modules
  mirroring `next-app/src/lib/paypal.ts`, admin gating via
  `next-app/src/lib/admin-auth.ts`, docs in `project-docs/`.
- Netlify serverless constraints (short function timeouts) shape the
  step-wise sync design — see [03](03-sync-lifecycle.md) and [10](10-rate-limits-and-quotas.md).
