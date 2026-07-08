# Etsy Open API v3 — Endpoints This Integration Would Call

> Planning only. Curated from the Etsy v3 OpenAPI spec
> (`https://www.etsy.com/openapi/generated/oas/3.0.0.json`). Operation names
> are the spec's `operationId`s. **Re-verify paths/params against the live
> spec at build time.** All calls send `x-api-key`; all except the public
> OAuth token endpoint and taxonomy reads also send the OAuth bearer
> (`{user_id}.{access_token}`).

## OAuth (no scope — public token endpoints)

| Operation | Method + path | Used for |
| --- | --- | --- |
| (authorize redirect) | `GET https://www.etsy.com/oauth/connect` | Consent screen (browser redirect, not an API call) |
| token exchange / refresh | `POST /v3/public/oauth/token` | Code→tokens (PKCE) and refresh-token rotation |

## Identity & shop context

| Operation | Method + path | Scope | Used for |
| --- | --- | --- | --- |
| `getMe` | `GET /v3/application/users/me` | `shops_r` | Resolve `user_id` + `shop_id` at connect time |
| `getShop` | `GET /v3/application/shops/{shop_id}` | `shops_r` | Shop name/status for the admin panel |

## One-time shop infrastructure (read; create only for sections)

| Operation | Method + path | Scope | Used for |
| --- | --- | --- | --- |
| `getShopShippingProfiles` | `GET /v3/application/shops/{shop_id}/shipping-profiles` | `shops_r` | Settings dropdown ([06](06-shop-prerequisites.md)) |
| `getShopReturnPolicies` | `GET /v3/application/shops/{shop_id}/policies/return` | `shops_r` | Settings dropdown |
| readiness-state list (name per spec) | `GET /v3/application/shops/{shop_id}/readiness-states` *(verify exact path — newer API area)* | `shops_r` | Settings dropdown |
| `getShopSections` | `GET /v3/application/shops/{shop_id}/sections` | `shops_r` | Section mapping |
| `createShopSection` | `POST /v3/application/shops/{shop_id}/sections` | `shops_w` | Auto-create per-type sections (only API-side create we do) |

## Taxonomy (build-time / cached in code; no OAuth needed)

| Operation | Method + path | Scope | Used for |
| --- | --- | --- | --- |
| `getSellerTaxonomyNodes` | `GET /v3/application/seller-taxonomy/nodes` | — | Pin leaf `taxonomy_id` map |
| `getPropertiesByTaxonomyId` | `GET /v3/application/seller-taxonomy/nodes/{taxonomy_id}/properties` | — | Property/scale IDs for best-effort attributes |

## Listings — core sync (Phases 1–2)

| Operation | Method + path | Scope | Used for |
| --- | --- | --- | --- |
| `createDraftListing` | `POST /v3/application/shops/{shop_id}/listings` | `listings_w` | Step 1 of publish |
| `updateListing` | `PATCH /v3/application/shops/{shop_id}/listings/{listing_id}` | `listings_w` | Activate (`state: active`), deactivate (`inactive`), copy/attribute updates |
| `updateListingInventory` | `PUT /v3/application/listings/{listing_id}/inventory` | `listings_w` | Price / quantity / SKU (incl. scheduled price push) |
| `updateListingProperty` | `PUT /v3/application/shops/{shop_id}/listings/{listing_id}/properties/{property_id}` | `listings_w` | Best-effort structured attributes (length, ring size, metal) |
| `getListing` | `GET /v3/application/listings/{listing_id}` | `listings_r` | Spot-check state during reconcile |
| `getListingsByShop` | `GET /v3/application/shops/{shop_id}/listings` | `listings_r` | Duplicate-adoption guard, first-connect reconciliation, monthly audit |
| `deleteListing` | `DELETE /v3/application/listings/{listing_id}` | `listings_d` | Admin-confirmed delete only (never automatic — [13](13-open-questions.md) Q9) |

## Listing images ([05-image-pipeline.md](05-image-pipeline.md))

| Operation | Method + path | Scope | Used for |
| --- | --- | --- | --- |
| `uploadListingImage` | `POST /v3/application/shops/{shop_id}/listings/{listing_id}/images` | `listings_w` | One multipart call per image (with `rank`) |
| `getListingImages` | `GET /v3/application/listings/{listing_id}/images` | `listings_r` | Reconcile-on-resume after crash windows |
| `deleteListingImage` | `DELETE /v3/application/shops/{shop_id}/listings/{listing_id}/images/{listing_image_id}` | `listings_d` | Removed/replaced images |

## Optional / deferred

| Operation | Method + path | Scope | Phase | Used for |
| --- | --- | --- | --- | --- |
| `updateListingTranslation` | `PUT /v3/application/shops/{shop_id}/listings/{listing_id}/translations/{language}` | `listings_w` | deferred (Q3) | ES translations from `*_es` fields |
| `uploadListingVideo` | `POST /v3/application/shops/{shop_id}/listings/{listing_id}/videos` | `listings_w` | not planned | Videos (no source data today) |

## Orders (Phase 3 only)

| Operation | Method + path | Scope | Used for |
| --- | --- | --- | --- |
| webhook registration (per Etsy webhooks docs) | `POST` (management endpoint per current docs) | app-level | Subscribe to `order.paid`, `order.canceled` |
| `getShopReceipt` | `GET /v3/application/shops/{shop_id}/receipts/{receipt_id}` | `transactions_r` | Resolve webhook `resource_url` → line items (listing_id + sku) |
| `getShopReceiptTransactionsByReceipt` | `GET /v3/application/shops/{shop_id}/receipts/{receipt_id}/transactions` | `transactions_r` | If line items aren't embedded in the receipt payload |

**Not used anywhere:** `transactions_w` (mark-shipped), Etsy Ads, reviews,
buyer messaging, `email_r`/`address_r` PII scopes — deliberately out of scope
([15-compliance.md](15-compliance.md)).
