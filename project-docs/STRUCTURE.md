# Structure & Build Integrity

> Canonical map of the current project layout and the invariants that keep the
> Next.js site consistent. Last updated: **2026-06-30**.

## What kind of site this is

The active site is a **Next.js App Router application** in `next-app/`. Netlify
is connected at the parent project folder, but root `netlify.toml` sets:

```toml
[build]
  base = "next-app"
  command = "npm run build"
  publish = ".next"
```

The former root static HTML site has been removed. Do not reintroduce root
`*.html`, `scripts/`, `assets/`, or `netlify/functions/` as app runtime.

## Single sources of truth

| Concern | Single source of truth |
|---------|------------------------|
| Pages/routes | `next-app/src/app/[locale]/*` (`(home)` owns the localized homepage route) |
| Shared layout | `next-app/src/components/layout/*` |
| Product data | Supabase `products` table |
| Product type contract | `next-app/src/types/product.ts` |
| Product uploads | Supabase Storage bucket `product-images` |
| Product pricing | `next-app/src/lib/pricing.ts` and `next-app/src/lib/spot-price.ts` |
| Metal price API | `next-app/src/app/api/metal-prices/route.ts` |
| Inquiry API | `next-app/src/app/api/inquire/route.ts` and `next-app/src/app/api/inquiries/[id]/route.ts` |
| Online payments (PayPal) | `next-app/src/lib/paypal.ts` + `next-app/src/app/api/paypal/{create-order,capture-order,webhook}/route.ts` + `next-app/src/components/checkout/PayPalCheckoutButton.tsx` |
| Authoritative checkout totals | `next-app/src/lib/checkout-pricing.ts` (subtotal/tax/shipping/total — never trusted from the client) |
| Public-shop cache invalidation | `next-app/src/app/actions/admin-products.ts` (`adminRevalidateProduct`/`adminRevalidateProducts`) — every write to `products` that should be visible in `/shop` immediately, from any client (browser or server), must call one of these after the write |
| Supabase clients | `next-app/src/lib/supabase/client.ts` and `server.ts` |
| Translations | `next-app/messages/en.json` and `next-app/messages/es.json` |
| Local static assets | `next-app/public/assets/*` |
| SEO robots/sitemap | `next-app/src/app/robots.ts` and `next-app/src/app/sitemap.ts` |
| Project memory | `project-docs/` |

## Directory map

```text
NaplesEstateJewelry.co/
├── AGENTS.md
├── ACCOUNT_SETUP.md
├── netlify.toml
├── supabase/
│   ├── schema.sql
│   ├── products.sql
│   ├── inquiries.sql
│   └── fix-permissions.sql
├── project-docs/
└── next-app/
    ├── package.json
    ├── netlify.toml
    ├── next.config.ts
    ├── messages/
    ├── public/
    │   ├── assets/
    │   └── netlify-forms.html
    └── src/
        ├── app/
        ├── components/
        ├── context/
        ├── i18n/
        ├── lib/
        └── types/
```

## Structural invariants

1. **Keep the app in `next-app/` unless doing a deliberate repo-root
   promotion.** Root `netlify.toml` depends on that base directory.
2. **Do not add runtime files back to the parent root.** Root is for deployment
   config, docs, and database setup. App code and public assets belong under
   `next-app/`.
3. **Products live in Supabase.** Do not rebuild a static JS product catalog.
4. **Product ids are permanent.** Saved cart/wishlist state and URLs depend on
   product ids. Retire items by status rather than renaming ids.
5. **Image bytes do not belong in product rows.** Product rows store URL/path
   strings only. New uploaded inventory photos belong in Supabase Storage bucket
   `product-images`; legacy local paths such as `/assets/images/pages/trust.webp`
   must resolve inside `next-app/public/assets/...`.
6. **Bilingual route behavior stays in `next-intl`.** Add or change localized
   strings in `messages/en.json` and `messages/es.json` or in clearly paired
   localized page logic.
7. **Secrets stay out of the repo.** `.env` and `.env.local` remain ignored.
   Only public `NEXT_PUBLIC_*` values may be exposed to browser code.
8. **Build before publishing.** Run `npm run build` from `next-app/` after code,
   route, schema contract, or config changes.

## Known follow-up

The cleanest long-term shape is to promote `next-app/` to the repository root.
Until then, keep the parent folder lean and avoid duplicating app assets or app
configuration outside `next-app/`.

Product image storage has one remaining cleanup track from the 2026-06-20 audit:
move the remaining legacy local-only product photos to Supabase Storage. The
91 old unreferenced `product-images/products` objects found by the audit were
archived and deleted through the confirmed Storage GC flow.
