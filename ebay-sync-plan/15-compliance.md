# 15 — Compliance (eBay API License Agreement, Notifications, Marketplace Policies)

> Planning only. Re-verify against the current eBay API License Agreement
> (developer.ebay.com/join/api-license-agreement) and policy pages at
> implementation time — this summarizes the obligations the design already
> accounts for.

## eBay Developer obligations — how the design complies

| Obligation | How this plan complies |
| --- | --- |
| **Marketplace account-deletion notifications (mandatory)** | Day-one subscription with a verified endpoint ([09-api-routes.md](09-api-routes.md), Q10): GET challenge echo (`sha256(challengeCode + verificationToken + endpoint)`), POST handler verifying `x-ebay-signature` via the Notification API public key (cached ~1h), immediate 200 ack, `webhook_events` idempotency. Failure handling matters: unacked notifications re-send, 24h of failures marks the endpoint down, 30 days to fix. Our handler is nearly a no-op **because we store no eBay buyer data** — the deliberate design choice that makes this obligation cheap. |
| **Data deletion on notification** | Nothing to delete in Phases 1–2 (only our own seller's tokens/IDs are stored). Phase 3 stores only order/line-item IDs in the log — a deletion notification for a matching buyer triggers log-row scrubbing; buyer PII is never at rest ([08-database-schema.md](08-database-schema.md)). |
| **Caching limits (License Agreement: intermediate copies deleted when no longer required)** | We store only: SKUs/offer IDs/listing IDs, states, our own hashes, timestamps, and redacted error summaries. No eBay listing copy, no eBay images, no buyer data at rest — the same ID-and-state-only footprint the Etsy integration uses. |
| **Credential secrecy** | Client ID/Cert ID in Netlify env only; user tokens AES-GCM-encrypted in a service-role-only row; redacted logging ([04](04-oauth-and-secrets.md), [11](11-error-handling.md)). Never client-side, never committed. Cert ID resettable if compromised. |
| **Never collect eBay usernames/passwords** | OAuth-only by construction; the owner consents on ebay.com. |
| **Graceful error handling, bounded retries** | The License-Agreement-cited "max two retries for infrastructure errors" informs the retry policy ([11-error-handling.md](11-error-handling.md)); backoff on 429; no polling beyond need (order poll is 15-min cadence, price push daily). |
| **Latest API versions, UTF-8, resilience to page-size changes** | REST v1 APIs only (no legacy Trading/SOAP anywhere in the plan); paginate by `next` links, never by computed totals. |
| **No prohibited data aggregation / AI-training use** | N/A by design — we display nothing from eBay and derive nothing; the flow is push-only plus our own order matching. |
| **API deprecation watch** | eBay deprecates with ~10–18 month windows and a public status page; `features/ebay-sync.md` (when written) should note the per-API versions built against, and the monthly audit includes a release-notes glance. |

## eBay marketplace policies the sync must not violate

- **Jewelry policy (Fine vs Fashion):** Fine Jewelry requires solid
  sterling (925+), gold (9K+), palladium (500+), or platinum-group (850+)
  metals and consistent Metal/Metal Purity item specifics.
  **Plated/vermeil → Fashion Jewelry** (or excluded) — enforced in
  pre-flight, decided in Q4. Titles/descriptions must match the declared
  metal/purity — automatic for us, both come from the same product row.
- **Bullion & collectible-currency policies: not applicable (Q6 decision,
  2026-07-09).** Coins and Bullion are excluded from the eBay sync entirely
  — pre-flight ineligibility, so the both-sides-photo rule, fineness/mint
  requirements, the $2,500 ungraded price cap, and the graded-condition
  descriptor regime never come into play. (Kept here as the record of *why*
  the exclusion is the low-risk choice: precious-metals policy enforcement
  is active on eBay, and violations create account defects.)
- **Authenticity Guarantee (fine jewelry program):** above a program
  threshold (`TODO(ebay-verify)` current value), fine-jewelry sales route
  through eBay's authentication center — a shipping-workflow change, not an
  API field. Dry-run notes it on high-value items so the owner isn't
  surprised at sale time.
- **No off-platform steering:** listing descriptions must not push buyers to
  buy off-eBay (links/contact info prohibited). The description template
  contains no URLs — same rule the Etsy template already enforces for fee
  avoidance.
- **Accurate listings / no defect-farming:** descriptions, aspects, photos
  come from the same data the site sells with; withdraw (never silent
  cancel-after-sale) is the out-of-stock verb, and the Phase 2 auto-hide
  minimizes oversell cancellations, which create seller defects on eBay.
- **Selling limits are policy, not just quota:** publishing past the monthly
  limit isn't possible (hard error), but *planning* around it is on us —
  bulk pre-flight surfaces the cut ([06](06-account-prerequisites.md), Q14).

## Data handling summary (all directions)

| Data | Direction | At rest? |
| --- | --- | --- |
| Product copy, price, qty, aspects, image **URLs** | Us → eBay | Already ours (Supabase); eBay holds its listing copy + EPS image copies |
| Image bytes | Supabase Storage/site → **eBay fetches directly** | Never touch our functions at all ([05](05-image-pipeline.md)) |
| OAuth tokens | eBay → us | Encrypted, service-role-only row |
| SKU/offer/listing IDs, states | eBay → us | Yes — the mapping table (ours to keep; not "eBay content") |
| Orders / buyer info (Phase 3) | eBay → us | Transient; only order/line-item IDs logged, **no buyer PII stored** |
| Account-deletion notifications | eBay → us | `webhook_events` row (IDs only) + log |

Privacy-policy note: Phase 3 processes eBay buyer order data transiently;
those buyers are eBay's customers under eBay's privacy policy. Same
conclusion as the Etsy plan — no site `/privacy` change expected, but
re-check wording when Phase 3 actually ships. The RuName registration
requires a privacy-policy URL; `https://naplesestatejewelry.co/privacy`
satisfies it.

## Project-internal compliance

- No git operations in this folder (project rule); the owner copies to the
  repo manually.
- No secrets in `ebay-sync-plan/` or `project-docs/` — env var **names**
  only.
- Destructive-op rules apply to eBay objects too: `deleteOffer` /
  `deleteInventoryItem` and bulk anything are dry-run/confirm-first;
  `withdrawOffer` is the automatic-safe verb
  ([03-sync-lifecycle.md](03-sync-lifecycle.md)).
- The Etsy trademark-attribution requirement has **no direct eBay analog**
  in this plan's scope (nothing eBay-branded is displayed to buyers on our
  site; the admin panel may say "eBay" nominatively). If eBay branding is
  ever shown customer-facing, check eBay's brand guidelines then.
