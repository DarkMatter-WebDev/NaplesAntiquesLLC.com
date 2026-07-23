# Current Status

> Concise present-state snapshot for session startup. Historical implementation
> detail belongs in `CHANGELOG.md`; durable rationale belongs in `DECISIONS.md`.
> Last reconciled: **2026-07-23**.

## At A Glance

- The active application is the Next.js App Router project in `next-app/`.
- Netlify builds from `next-app/` through the root `netlify.toml`.
- Supabase is the system of record for products, accounts, orders, inquiries,
  marketing data, marketplace state, and app metadata.
- The public site supports English and Spanish, a database-backed shop,
  customer accounts, PayPal checkout, admin inventory/order tools, Etsy sync,
  eBay sync, and AI-assisted product entry.
- Local development currently serves the app at `http://localhost:3001`.
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
- The AI listing assistant has a provider abstraction and an admin-editable
  prompt. Non-overridable field rules protect buyer-facing copy from seller
  guesses, normalize length, and extract width only from explicit evidence.
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
  Rate-limit rows have indexed probabilistic cleanup.
- Public subscriber mutations are routed through validated Next APIs; SQL
  revokes direct public RPC execution once the pending hardening migration is
  applied.
- Admin routes require an authenticated admin profile. Browser clients use only
  public Supabase credentials; service-role access remains server-only.
- CSP, HSTS, frame blocking, referrer, permissions, nosniff, and
  cross-domain-policy headers are configured in Next and root Netlify config.
- Next.js is 16.2.10. The last full and production-only `npm audit` checks
  reported zero vulnerabilities.
- **Still pending:** deploy the 2026-07-21 security changes and apply/verify the
  three SQL hardening scripts listed first in `TASKS.md`.

## Database And Deployment

Confirmed applied migrations include the main sales/PayPal schema, no-
reservation checkout, PayPal hardening/refund ledger, order email history,
order tracking, order/message recycle bins, sold-price locking, product
quantity, product width, Etsy sync/resumable queue, eBay sync, and product
videos. Individual runbooks remain the authority for migration order.

Do not infer that every SQL file is applied. The security hardening scripts
listed in `TASKS.md` remain pending until production verification proves
otherwise.

Netlify environment values are the current operating credentials. Local
`next-app/.env.local` is known to be stale and must not be treated as the
production configuration.

## Verification Baseline

Latest app verification before this documentation-maintenance pass:

- `npm test -- --run`: **435 tests passed**.
- `npm run lint`: **passed**.
- `npm audit --omit=dev` and `npm audit`: **0 vulnerabilities** at the
  2026-07-21 security pass.
- `npm run build`: application compilation succeeds, then the generated Next
  route-contract check rejects the named `renderShopPage` export from
  `src/app/[locale]/shop/(list)/page.tsx`. This is the current known build
  blocker and must not be reported as a passing production build.
- Recent browser checks covered shop routes, filtering, responsive overflow,
  image loading, checkout address validation, and Florida/non-Florida totals.
- 2026-07-23 desktop hover-affordance pass: `npm run lint` passed; desktop
  homepage and shop preview checks confirmed the new controls have pointer
  cursors and transition rules. The dev server remains available at
  `http://localhost:3001`.
- 2026-07-23 Admin Products summary-card removal: `npm run lint` passed; the
  `/admin` preview showed the toolbar directly below the header with no
  summary cards. The shared JSX removal applies at desktop, tablet, and mobile
  widths. `npm run build` compiled successfully but remains blocked by the
  known generated `renderShopPage` route-contract error above.
- 2026-07-23 Admin Products page-scroll removal: the `/admin` preview measured
  the document and body at the viewport height while the product-table wrapper
  retained independent vertical scrolling. `npm run lint` passed; the build
  remains blocked by the same known generated route-contract error.

The hover-affordance pass changes app UI styling only; it does not alter SQL,
customer data, product data, orders, or payments.

## Immediate Priorities

1. Deploy and verify the pending security hardening, then apply and probe the
   three SQL scripts in `TASKS.md`.
2. Resolve the `renderShopPage` route-export build blocker.
3. Complete accountant review for Florida county surtax and any non-Florida
   nexus registrations before changing tax collection.
4. Run the controlled PayPal recovery/refund/race matrix in the configured
   environment.
5. Finish Cloudflare Stream deployment/device checks and the remaining targeted
   marketplace verification.
