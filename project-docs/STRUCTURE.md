# Structure And Build Integrity

> Canonical project map and single sources of truth. Last reconciled:
> **2026-08-03**.

## Runtime Shape

The active site is the Next.js App Router application in `next-app/`. Root
`netlify.toml` intentionally points Netlify at that directory:

```toml
[build]
  base = "next-app"
  command = "npm run build"
  publish = ".next"
```

The retired root static site must not return. Root is for operating
instructions, deployment config, SQL, project memory, and dedicated marketplace
plans. App source and runtime assets belong under `next-app/`.

## Directory Map

```text
NaplesEstateJewelry.co/
|-- AGENTS.md
|-- ACCOUNT_SETUP.md
|-- CLAUDE.md
|-- netlify.toml
|-- project-docs/
|   |-- features/
|   |-- PROJECT_OVERVIEW.md
|   |-- CURRENT_STATUS.md
|   |-- TASKS.md
|   |-- DECISIONS.md
|   |-- CHANGELOG.md
|   `-- ...
|-- supabase/
`-- next-app/
    |-- package.json
    |-- package-lock.json
    |-- next.config.ts
    |-- netlify/
    |   |-- edge-functions/
    |   `-- functions/             # scheduled marketplace + social-drip triggers
    |-- messages/
    |-- public/
    |   `-- assets/
    `-- src/
        |-- app/
        |-- assets/                # vendored static TTFs for the social ad card
        |-- components/
        |-- context/
        |-- hooks/
        |-- i18n/
        |-- lib/
        `-- types/
```

`banner.png` is a temporary owner-supplied source candidate for eBay artwork.
It is not a runtime asset and is retained only because it differs materially
from the shipped WebP. Resolve its policy/content decision in `TASKS.md`; do not
let additional loose app assets accumulate at root.

## Single Sources Of Truth

| Concern | Source |
|---|---|
| Localized pages/routes | `next-app/src/app/[locale]/` |
| Shared layout | `next-app/src/components/layout/` |
| Product data | Supabase `products` |
| Product TypeScript contract | `next-app/src/types/product.ts` |
| Product uploads | Supabase Storage bucket `product-images` |
| Product video | Cloudflare Stream bytes; Supabase `product_videos` metadata; `src/lib/product-video*.ts` and `cloudflare-stream.ts` |
| Product pricing | `next-app/src/lib/pricing.ts` and `spot-price.ts` |
| Authoritative checkout totals | `next-app/src/lib/checkout-pricing.ts` |
| Shipping methods and fees | `next-app/src/lib/checkout-shipping.ts` |
| U.S. address normalization | `next-app/src/lib/us-address.ts` |
| PayPal integration | `src/lib/paypal*.ts`, PayPal API routes, and `features/paypal-checkout.md` |
| Etsy integration | `src/lib/etsy/`, Etsy API routes, and `features/etsy-sync.md` |
| eBay integration | `src/lib/ebay/`, eBay API routes, and `features/ebay-sync.md` |
| Instagram posting | `src/lib/instagram/`, `/api/admin/instagram/*`, and `features/instagram-posting.md` |
| Facebook posting | `src/lib/facebook/`, `/api/admin/facebook/*`, and `features/facebook-posting.md` |
| Deep Field Gallery product push (outbound, one-way) | `src/lib/deepfield/{payload,sync}.ts`, hooked from `app/actions/admin-products.ts` + `api/paypal/{capture-order,webhook}`, and `features/deepfield-sync.md`. No API route of its own — NEJ is the sender, never a receiver |
| Social captions/card/renditions (shared by both channels) | `src/lib/instagram/{mapping,card,images,backdrop}.ts` + fonts in `src/assets/fonts` |
| Social queue scheduling + background publishing | `src/app/[locale]/admin/social-queues/`, `[locale]/layout.tsx`, `components/admin/{SocialQueuesDashboard,SocialQueueRowActions,SocialScheduleModal,SocialBackgroundPublishProvider}.tsx`, `src/lib/{social-queue-schedule,social-background-publish}.ts`, channel sync APIs/stores, Netlify drip functions, and `supabase/social-scheduled-posting-2026-08.sql` |
| Short product links (`/p/<inventory#>`) | `next-app/src/app/p/[code]/route.ts` |
| Distributed rate limits | `next-app/src/lib/rate-limit.ts` and hardening SQL |
| Broad API edge limit | `next-app/netlify/edge-functions/api-rate-limit.ts` |
| Blocked scanner probes | `next-app/netlify/edge-functions/blocked-probes.ts` with fallback rules in root `netlify.toml` |
| Public-shop cache invalidation | `next-app/src/app/actions/admin-products.ts` |
| Supabase clients | `next-app/src/lib/supabase/client.ts` and `server.ts` |
| Translations | `next-app/messages/en.json` and `es.json` |
| Local runtime assets | `next-app/public/assets/` |
| SEO robots/sitemap | `next-app/src/app/robots.ts` and `sitemap.ts` |
| Page titles, descriptions, canonicals and social cards | `next-app/src/lib/seo.ts` — `pageMetadata()`. Public pages call it rather than hand-rolling `openGraph`; a hand-rolled block that omits `images` silently ships a blank share card |
| `noindex` legal pages (and their sitemap exclusion) | `next-app/src/lib/legal-metadata.ts` — `LEGAL_NOINDEX_PATHS`, which `sitemap.ts` subtracts |
| Brand mark (header + browser tab, one artwork) | `public/assets/images/branding/nav-logo.webp`, `src/app/icon.png`, `src/app/favicon.ico` |
| Project memory | `project-docs/` |

## Structural Invariants

1. Keep the runtime under `next-app/` unless the entire deployment structure is
   deliberately migrated and all config/docs change together.
2. Never rebuild a static product catalog. Public/admin product reads come from
   Supabase and select only needed columns.
3. Preserve product IDs. They are route and saved-state keys.
4. Store image/video references in database rows, never media bytes.
5. New product images use Supabase Storage and WebP/downscale/cache defaults.
6. Video bytes go directly to Cloudflare Stream and only ready projections
   reach public product pages.
7. Keep EN/ES route behavior paired.
8. Browser code gets only public Supabase values. Service-role and provider
   secrets stay server-only.
9. Every public product write that should change `/shop` calls the shared
   product cache revalidation helper.
10. Checkout amounts, shipping methods, and destination validity are recomputed
    server-side from their shared libraries.
11. Public mutations use layered rate limits and validated app routes; do not
    expose direct public database mutation RPCs.
12. Supabase schema changes update SQL, TypeScript contracts, query projections,
    UI, tests, and project memory together.
13. `CURRENT_STATUS.md`, `TASKS.md`, and `DECISIONS.md` stay concise.
    `CHANGELOG.md` is the only full-history memory file.
14. Do not run git commands in this source-of-truth folder.

## Current Build Structure

`src/app/[locale]/shop/(list)/page.tsx` remains a thin Next route entry with
only supported route exports. The reusable implementation lives beside it in
`shop-page-renderer.tsx` and is shared with `/shop-modern`. The production build
completed successfully on 2026-08-03: 443 pages, with TypeScript and lint also
passing.

## Cleanup Notes

- Generated `.next`, `*.tsbuildinfo`, logs, caches, and dependency folders are
  disposable and must remain ignored.
- `COMPLIANCE_AUDIT.md` is retained point-in-time evidence, not startup memory.
- The remaining legacy local-only product-image migration is tracked in
  `TASKS.md`.
