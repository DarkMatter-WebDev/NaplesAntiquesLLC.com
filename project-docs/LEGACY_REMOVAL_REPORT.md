# Legacy Removal Report

> Generated 2026-06-13. Updated after cleanup on 2026-06-13. Scope: identify
> what appears to be required by the current Next.js site versus what belonged
> to the older static HTML site.
>
> **Status as of 2026-07-02: purely historical — the removal described below
> is complete and confirmed.** The site has since been deployed on Netlify
> (see `CURRENT_STATUS.md`), and `project-docs/features/*` has been swept
> multiple times since (2026-06-20, 2026-06-25) to describe the current
> Next.js/Supabase app, not the retired static site. The two open items below
> ("Remaining: deploy a preview and test…" and "Continue pruning…") are
> resolved; kept in place rather than deleted since this file is an audit
> record, not a live checklist.

## Executive Summary

The active app is `next-app/`.

Evidence:

- Root `netlify.toml` sets `base = "next-app"`, `command = "npm run build"`,
  and `publish = ".next"`.
- `next-app/package.json` is a Next app with `next`, `react`, `next-intl`,
  Supabase, Resend, and `@netlify/plugin-nextjs`.
- `npm run build` from `next-app/` passes.
- The Next shop reads products from Supabase (`products` table), not from the
  old `scripts/shop/shop-products.js` catalog.
- The Next app has its own copied runtime assets in `next-app/public/assets/`.
  Root `assets/` is mirrored there with identical hashes, except for one legacy
  CSS file: `assets/css/home-bullion-widget.css`.

Conclusion: the older root static HTML site has now been removed from the app
runtime. Deployment config, docs, database SQL, and the current Next app remain.

## Current Next Runtime Surface

Keep these as current app files:

- `next-app/src/` - App Router pages, components, API routes, Supabase clients,
  pricing helpers, cart/wishlist context, admin UI.
- `next-app/messages/` - `next-intl` translation messages.
- `next-app/public/assets/` - local images and video used by the React app.
- `next-app/public/netlify-forms.html` - static form-detection helper for
  Netlify if still used by the deployment.
- `next-app/package.json` and `next-app/package-lock.json`.
- `next-app/next.config.ts`, `next-app/netlify.toml`,
  `next-app/postcss.config.mjs`, `next-app/eslint.config.mjs`,
  `next-app/tsconfig.json`.
- `next-app/.env.local` locally only. It contains runtime environment values;
  keep it ignored and do not commit secret values.

Keep these root-level support files for now:

- `netlify.toml` - currently required if Netlify deploys from the parent folder,
  because it points the build into `next-app`.
- `project-docs/` and `AGENTS.md` - project memory and agent instructions.
- `supabase/` - database schema and RLS scripts still relevant to the Next app
  (`products`, `inquiries`, `profiles`, auth support).
- `.gitignore` - keeps local env files ignored at the parent level.
- `ACCOUNT_SETUP.md` - current Supabase setup notes for the Next app.

## Removed Legacy Files

These legacy static-site runtime files were removed:

- Root static HTML pages:
  - `index.html`
  - `about.html`
  - `account.html`
  - `account-dashboard.html`
  - `bullion.html`
  - `cart.html`
  - `contact.html`
  - `estate-jewelry.html`
  - `estate-services.html`
  - `faq.html`
  - `free-evaluation.html`
  - `gold-services.html`
  - `member-access.html`
  - `privacy.html`
  - `product.html`
  - `shop.html`
  - `silver-services.html`
  - `logo-canvas.html`
- `es/` - static Spanish HTML twins.
- `scripts/` - old vanilla JS runtime:
  - `scripts/shared/*`
  - `scripts/shop/*`
  - `scripts/account/*`
  - `scripts/forms/*`
- Static-site CSS:
  - `editorial-base.css`
  - `editorial-theme.css`
  - `assets/css/home-bullion-widget.css`
- Old Netlify Function:
  - `netlify/functions/metal-prices.js`
  - The Next replacement is `next-app/src/app/api/metal-prices/route.ts`.
- Root SEO files generated for the static site:
  - `robots.txt`
  - `sitemap.xml`
  - Next replacements are `next-app/src/app/robots.ts` and
    `next-app/src/app/sitemap.ts`.
- Static-site maintenance scripts:
  - `_sync-editorial.ps1`
  - `_repair-site.ps1`
  - `tools/check-integrity.mjs`
  - `tools/update-webp-paths.mjs`
  - `tools/update-dm-badge-url.mjs`
  - `tools/sync-site-headers.mjs`
  - `tools/remove-desktop-inicio.mjs`
  - `tools/list-image-groups.mjs`
  - `tools/inject-header-account-cart.mjs`
  - `tools/copy-all-site-images.ps1`
  - `tools/deploy-optimized-images.ps1`
  - `tools/image-optimization.md`
- Root copied assets after confirming the Next copy remains:
  - `assets/images/`
  - `assets/shoppics/`
  - `assets/video/`
- Empty folders:
  - `data/`
  - `pictures/`
- Root `public/logo-canvas.html`, if no longer used as a design/reference page.

## Removed Conditional Items

These were also removed after reference checks:

- `admin/` - replaced by Next admin routes.
- `language-guide.md` - legacy/reference documentation.
- `public/logo-canvas.html` and `next-app/public/logo-canvas.html` - unused
  design/reference pages.
- `next-app/public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`,
  `window.svg` - unused default create-next-app assets.

## Do Not Delete Yet

- `next-app/public/assets/` - required by current hard-coded image/video paths
  such as `/assets/images/pages/trust.webp` and `/assets/video/homepage-hero.mp4`.
- `supabase/` - the Next app depends on Supabase tables and policies. Keep until
  schema management is intentionally moved elsewhere.
- Root `netlify.toml` - required while the repository root remains the Netlify
  connected folder. If `next-app/` becomes the repository root, this can be
  replaced by `next-app/netlify.toml`.
- `project-docs/` - keep and update as the source of project memory.
- `.env.local` files - do not delete unless you have a known replacement and do
  not commit them. They may contain secrets or deployment credentials.

## Cleanup Plan Status

Completed:

- Kept `next-app/`, `project-docs/`, `supabase/`, root `AGENTS.md`, root
  `.gitignore`, root `netlify.toml`, and setup docs.
- Deleted the legacy runtime and unused reference files listed above.
- Rewrote key stale docs for the Next app.
- Ran from `next-app/`:

   ```bash
   npm run build
   ```

Remaining: deploy a preview and test:
   - `/`
   - `/es`
   - `/shop`
   - `/es/shop`
   - one product detail page
   - `/contact`
   - `/free-evaluation`
   - `/account/sign-in`
   - `/admin`
   - `/api/metal-prices`
   - `/robots.txt`
   - `/sitemap.xml`
- Continue pruning/revising older `project-docs/features/*` files that still
  describe the retired static site.

## Optional Bigger Cleanup

The cleanest long-term repository shape is to promote `next-app/` to the repo
root. That would remove the parent-folder confusion entirely.

If doing that later, move these into the new root:

- `next-app/src/`
- `next-app/public/`
- `next-app/messages/`
- `next-app/package*.json`
- `next-app/*.config.*`
- `next-app/netlify.toml`
- `project-docs/`
- `supabase/`
- `AGENTS.md`

Then update Netlify so the connected base directory is the repository root, not
`next-app`.

## Verification Performed

- Listed repository files and sizes.
- Confirmed root `netlify.toml` builds from `next-app`.
- Confirmed Next build passes with `npm run build`.
- Confirmed Next routes include localized marketing pages, shop, product detail,
  account, admin, inquiries, metal-prices API, robots, and sitemap.
- Confirmed the Next shop reads Supabase `products`.
- Confirmed root `assets/` files are duplicated into
  `next-app/public/assets/` with matching SHA256 hashes, except
  `assets/css/home-bullion-widget.css`, which exists only in the root legacy
  asset tree.
