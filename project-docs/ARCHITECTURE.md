# Architecture

> Update whenever significant structural changes occur. Last updated:
> **2026-06-20** after the documentation cleanup, product image/object storage
> audit, and customer-facing reveal coordinator addition.

## System Design

The active site is a **Next.js App Router** app in `next-app/`, deployed on
Netlify with `@netlify/plugin-nextjs`.

```text
Browser
  ├── Next localized routes (/ and /es)
  ├── React components and context (cart, wishlist, layout, admin, legal notice)
  ├── Next route handlers (/api/metal-prices, /api/inquire, /api/inquiries/:id,
  │   /api/checkout/order, /api/subscribe, /api/unsubscribe,
  │   /api/admin/marketing/*, /api/webhooks/resend)
  └── Public assets from next-app/public/assets
        │
        ├──> Supabase Auth + Postgres + Storage
        ├──> gold-api.com via server-side spot-price helper
        └──> Resend for inquiry/order and direct marketing email when configured
```

The old root `*.html`, `es/`, `scripts/`, root `assets/`, and
`netlify/functions/` runtime have been removed.

## Folder Structure

```text
NaplesEstateJewelry.co/
├── AGENTS.md
├── ACCOUNT_SETUP.md
├── netlify.toml                 # Netlify parent config: base = next-app
├── .gitignore
├── project-docs/                # project memory
├── supabase/                    # SQL schema/policy scripts
└── next-app/
    ├── package.json
    ├── package-lock.json
    ├── netlify.toml             # app-local Netlify config
    ├── next.config.ts
    ├── messages/                # next-intl messages
    ├── public/
    │   ├── assets/              # local images/video
    │   └── netlify-forms.html
    └── src/
        ├── app/                 # routes, metadata, APIs
        ├── components/          # layout/shop/admin/account/contact UI
        ├── context/             # cart + wishlist context
        ├── i18n/                # next-intl routing/request config
        ├── lib/                 # pricing, spot price, Supabase clients
        └── types/               # shared TypeScript contracts
```

## Routing

Localized pages live under `next-app/src/app/[locale]/`. The localized
homepage route is grouped under `next-app/src/app/[locale]/(home)/` so its
branded loading fallback does not wrap every internal localized route.

Current route families include:

- `/` and `/es`
- `/about`, `/contact`, `/free-evaluation`, `/privacy`, `/terms`,
  `/cookie-preferences`, `/accessibility`, `/returns-refunds`, `/shipping`,
  `/auction-terms`, `/vendor-terms`, `/unsubscribe`, `/faq`
- `/estate-jewelry`, `/estate-services`, `/gold-services`,
  `/silver-services`, `/bullion`
- `/shop` and `/shop/[id]`
- `/account`, `/account/sign-in`, `/account/sign-up`
- `/admin`, `/admin/orders`, `/admin/orders/[id]`, `/admin/messages`,
  `/admin/inquiries`, `/admin/subscribers`, `/admin/marketing`,
  `/admin/settings`, `/admin/users`, and
  `/admin/users/[id]/invoices`

## Compliance Foundation

The shared footer (`next-app/src/components/layout/SiteFooter.tsx`) exposes a
Legal column on every page using the shared footer. Legal/policy pages share the
`LegalPolicyPage` renderer under `next-app/src/components/legal/`.

Marketing email uses `next-app/src/lib/marketing.ts` as the single audience and
send chokepoint. Newsletter subscribers are explicit opt-in via
`homepage_subscribers`; account holders are included by default unless
`profiles.marketing_opt_out = true`. Admin campaign pages and APIs use the
service-role Supabase client server-side only, require an admin profile check,
and refuse marketing sends until a physical mailing address is configured in
`marketing_settings`.

The locale layout mounts `CookieNotice`, which stores only a notice-accepted
flag in localStorage. `Cookie Preferences` lets visitors reset/accept that
notice. Source review on 2026-06-19 found no GA/GTM/Meta Pixel/Clarity/Hotjar
tracking code in the app; if non-essential tracking is added later, the policy
and cookie preference UI need a real opt-in/out update.

Account registration stores Terms/Privacy acceptance in Supabase Auth user
metadata. `supabase/compliance-consent.sql` and `supabase/schema.sql` add
matching `profiles` fields for acceptance timestamps and accepted policy version
so the live database can copy those values into profile records. Homepage
subscribers can opt out through `/unsubscribe`, which
posts to `/api/unsubscribe` and calls the `unsubscribe_homepage` RPC added to
`supabase/homepage-subscribers.sql`.

## Carousel Hero

The **home page** hero (`next-app/src/components/home/HomeHero.tsx`) is the 3D
carousel widget (`next-app/carousel`), replacing the old MP4 ring video. Storefront
CTAs route directly to `/shop`; there is no intermediate `/store` chooser route.
The ring is **windowed/infinite** (only an admin-set number of cards exist at
once; the curated list cycles through), photos carry a per-photo **White/Black
group** that drives a **swept** hero background, images go through `next/image`
with an off-screen preloader, and an `IntersectionObserver` pauses it offscreen.
Admin curation is at `/admin/settings` → `Store Carousel Hero`, backed by
`next-app/carousel/lib/carouselData.ts`. The
hero reads `carousel_selection` + `carousel_settings` on the client and falls back
to hardcoded items if the tables are absent/empty. Setup SQL: `next-app/carousel/
sql/setup.sql` (+ `add-per-item-bg.sql`, `add-visible-count.sql`,
`add-visible-count-mobile.sql`). Full detail: `project-docs/features/carousel-hero.md`.

## Customer-Facing Reveal Motion

The locale layout mounts `next-app/src/components/layout/CustomerReveal.tsx`
inside `data-customer-reveal-root`. It is a small client-side coordinator that
adds loaded-block entrance reveals on customer-facing localized pages while
skipping `/admin` routes. Each selected block waits for its own descendant
images, CSS background images, and `document.fonts.ready` before moving from
`data-customer-reveal="pending"` to `visible`; image errors count as complete so
content does not remain hidden. Large shop gallery parents are excluded because
product cards already have their own image-aware reveal and lazy offscreen
images should not block the whole gallery. Shared CSS lives in
`next-app/src/app/globals.css` and disables the motion for reduced-motion users
and print. The home carousel hero carries `data-customer-reveal-skip` because
the 3D carousel depends on unmodified ancestor transform/filter state and its
own admin-driven visible-count/windowing behavior. `HomeHero` owns a local
top-down readiness fade instead: after carousel data/settings settle and the
visible ring image URLs plus fonts are ready, the headline fades in first, the
carousel layer second, and the subscriber/actions layer last while preserving
the existing centered `translateX(-50%)` transforms.

Next-generated SEO endpoints:

- `/robots.txt` from `next-app/src/app/robots.ts`
- `/sitemap.xml` from `next-app/src/app/sitemap.ts`

Current route handlers include `/api/metal-prices`, `/api/inquire`,
`/api/inquiries/[id]`, `/api/checkout/order`, `/api/subscribe`, and the
admin-only `/api/admin/ai-product-fill`.

## Data Model

Supabase is the source for app data:

- `products` - shop catalog, pricing inputs, copy, lifecycle status, images,
  inventory/SKU fields, new primary Product Type (`product_type`) with legacy
  `jewelry_type` fallback, secondary Metal Type (`metal_type`) with legacy
  Gold/Silver `category` pricing fallback, Metal Color (`metal_variant`),
  necklace/bracelet Link Type (`chain_type`), location, featured flag, bilingual
  public notes (`public_notes` = Notes (EN), `public_notes_es` = Notes (ES),
  shown on the /es product page), and admin-only cost/acquisition fields. The
  legacy `internal_notes` column is retained for the `details` fold but no longer
  surfaced in the listing form.
- `orders` - order headers/customer totals/payment/fulfillment state.
- `order_items` - immutable product snapshots attached to orders.
- `invoices` - invoice headers/totals/status for order-linked billing.
- `admin_notifications` - admin message center notifications for checkout
  orders and future operational alerts.
- `homepage_subscribers` - homepage subscriber CTA signups displayed in the
  admin Subscribers tab.
- `saved_items` - account-linked saved item records for the next account phase.
- `profiles` - customer profile/contact/address details plus admin/VIP flags.
- `favorites` / cart-related account data - customer saved state.
- `inquiries` - submitted seller/buyer inquiries.
- `ai_settings` - single-row table holding the optional admin override for the
  AI listing-assistant system prompt (NULL = use the built-in default).
- `carousel_selection` / `carousel_settings` - Carousel Hero curation. Selection:
  `product_id`, `position`, `bg_color` (per-photo White/Black group). Settings:
  `show_price`, `bg_color` (legacy default), `visible_count` (desktop ring size),
  `visible_count_mobile`.

SQL setup and policy scripts live in `supabase/`.

Anonymous public reads should use `next-app/src/lib/supabase/public.ts`, which
creates a cookie-free Supabase anon client for server-side rendering. The
cookie-backed server client is reserved for user-state routes/actions that need
the logged-in Supabase session. As of 2026-06-22, the proxy refreshes Supabase
sessions only for account/admin/checkout/payment paths so marketing/legal/service
pages can prerender and cache without harmless public reads forcing
request-time rendering.

Existing Supabase projects should run `supabase/profile-contact-fields.sql` to
add the full editable customer profile fields used by `/account` and checkout
prefill.

Existing Supabase projects should also run
`supabase/admin-profile-read-policy.sql` before using `/admin/users`; it adds a
security-definer admin check and an RLS policy so admin accounts can read the
complete `profiles` table.

Existing Supabase projects should run `next-app/sql/ai-settings-setup.sql` to
create the admin-only `ai_settings` table and the `is_app_admin()` helper that
back the editable AI listing-assistant prompt. Until it is run, the Settings
panel still shows the default prompt, but saving a custom prompt fails with a
clear "table not found" error.

Existing Supabase projects should run `supabase/sales-workflow.sql` before
using Orders/Sales, invoices, saved item records, guarded product delete, or the
new product lifecycle fields in production.

Existing Supabase projects should run `supabase/product-jewelry-type.sql` to add
and backfill `products.jewelry_type` for the separated Jewelry Type / Link Type
catalog model.

Existing Supabase projects should run `supabase/product-type-metal-type.sql` to
add and backfill nullable `products.product_type` and `products.metal_type`.
The app currently dual-writes these fields while preserving `jewelry_type` and
`category` for compatibility.

Existing Supabase projects should run
`supabase/admin-notifications-checkout.sql` after `sales-workflow.sql` before
using public checkout order submission or `/admin/messages` in production.

Existing Supabase projects should run `supabase/homepage-subscribers.sql`
before using the homepage subscriber CTA or `/admin/subscribers` in production.

## Product Images

Products can use:

- local paths under `/assets/...`, served from `next-app/public/assets/...`
- Supabase Storage public URLs for uploaded admin images

Remote Supabase Storage images are allowed in `next-app/next.config.ts`.

Product image bytes are intentionally stored outside product rows. The
`products.images` and `products.image_urls` arrays store URL/path strings only;
new uploads go to Supabase Storage bucket `product-images` under `products/`.
The admin upload path compresses images to WebP before upload, then stores the
returned public URL on the product record. Public shop/card/detail rendering
prefers `image_urls` and falls back to `images`.

2026-06-20 live audit: 48 products, 321 entries in each image array, zero
`data:`/inline image payloads, 28 Storage-only products, 19 local-only legacy
products, 1 mixed product, and 202 DB-referenced Storage objects all present.
The subsequent confirmed Storage GC deleted 91 old unreferenced objects; the
follow-up dry-run reported 202 objects, 202 referenced paths, 0 orphans, and 0
deletable paths. The DB-backed local shop PNG paths were migrated to WebP and
the 114 repointed shop PNG originals were removed, leaving no PNG files under
`next-app/public/assets`.

## Pricing

Metal pricing is server-side:

- `next-app/src/lib/spot-price.ts` fetches gold/silver spot data from
  `api.gold-api.com` with a fallback.
- `next-app/src/app/api/metal-prices/route.ts` exposes the app API.
- `next-app/src/lib/pricing.ts` computes display pricing.

## Authentication

Supabase Auth is configured through:

- `next-app/src/lib/supabase/client.ts`
- `next-app/src/lib/supabase/server.ts`
- `next-app/src/lib/supabase/public.ts` for anonymous server-side public reads.
- `next-app/src/proxy.ts`, which refreshes Supabase sessions during routing only
  for user-state route prefixes.

Account routes live under `next-app/src/app/[locale]/account/`.

## AI Product Listing Assistant

The Product Admin Add/Edit drawer includes an integrated AI Listing Assistant
that accepts typed text or browser speech-recognition transcript text, requests
a structured product draft from the server, previews returned fields, and
applies them into the current form state. It does not write directly to
Supabase; the normal product Save flow remains the persistence step. The older
manual Quick Fill workflow is currently disabled in the editor UI
(`SHOW_QUICK_FILL = false` in `AdminShell.tsx`), but its parser and gated panel
still live in `AdminShell.tsx` so it can be restored without carrying a stale
backup copy.

Provider and model details are isolated in
`next-app/src/lib/ai-product-provider.ts`. UI components, route handlers,
schema coercion, and form population code must stay provider-neutral.

The trust boundary is:

- `next-app/src/app/api/admin/ai-product-fill/route.ts` verifies the signed-in
  Supabase user is an admin, validates transcript/images, rate-limits per admin
  user, calls the provider-neutral draft function, coerces the result, and
  returns structured JSON.
- `next-app/src/lib/ai-product-schema.ts` owns the provider-neutral schema,
  accepted field keys, enum coercion, warnings, and confidence/uncertainty
  shape.
- `next-app/src/lib/ai-product-provider.ts` is the only file that may read AI
  API keys, know provider names/model names, construct provider requests, parse
  provider-specific responses, or store the default extraction prompt
  (`PRODUCT_EXTRACTION_SYSTEM_PROMPT`).

### Editable system prompt

The system prompt that drives extraction is editable by the admin at
`/admin/settings` (the "AI Listing Assistant Prompt" panel).
`PRODUCT_EXTRACTION_SYSTEM_PROMPT` in `ai-product-provider.ts` is the built-in
default; an optional override is stored in the single-row `ai_settings` table
and read server-side per request via `next-app/src/lib/ai-settings-store.ts`.
The admin-gated `next-app/src/app/api/admin/ai-settings/route.ts` (`GET`/`PUT`)
loads and saves the override; saving a blank value clears it and reverts to the
default. The fill route passes the override into the provider through the
`systemPrompt` input. If the `ai_settings` table is missing or the read fails,
the default prompt is used so generation never breaks. Required setup SQL lives
at `next-app/sql/ai-settings-setup.sql`.

The assistant sends the first allowed product images as visual context to the
provider layer. `AI_MAX_IMAGES` controls the count and defaults to 2; local
`/assets/...` product images and Supabase Storage `product-images` URLs are the
allowed sources.

Required live environment configuration before actual generation works:

```text
AI_PROVIDER=<openai|anthropic|google|local>
AI_MODEL=<configured model name>
OPENAI_API_KEY=... or ANTHROPIC_API_KEY=... or GOOGLE_AI_API_KEY=...
```

Optional controls include `AI_MODEL_FAST`, `AI_MODEL_ACCURATE`,
`AI_MODEL_PREMIUM`, `AI_MAX_IMAGES`, `AI_MAX_IMAGE_BYTES`,
`AI_RATE_LIMIT_HOURLY`, `AI_RATE_LIMIT_DAILY`, `AI_TIMEOUT_MS`, and
`AI_MAX_OUTPUT_TOKENS`.

## Deployment

Root `netlify.toml`:

```toml
[build]
  base = "next-app"
  command = "npm run build"
  publish = ".next"
```

It keeps useful legacy image redirects that still land on
`next-app/public/assets`. Redirects to deleted legacy scripts were removed.

## Verification

Primary check:

```bash
cd next-app
npm run build
```

Run `npm run lint` when touching TypeScript, React components, routing, or
shared UI behavior.
