# Integrity Rules & Pre-Publish Checklist

> Current rules for the Next.js app. Last updated: **2026-06-20**.

## Commands

Run from `next-app/`:

```bash
npm run build
npm run lint
```

`npm run build` is the required publish gate. `npm run lint` should run when
touching TypeScript, React components, routing, or shared UI behavior.

## Rules

### 1. Keep the runtime under `next-app/`

The parent folder should contain deployment config, docs, Supabase SQL, and
setup notes. It should not regain root `*.html`, `scripts/`, `assets/`,
`tools/check-integrity.mjs`, or `netlify/functions/` as runtime code.

### 2. Keep Supabase as the product source

The shop pages read from Supabase `products`. Product schema changes must be
reflected in:

- `supabase/*.sql`
- `next-app/src/types/product.ts`
- shop/admin/product UI that reads or writes the changed field

### 3. Preserve product ids

Product ids are URLs and saved-state keys. Do not rename them casually. Mark an
item sold/unavailable or add a new product instead.

### 4. Keep image storage boundaries clear

Hard-coded paths like `/assets/images/pages/trust.webp` must resolve inside
`next-app/public/assets`. Supabase Storage URLs are allowed for uploaded product
images and are covered by `next.config.ts` remote image patterns.

Never store product image bytes as base64/data-URI payloads in `products.images`
or `products.image_urls`. Those columns are URL/path arrays only. New uploaded
inventory photos should go to Supabase Storage bucket `product-images`; local
product photos are legacy or deliberate app-bundled assets.

### 5. Keep EN/ES routes together

When adding a page, ensure it behaves correctly for both locale prefixes. Update
`next-app/messages/en.json` and `next-app/messages/es.json` for shared strings.
Check sitemap behavior if the page should be indexed.

### 6. Never commit secrets

Keep `.env`, `.env.local`, service-role keys, Resend keys, and private
credentials out of commits. Record only where credentials live.

## Pre-publish checklist

- [ ] `npm run build` passes from `next-app/`.
- [ ] `npm run lint` passes or any existing lint debt is documented.
- [ ] New/changed local images live under `next-app/public/assets`.
- [ ] New uploaded product images live in Supabase Storage, not as database
      blobs/base64 strings.
- [ ] Supabase schema/type/UI changes are kept in sync.
- [ ] EN and ES routes render for changed user-facing pages.
- [ ] Root `netlify.toml` still points to `base = "next-app"`.
- [ ] `project-docs/CURRENT_STATUS.md`, `TASKS.md`, and `CHANGELOG.md` are
      updated for meaningful changes.
