# Architecture

> Update whenever significant structural changes occur. Last updated:
> **2026-06-13** after removing the retired static HTML site.

## System Design

The active site is a **Next.js App Router** app in `next-app/`, deployed on
Netlify with `@netlify/plugin-nextjs`.

```text
Browser
  ├── Next localized routes (/ and /es)
  ├── React components and context (cart, wishlist, layout, admin)
  ├── Next route handlers (/api/metal-prices, /api/inquire, /api/inquiries/:id)
  └── Public assets from next-app/public/assets
        │
        ├──> Supabase Auth + Postgres + Storage
        ├──> gold-api.com via server-side spot-price helper
        └──> Resend for inquiry email when configured
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

Localized pages live under `next-app/src/app/[locale]/`.

Current route families include:

- `/` and `/es`
- `/about`, `/contact`, `/free-evaluation`, `/privacy`, `/faq`
- `/estate-jewelry`, `/estate-services`, `/gold-services`,
  `/silver-services`, `/bullion`
- `/shop` and `/shop/[id]`
- `/account`, `/account/sign-in`, `/account/sign-up`
- `/admin` and `/admin/inquiries`

Next-generated SEO endpoints:

- `/robots.txt` from `next-app/src/app/robots.ts`
- `/sitemap.xml` from `next-app/src/app/sitemap.ts`

## Data Model

Supabase is the source for app data:

- `products` - shop catalog, pricing inputs, copy, status, images, sort order.
- `profiles` - customer profile/contact/address details plus admin/VIP flags.
- `favorites` / cart-related account data - customer saved state.
- `inquiries` - submitted seller/buyer inquiries.

SQL setup and policy scripts live in `supabase/`.

Existing Supabase projects should run `supabase/profile-contact-fields.sql` to
add the full editable customer profile fields used by `/account` and checkout
prefill.

## Product Images

Products can use:

- local paths under `/assets/...`, served from `next-app/public/assets/...`
- Supabase Storage public URLs for uploaded admin images

Remote Supabase Storage images are allowed in `next-app/next.config.ts`.

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
- `next-app/src/proxy.ts`, which refreshes Supabase sessions during routing.

Account routes live under `next-app/src/app/[locale]/account/`.

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
