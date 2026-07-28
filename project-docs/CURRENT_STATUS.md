# Current Status

> Concise present-state snapshot for session startup. Historical implementation
> detail belongs in `CHANGELOG.md`; durable rationale belongs in `DECISIONS.md`.
> Last reconciled: **2026-07-28**.

## At A Glance

- The active application is the Next.js App Router project in `next-app/`.
- Netlify builds from `next-app/` through the root `netlify.toml`.
- Supabase is the system of record for products, accounts, orders, inquiries,
  marketing data, marketplace state, and app metadata.
- The public site supports English and Spanish, a database-backed shop,
  customer accounts, PayPal checkout, admin inventory/order tools, Etsy sync,
  eBay sync, and AI-assisted product entry.
- Local development currently serves the app at `http://localhost:3000`.
- Local source contains several changes newer than the last confirmed live-site
  review. Deployment parity must not be assumed until the next Netlify deploy
  and production smoke test.

## Storefront

- `/shop` supports gallery/list views, database-side pagination, URL-backed
  search/filter/sort state, responsive filters, Saved Items, and cart flows.
- Shop cards mount only the cover image initially. Carousel neighbors mount on
  interaction, offscreen cards use containment, and multi-image gallery cards
  show a bottom-edge progress fill during hover progression.
- Pagination uses explicit ellipses for omitted ranges and localized
  `Page X of Y` status at 440px and below.
- Public browse includes available items and, when enabled in Admin Settings,
  sold items. A second setting can replace sold prices with `Sold` without
  changing stored product prices.
- The public status filter is a required Available/Sold radio choice. Available
  is selected by default; Sold inventory appears only after selecting Sold.
- The shop count uses the fully filtered result count as its numerator and the
  whole visible public inventory as its denominator. A live 2026-07-28 audit of
  Silver + Everything Else confirmed the current data genuinely has 29
  Available and 29 Sold matches out of 127 public pieces; the equal numerators
  are coincidental, while the constant denominator is intentional.
- Product attributes are consistent across gallery and list views. Necklace and
  bracelet width is stored as `width_mm`, displayed in millimeters, and
  filterable through five multi-select ranges.
- Necklace/bracelet length accepts legacy and current inch formats for reads,
  while new Admin/AI writes normalize to a bare numeric value.
- The desktop filter sidebar has a viewport-relative height and internal scroll,
  so all controls remain reachable on short tablet-landscape and small-desktop
  viewports.
- The desktop header uses the optimized 160x160
  `public/assets/images/branding/nav-logo.webp` asset.
- Desktop Saved Items and Cart controls use color feedback plus motion on the
  icon glyph only; their hover state has no pale fill, surrounding lift, or
  shadow box.

## Checkout And Orders

- PayPal Orders API v2 is the storefront payment processor. The browser never
  supplies authoritative amounts; `src/lib/checkout-pricing.ts` reloads product
  data and calculates item snapshots, shipping, tax, and total.
- Checkout is U.S.-only for shipped orders. State is normalized to one of the
  50 states plus D.C.; ZIP accepts five digits or ZIP+4; the server rejects
  incomplete, invalid, international, and tampered addresses.
- `src/lib/checkout-shipping.ts` is the only shipping-rate catalog:
  Local Pickup $0, Priority Insured $45, Express Overnight Insured $75.
- Current owner policy: Local Pickup and validated Florida destinations are
  charged 6% Florida sales tax on discounted taxable merchandise plus charged
  shipping. Non-Florida destinations receive $0 Florida tax.
- Florida destination-county discretionary surtax is not implemented. Tax
  collection in other nexus states is also not implemented and requires
  accountant review before expansion.
- Checkout uses no inventory reservation. Multiple buyers may reach PayPal;
  the first successful capture wins the row-locked inventory race.
- Capture evidence, webhooks, refunds, invoices, receipts, shipping/tracking,
  recycle-bin behavior, and sold-price locking have durable database support.
  The final live recovery/refund/race matrix remains an owner-controlled test.
- Pickup order details omit a meaningless shipping-address block. Financial
  summaries use exact two-decimal currency output.

## Admin And Listing Intake

- Admin Products defaults to Available inventory and supports filtering,
  selection, sticky identity columns/totals, row quick actions, draft/archive/
  sold lifecycle controls, image lightboxes, cloning, and permanent deletion
  behind explicit confirmation.
- Admin Products intentionally omits the separate Total, Available, and Sold
  summary cards; inventory counts remain available through the table and filters.
- The Admin Products screen is locked to the dynamic viewport; only the product
  table wrapper scrolls, including on narrow layouts.
- Add/Edit listing supports product type, material/pricing fields, bilingual
  copy, `width_mm`, quantity, product video candidates, Etsy data, and eBay data.
- Edit Listing can regenerate only blank Spanish title/description/notes fields;
  retained Spanish copy is never overwritten and the result is saved only when
  the admin saves the form.
- The AI listing assistant supports iterative, in-editor conversation. Each
  turn revises the current form, reports what changed or could not be verified,
  and asks targeted follow-up questions. The server now auto-applies only
  high-confidence descriptive values going into blank fields; overwrites,
  uncertain values, and sensitive facts remain pending until the admin accepts
  them. Assistant turns have Read Aloud/Stop plus optional automatic playback,
  using OpenAI speech with a browser-device fallback. Its provider abstraction,
  admin-editable prompt, buyer-copy firewall, and explicit measurement rules
  remain enforced on every turn.
- Orders support invoices, email history, partial/full PayPal refund handling,
  shipment carrier/tracking, explicit inventory restoration, and a recycle bin.
- Messages and inquiries share the admin notification workflow; marketing
  supports subscribers, account holders, buyers, and combined audiences.

## Marketplace Integrations

- Etsy Phase 1/2 is live. The durable resumable queue migration is applied, and
  the 2026-07-21 repair action recovered all previously affected image-sync
  rows. Status reconciliation preserves local content freshness independently
  from remote active/draft lifecycle.
- Etsy draft publishing, selected review-first sync, channel-specific status
  checks, taxonomy correction, price pushes, and one-click repair are in the
  Admin Products Actions modal.
- eBay Phase 0 webhook/status reconciliation is live and Phase 1/2 write paths
  are partially live-verified. Review-first publishing remains the default.
- Etsy and eBay have separate status-check actions and separate Publish All
  Ready actions. Marketplace sync entry points are consolidated in the Actions
  modal.
- Open marketplace risks are tracked in `TASKS.md`: sold hidden eBay status
  scanning, inventory #82's external relist, remaining controlled eBay write
  checks, and one real Etsy image-progress observation.
- The current shipped eBay description banner contains off-eBay contact
  information and is intentionally not connected to listing descriptions.
  Root `banner.png` is a newer, different candidate, but still includes the
  website address; it is retained pending an owner decision and policy review.

## Product Media

- Product images are URL/path references only. New uploads go to Supabase
  Storage, are downscaled/encoded as WebP, and use immutable cache headers.
- Storage cleanup is reference-aware and dry-run-first. The last confirmed
  product-image GC pass reported no deletable orphans.
- Product video code is complete around direct browser-to-Cloudflare Stream TUS
  uploads, staged replacement, webhook processing, ready-only public playback,
  and provider-first deletion.
- The product-video SQL is applied. Netlify environment variables, Stream
  webhook registration, device testing, and marketplace MP4 validation remain
  pending.

## Security

- Netlify Edge applies a broad per-IP `/api/*` rate limit. Sensitive public
  routes also use distributed Supabase counters with route-specific limits.
- The shared limiter fails closed when its service client/RPC is unavailable.
  After the owner re-ran the SQL on 2026-07-28, a live read-only production
  probe confirmed that the rate-limit RPC is `SECURITY DEFINER`, has
  `search_path=public`, is blocked for `anon`/`authenticated`, remains
  executable by `service_role`, contains the deterministic one-percent
  one-day stale-row cleanup, and has `rate_limits_window_start_idx`.
- Public subscriber mutations are routed through validated Next APIs. Live
  2026-07-28 privilege probes now confirm both
  `subscribe_homepage(text,text,text)` and `unsubscribe_homepage(text)` are
  blocked for `anon`/`authenticated` and remain executable by `service_role`.
- The authenticated product-column hardening is applied: all seven internal
  product columns are unreadable to `authenticated`, while a normal public
  column remains readable.
- Admin routes require an authenticated admin profile. Browser clients use only
  public Supabase credentials; service-role access remains server-only.
- CSP, HSTS, frame blocking, referrer, permissions, nosniff, and
  cross-domain-policy headers are configured in Next and root Netlify config.
- Next.js is 16.2.12, PostCSS is overridden to 8.5.23, and Sharp is 0.35.3
  throughout the installed production tree. The production-only audit reports
  zero vulnerabilities.
- The full audit reports nine high-severity development-tool findings through
  ESLint 9's `minimatch@3` / `brace-expansion@1` chain. The audit's forced
  ESLint 10 remediation was tested and rejected because the stable React lint
  plugins bundled by `eslint-config-next@16.2.12` do not support it; lint fails
  at rule startup. This is not part of the deployed dependency tree. Monitor
  upstream stable tooling rather than forcing an incompatible major upgrade.
- **Still pending:** deploy the 2026-07-21 application security changes and
  verify the live response headers and Netlify Edge function behavior.

## Database And Deployment

Confirmed applied migrations include the main sales/PayPal schema, no-
reservation checkout, PayPal hardening/refund ledger, order email history,
order tracking, order/message recycle bins, sold-price locking, product
quantity, product width, Etsy sync/resumable queue, eBay sync, and product
videos. Individual runbooks remain the authority for migration order.

Do not infer that every SQL file is applied. The three 2026-07 security scripts
are specifically verified in production: subscriber RPC execution is
service-role-only, the current rate-limit function/index/cleanup definition is
present, and authenticated users cannot read the seven internal product
columns.

Netlify environment values are the current operating credentials. Local
`next-app/.env.local` is known to be stale and must not be treated as the
production configuration.

A read-only Netlify key-name audit on 2026-07-28 found the core Supabase, site
URL, Resend, PayPal, Anthropic AI, Etsy, and eBay entries present. The four
Cloudflare Stream variables, `OPENAI_API_KEY`, and `ETSY_CRON_SECRET` remain
absent. The owner explicitly deferred those nonessential video, server-voice,
and scheduled-Etsy features for the current deployment; device-voice and manual
Etsy actions remain available. No environment values were read or recorded.

## Verification Baseline

Latest app verification for the current UI-maintenance pass:

- `npm test -- --run`: **452 tests passed**.
- `npm run lint`: **passed**.
- `npm audit --omit=dev`: **0 vulnerabilities**.
- `npm audit`: **9 high-severity development-tool findings** in the supported
  ESLint 9 matching stack; the forced ESLint 10 path is currently incompatible
  with Next's stable React lint plugins.
- `npm run build`: **passed** on Next.js 16.2.12. TypeScript completed, all 419
  static pages generated, and the command exited 0.
- Recent browser checks covered shop routes, filtering, responsive overflow,
  image loading, checkout address validation, and Florida/non-Florida totals.
- 2026-07-23 desktop hover-affordance pass: `npm run lint` passed; desktop
  homepage and shop preview checks confirmed the new controls have pointer
  cursors and transition rules. The dev server remains available at
  `http://localhost:3000`.
- 2026-07-23 Admin Products summary-card removal: `npm run lint` passed; the
  `/admin` preview showed the toolbar directly below the header with no
  summary cards. The shared JSX removal applies at desktop, tablet, and mobile
  widths. `npm run build` compiled successfully but remains blocked by the
  known generated `renderShopPage` route-contract error above.
- 2026-07-23 Admin Products page-scroll removal: the `/admin` preview measured
  the document and body at the viewport height while the product-table wrapper
  retained independent vertical scrolling. `npm run lint` passed; the build
  remains blocked by the same known generated route-contract error.
- 2026-07-24 local preview orientation: `npm run dev` started successfully at
  `http://localhost:3000`; the homepage and `/shop` rendered in the in-app
  browser. The shop showed live spot prices, filters, and product cards. No
  source or data changes were made.
- 2026-07-24 product-detail mobile investigation: the affected item route
  returned HTTP 200 and had no browser console errors, but its shared content
  wrapper stayed at `data-customer-reveal="pending"` / `opacity: 0` at 390px.
  The reveal waits on 15 gallery images, including offscreen lazy thumbnails
  that never load on mobile. This explained the brief flash followed by blank
  content.
- 2026-07-24 customer-reveal hardening: the shared reveal now ignores lazy
  images and has a 1.4-second fallback, so slow/deferred media cannot leave
  customer content hidden. At 390px the affected 15-image product stayed
  visible while three offscreen thumbnails remained unloaded. A browser audit
  of 28 English/Spanish public routes found zero pending/hidden reveal
  containers and no browser warnings/errors. `npm run lint` passed and
  `npm test -- --run` passed all 435 tests; `npm run build` compiled before
  stopping at the pre-existing `renderShopPage` route-contract error.
- 2026-07-24 shop-return restoration: opening a product from either gallery or
  list view records the exact localized shop URL and vertical position for this
  tab. The detail-page Back to Shop action restores that state; direct entries
  still use the normal shop fallback. Focused coverage passed (2 tests), the
  full suite passed all 437 tests, and a browser check returned from page 2 to
  the exact 1,150px position. `npm run lint` passed. `npm run build` compiled
  before stopping at the same existing `renderShopPage` route-contract error.
- 2026-07-24 iterative AI listing assistant: a real two-turn Admin preview
  preserved the existing listing, reported four useful clarification points,
  accepted the admin's answers and revision request, and produced a second
  revised draft. Conversation state resets between product editors and remains
  unsaved until normal Save. Focused assistant tests passed (9), the full suite
  passed all 439 tests, and `npm run lint` passed. `npm run build` compiled
  before stopping at the unchanged `renderShopPage` route-contract error.
- 2026-07-24 homepage-carousel bootstrap fix: the homepage now server-renders
  one cached Supabase-curated payload and `HomeHero` no longer replaces it
  after hydration. Bundled products are used only if the server read fails or
  the selection is empty; admin saves expire the tagged cache immediately.
  Initial HTML contained the current curated Rolex and no fallback name/path,
  and six repeated preview reloads showed the same one-set result with no
  console errors. Three focused tests, all 442 tests, and lint passed.
  `npm run build` compiled before stopping at the unchanged `renderShopPage`
  route-contract error.
- 2026-07-24 shop status radios: the old Available-only checkbox is now an
  Available/Sold radio pair, with Available as the required default. Browser
  checks confirmed Available → Sold → Available URL/result transitions,
  exclusive checked state, and paired Spanish labels. The focused 18-test
  filter suite, all 443 tests, and lint passed. `npm run build` compiled before
  stopping at the unchanged `renderShopPage` route-contract error.

- 2026-07-24 AI confirmation and read-aloud hardening: the server now compares
  each AI draft with the current form and holds every overwrite, sensitive
  field, or low/medium/missing-confidence value for explicit accept/keep
  review. Warnings and uncertain unchanged values force clarification
  questions. Read Aloud/Stop and an automatic-play preference use an
  authenticated OpenAI speech route with a device-voice fallback. A live Admin
  test proved proposed fields stayed unchanged until accepted, Keep Existing
  preserved the original, Undo restored the accepted test field, and read-aloud
  entered/stopped playback; no listing was saved. Eighteen focused tests, all
  452 tests, and lint passed. `npm run build` compiled before stopping at the
  unchanged `renderShopPage` route-contract error.
- 2026-07-27 no-code deployment-readiness audit: all 452 tests and lint passed,
  but the production build still fails on the named `renderShopPage` route
  export and the dependency audits now report high-severity advisories.
  A cold parallel preview probe reproduced the previously intermittent
  development JSON parse failure across several routes; both translation JSON
  files validated, and a clean restart followed by sequential desktop/mobile-
  user-agent route checks returned 200 for home, shop, the affected multi-image
  detail page, Spanish home/shop, checkout, contact, and metal prices. Admin
  correctly redirected to sign-in. No application code, configuration,
  database, or site content changed.
- 2026-07-27 deploy-blocker remediation: current official guidance and live npm
  registry/audit data reconfirmed the route export and production dependency
  findings. The shop renderer moved to a normal colocated module, leaving the
  route file with only valid Next exports. Next/ESLint config advanced to
  16.2.12, Sharp to 0.35.3, and overrides pin PostCSS 8.5.23 plus Sharp 0.35.3
  throughout Next's nested tree. Production audit, lint, all 452 tests, and the
  complete 419-page build passed. English/Spanish shop, `/shop-modern`, the
  affected mobile product page, checkout, contact, auth redirect, and metal
  prices returned expected results with no browser warnings/errors or mobile
  overflow.

This session's UI changes harden customer-page reveal behavior and preserve
shop context when returning from product details, and add iterative Admin AI
listing feedback with explicit confirmation and read-aloud. The carousel now
also receives one server-authoritative initial payload. These changes do not
alter SQL, saved customer/product data, orders, or payments.

## Immediate Priorities

1. Deploy and verify the pending application security hardening and live
   response headers. The three security SQL scripts are already verified.
2. Complete accountant review for Florida county surtax and any non-Florida
   nexus registrations before changing tax collection.
3. Run the controlled PayPal recovery/refund/race matrix in the configured
   environment.
4. Complete the remaining targeted non-video marketplace verification.
