# 15 — Compliance (Etsy API Terms & Policies, Data Handling)

> Planning only. Re-verify against the current Etsy API Terms of Use and
> Developer Policy at implementation time — this summarizes the obligations
> the design already accounts for.

## Etsy API Terms — how the design complies

| Obligation | How this plan complies |
| --- | --- |
| **API only, no scraping** | All Etsy interaction is via documented v3 endpoints ([openapi-endpoints-used.md](openapi-endpoints-used.md)). No HTML fetching of etsy.com, ever — including for "does my listing look right" checks (those are the owner's eyeballs). |
| **Trademark / branding** | Required attribution displayed wherever the integration has UI (admin panel): *"The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc."* We never use Etsy logos to imply endorsement; the buyer-facing site currently shows nothing Etsy-branded at all (nothing customer-facing is in scope). |
| **Minimal caching of Etsy data** | We store only: IDs (listing/image/profile/section), states, our own hashes, timestamps, and redacted error summaries. No Etsy listing copy, no Etsy images, no buyer data at rest. Etsy's terms limit how long API data may be cached — our ID-and-state-only footprint sits comfortably under any such limit, and receipt data (Phase 3) is processed transiently and not persisted beyond order/transaction IDs in the log. |
| **Credential secrecy** | Keystring/shared secret in Netlify env only; user tokens encrypted at rest, service-role-only table, redacted logging ([04-oauth-and-secrets.md](04-oauth-and-secrets.md), [11-error-handling.md](11-error-handling.md)). Credentials are never shared, embedded client-side, or committed. |
| **Rate-limit respect** | Client-side throttle below the cap, backoff on 429, quota logging ([10-rate-limits-and-quotas.md](10-rate-limits-and-quotas.md)). |
| **Personal-app scope** | Own shop only. No multi-seller features, no commercial API use — matches the personal approval tier. If that ever changes, commercial approval is a prerequisite, not an afterthought. |
| **User consent & revocation** | OAuth consent is the owner's own; Disconnect removes our stored grant and we document Etsy-side revocation (etsy.com → Security → Apps). |

## Etsy marketplace policies the sync must not violate

- **Vintage policy (20+ years)** — the owner attests all synced inventory is
  genuinely vintage and that post-2006/missing `item_year` values are
  data-entry errors; those items push with an owner-approved `1990s` fallback
  rather than being blocked ([02-field-mapping.md](02-field-mapping.md) §C,
  [13-open-questions.md](13-open-questions.md) Q2, decided 2026-07-08).
  Compliance responsibility for that attestation sits with the owner; the
  sync keeps it honest by flagging every fallback use in the dry-run and by
  using the real `item_year` bucket the moment one is entered.
- **Fee avoidance** — listing descriptions must not steer buyers off-Etsy to
  buy the same item cheaper (no site URLs / "buy direct" language in pushed
  descriptions). The description template omits links entirely.
- **Accurate listings** — descriptions/materials/photos come from the same
  data the site sells with; no Etsy-only embellishment.
- **Prohibited/restricted items** — coins/bullion are **included** per the
  owner's Q7 decision (2026-07-08), with the owner accepting the policy risk;
  an Etsy-side rejection of such an item surfaces as a per-item error and the
  item stays site-only.

## Data handling summary (all directions)

| Data | Direction | At rest? |
| --- | --- | --- |
| Product copy, price, qty, attributes | Us → Etsy | Already ours (Supabase); Etsy holds its copy |
| Image bytes | Supabase Storage → our function memory → Etsy | Never at rest with us beyond the request; no blobs in Postgres (project hard rule) |
| OAuth tokens | Etsy → us | Encrypted, service-role-only row |
| Listing/image IDs, states | Etsy → us | Yes — the mapping tables (ours to keep; not "Etsy content") |
| Receipts / buyer info (Phase 3) | Etsy → us | Transient; only order/transaction IDs logged, **no buyer PII stored** |

Privacy-policy note: Phase 3 processes Etsy buyer order data transiently.
Since none of it is retained and those buyers are Etsy's customers under
Etsy's privacy policy, no site privacy-policy change is expected — but
re-check `/privacy` wording when Phase 3 actually ships.

## Project-internal compliance

- No git operations in this folder (project rule); the owner copies to the
  repo manually.
- No secrets in `etsy-sync-plan/` or `project-docs/` — env var **names** only.
- Destructive-op rules apply to Etsy objects too: `deleteListing` and bulk
  anything are dry-run/confirm-first ([13-open-questions.md](13-open-questions.md) Q9).
