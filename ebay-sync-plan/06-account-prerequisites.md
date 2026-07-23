# 06 — eBay Account & Developer Prerequisites (one-time setup)

> Planning only. These are eBay-side objects and gates that must exist
> **before any listing can be published**. Their IDs are stored once in
> `ebay_connection` defaults ([08-database-schema.md](08-database-schema.md))
> and attached to every offer. This is the eBay analog of
> `etsy-sync-plan/06-shop-prerequisites.md`, but the list is longer — eBay
> gates more at the account/keyset level.

## Developer-side gates (before any API call works)

| Gate | What it is | How |
| --- | --- | --- |
| eBay Developers Program account | Free registration, ~1 business day approval | developer.ebay.com → register (owner's or developer's account — owner decision; recommend owner-owned like the Etsy app, Q13) |
| Application keyset | App ID (Client ID) + Dev ID + Cert ID (Client Secret), separate per environment | Application Keys page; create Production + Sandbox keysets |
| **Marketplace account-deletion compliance** | **The production keyset is DISABLED until done**: subscribe to `MARKETPLACE_ACCOUNT_DELETION` notifications via a verified HTTPS endpoint, or opt out ("not persisting eBay data") | Our plan: **subscribe** — build the small challenge/ack endpoint in Phase 0 so Phase 3 never forces a compliance change; see [15-compliance.md](15-compliance.md) and Q10 |
| RuName (per environment) | eBay's wrapper around the OAuth callback URL | [04-oauth-and-secrets.md](04-oauth-and-secrets.md) |
| Netlify env vars | `EBAY_*` names in [04](04-oauth-and-secrets.md) | Values in Netlify only |

No app-approval wait exists (unlike Etsy's personal-app approval) — the
account-deletion step is the only activation gate, and it's self-service.

## Seller-account gates (owner's eBay account, before publish)

| Object | Required? | Create via | Recommendation |
| --- | --- | --- | --- |
| eBay seller account, payments onboarded | Yes | eBay UI only | All accounts are on eBay Managed Payments already; complete any pending seller onboarding in Seller Hub. |
| **Business-policy opt-in** (`SELLING_POLICY_MANAGEMENT` program) | Yes — offers reference policy IDs and publish fails without the opt-in | API (`optInToProgram`) or automatic when creating policies in the UI | Do it first; **can take up to 24h to process**. Status via `getOptedInPrograms`. |
| Fulfillment (shipping) policy — **two of them** (Q16, added 2026-07-09) | Yes (`fulfillmentPolicyId`) | eBay UI (Seller Hub → Business Policies) or API | **Manual create in UI, API read + pick in our admin** — same rationale as Etsy: shipping terms (carrier, insured shipping for gold, handling time) are business decisions the platform UI validates better than a hardcoded payload. **Confirmed live 2026-07-09:** "NEJ Insured Flat Rate" (USPS Priority Mail, $15/$5, 2-day handling) as the standard policy, plus "NEJ Express High-Value" (FedEx 2Day, $50/$50, 1-day handling) for items over an admin-editable threshold (seeded $1000) — eBay's policies are static objects with no conditional logic, so our sync code picks between the two per item ([02-field-mapping.md](02-field-mapping.md)). Our app lists both via `getFulfillmentPolicies` and the owner picks each default in `/admin/settings`. |
| Payment policy | Yes (`paymentPolicyId`) | UI or API | Same pattern. Managed Payments means no payment methods to configure; the one decision is **`immediatePay: true`** (recommended — mirrors the site's "whoever pays first" no-reservation philosophy; Q8). |
| Return policy | Yes (`returnPolicyId`) | UI or API | Same pattern; align with the site's `/returns-refunds` content (Q8 decides exact terms — note 30-day returns materially help placement/buyer trust on eBay). |
| **Inventory location** (`merchantLocationKey`) | Yes — publish fails without one | **API** (`createInventoryLocation`) | The one object we *do* create by API (it's trivial and invisible): a single `WAREHOUSE` location, minimal payload `{postalCode, country:"US"}` — no street address needed. Key ≤36 chars, immutable once set (e.g. `nej-naples-fl`). |
| **Out-of-Stock Control** (`OUT_OF_STOCK_CONTROL` program) | **Yes** — Q7 chose quantity-zero sold handling | API (`optInToProgram`) or account preference in UI | Opt in during setup (step 6 below). |
| **Selling limits** | Always present — monthly caps on item count AND dollar value | Check via `getPrivileges` | ✅ **Resolved (Q13/Q14, 2026-07-09): the owner's existing eBay account has limits that comfortably hold the full catalog** — no increase request or publish ordering needed. The `getPrivileges` snapshot stays in the settings panel and pre-flight as an informational safety net, and a limit rejection still maps to a clear operator message. |
| eBay Store subscription | No | UI | Optional economics decision (lower FVF + more free listings vs monthly fee + store categories) — Q12, default no. |

## Category & aspects strategy

- At build time, resolve leaf `categoryId`s for each `product_type` via
  `getCategorySuggestions` (Taxonomy API, tree `0`), pin the map in
  `lib/ebay/mapping.ts` with node names in comments — identical discipline to
  `ETSY_TAXONOMY_MAP`, including `approximate: true` flags where no clean
  leaf exists, dry-run visibility, and a per-product override field.
- Candidate leaves and the Fine-vs-Fashion eligibility rule:
  [02-field-mapping.md](02-field-mapping.md) §D.
- For each pinned leaf, pull `getItemAspectsForCategory` once and pin the
  required/recommended aspect table (names, modes, allowed values for
  SELECTION_ONLY) — this powers pre-flight validation so publish-time
  failures are rare instead of routine.
- Condition allow-list per category from Metadata
  `getItemConditionPolicies` (jewelry: Pre-owned 3000 confirmed-style;
  coins: Graded/Ungraded + descriptors; bullion: often none) — pinned with
  the same verify-at-build-time flags.
- Taxonomy/Metadata quotas are the tight ones (5,000/day each) — these are
  build-time/cached reads, not per-sync calls
  ([10-rate-limits-and-quotas.md](10-rate-limits-and-quotas.md)).

## Setup checklist (owner + developer, in order)

1. Owner (or developer under owner's account): register on the eBay
   Developers Program; create Production + Sandbox keysets.
2. Developer: build + deploy the account-deletion notification endpoint;
   complete the keyset activation (subscribe, send test notification) —
   [15-compliance.md](15-compliance.md).
3. Developer: configure RuNames (both environments); set Netlify env vars.
4. Owner: confirm seller account standing in Seller Hub. (Selling limits
   already confirmed sufficient — Q14; the settings panel will display the
   `getPrivileges` readout for ongoing visibility.)
5. Owner: create shipping/payment/return business policies in Seller Hub
   (this also handles the business-policy opt-in); confirm with the
   developer that `getFulfillmentPolicies` etc. return them.
6. Developer: `optInToProgram(OUT_OF_STOCK_CONTROL)` (Q7 = quantity-zero);
   `createInventoryLocation` once.
7. Owner: **Connect eBay** in `/admin/settings` (OAuth); pick default
   policies + location in the settings panel (stored in `ebay_connection`).
8. Developer: pin category map + aspect tables + condition IDs from live
   Taxonomy/Metadata calls.
9. First dry-run ([14-verification-checklist.md](14-verification-checklist.md)).
