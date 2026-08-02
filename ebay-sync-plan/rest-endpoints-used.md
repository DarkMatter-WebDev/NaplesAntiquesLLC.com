# eBay REST APIs — Endpoints This Integration Would Call

> Planning only. The eBay analog of `etsy-sync-plan/openapi-endpoints-used.md`.
> Method names are eBay's documented operation names. **Re-verify
> paths/params against each API's published OpenAPI contract at build time**
> (eBay publishes OpenAPI 3 JSON/YAML per API — fetch full local copies; the
> Etsy build proved truncated web fetches of large specs hide real bugs).
> Hosts: `api.ebay.com` (prod) / `api.sandbox.ebay.com` (sandbox); Media API
> uses `apim.ebay.com`. All calls send `Authorization: Bearer <token>`;
> item/offer writes also send `Content-Language: en-US`. Sell APIs need a
> **user** token; Taxonomy/Metadata/Notification-public-key work with an
> **application** token (client credentials).

## OAuth (identity service — Basic auth, not Bearer)

| Operation | Method + path | Used for |
| --- | --- | --- |
| (consent redirect) | `GET https://auth.ebay.com/oauth2/authorize` | Consent screen (browser redirect; `redirect_uri` = RuName) |
| token exchange / refresh / app token | `POST https://api.ebay.com/identity/v1/oauth2/token` | `authorization_code` (connect), `refresh_token` (2h renewal), `client_credentials` (cached app token for Taxonomy/Metadata) |

## Account context & one-time setup (Sell Account v1 + Inventory location)

| Operation | Method + path | Scope | Used for |
| --- | --- | --- | --- |
| `getPrivileges` | `GET /sell/account/v1/privilege` | `sell.account` | Connect-time smoke test + **selling-limit snapshot** (settings panel, bulk pre-flight) |
| `getFulfillmentPolicies` | `GET /sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US` | `sell.account` | Settings dropdown (policies created by owner in Seller Hub) |
| `getPaymentPolicies` | `GET /sell/account/v1/payment_policy?marketplace_id=EBAY_US` | `sell.account` | Settings dropdown |
| `getReturnPolicies` | `GET /sell/account/v1/return_policy?marketplace_id=EBAY_US` | `sell.account` | Settings dropdown |
| `getOptedInPrograms` | `GET /sell/account/v1/program/get_opted_in_programs` | `sell.account` | Prerequisite checklist (business-policy opt-in status) |
| `optInToProgram` | `POST /sell/account/v1/program/opt_in` | `sell.account` | `OUT_OF_STOCK_CONTROL` (Q7) and, if needed, `SELLING_POLICY_MANAGEMENT` |
| `createInventoryLocation` | `POST /sell/inventory/v1/location/{merchantLocationKey}` | `sell.inventory` | One-time WAREHOUSE location (`{postalCode, country}`) — the only setup object we create by API |
| `getInventoryLocations` | `GET /sell/inventory/v1/location` | `sell.inventory` | Prerequisite checklist / idempotent setup |

## Taxonomy & Metadata (build-time / cached in code; application token)

| Operation | Method + path | Used for |
| --- | --- | --- |
| `getDefaultCategoryTreeId` | `GET /commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_US` | Tree id (expected `0`) — fetched, not hardcoded |
| `getCategorySuggestions` | `GET /commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=…` | Pin the `product_type` → leaf `categoryId` map |
| `getCategorySubtree` | `GET /commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=…` | Audit the pinned leaves' neighborhoods |
| `getItemAspectsForCategory` | `GET /commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=…` | Pin required/recommended aspect tables (names, modes, allowed values) per leaf |
| `getItemConditionPolicies` | `GET /sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=categoryIds:{…}` | Pin allowed condition IDs per leaf (jewelry 3000; coins graded/ungraded; bullion often none) — always filtered, responses are huge otherwise |
| `getNegotiatedPricePolicies` | `GET /sell/metadata/v1/marketplace/EBAY_US/get_negotiated_price_policies?filter=…` | Only if Q9 (Best Offer) is ever enabled |

## Listings — core sync (Sell Inventory v1, Phases 1–2)

| Operation | Method + path | Scope | Used for |
| --- | --- | --- | --- |
| `createOrReplaceInventoryItem` | `PUT /sell/inventory/v1/inventory_item/{sku}` | `sell.inventory` | Step 1 of publish + every content/image/aspect update (full replace; live listings auto-revise) |
| `getInventoryItem` | `GET /sell/inventory/v1/inventory_item/{sku}` | `sell.inventory` | Reconcile / verify-listing |
| `createOffer` | `POST /sell/inventory/v1/offer` | `sell.inventory` | Step 2 (EBAY_US · FIXED_PRICE · GTC · category · price · policies · location) |
| `updateOffer` | `PUT /sell/inventory/v1/offer/{offerId}` | `sell.inventory` | Offer-side updates (category/description/policies; full replace; revises live listing) |
| `getOffer` / `getOffers` | `GET /sell/inventory/v1/offer/{offerId}` / `GET …/offer?sku=…` | `sell.inventory` | Crash-window adoption (offer/listing id recovery), verify-listing, monthly audit |
| `getListingFees` | `POST /sell/inventory/v1/offer/get_listing_fees` | `sell.inventory` | Dry-run fee readout (unpublished offers only, ≤250/call) |
| `publishOffer` | `POST /sell/inventory/v1/offer/{offerId}/publish` | `sell.inventory` | Go live (returns `listingId`; **public immediately**) |
| `withdrawOffer` | `POST /sell/inventory/v1/offer/{offerId}/withdraw` | `sell.inventory` | End listing, keep offer (archived/removed; Q7 option B) |
| `bulkUpdatePriceQuantity` | `POST /sell/inventory/v1/bulk_update_price_quantity` | `sell.inventory` | Price push fast path + quantity-zero hide/restore (Q7 option A). `TODO(ebay-verify)` batching shape (entries appear one-SKU-each, ≤25/call) |
| `deleteOffer` | `DELETE /sell/inventory/v1/offer/{offerId}` | `sell.inventory` | **Admin-confirmed cleanup only** — never automatic |
| `deleteInventoryItem` | `DELETE /sell/inventory/v1/inventory_item/{sku}` | `sell.inventory` | **Admin-confirmed cleanup only** — ends everything for the SKU |

Optional bulk variants (`bulkCreateOrReplaceInventoryItem`,
`bulkCreateOffer`, `bulkPublishOffer`, ≤25/call) — noted as a non-goal for
MVP; the sequential drain is simpler and per-item error isolation cleaner at
this catalog size.

## Compliance & notifications

| Operation | Method + path | Scope/auth | Used for |
| --- | --- | --- | --- |
| (challenge) | `GET https://naplesestatejewelry.co/api/webhooks/ebay-account-deletion?challenge_code=…` | — (our endpoint) | Keyset-activation verification (Phase 0) |
| (notification) | `POST` same endpoint, `x-ebay-signature` header | signature | `MARKETPLACE_ACCOUNT_DELETION` events |
| `getPublicKey` | `GET /commerce/notification/v1/public_key/{public_key_id}` | app token | Signature verification key (cached ~1h) |
| `getListingViolationsSummary` | `GET /sell/compliance/v1/listing_violation_summary` | `sell.inventory` (verify scope at build) | Phase 2 hygiene sweep (`ASPECTS_ADOPTION` drift) |
| `getListingViolations` | `GET /sell/compliance/v1/listing_violation?compliance_type=…` | same | Drill-down when the summary is non-zero |

## Orders (Phase 3 only — polling, not webhooks)

| Operation | Method + path | Scope | Used for |
| --- | --- | --- | --- |
| `getOrders` | `GET /sell/fulfillment/v1/order?filter=lastmodifieddate:[…],orderfulfillmentstatus:{NOT_STARTED\|IN_PROGRESS}&limit=200` | `sell.fulfillment.readonly` | Cursor-based order poll → SKU match → site-sale semantics |
| `getOrder` | `GET /sell/fulfillment/v1/order/{orderId}` | same | Detail fetch when needed (cancel requests visible only here) |

**Not used anywhere:** `createShippingFulfillment` (tracking upload — owner
ships from Seller Hub), Trading API / any legacy SOAP surface, Marketing API
(Promoted Listings), Stores API (unless Q12 flips), Media API
(`createImageFromUrl`/`createImageFromFile`/`getImage` — documented fallback
only, [05-image-pipeline.md](05-image-pipeline.md)), Feed API, buyer-side
Buy APIs, `sell.finances` — deliberately out of scope
([15-compliance.md](15-compliance.md)).
