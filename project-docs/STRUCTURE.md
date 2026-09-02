# Structure And Build Integrity

> Canonical project map and single sources of truth. Last reconciled:
> **2026-08-30**.

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
    |   |-- assets/
    |   `-- <indexnow-key>.txt      # IndexNow key file; public by protocol design
    |-- scripts/                   # dev-cache guard, route/compression probes, indexnow-submit
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
| SEO guide pages (nested under the parent lander, never `/guides/` or `/blog/`) | `[locale]/silver-services/flatware-value/` (the template), `[locale]/gold-services/what-is-my-gold-worth/`, `[locale]/jewelry-appraisal/hallmarks/`, `[locale]/estate-services/selling-inherited-jewelry/` — each `page.tsx` self-contains its copy, FAQPage + BreadcrumbList JSON-LD, and metadata; listed in `sitemap.ts` at 0.6; content rules in `DECISIONS.md` → *"Guide pages live UNDER their parent"* |
| Breadcrumbs — schema AND visible trail (every sitemap page except `/`, plus product pages) | `src/lib/breadcrumb-ld.ts` (the one `BreadcrumbList` shape + tests), `src/components/BreadcrumbJsonLd.tsx` (the script tag), `src/components/BreadcrumbTrail.tsx` (the visible "Home › Sell Gold" line; `BreadcrumbTrailFromLd` variant for pages that build the LD object by hand). Legal pages get both through `LegalPolicyPage`'s `path` prop. Pages that pre-date the helper (`/sell`, `/sell/[city]`, `/shop/[id]`, `/jewelry-appraisal`, `/diamond-buyers`, `/watch-buyers`, the four guides) still build the LD shape by hand and feed it to the trail — same names for the same parents, placement/tone rules in `DECISIONS.md` |
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
| Homepage announcement strip (copy, link, visibility) | `next-app/src/lib/home-banner.ts` (pure: shape, default, resolve, parse, the MEASURED length budget) + `home-banner-server.ts` (cached fetch), edited via `/api/admin/home-banner` and `components/admin/AdminHomeBannerPanel.tsx`. ⚠️ The strip is `nowrap` — `BANNER_SAFE_CHARS`/`BANNER_MAX_CHARS` encode the 320px Spanish measurement and are enforced in the parser, not just the panel |
| Admin-editable weekly store hours | `next-app/src/lib/store-hours.ts` (server-only fetch) over the pure formatters in `business-location.ts`, edited via `/api/admin/store-hours` and `components/admin/AdminStoreHoursPanel.tsx` |
| Public-shop cache invalidation | `next-app/src/app/actions/admin-products.ts` |
| Supabase clients | `next-app/src/lib/supabase/client.ts` and `server.ts` |
| Translations | `next-app/messages/en.json` and `es.json` |
| Local runtime assets | `next-app/public/assets/` |
| Search-engine push after URL changes (Bing/Yandex/Seznam/Naver) | `npm run indexnow` → `next-app/scripts/indexnow-submit.mjs`, keyed by `public/5f41b4c6500c156c3ddaec86d7e313b6.txt`. The key is public by protocol design (never in `.env`); `txt` is excluded from the `proxy.ts` matcher so the file is served verbatim at the root. The script reads the LIVE sitemap and refuses to submit until it reads the key back from production |
| Sitemap freshness signal | `CONTENT_LAST_MODIFIED` in `next-app/src/app/sitemap.ts` — bumped by hand when a batch changes page COPY (not for doc-only or infrastructure deploys); `/shop` alone uses "now" |
| A link inside copy that ALSO feeds JSON-LD or a data array | `next-app/components/LinkedPhrase.tsx` over `lib/link-phrase.ts`: finds the literal phrase at render and links only that span, falling back to plain text. Used by `/faq` (FAQPage answer) and `/trade-in` (STEPS). ⚠️ Never fork such a sentence into a second JSX copy — that is how visible text drifts from the schema |
| SEO robots/sitemap | `next-app/src/app/robots.ts` and `sitemap.ts` |
| Page titles, descriptions, canonicals and social cards | `next-app/src/lib/seo.ts` — `pageMetadata()`. Public pages call it rather than hand-rolling `openGraph`; a hand-rolled block that omits `images` silently ships a blank share card |
| `noindex` legal pages (and their sitemap exclusion) | `next-app/src/lib/legal-metadata.ts` — `LEGAL_NOINDEX_PATHS`, which `sitemap.ts` subtracts |
| Brand mark (header + browser tab + JSON-LD `logo`, one artwork) | `public/assets/images/branding/nav-logo.webp`, `src/app/icon.png`, `src/app/favicon.ico`; the schema `logo` in `[locale]/layout.tsx` and `sell/[city]/page.tsx` points at the same file. ⛔ `branding/logo.webp` (a "Naples Jewelry Buyers" mark) was removed 2026-09-01 — never bring it back |
| Touch photo-swipe gesture (product gallery AND shop cards) | `next-app/src/lib/photo-swipe.ts` — thresholds and axis arbitration included. It was duplicated per surface until 2026-08-17, and the gallery's copy silently missed the fix the cards got, so **both surfaces must keep importing this** |
| Route-change progress bar | `next-app/src/components/layout/RouteProgressBar.tsx`, mounted once in `[locale]/layout.tsx` **inside `<Suspense>`**. Navigations begun in code arm it via its `startRouteProgress(href)` export rather than a second indicator |
| Showroom address, hours, and shared-suite wayfinding copy | `next-app/src/lib/business-location.ts` — schema, footer, checkout, receipts and page copy all read from it. ⚠️ Since 2026-08-25 the weekly HOURS are admin-editable data (`shop_settings.store_hours` via `src/lib/store-hours.ts`); the formatters here are pure and take the schedule as a parameter, and `HOURS` is only the fallback default. The phone number was never centralised and is now hardcoded in 105 places across 37 files; the address must not repeat that |
| Embedded showroom map (homepage CTA + contact `VisitUsPanel`) | `next-app/src/components/ShowroomMap.tsx`, pinned by `mapsEmbedUrl()` in `business-location.ts`. ⚠️ It frames Google, so `frame-src` must list `https://www.google.com` AND `https://maps.google.com` in **both** `next-app/next.config.ts` and root `netlify.toml` — the frame is SQUARE (`aspect-ratio: 1/1`, capped by `maxWidth`, which binds height too); the embed 301s between those origins, and a CSP-blocked iframe blanks silently. `loading="lazy"` is required, not cosmetic |
| Showroom address as a DISPLAY block (footer, homepage CTA, About) | `next-app/src/components/ShowroomAddress.tsx`. Puts the landmark on its own line so "Sharon Lynch Collections" cannot split. ⚠️ Only the NAME is `nowrap` — an unbreakable full clause overflows a 320px column. `addressWithLandmark()` is still the right call for prose and email; both compose from `landmarkParts()` |
| Copy-address control (footer, homepage CTA, contact panel, About) | `next-app/src/components/CopyAddressButton.tsx`, copying `addressOneLine()` via `lib/clipboard.ts`. ⚠️ Street+city only — never the landmark or business name, because the paste target is a geocoder. Must remain a SIBLING of the maps link, never nested inside the `<a>` or the `<address>` |
| Opening hours as a DISPLAY list (footer, contact, About, homepage CTA) | `next-app/src/components/ShowroomHours.tsx`, rows from `hoursRows()` / `hoursRowsGrouped()`. Closed days are derived from `HOURS.days`, never a second list. ⚠️ The grouped 2-row variant hardcodes "Sunday – Monday" and is only valid while the closed days stay a contiguous pair. `hoursLine()` remains the right call for prose and email |
| Customer reviews (content + both presentations) | `next-app/src/lib/testimonials.ts` is the only review list; `components/home/TestimonialsSection.tsx` renders it as a grid (product pages) or a CSS-only marquee (homepage, `variant="marquee"`). ⚠️ Marquee card spacing must stay `margin-inline-end` not `gap`, and the wrapper must keep `data-customer-reveal-skip` — both fail silently. Quotes are verbatim; a review that cannot be published verbatim is not published |
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
`shop-page-renderer.tsx` and is shared with `/shop-modern`.

### ⚠️ The `(N/N) static pages` build line is NOT the prerendered page count

Reconciled by measurement 2026-08-30, after this file (456), `CURRENT_STATUS.md`
(458) and the actual build (457) all disagreed. **All three were "right" when
written; the figure simply is not stable.**

`✓ Generating static pages (457/457)` is a **progress counter for the
generation phase**. It is not the number of pages emitted, and it moves on its
own:

- `shop/[id]/page.tsx:187` runs `generateStaticParams()` over every product with
  status `available` **or** `sold`, two entries per product. The generation
  phase therefore **scales with the catalog**, and adding or permanently
  removing a product shifts the counter without any code change. (Marking an
  item *sold* does not — `sold` is in that filter, which is why a 2-product
  sale once left the counter unmoved while the sitemap dropped by 2.)
- None of those product pages are actually prerendered. `/[locale]/shop/[id]`
  builds as **ƒ dynamic**, because the page decides visibility from the session.

⛔ **Do not treat that line as an invariant, and do not "correct" it to a fixed
number.** Measure it if you want, but a delta is not by itself a defect.

### The numbers that ARE stable

From `.next/prerender-manifest.json` (authoritative) on 2026-08-30:

| Measure | Value |
|---|---|
| Prerendered routes, total | **60** |
| — English | **27** |
| — Spanish | **27** |
| — non-locale (`_global-error`, `_not-found`, `favicon.ico`, `icon.png`, `robots.txt`, `sitemap.xml`) | **6** |
| Prerendered product pages | **0** |
| `.html` files under `.next/server/app` | 56 |

**`en === es` is the invariant worth asserting** — it is a direct check of the
"Keep EN/ES route behavior paired" rule, and unlike the progress counter it
cannot be moved by inventory.

⚠️ **The regression this guards against is real, so keep guarding it — just with
the right number.** `[locale]/layout.tsx` reads `useSearchParams` through
`RouteProgressBar`, and that hook client-renders everything up to the nearest
`<Suspense>` boundary. The boundary around that component is the only thing
keeping the deopt contained; remove it and the build still succeeds while
prerendering silently collapses. After touching the root layout, check the
manifest, not the progress line:

```bash
node -e "const m=require('./.next/prerender-manifest.json');const r=Object.keys(m.routes);console.log(r.length,'routes | en',r.filter(x=>x.startsWith('/en')).length,'| es',r.filter(x=>x.startsWith('/es')).length)"
```

## Cleanup Notes

- Generated `.next`, `*.tsbuildinfo`, logs, caches, and dependency folders are
  disposable and must remain ignored.
- `COMPLIANCE_AUDIT.md` is retained point-in-time evidence, not startup memory.
- The remaining legacy local-only product-image migration is tracked in
  `TASKS.md`.
