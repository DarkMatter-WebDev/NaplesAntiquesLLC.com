# Decisions Log

> Running log of important technical, design, and business decisions. Newest at
> the top. Use the format below for every entry.
>
> ```
> ## YYYY-MM-DD — Short title
> **Decision:** ...
> **Reason:** ...
> **Alternatives considered:** ...
> ```

---

## 2026-06-01 — Spanish translation via separate `/es/` pages

**Decision:** Add a full Spanish version of the site as separate pages in a
`/es/` subdirectory, paired with English via `hreflang`, with a one-click EN/ES
header toggle. Spanish copy will be AI-drafted and reviewed by a native speaker
before publishing. Shop products stay single-source (add `*_es` fields, not a
duplicate catalog). Full plan in `features/spanish-translation.md`.

**Reason:** Separate, indexable Spanish URLs capture real Spanish-search leads in
Southwest Florida's large Spanish-speaking market, read professionally for a
luxury/trust brand, and fit the static + Netlify setup with no build step.

**Alternatives considered:** JS text-swap toggle (no Spanish SEO, flash of
untranslated text, heavy tagging); Google Translate widget / browser
auto-translate (inaccurate, unprofessional, no SEO value).

---

## 2026-06-01 — Lead form uses Jotform (recorded for the record)

**Decision:** The "Submit Your Item" lead form is an embedded Jotform (form id
`261379265677068`) on `contact.html`. This was **already implemented and working
before this documentation session** — recorded here so future sessions don't
mistake it for unfinished. The earlier custom files (`submit-item-form.*`) are
legacy/unused.

**Reason:** Jotform provides hosted delivery, spam handling, and **photo
uploads** out of the box, with no custom backend to maintain.

**Alternatives considered:** Formspree (file uploads paid-only); FormSubmit;
finishing the custom form with a self-hosted handler.

---

## 2026-06-01 — Adopt a Markdown project-memory system

**Decision:** Maintain persistent project context in `project-docs/` (overview,
status, architecture, decisions, tasks, changelog, per-feature docs, meeting
notes, and a Dark Matter `CLIENTS.md`).

**Reason:** Preserve decisions and state across AI sessions / chat resets / new
contributors, and reduce repeated re-explanation. Documentation is treated as
part of the implementation, not optional.

**Alternatives considered:** A single README; an external wiki/Notion; relying on
chat history alone.

---

## 2026-06-01 — Add Dark Matter Web Services footer credit

**Decision:** Show a "Powered by Dark Matter Web Services" badge (linking to
`darkmatterwebdev.com`) in the footer of every page; bumped theme cache version
to `darkmatter-credit-20260601`.

**Reason:** Agency attribution + lightweight marketing for the builder.

**Alternatives considered:** No credit; text-only credit.

---

## (Earlier) — Reorganize assets and scripts with redirects

**Decision:** Move images under `assets/images/{branding,pages,shop}/` and group
scripts under `scripts/{shared,shop,account,forms}/`, adding 301 redirects in
`netlify.toml` from all legacy root URLs.

**Reason:** Cleaner repo structure without breaking previously published/indexed
URLs.

**Alternatives considered:** Leaving files at the root; breaking old URLs.

---

## (Earlier) — Keep the product catalog in code, not a database

**Decision:** Store products as a static `window.SHOP_PRODUCTS` array in
`scripts/shop/shop-products.js`. Supabase holds only customer-account data
(profiles, favorites, carts).

**Reason:** Small, hand-curated inventory; editing in code (with AI assistance)
is simpler than a CMS/DB and keeps the catalog versioned with the site. Avoids
the cost/complexity of Shopify or an admin dashboard.

**Alternatives considered:** Shopify; a custom admin + product table in Supabase;
a headless CMS.

---

## (Earlier) — Live gold-spot pricing via a Netlify Function

**Decision:** Compute shop prices from live gold spot. A Netlify Function
(`metal-prices.js`) fetches XAU from `gold-api.com`, caches 5 min, adds CORS and a
fallback; each product price = `meltValue × pricingMultiplier`.

**Reason:** Prices stay fair and current with the gold market automatically; the
upstream API key/endpoint and rate limits are hidden behind the function, and a
fallback keeps the shop usable if the API fails.

**Alternatives considered:** Hard-coded manual prices; calling the price API
directly from the browser; a paid pricing widget.

---

## (Earlier) — Supabase for customer accounts

**Decision:** Use Supabase (Postgres + Auth) for sign-in, profiles, favorites,
and saved carts, with RLS so users only see their own data. Ship only the anon
key to the browser.

**Reason:** Managed auth + Postgres + RLS with minimal backend code; fits a
static site without running our own server.

**Alternatives considered:** Firebase; a custom Node/Express backend; no accounts
(guest-only).

---

## (Earlier) — Static multi-page site with Tailwind CDN + PowerShell sync

**Decision:** Build as plain HTML pages styled with Tailwind (CDN) + custom
editorial CSS, and keep shared header/theme consistent using PowerShell sync
scripts instead of a templating/build framework.

**Reason:** Maximum simplicity, speed, and SEO; no build pipeline to maintain;
easy to host anywhere static.

**Alternatives considered:** A framework (Next.js/Astro/11ty); a CMS; manual
per-page header edits.
