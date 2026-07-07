# Current Status

> Reflects the present state of development. **Update this at the end of every
> work session.** Last updated: **2026-07-07**.

## 2026-07-07 (latest) -- Admin override for the product-page "customer special pricing" line

- Added a per-item manual override for the "Own gold or silver? Put it toward
  this piece and pay as little as ___" trade-in line on `/shop/[id]`. That
  line previously always mirrored the computed scrap/melt value; an admin can
  now check **"Override customer special pricing"** in the edit product form
  and enter a custom dollar amount that replaces just that line's number. The
  **Scrap value / Based on spot box** above it is unaffected either way — it
  always reflects the real computed value.
- New columns: `products.special_price_override_enabled` (boolean, default
  `false`) and `products.special_price_override_amount` (numeric). New
  helper `getSpecialPriceOverrideAmount()` in `types/product.ts` treats an
  enabled-but-empty/zero/negative amount as "no override" (falls back to the
  computed scrap value rather than showing $0). Admin form validates that an
  amount is entered whenever the checkbox is on.
- Follows the same optional-column fallback pattern as `show_spot_price`:
  `shop/[id]/page.tsx`'s product fetch retries without the two new columns if
  they don't exist yet on an un-migrated database, so the page (and the
  trade-in line, via its scrap-value fallback) keeps working before the SQL
  migration runs. Verified live against the current (un-migrated) database —
  `/shop/18k-heraldic-cross-band-ring-01` renders 200 with the trade-in line
  intact.
- **Needs a manual step:** run `supabase/product-special-price-override-2026-07.sql`
  in the live Supabase project to add the columns and grant anon/authenticated
  SELECT on them (same reasoning as the `show_spot_price` grant — see that
  file's comments). Added to TASKS.md.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass. Confirmed the product page still renders correctly today
  (pre-migration) via a live local request.

## 2026-07-07 (a bit earlier) -- Home hero loading spinner + fixed a React 19 console error on /shop

- **Home hero loading spinner:** `HomeHero.tsx` fills the blank spot before
  the carousel/headline content is ready with a small centered spinner, tied
  to the existing `heroReady` state (appears with no flash on first paint,
  disappears the instant content is ready, hidden under
  `prefers-reduced-motion`). Sized 4.5rem per follow-up feedback (was
  2.25rem).
- **Fixed a React 19 dev console error on `/shop`** ("Encountered a script
  tag while rendering React component...") caused by the blocking inline
  `<script>` that skips the shop hero's entry-reveal replay on repeat visits.
  This is a known, currently-unresolved React 19 limitation (any literal
  `<script>` JSX element triggers it on hydration, even correct/necessary
  ones with no first-party replacement API yet — see `facebook/react#34008`,
  `shadcn-ui/ui#10104`). Added `components/shop/ScriptTagWarningGuard.tsx`, a
  tiny client component that filters only that exact known-false-positive
  message text (dev-only), leaving all other console output untouched.
  Verified live: the script itself still runs correctly, and `console.error`
  is confirmed patched with the expected filter logic. See CHANGELOG.md for
  the full writeup.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass for both changes.

## 2026-07-07 (a bit earlier) -- Fixed the recurring "stuck/unresponsive dev server" issue (Turbopack cache vs. OneDrive)

Root-caused and fixed the intermittent dev-server corruption noted in earlier
sessions (2026-07-05 "Dev-infra" note; also hit again at the start of this
session — two orphaned `next dev` processes were holding ports 3000/3001 but
no longer answering requests). Confirmed against a live upstream Next.js/
Turbopack bug (GitHub issue vercel/next.js#95495): the dev cache
(`.next/dev/cache/turbopack`) is a RocksDB-style store that corrupts on
Windows when another process locks it mid-write, and OneDrive's background
sync of this project folder is exactly that. The real engine fix only ships
starting in Next.js `16.3` canary/preview (merged 2026-07-06) — not stable,
not something to adopt on this project's pinned `16.2.9` yet.

- **Fix:** `next-app/.next` is now an **NTFS directory junction** pointing to
  `%LOCALAPPDATA%\dev-cache\NaplesEstateJewelry\next-app\.next` (outside the
  OneDrive-synced tree — OneDrive does not sync junctions), with a matching
  **`node_modules` junction** alongside it (pointing back to the real
  `next-app/node_modules`) — required because Node resolves the relocated
  chunk files to their real path before its `node_modules` upward search, so
  without the second junction every route 500'd
  (`Cannot find module 'react/jsx-runtime'`). Both are local-machine-only
  filesystem state; `.next`/`node_modules` are already `.gitignore`d, so this
  has zero effect on the repo copy or the Netlify build. See DECISIONS.md
  2026-07-07 (later) for the full writeup, including the gotcha.
- **New `predev` safety net:** `next-app/scripts/dev-cache-guard.mjs`
  (wired via `package.json`'s new `"predev"` script) clears the Turbopack
  cache subfolder automatically if it's ever left in the "bookkeeping files
  only, no real data" shape a failed commit leaves behind — so any future lock
  contention self-heals on the next `npm run dev` instead of producing sticky
  500s for the rest of a session.
- Verification: killed the two stuck orphaned dev-server processes, applied
  the junctions, confirmed `npm run dev` starts with no cache-deleted warning
  and `GET /` / `GET /shop` both return `200` live, confirmed real `.sst`/
  `.meta` cache files are landing in the relocated folder (not just empty
  bookkeeping files). `npx tsc --noEmit`, `npm run lint` (0 problems), and
  `npm run build` all pass with the `package.json`/new script in place.
- **Note for future sessions on this machine:** if `next-app/.next` or
  `next-app/node_modules` ever look empty/0-byte in a plain file browser, it's
  because they're junctions to `%LOCALAPPDATA%\dev-cache\NaplesEstateJewelry\next-app\`
  — that's expected, not a bug. Don't delete or "fix" the junctions; if a
  cache-related error ever needs a manual clear, delete the *target* content
  under `%LOCALAPPDATA%\dev-cache\...` (or just the `.next\dev\cache\turbopack`
  subfolder through the junction, same as before). This setup is per-machine —
  it doesn't need to be (and isn't) replicated in the repo or on Netlify.

## 2026-07-07 (a bit earlier) -- Shop page graceful-loading audit: full top-down entry cascade + per-card reveal no longer replays its multi-second wave on reload

Follow-up audit of the whole `/shop` page's loading experience (not just the
hero) per the request to make sure everything "fades in from the top down"
and reloads gracefully every time, while keeping the existing skeleton
loader and inter-page spinner.

- **Extended the entry-reveal cascade to every section, top to bottom.**
  Previously only the hero (`shop-entry-reveal-hero`, 80ms delay) and the
  filter sidebar (was `shop-entry-reveal-filters`, 260ms) faded in; the
  mobile spot-price row, the desktop standalone year filter, and the whole
  results panel (toolbar + product grid + pagination) just popped in with no
  transition at all. Added the same `shop-entry-reveal` treatment (gated on
  `isModern`, same as the hero) to all of them, with two new delay tiers in
  `next-app/src/app/[locale]/shop/(list)/page.tsx`:
  `shop-entry-reveal-secondary` (200ms — mobile spot-price row + desktop
  standalone year filter, whichever is visible at that breakpoint) and
  `shop-entry-reveal-results` (320ms — filter sidebar + results panel
  together, since they sit side by side on desktop and shouldn't stagger
  against each other). Net effect: hero -> spot/year row -> sidebar+grid,
  a genuine top-down wave instead of a two-piece reveal with an abrupt grid
  pop-in beneath it. All of it is still skipped on a repeat visit via the
  existing `shop-repeat-visit` sessionStorage marker (generic selector, so
  it automatically covers the newly-tagged elements too — no script changes
  needed).
- **Fixed a second, grid-level "reload stutter."** `ProductCard.tsx` already
  had its own sophisticated per-card reveal (wait for the real `<img>` to
  finish loading via `requestAnimationFrame` polling of `.complete`, then a
  row/column-based stagger delay — `revealRow * (columns * 90 + 140) +
  revealColumn * 90`) that runs on every mount. For a 4-column, 24-item page
  that's up to ~2.7s of artificial delay for the last row, even though a
  reload has every image already in the browser cache and ready instantly —
  effectively a *second* stutter stacked on top of the hero's (independent
  of it, and not fixed by the earlier hero-only patch). Reused the same
  `shop-repeat-visit` marker: the per-card reveal effect now checks
  `document.querySelector('main')?.classList.contains('shop-repeat-visit')`
  and zeroes out the stagger delay when true, so repeat-visit cards still
  fade in individually via the existing CSS `transition` (snappy, no pop)
  the instant each one's image is ready, instead of riding out the full wave
  again. First-time-this-session loads (and any filter/sort/page change,
  which doesn't set the marker) keep the full cascading reveal unchanged.
- **Confirmed already-graceful pieces stay intact:** the route's
  `loading.tsx` skeleton (layout-matched skeleton cards + header bar,
  streamed instantly on both a fresh navigation and a hard reload while the
  server component awaits the catalog query) and `ShopLoadingOverlay` (the
  client-side spinner shown in `.shop-results-panel` during
  filter/sort/pagination transitions) were not touched — both already cover
  their respective loading phases correctly and compose fine with the wider
  entry cascade.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass (`next-app/`). Not re-verified live in-browser this pass —
  the local dev server/browser tooling was unresponsive during this session,
  so this still needs a manual smoke test (fresh `/shop` load → confirm the
  hero, spot/year row, and sidebar+grid arrive in that order top-down;
  reload → confirm nothing replays/stutters and cards are simply present).

## 2026-07-07 (just before) -- Shop hero "Don't just buy. Invest." no longer re-plays its entry animation on reload

The modern shop hero + filter sidebar have a staggered fade/blur/slide-in CSS
entry animation (`.shop-entry-reveal`, `shop-entry-reveal` keyframes,
`next-app/src/app/[locale]/shop/(list)/page.tsx`) that — since `/shop` is a
dynamic, server-rendered route — replayed from scratch on every single reload
or quick return, which read as a stutter each time rather than a one-time
welcome effect.

- Added a small blocking inline `<script>` right after `<main>` (only when
  `isModern`) that checks `sessionStorage` for a `shopHeroSeen` flag: unset ->
  set it and let the animation play normally (first visit this tab session);
  already set -> add a `shop-repeat-visit` class to the `<main>` element via
  `document.currentScript.parentElement`, which a new CSS rule uses to force
  `.shop-entry-reveal` straight to its end state (`opacity: 1; animation:
  none; transform: none; filter: none;` — mirrors the existing
  `prefers-reduced-motion` rule). Being a plain blocking `<script>` placed
  before the animated elements in document order, it mutates `<main>`'s class
  before the browser paints them, so there's no flash/flicker either way.
  `<main>` carries `suppressHydrationWarning` since this is an intentional
  out-of-band DOM mutation React's hydration isn't meant to reconcile against
  (the same sanctioned pattern libraries like `next-themes` use for
  pre-hydration `<html>` class tweaks).
- Scope is deliberately per-tab-session, not permanent: `sessionStorage`
  persists across reloads and back/forward navigation in the same tab (so a
  reload or "quickly come back to it" no longer stutters) but resets for a
  genuinely new tab/window, so first-time visitors still get the intended
  cascading reveal.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass. Tested live in-browser via CDP against a running dev
  server: confirmed a fresh session plays the animation
  (`animationName: "shop-entry-reveal"`, sets the sessionStorage flag), and
  that reloading the same tab afterward shows `<main>` gaining
  `shop-repeat-visit`, both the hero's and filter sidebar's
  `animationName` computing to `"none"`, and `opacity: 1` immediately — no
  flash, no error overlay, no hydration-warning badge in the Next.js dev
  toolbar.

## 2026-07-07 (a bit later) -- Local dev now reachable from other devices (LAN IP + Netlify Dev live tunnel)

Investigated how to test the app on `localhost` AND `<your-LAN-IP>:port` (e.g.
from a phone on the same Wi-Fi), plus whether Netlify could provide a public
test URL without deploying. `next dev` already binds `0.0.0.0` by default in
this Next.js version, but Next.js 15+/16 blocks cross-origin requests to dev
assets/HMR by default (`allowedDevOrigins`), which silently breaks the page
when loaded from anything other than `localhost`.

- Added `allowedDevOrigins: ['192.168.119.224', '192.168.119.*']` to
  `next-app/next.config.ts` (dev-only setting, no effect on production
  builds/deploys) — this machine's current LAN IP, plus a same-subnet
  wildcard as a hedge against the DHCP lease changing the last octet.
- Documented three testing tiers in `next-app/README.md` (new "Testing from
  another device" + "Testing via a public HTTPS tunnel" sections under
  Development): (1) plain LAN IP over HTTP — works for normal browsing, but
  is NOT a secure context, so the AI listing assistant's microphone
  (Web Speech API) can't be granted there, only `localhost` gets that
  exemption; (2) `next dev --experimental-https` for a self-signed HTTPS LAN
  cert when mic/camera testing from another device is needed; (3) Netlify
  Dev's `netlify dev --live` for a real HTTPS public tunnel
  (`https://<name>--<site>.netlify.live`) that proxies the local dev server —
  usable from any network (not just the same Wi-Fi), shareable, and exercises
  the actual `netlify.toml` redirects/headers, all without deploying/publishing
  anything. Netlify CLI isn't installed/linked yet in this project — the repo
  has no `.netlify/` folder — so first use requires `netlify login` +
  `netlify link` (documented in the README).
- Verification: started `next dev`, confirmed via CDP that the homepage
  loaded fully over `http://192.168.119.224:3001` (the port `next dev` picked
  since 3000 was occupied) with all 46 `/_next/*` resources fetched
  successfully and zero "Blocked cross-origin request" warnings in the server
  log — confirming `allowedDevOrigins` is wired correctly. `npx tsc --noEmit`,
  `npm run lint` (0 problems), `npm run build` all pass with the config
  change in place. Did not install/test the Netlify CLI live-tunnel flow live
  this session (no Netlify login credentials available in this environment).
- Note: `NEXT_PUBLIC_SITE_URL`/`SITE_URL` in `.env.local` are hardcoded to
  `https://naplesestatejewelry.co` — outbound emails (order invoices,
  marketing) generated during local testing will still link to the live
  production site, not the local/tunnel URL. This is expected/unchanged and
  doesn't affect in-browser testing.

## 2026-07-07 (a bit earlier) -- OG/Twitter preview image re-encoded lossy (1.77MB -> 268KB)

Per the user's request, re-encoded `next-app/public/assets/images/pages/og-preview.webp`
(the site-wide social-share preview image, added in an earlier session as a
**lossless** WebP) as a standard **lossy** WebP instead. Decoded the existing
lossless file (pixel-identical to the original PNG, which was already deleted)
and re-encoded with `sharp` at `{ quality: 88, effort: 6 }` — landed at
**267.7 KB** (down from 1,774,538 bytes), comfortably under the project's
300KB page-image guideline. Same filename/path/dimensions (1983×793), so no
change needed in `next-app/src/app/layout.tsx`.
- Verification: visually diffed the new lossy file against the original
  lossless version (both decoded back to PNG and viewed side by side) — no
  visible difference in the logo text, gold gradients, or the dark textured
  background at quality 88. `npx tsc --noEmit`, `npm run lint` (0 problems),
  `npm run build` all pass. No temp conversion/comparison scripts or backup
  files left behind.
- Pending: same as before — no live re-deploy/crawler cache-bust done yet;
  if this URL was already scraped by Facebook/X/etc. under the old (lossless)
  build, it may need a manual "scrape again" via each platform's debugger
  after the next deploy to pick up the smaller file.

## 2026-07-07 (just before) -- AI Listing Agent: place-name "brands" (e.g. Taxco) and agent-controlled "show spot/melt value"

Two refinements to the smart listing assistant (`next-app/src/lib/ai-product-provider.ts`
system prompt, `next-app/src/lib/ai-product-schema.ts` schema/coercion,
`next-app/src/components/admin/AdminShell.tsx` draft-apply wiring). Bumped
`PROMPT_VERSION` to `product-listing-extraction-v12`.

1. **Place-name trade identifiers now count as `brand`.** Previously `brand`
   was extracted strictly from a stated maker, logo, or maker stamp. The
   prompt now also recognizes well-known jewelry-making REGION/PLACE names as
   a brand-equivalent when marked/stamped or stated — the standing example is
   Mexican silver stamped/described as **"Taxco"** (bought and sold in the
   trade as "Taxco jewelry"/"Taxco silver" even though Taxco is a town, not a
   company). Same logic now applies to a handful of other similarly
   recognized place-based identifiers when marked or stated: Navajo/Zuni/Hopi
   for marked Native American silverwork, Bali for Balinese silver, Siam/Siam
   Sterling for vintage Thai niello silver. Explicitly excluded: a generic
   country-of-manufacture stamp with no distinct trade identity of its own
   (e.g. a plain "Italy"/"925 Italy" stamp on a mass-produced chain stays
   `brand: null` unless an actual maker mark/logo is also present) — this
   guards against the model over-applying the new rule to every
   country-stamped import chain.
2. **The AI can now set "Show spot / melt value on storefront" (`show_spot_price`)
   off during intake.** Added `show_spot_price: boolean | null` to
   `ProductAutofillFields` (`ai-product-schema.ts`: new field key, new
   `cleanBoolean()` coercer, wired into `coerceProductAutofill`) and to
   `AdminShell.tsx`'s `applyAiDraftToForm` (new `setField('show_spot_price', ...)`
   case) and `AI_PRODUCT_FIELD_LABELS` ("Show Spot/Melt Value"), plus a small
   `formatAiFieldValue()` helper so the AI-fields review panel prints
   "Shown"/"Hidden (item flagged not solid/priced by weight)" instead of the
   raw `true`/`false`. The prompt instructs the model to leave this field
   `null` (default: shown) unless the seller specifically says the item is
   **not priced by weight**, **not solid** (gold-filled/plated, vermeil, clad
   — vs. stated/marked solid 14K/18K/sterling), or **"weighted"** (the trade
   term for hollow sterling holloware filled with plaster/resin for
   stability, where gross weight overstates actual silver content) — never
   inferred from photos alone, only from what the seller states about
   construction/pricing basis.
   - Confirmed the "Show spot / melt value on storefront" checkbox (added in
     an earlier session) already renders identically on both the **new-item**
     and **edit-item** forms — they share the same `AdminShell.tsx` editor
     modal/state, so no separate new-item-only gap existed here; no UI
     addition was needed for that half of the request, only the AI wiring.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass. Not exercised against a live AI provider call this session (no
  new photos/transcript run through `/api/admin/ai-product-fill`) — the
  coercion path mirrors the existing, already-proven `cleanGender`/
  `cleanPriceMode` string-enum pattern, and `setField`'s null/empty-string
  skip check was confirmed to correctly pass through a literal `false`
  (`false !== null && false !== ''`) so the field only gets skipped when the
  model omits it, not when it deliberately returns `false`.
- Pending: no live smoke test of an actual AI generation run yet exercising a
  Taxco-marked photo or a "this one's weighted" transcript — recommended next
  real intake to confirm end-to-end before relying on it for a real listing.

## 2026-07-07 (earlier) -- Admin listing editor: fixed Product Type field clearing, mobile modal now edge-to-edge and footer-safe

Two related admin `AdminShell.tsx` product editor ("add item"/"edit item")
fixes:

1. **Product Type field couldn't be cleared to type a brand-new type.**
   Root cause was two-fold in `next-app/src/components/admin/AdminShell.tsx`
   and `next-app/src/components/admin/ComboboxInput.tsx`:
   - The field's `onChange` handler coerced an emptied value straight back to
     `'Other'` on every keystroke (`normalizeProductTypeValue(value) ?? 'Other'`),
     so the box could never actually go blank while editing — it now keeps a
     genuinely empty value empty while typing, and only the save path
     (`normalizedJewelryType = normalizeProductTypeValue(jewelryTypeInput) ?? 'Other'`,
     unchanged) still defaults a still-blank field to `'Other'` at save time.
   - The field was wrapped in `<ClearableField>`, whose clear button is
     absolutely-positioned over the right edge of whatever it wraps. That
     landed directly on top of `ComboboxInput`'s own built-in clear/toggle
     button and physically intercepted every click meant for it — confirmed via
     CDP (`Click intercepted by: <button class="clearable-field__button">`).
     Removed the redundant `ClearableField` wrapper; `ComboboxInput` is fully
     self-contained. Also reworked `ComboboxInput`'s own button to always show
     an immediate one-click "x" clear whenever a value is present (previously
     a two-step arm-then-clear dance where the "x" only appeared after a first
     click).
2. **Mobile viewport anchoring for the add/edit item modal.** In the
   `.product-editor-modal` and its overlay:
   - Sized to `h-svh` instead of `h-dvh` on mobile ("small viewport height" —
     the guaranteed-visible area with the browser's address bar/toolbar fully
     expanded — vs. the "dynamic" one that grows the instant the toolbar
     auto-hides). This means the modal footer's Save/Cancel/etc. buttons can
     never end up transiently covered by the browser chrome mid-animation.
   - Added `overflow-x-hidden`/`max-w-[100vw]` on the overlay, modal, and
     `.product-editor-body` as a hard guarantee against any horizontal scroll.
   - Added a body-scroll lock (`document.body.style.overflow = 'hidden'` +
     `overscrollBehavior: 'none'`) for as long as the modal is open, so the
     (much wider than viewport) products table underneath can't be
     panned/scrolled behind the fixed modal on touch devices.
   - Desktop (`md:`) sizing (`max-w-5xl`, `h-auto`) is unchanged.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass. Manually tested live at a 390×700 mobile viewport via CDP: typed
  "Ring" into Product Type, single-clicked its clear button, confirmed the
  field stayed blank and the full unfiltered option list reappeared, then
  typed a brand-new custom type ("Tie Bar") and confirmed it was accepted
  (and its conditional "Height" field appeared correctly). Confirmed
  `document.documentElement.scrollWidth === innerWidth` (no horizontal
  overflow) with 9 photos + all sections expanded, confirmed
  `document.body.style.overflow` locks to `hidden` while the modal is open
  and cleanly resets to `''` on close, and confirmed desktop sizing
  (`max-width: 1024px`, `height: auto`) is unaffected.
- Noted but out of scope: an intermittent React hydration-mismatch dev
  overlay warning tied to the admin header's live "Orders" unread-count badge
  (`AdminHeader.tsx`) — pre-existing, unrelated to these changes, not
  investigated further this session.

## 2026-07-07 (even earlier) -- New site-wide OG/Twitter card image

Replaced the default social-share preview image. User dropped `logo.png`
(1983×793 branded banner: watch, rings, chains, "NAPLES ESTATE JEWELRY —
BUY · SELL · TRADE") at the project root; converted it losslessly to WebP via
`sharp` (`{ lossless: true }`) and wired it up as the new default
`openGraph`/`twitter` image in `next-app/src/app/layout.tsx`, replacing the
old `trust.webp` fallback. Original PNG deleted per instructions; no PNG or
scratch conversion script left behind.

- New asset: `next-app/public/assets/images/pages/og-preview.webp` (1983×793,
  ~1.77MB). Note: this is noticeably larger than other page images because it's
  a **lossless** encode (as explicitly requested) of a highly-textured dark/
  grainy background — lossy WebP would get this well under 300KB if file size
  ever becomes a concern (this image is only ever fetched by link-preview
  crawlers/social platforms, not rendered inline on any page, so it doesn't
  affect Core Web Vitals).
- `next-app/src/app/layout.tsx`'s site-wide `openGraph.images` /
  `twitter.images` now point at `og-preview.webp` (with explicit
  `width`/`height` on the OG variant). This is the fallback used by every page
  except `/shop/[id]`, which still generates its own OG image per-product from
  that product's own photo (unchanged).
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems) pass; visually
  diffed the WebP output against the source PNG (re-decoded to PNG and viewed)
  and confirmed pixel-for-pixel identical, as expected for lossless.
- Pending: no live re-deploy/crawler cache-bust done yet — Facebook/X/etc.
  cache OG images by URL, so if this URL was ever previously scraped under the
  old build it may need a manual "scrape again" via each platform's debugger
  after deploy.

## 2026-07-07 (later still) -- Shop default per-page is now 24

Changed `shop/(list)/page.tsx`'s `DEFAULT_PER_PAGE` from `48` to `24` — a bare
`/shop` (or any filtered view) with no explicit `perPage` param now shows 24
items per page instead of 48. This also fixes a pre-existing mismatch:
`ShopPagination.tsx`'s "Per page" select already treated **24** as the implicit
default (it omits the `perPage` param entirely when 24 is chosen, to keep the
URL clean), even though the page's actual default was 48 — so choosing "24" from
the dropdown looked identical to leaving it at the (then-48) default until you
noticed the count. The two are now consistent.

- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass. Confirmed live: a bare `/shop` renders exactly 24 product cards, 3
  pages of pagination (up from 2 at 48/page), and the "Per page" select shows
  `24` selected by default.

## 2026-07-07 (later) -- Category toggle buttons (Jewelry & Watches / Sterling Silver) now deselect on re-click

The modern-layout sidebar's gold-gradient **Category** buttons (`Jewelry & Watches`
/ `Sterling Silver` — the `.modern-sidebar-gender-button` pills in `ShopFilters.tsx`)
previously always applied the clicked value even if it was already active. Clicking
the currently-active button now clears the category filter entirely (removes
`itemGroup` and its paired `metal`/`metalColor`/`metalType`/`purity` params) instead
of re-pinning the same value, so both buttons show unselected and the catalog
returns to showing every item type/metal.

- **`ShopFilters.tsx` (`updateItemGroupFilter`):** added an early branch — if
  `currentItemGroup === value` (the clicked button is already active), clear
  `itemGroup` + the metal/purity params it pins instead of setting them, then
  return early. Behavior when clicking the *other* (inactive) button is unchanged.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass. Confirmed live on the dev server: clicking **Sterling Silver** sets
  `?itemGroup=everything-else&metal=silver` and marks it active; clicking it again
  returns to bare `/shop` with neither button active; same round-trip verified for
  **Jewelry & Watches** (`?itemGroup=jewelry` → bare `/shop`).

## 2026-07-07 -- Shop filter/sort/pagination navigations now show a loading spinner

Added a lightweight spinner over the shop results panel so changing a filter, the
sort order, the gallery/list view, the year slider, or the per-page/page-number
pagination no longer looks "frozen" while the new page renders on the server.

- **New shared client module `components/shop/ShopNavigationProgress.tsx`:**
  `ShopNavigationProvider` (wraps the catalog section in `shop/(list)/page.tsx`)
  exposes a `push()` that runs `router.push` inside `useTransition`, so `isPending`
  reflects the real RSC round trip for a filter/sort/view/year/per-page change.
  Plain `<Link>` pagination (prev/page-number/next) isn't visible to that
  `useTransition`, so a small `LinkPendingBridge` (using Next's `useLinkStatus`)
  mirrors each pagination link's own pending state into the same shared context.
- **`ShopLoadingOverlay`** renders a small spinner centered over the product
  grid/toolbar/pagination area (`.shop-results-panel`, `position: relative`),
  debounced 150ms so an instant/prefetched navigation never flashes it, and
  disappears the instant the new content commits — no minimum show time.
- **Every filter/sort/view/year/pagination control now calls the shared `push()`**
  instead of its own `useRouter()` directly: `ShopFilters.tsx`, `ShopSortSelect.tsx`,
  `ShopViewToggle.tsx`, `ShopYearFilter.tsx`, `ShopPagination.tsx`. Behavior/URLs are
  unchanged — only the navigation call site moved.
- Same mechanism on desktop and mobile (mobile filter drawer, mobile sort select,
  and mobile pagination all route through the identical shared context); no
  device-specific code branch was needed.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass. Confirmed live on the dev server with CDP network throttling
  (900ms latency): the spinner appears ~150–200ms after a select/dropdown change
  or a pagination click and disappears the instant the new results land, on both
  a desktop (1280px) and a mobile (390px) viewport; an untouched fast/instant
  navigation never shows it.

## 2026-07-06 (even later) -- Shop filter dropdowns no longer self-narrow

Fixed the gallery filter dropdowns (Brand + the dynamic extra Item Type entries) so
picking a value never shrinks what else shows up in that same dropdown (or others)
on the next open — you could set Brand to "Taxco", then reopen the Brand dropdown
and only see "Taxco" + "All brands" instead of the full brand list, forcing a reset
back to "All" before picking a different brand.

- **Root cause:** `/shop`'s catalog read (`queryShopCatalog`) applies the visitor's
  active `status`/`purity`/`metalColor`/`metal`/`brand` filters at the **database**
  level for performance, and the Brand/Item-Type dropdown option lists were being
  computed from that *already-filtered* result set — so an active filter fed back
  into narrowing the very dropdowns used to change it.
- **Fix (`shop/(list)/page.tsx`):** facet option lists (`brandOptions`,
  `itemTypeOptions`) now come from a second, always-unfiltered catalog fetch (same
  `unstable_cache`-backed `loadShopCatalog`, called with every DB-level filter key
  null) instead of the visitor's filtered `collectionProducts`. When the visitor has
  no filters active, that's the exact same cache entry as the main read, so there's
  no extra DB round trip in the common case; filtered views add one cheap, shared
  (across all visitors) cached lookup for the unfiltered facet list.
- Every other dropdown (Item Type's static list, Link Type, Metal, Metal Color,
  Purity, Gender, Sort) was already a fixed/static option list not derived from the
  filtered product set, so they weren't affected by this bug and needed no change.
  Metal Color/Purity are still intentionally scoped by the selected Metal (gold vs
  silver — a structural pairing, not the reported self-narrowing bug), and
  Brand/Item-Type are still scoped by the Jewelry-vs-Sterling-Silver category tab,
  same as before.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build` all
  pass. Confirmed live on the dev server: `GET /shop?brand=Taxco` renders the Brand
  `<select>` with the full 16-brand list (not just Taxco + "All brands").

## 2026-07-06 (later) -- Per-item "Show spot/melt value" toggle (?? SQL migration pending)

Added a per-listing admin toggle so items that aren't 100% precious metal (mixed
metal, gemstones, plating…) don't show a misleading melt/scrap value on the
storefront. New `products.show_spot_price` boolean column, default `true` (every
existing listing keeps its current behavior).

- **Admin edit/New Item form:** new **"Show spot / melt value on storefront"**
  checkbox in the pricing section, with helper copy explaining when to turn it off.
  Carries through Clone and the AI/quick-fill draft merge unchanged (only touched by
  its own checkbox).
- **Storefront (`/shop/[id]`):** the "Scrap gold/silver value" + "Based on spot
  $/oz" callout box, and the paired "Own gold or silver? Put it toward this piece…"
  store-credit line, are now gated on `show_spot_price !== false`. When off (and the
  item still has weight+purity, so the box would otherwise have shown), the page
  shows a short note instead: *"This piece isn't 100% gold or silver, so spot
  pricing doesn't apply directly to this item"* (EN/ES). The actual selling price
  ("Your price") and its computation are unaffected — this only controls the melt/
  scrap-value disclosure, not pricing.
- Follows the existing optional-column fallback pattern (like `item_year`): if the
  live DB doesn't have the column yet, the product page and admin save both retry
  without it and default to `true` (current behavior), so nothing breaks pre-migration.
- **?? MANUAL STEP — run `supabase/product-show-spot-price-2026-07.sql` in Supabase.**
  Also updated the canonical `supabase/products.sql` install script (both the
  `create table` and the "add columns introduced after initial deploy" section) so a
  fresh install includes the column. **The migration must also `grant select
  (show_spot_price) on public.products to anon, authenticated`** — the 2026-07
  hardening scripts locked anon/authenticated SELECT to a static column list, so a
  new column isn't readable by the storefront until explicitly granted; the migration
  file includes this grant.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), and `npm run build`
  all pass from `next-app/`. Confirmed live on the dev server (:3002, pre-migration
  DB): a product page returns 200 and still renders the melt-value box via the
  optional-column fallback (defaults to `true`). The admin checkbox itself was not
  exercised in-browser (admin route requires an owner sign-in not available here);
  code path mirrors the existing "Featured in shop" checkbox exactly.

## 2026-07-06 -- Manual Reserved item status removed

Removed the manual **Reserved** product lifecycle from the active admin app. Product
Admin no longer shows a Reserved metric card, status dropdown option, row action, or
quick-fill status token; the AI listing prompt no longer suggests Reserved as an
allowed status; and legacy stored `reserved` values normalize to `available` in the app
layer so old data does not keep a hidden hold state alive. Public shop visibility
continues to use available/sold only, with `pending_payment` used for unpaid admin
order holds. No destructive database cleanup was run; removing old vestigial columns or
rewriting historical SQL install scripts should be handled as a separate confirmed
Supabase cleanup. Verification: `npm run lint` and `npm run build` from `next-app/`
both pass; browser preview confirmed the admin Products page shows Total/Available/Sold
only, row actions do not include Reserve, and the New Item status dropdown has Draft,
Available, Pending Payment, Sold, and Archived only.

## 2026-07-06 -- ? Manual fixed pricing uses Price Label only + Quick Add

Removed the visible **Asking Price** input from the shared New Item/Edit Item admin
product form. Manual/fixed pricing now uses **Price Label** as the entered value:
quick-fill aliases such as "price", "manual price", and the old "asking price" label
map into `manual_price_label`; AI values that arrive as `asking_price` are formatted
into `manual_price_label`; and admin product saves clear `asking_price` to `null` so a
hidden stale value cannot override the visible label. Bare numeric manual price labels
are normalized centrally (`1` -> `$1`, `1200` -> `$1,200`) across admin entry, shop
display, cart, checkout totals, and order snapshots. New Item also has a **Quick add**
checkbox that switches the product to manual fixed pricing and bypasses spot-pricing
requirements (purity/weight/multiplier) while still requiring a title, inventory
number, and price label. Checkout now hydrates stale cart rows from the live product row
when the stored cart price is unparseable, preventing manual-priced items from turning
into dash totals after a product is corrected. Verification: `npm run lint` and
`npm run build` from `next-app/` both pass.

## 2026-07-06 -- ? Orders badge now means unseen active orders

Changed the admin **Orders** nav badge from a paid/pending-fulfillment counter to a
notification-style unseen-order counter. It now counts active orders (`deleted_at is
null`) created after the current admin/browser last viewed the active Orders area, and
viewing `/admin/orders` or an order detail page records a last-seen timestamp and clears
the badge. Recycle Bin orders do not count. Verification: `npm run lint` and
`npm run build` pass from `next-app/`; browser preview confirmed `/admin/orders`
clears the old "Orders 8" badge and it remains cleared after navigating back to
`/admin`.

## 2026-07-05 -- ?? Full UX walkthrough audit (browser-driven, no code changed)

Walked every major public user path on the dev server (:3002) with browser
control: home, nav, /auctions, shop (filters/sort/search/sold view), product
detail (EN+ES), add-to-cart ? cart drawer ? guest checkout (shipping switch,
required-field gate, PayPal button enable — **not** clicked, no orders created),
free-evaluation form, contact + INQUIRE prefill, sign-in/sign-up/reset-password,
saved-items drawer, FAQ accordions, admin gating, all legal pages, redirects,
mobile viewport (no horizontal overflow; hamburger + call button work). Verified
`/api/metal-prices` healthy (`source: "api"`). Findings (full report delivered in
session; top items added to TASKS Backlog):

- **? 2026-07-05 (orders recycle bin) — build-shipped, SQL applied.** Admin Orders now
  uses soft delete: active deletes set `orders.deleted_at`, `/admin/orders?view=trash`
  shows a Recycle Bin with Restore and Delete Forever, and order-detail delete was
  switched to the same soft-delete path. Added `supabase/orders-recycle-bin.sql`
  (idempotent; adds `orders.deleted_at` + active/trash indexes). Owner ran the SQL in
  Supabase and the verify query returned `deleted_at` / `timestamp with time zone`;
  non-destructive route verification now shows `/admin/orders` and
  `/admin/orders?view=trash` return 200 with the migration notice gone. Also fixed the
  paid-order return-to-inventory warning so the delete modal closes before the alert is
  shown. Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build`; browser/
  HTTP preview checked `/admin/orders` + `/admin/orders?view=trash`. Remaining: test
  delete/restore/delete-forever with a deliberate unpaid test order.
- **? 2026-07-05 (invoice generation) — build-shipped.** Orders now generate an
  idempotent invoice row through `upsertOrderInvoice`: new PayPal checkout orders get a
  draft invoice during create-order, paid capture upgrades it to `paid`, and new manual
  admin orders call the same admin invoice endpoint after creation. Order detail now has
  a **Generate Invoice / Refresh Invoice** button for legacy/test orders that are missing
  an invoice row. Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build`;
  preview confirmed the paid test order `NEJ-20260704-VPBG0` shows "No invoice generated
  yet" plus the new **Generate Invoice** button. The button was not clicked because it
  writes to the live database.
- **? 2026-07-05 (admin order print preview) — build-shipped.** Order detail now has a
  **Print Order** action that opens `/admin/orders/[id]/print` in a popup/tab. The route
  is admin-authenticated and shows a paper-style preview with order statuses, customer/
  address data, item snapshots, discounts, totals, notes, and a Print toolbar button.
  Print CSS hides the toolbar and shared cookie/cart/wishlist chrome. Verification:
  `npm run lint`, `npx tsc --noEmit`, `npm run build`; browser preview confirmed
  `NEJ-20260704-VPBG0` opens the preview route with the paper and Print button visible.
- **? 2026-07-05 (admin inventory restore override) — build-shipped.** Order detail now
  has a **Restore item to inventory** action that marks linked products `available`
  without changing order/payment state, even for completed paid sales. Delete confirmation
  now has two choices: Recycle Bin only, or Recycle Bin + return linked products to
  inventory. Paid orders are no longer blocked from the Recycle Bin path. Verification:
  `npm run lint`, `npx tsc --noEmit`, `npm run build`; browser UI verification was
  blocked by admin sign-in redirect in the in-app browser, so exercise on a deliberate
  test order while signed in.
- **? FIXED 2026-07-05 — E04 product soft-404.** Root cause was the
  `shop/loading.tsx` **ancestor** streaming boundary wrapping `[id]` (not just
  `[id]/loading.tsx`). Fixed by moving the shop-list page + skeleton into a
  `shop/(list)/` route group (scopes the loading boundary to `/shop` only, off
  `[id]`), removing `shop/[id]/loading.tsx`, and adding an early `notFound()` in
  the product `generateMetadata`. Unknown/hidden product URLs now return a real
  404 (EN+ES); `/shop` keeps its skeleton; `npm run build` passes. See CHANGELOG.
- **? FIXED 2026-07-05 — sold product detail page.** No longer shows the live
  price captioned "? This is your price"; sold items now show a "Sold — one of a
  kind" caption and keep an Inquire/Call CTA (no Add to Cart). See CHANGELOG.
- **? FIXED 2026-07-05 — UX-friction batch.** Free-evaluation photos now optional
  (photo-or-description guard); sign-in shows friendly localized errors instead of
  raw Supabase strings; saved-items drawer now shows the live computed price;
  ES nav "Tienda / Tienda" ? "Tienda ? Catálogo / Subastas"; cart/checkout
  "1 item(s)" ? proper singular/plural. Checkout address `*` + missing-field
  naming turned out to be **already handled** (dynamic `*` + click-to-reveal alert;
  the audit's DOM query missed the asterisks) — left the owner-verified pay-gate
  as-is. Open business/legal question: 7% FL sales tax on out-of-state orders. See
  CHANGELOG.
- **? 2026-07-05 (checkout UX) — guest sign-in gate + printable order confirmation.**
  "Proceed to Checkout" now shows signed-out shoppers a **Log In / Create Account /
  Continue as Guest** modal (signed-in users go straight through) — verified live. The
  post-PayPal confirmation keeps what it showed and adds a **View & Print Order Details**
  button (guest) revealing a printable receipt (items/totals via read-only `OrderSummary`
  + contact/ship-to + Print button; snapshotted client-side before the cart clears so
  guests can print). Built + build-verified; the live PayPal?print round-trip needs a
  sandbox buyer login (owner to run). Also verified live signed in as admin: the
  Create-Order tax (FL 6% / CA $0) and that the Reopen button renders conditionally
  (absent on open orders; no cancelled orders existed to click-test). See CHANGELOG + TASKS.
- **? 2026-07-05 (final batch) — tax?6%, Reopen button, lint?0, query dedup + env note.**
  Owner-directed: FL sales tax is now **6% everywhere when taxable** (was 7%/6.5% —
  centralized into a single `FL_TAX_RATE` in `checkout-pricing.ts`, imported by
  cart/checkout/admin); the out-of-state exemption still applies (verified live: FL 6%,
  CA $0). Added an admin **Reopen Order** button (`OrderDetailPanel`, shows on cancelled
  orders; build-verified, needs owner admin login to exercise). **Lint is now at 0
  problems** (5 hook errors + 1 font warning resolved: sign-in `nextUrl`?ref, the other
  4 are documented intentional patterns given scoped suppressions). Product page double
  DB query deduped via `React.cache`. **Owner env note:** all working env is in Netlify
  (PayPal sandbox, AI, etc.); `.env.local` is **stale**; remaining testing is live-post-
  deploy and owner-owned — this likely clears the old PayPal Netlify-credential blocker.
  `chris@naplesestatejewelry.co` confirmed real. Bigger shop-perf refactors + image
  re-encodes deliberately left for a focused pass (need live/visual verification). See
  CHANGELOG + TASKS.
- **? 2026-07-05 (later still) — Lint cleanup.** Cleared the 6 dead-code /
  stale-directive lint warnings (unused `setInvoices`/`hasDrawerFilters`/`LOCALES`, two
  stale `eslint-disable` comments, and the unused/never-wired `reopenOrder()` admin
  function). Lint now reports only the 5 `react-hooks/set-state-in-effect` **errors** +
  1 `google-font-display` warning, all deferred as a tracked follow-up (none block the
  build). tsc/build clean; `/shop` filters re-verified live. See TASKS + CHANGELOG.
- **? FIXED 2026-07-05 (later still) — Saved Items drawer gets an Add to Cart
  button, plus a real crash bug found and fixed along the way.** Owner clarified the
  earlier "add-to-cart affordance for the saved drawer" note and asked for it. Reused
  `CartButton` (`variant="icon"`) fed a minimal `CartItem` from what the wishlist
  stores; checkout's existing field-backfill effect fills in the rest. **While
  verifying this, found a real bug:** `[locale]/layout.tsx` nested
  `WishlistProvider` around `CartProvider`, but `WishlistProvider` renders
  `<WishlistDrawer>` as a *sibling* to its children, not inside them — so
  `WishlistDrawer` sat outside the `CartContext` tree entirely. The new
  in-drawer `CartButton` (which calls `useCart()`) crashed the whole app to a blank
  "page couldn't load" screen the instant a saved item rendered. Fixed by swapping the
  provider order (`CartProvider` now wraps `WishlistProvider`; confirmed no reverse
  dependency — `CartDrawer` never calls `useWishlist()`). Re-verified live: save ?
  open drawer ? Add to Cart works, item stays saved, cart badge updates, checkout
  renders the full spec line for the item, no console errors, and a full EN+ES route
  sweep still returns 200. `tsc`/build clean.
- **? FIXED 2026-07-05 (later) — FL sales tax no longer charged on out-of-state
  shipments (owner decision).** Authoritative fix in `lib/checkout-pricing.ts`
  (`buildOrderDraft` + new `isFloridaState`/`chargesFlSalesTax` helpers): tax now
  applies only for local pickup or a Florida shipping address; out-of-state shipments
  are untaxed. Threaded through `/api/paypal/create-order` (both the fresh-order and
  reuse-recompute paths) and the checkout page's own live estimate (`OrderSummary` +
  `CheckoutClient`), so the displayed total matches what's actually charged. The admin
  manual-order form (`OrdersPanel.tsx`) got the same exemption logic (its separate,
  pre-existing 6.5% rate was left as-is — untouched by this fix, not verified live,
  see TASKS). The header mini-cart (`CartDrawer.tsx`) intentionally keeps its flat 7%
  pre-checkout estimate — it has no address input, so it can't know the destination.
  Verified live on dev: CA address ? $0 tax / correct total; FL ? 7% tax restored;
  Local Pickup ? always taxed regardless of state field. No orders were created during
  testing (confirmed via network log — the PayPal button's `createOrder` only fires on
  an actual click, which wasn't triggered). `tsc`/build clean.
- **? FOLLOW-UP 2026-07-05 — account auth pages localized.** `/es/account/sign-in`,
  `sign-up`, and `reset-password` were fully English; now bilingual (labels, buttons,
  placeholders, validation, success screens). Fixed a latent missing-`/es` prefix on
  the sign-in "Create one" link. A **final full EN+ES walkthrough passed** (all routes
  200, garbage product 404, redirects + metal feed live, shop/cart/checkout/sold/saved
  flows and localized auth all confirmed, no console errors, `npm run build` clean).
- **Dev-infra:** Turbopack JSON cache corruption produced sticky 500s across
  routes mid-session (fixed by deleting `.next`); OneDrive sync is a plausible
  aggravator — see the walkthrough report / dev-server-gotchas memory.

## 2026-07-04 (later) -- ?? Pre-launch security audit round 2 (code shipped, ?? 4 SQL files pending)

A five-agent pre-launch audit (API routes, DB/RLS, payments/lifecycle, perf/cost,
client/secrets) surfaced a new **CRITICAL** and several HIGHs on top of the earlier
2026-07-04 findings. **Code fixes are shipped and verified (`tsc`/`eslint` clean,
`npm run build` passes).** Deploy the code, then run the SQL below.

- **?? CRITICAL (SQL only) — PUBLIC execute on payment RPCs.** Postgres grants
  EXECUTE to `PUBLIC` by default; the hardening file only revoked from
  `anon,authenticated`, so anon may still call `capture_paypal_order` /
  `apply_paypal_order_event` / `create_paypal_order` / `create_checkout_order` via
  PostgREST — i.e. mark orders paid + products sold without paying. **Fix: run
  `supabase/revoke-public-execute-2026-07.sql`** (revokes PUBLIC execute + default
  privileges; includes a `pg_proc.proacl` verification probe). No code change needed.
- **Code shipped this round:**
  - Deleted the dead, anonymous `/api/checkout/order` order-creation path ? now a
    410 stub (it let anyone flip the whole catalog to `pending_payment`).
  - `webhooks/resend` now **fails closed** when the signing secret is unset (was
    fail-open ? arbitrary unsubscribe).
  - PayPal **webhook** now verifies captured amount+currency before marking paid
    (mirrors capture-order; mismatch ? `pending` + admin notification).
  - Checkout now **rejects spot-linked items when the metal feed is on fallback**
    (`buildOrderDraft`, source==='fallback' ? 503 "call us") — no more selling gold
    off the hardcoded $3300 fallback during an API outage.
  - **Shipping method whitelisted** in `buildOrderDraft` (unknown method was $0 =
    free insured shipping).
  - **JSON-LD `</script>` breakout escaped** via new `lib/json-ld.ts#jsonLdHtml`
    (shop/[id], [locale]/layout, faq).
  - **IP rate limiting** on `/api/inquire`, `/api/contact-message`, `/api/subscribe`,
    `/api/unsubscribe`, `/api/paypal/create-order` via new `lib/rate-limit.ts`
    (**fails open until `supabase/rate-limiting-2026-07.sql` is run**). Honeypot +
    length caps added to the inquire JSON path; `productIds` capped at 50.
  - `/api/inquiries/[id]` PATCH now `requireAdmin()` (was any-signed-in-user).
  - `adminRevalidateProduct(s)` server actions now `requireAdmin()` (their action
    ids ship in public JS).
  - `server-only` import added to `lib/supabase/service.ts` + `lib/paypal.ts`
    (added the `server-only` dep) so a future client import fails the build.
  - Shop catalog **cache-key hardened**: free-text `?brand=` capped to 60 chars and
    `metal` constrained to gold/silver so junk querystrings can't spawn unbounded
    cache entries / DB reads.
- **Round 2b — the earlier "not yet coded" items are now DONE (code, build-verified):**
  - `item_conflict` race loser now raises a de-duped admin notification (refund
    reminder) from both capture paths — new `lib/order-finalize.ts#notifyItemConflict`.
  - Invoice + auto-receipt now fire on the **webhook-backstop** capture too (browser
    death after approval) — factored into `lib/order-finalize.ts#finalizePaidOrder`,
    called from both `capture-order` and the webhook.
  - Admin paid-order guards: `OrderDetailPanel` blocks delete / line-discount edits /
    mark-unpaid on paid orders (and delete now returns only held pending_payment
    products to available, never un-sells a sold item); `OrdersPanel`
    return-to-inventory refuses paid orders.
  - Partial-refund handling: `apply_paypal_order_event` now accumulates
    `refund_amount` and only marks fully `refunded` when cumulative = total, else
    `partially_refunded` (**SQL** — see manual steps; also folded into
    no-reservation-checkout.sql canonical).
  - profiles `internal_notes`/`account_type` SELECT restriction (**SQL**).
  - profiles.email **write-restriction (M3)** — the account form no longer writes
    `email` (now read-only, set from auth at signup) + column revoke (**SQL**).
- **?? MANUAL STEPS — run in Supabase, in this order (code-first, already deployed here):**
  1. `supabase/security-hardening-2026-07.sql` *(still pending from round 1)*
  2. `supabase/products-internal-columns-authenticated-2026-07.sql` *(round 1)*
  3. **`supabase/revoke-public-execute-2026-07.sql`** *(the CRITICAL)*
  4. **`supabase/rate-limiting-2026-07.sql`** *(enables rate limits; no-op until run)*
  5. **`supabase/profiles-column-restrictions-2026-07.sql`** *(M1 — internal_notes read)*
  6. **`supabase/orders-partial-refund-2026-07.sql`** *(M4 — partial refunds; needs
     orders-refund-amount.sql already applied)*
  7. **`supabase/profiles-email-write-restriction-2026-07.sql`** *(M3 — deploy the
     account-form change first)*
  Then the deferred `VALIDATE CONSTRAINT` lines in security-hardening-2026-07.sql.
- **Still open (deferred by choice):** env vars set in Netlify
  (`RESEND_WEBHOOK_SECRET`, `PAYPAL_WEBHOOK_ID`); verify CSP/HSTS reach SSR pages
  post-deploy. Perf quick-wins: ProductCard renders all images, product-detail
  double-query + `React.cache`, drop `unoptimized` on `/assets/` images, Material
  Symbols subset.
- **Dependency added:** `server-only` (npm) — guards `lib/supabase/service.ts` +
  `lib/paypal.ts` against client import.

## 2026-07-04 -- ?? Security hardening from full-site audit (?? SQL migration pending)

A three-pass audit (live site, admin flow, codebase) confirmed several issues via
live-DB probes. Remediation landed for the top server-side holes:

- **Code shipped** (build + `tsc`/`eslint` clean, not yet exercised live):
  `/api/checkout/order` calls `create_checkout_order` through the **service-role**
  client; `lib/checkout-pricing.ts#buildOrderDraft` rejects any **$0/negative line
  item** (409) for both manual + PayPal checkout.
- **?? MANUAL STEP — run `supabase/security-hardening-2026-07.sql` in Supabase.**
  Until it runs, the holes are still open (e.g. any logged-in customer can
  self-promote to admin, CODE-S01 Critical). **Deploy-order matters: ship the code
  first, then run the SQL.** The route now calls the RPC via the service-role client,
  which works before *and* after the revoke — but if the SQL runs while the old
  code is still live, the old cookie-client RPC call hits permission-denied and
  manual checkout breaks. The file is idempotent + has a rollback block.
- **Confirmed by live SQL probes:** CODE-S01 (is_admin self-writable), CODE-S02/D03
  (create_checkout_order granted to anon), CODE-D04 (anon reads cost_basis/
  minimum_price/internal_notes), CODE-D07 (only 3 CHECK constraints). No-reservation
  migration confirmed applied (reserve fns dropped). No live $0/pending_payment/
  fake-paid data found.
- **CODE-D04 residual — now fixed in code (?? 2nd SQL pending).** Admin product
  read moved to the service role (`admin/page.tsx`) and the `AdminShell` insert no
  longer `.select()`s, so `authenticated` no longer needs SELECT on the internal
  columns. **Run `supabase/products-internal-columns-authenticated-2026-07.sql`**
  (after the code deploys — same code-first ordering) to revoke those columns from
  `authenticated`. Verified on dev: admin table loads all 59 rows via service role.
- **Owner answers folded in:** no trade-in/store-credit build (phone-only); brand
  standardized to "Naples Estate Jewelry"; `naplesestatejewelry.com` not owned
  (can't 301); no license to display; Resend webhook secret is set.
- **SEO + technical batch shipped (code-only, build/tsc clean, verified on dev).**
  Canonical + hreflang on all content + product pages (`lib/seo.ts`), `html lang="en"`,
  de-doubled/seller-intent titles, product Breadcrumb/priceValidUntil/absolute-image/
  seller + locale-aware meta, FAQPage schema, global OG, sitemap hreflang+lastmod,
  robots hardening + `/shop-modern` noindex, `/sell`?`/free-evaluation` & `/cart`?`/shop`
  redirects, footer email, `error.tsx`, Netlify `/assets` cache fix. See CHANGELOG.
  **Deferred items — now all DONE** (see CHANGELOG 2026-07-04 final batch): real Google
  reviews swapped in; per-locale `<html lang>` shipped (html moved to `[locale]/layout`,
  root not-found self-contained, fonts in `lib/fonts.ts`); returns policy rewritten
  (all-sales-final + 5-day misrepresentation refund); "100%" badge replaced; H1 hygiene;
  mobile call button; CSP **enforced**; server-rendered spot price on gold/silver-services;
  new-listing re-slug (redirects + SQL). Auctions/Store nav left as-is (owner explained
  they may be real services — pending owner decision on copy, not removed).
  **?? Two new manual steps:** (1) run `supabase/reslug-new-listing-products-2026-07.sql`
  and deploy together with the next.config redirects; (2) after deploy, verify the
  enforced CSP on the live site (home, /gold-services TradingView chart, /checkout) —
  one-line rollback to Report-Only is commented in `netlify.toml`.
- **Guest checkout + remaining ecommerce-flow (PUB-E) items — DONE** (see CHANGELOG):
  `/checkout` no longer requires an account (guest checkout; optional sign-in nudge);
  shop counter reworded ("59 pieces"); `/wishlist`,`/saved` redirects; sign-up benefit
  line (password stays min-6); product-page trust line + rewritten Shipping policy.
  **The "signature required" shipping claim was removed** (owner: not always applicable)
  — product trust line now reads "Ships fully insured · Authenticity guaranteed" and the
  Shipping policy no longer promises signature-on-delivery. Only open PUB-E item is E04
  (garbage-product-URL soft-404: returns 404 on dev; verify on the live Netlify deploy).

## 2026-07-04 -- Checkout UX polish (owner-verified) + no-reply email wording

- **Pay-button validation is graceful now (owner-tested, works).** Clicking pay
  before the required "confirm your information" checkbox is checked no longer
  jolts/flashes the PayPal window. `PayPalCheckoutButton` dims the button and puts an
  invisible click-swallowing overlay over it while `!ready`, so PayPal is never
  invoked — it just shows an **inline red reminder above the button** that explicitly
  says to check the box (replaced the old full-screen modal; the checkbox is tracked
  via a `needsInfoConfirmation` prop). Owner confirmed the whole flow works
  2026-07-04.
- **No-reply customer emails no longer invite a reply.** The receipt/invoice and
  fulfillment-update emails (sent from `noreply@…`) said "reply to this email"; now
  they say "Call or text (239) 404-8505" only.

Both `tsc`/`eslint` clean. Other no-reply customer emails checked — none invite
replies. See CHANGELOG 2026-07-04.

## 2026-07-03 -- Auto-receipt on payment + paid-aware invoice/receipt email

On a successful PayPal capture, `capture-order` now **auto-emails the buyer their
receipt** (best-effort; only on the fresh capture, so no duplicates; never fails the
capture). The invoice email content is **paid-aware** (`buildInvoiceEmailContent`):
paid ? **Receipt** wording + "PAID IN FULL" badge + "Total Paid"; unpaid ? **Invoice**.
A shared `lib/order-invoice-mailer.ts#sendOrderInvoiceEmail` (fetch ? build ? send ?
log to `order_emails`) backs both the admin *Email Invoice/Receipt* button and the
auto-send. The admin button/modal relabel to Receipt for paid orders.

The auto-receipt **email sends regardless of the `order_emails` migration**; it's just
not logged to the Email History card until `supabase/order-emails.sql` is run (see the
per-order-email entry below — same pending migration). **Verified:** `npm run build`
passes, `tsc`/`eslint` clean. Not exercised live (needs a PayPal sandbox capture +
admin view + the migration). See DECISIONS 2026-07-03.

## 2026-07-03 -- Order detail: per-order email history

The admin order detail page (`/admin/orders/[id]`) now records every email sent from
it (invoice + fulfillment-update) and shows them in a new **Email History** card
under the Summary block on the right. New table `order_emails`
(`supabase/order-emails.sql`); the two email routes best-effort insert a row after a
successful send; the page loads the history and `OrderDetailPanel` prepends each
just-sent email optimistically.

?? **Manual step: run `supabase/order-emails.sql` in Supabase.** Until then the table
is missing ? history reads empty and the routes' logging insert no-ops (emails still
send fine — graceful). **Verified:** `npm run build` passes, `tsc`/`eslint` clean
(only pre-existing OrderDetailPanel warnings). Not exercised live (admin session had
lapsed; owner credentials not entered; table not yet migrated). After running the SQL,
verify by sending an invoice + a fulfillment-update email from an order and confirming
both appear in the Email History card. See DECISIONS 2026-07-03.

## 2026-07-03 -- Admin toggle: show/hide sold items in the shop gallery

Added an admin setting (in `/admin/settings` ? new **Shop Visibility** section) to
choose whether SOLD products appear in the public shop gallery. Available items are
always shown. Implementation follows the app's single-row-settings + admin-gated-API
pattern:
- **New table `shop_settings`** (`supabase/shop-settings.sql`) — single row, column
  `show_sold_items boolean default true`. Anon/authenticated SELECT (storefront
  reads it), writes only via the admin API's service-role client.
- **New API `/api/admin/shop-settings`** (GET/PUT, `requireAdmin`-gated, service-role
  read/write). PUT busts the `shop-catalog` cache tag so the change shows immediately.
- **New store lib** `src/lib/shop-settings.ts` (`fetchShowSoldItems` degrades to
  `true` on any error incl. missing table; `saveShowSoldItems`).
- **Admin UI** `src/components/admin/AdminShopVisibilityPanel.tsx` (checkbox),
  rendered by `AdminSettingsPanel`.
- **Shop query** (`shop/page.tsx#queryShopCatalog`) reads the setting and filters to
  `AVAILABLE_ONLY_SHOP_PRODUCT_STATUSES` (new export in `types/product.ts`) when the
  toggle is off, else the existing available+sold set.

? **Migration applied + feature verified end-to-end (2026-07-03).** `supabase/shop-settings.sql`
was run in Supabase. Verified live signed-in as admin: with the toggle ON `/shop`
showed 59/59 (7 sold visible); toggling OFF (PUT ? 200) dropped it to 52/52 with
`?status=sold` empty (the 7 sold hidden from results + total + facets); toggling back
ON restored 59/59. The setting was **restored to `true`** (its default) after testing
so production shows sold as before. `npm run build` passes, `tsc`/`eslint` clean. See
DECISIONS 2026-07-03.

## 2026-07-03 -- Checkout inventory: no reservation (whoever pays first gets the item)

Removed the 30-minute inventory reservation from PayPal checkout. Items now stay
`available` all the way through the PayPal window — no hold is placed — so multiple
buyers can check out the same one-of-one piece at once and the sale is decided at
**capture** (first payment to capture wins). Most of this was already in the app
code (`create-order` calls `create_paypal_order`; `capture-order` handles the
`item_conflict` race); this change finishes it by tearing down the orphaned
reservation machinery and correcting the docs:
- **SQL (`supabase/no-reservation-checkout.sql`)** now also **drops**
  `reserve_paypal_order` + `release_expired_paypal_reservations` and rewrites
  `apply_paypal_order_event`'s `denied` branch to not release a reservation.
  `supabase/paypal-checkout.sql` got a header pointing to it (that file still
  defines the reservation functions for a re-run, so no-reservation must be run
  after it). **?? Manual step: run `no-reservation-checkout.sql` in Supabase**
  (after `paypal-checkout.sql`) — see the SQL-migrations section below.
- **App copy:** the checkout subtitle no longer says "reserve the items" (now
  "check out the items"); a stale "double-reserve" comment was corrected.
- Vestigial `reserved_until`/`reserved_order_id` columns are left in place (always
  null) to avoid a destructive schema change. The manual admin **Reserved** product
  status has since been removed from the active app (2026-07-06).

**Verified:** `npx tsc --noEmit` clean and `npm run build` passes (app copy change
only — no route/type change); the SQL is not exercisable from here (needs a Supabase
run + PayPal sandbox approval to see the race). See DECISIONS 2026-07-03.

## 2026-07-03 -- PayPal checkout: capture-on-approve (confirm-on-return removed)

Reverted the 2026-07-02 confirm-on-return flow. The sale now completes when the
buyer hits **Pay Now** in the PayPal window (capture runs in the Buttons
`onApprove` callback); on return to our tab they land directly on the "Order
Received" confirmation. Removed: the intermediate "Confirm Your Order" review
screen, the client-side capture-on-confirm, and the sessionStorage hand-off
(`nej-paypal-pending`) + `GET /api/paypal/order-status` resume route +
`getPayPalOrder()` in `lib/paypal.ts` that existed only to restore that screen
after a mobile tab eviction. With no reservation (see the no-reservation entry
above), a tab evicted mid-capture just leaves the item available; the
`PAYMENT.CAPTURE.COMPLETED` webhook still reconciles any capture that landed.
**Verified:** `rm -rf .next && npm run build` passes (order-status route gone
from the route list; create/capture/webhook remain), `npx tsc --noEmit` clean,
`eslint` clean on the three changed files
(`CheckoutClient.tsx`, `PayPalCheckoutButton.tsx`, `lib/paypal.ts`). The button
UI itself was not exercised live — `/checkout` is auth-gated (redirects to
sign-in) and no test-account credentials were available this session; the
capture path also needs a PayPal sandbox approval. See DECISIONS 2026-07-03.

## 2026-07-03 -- All pending Supabase SQL migrations applied

Owner confirmed all previously outstanding Supabase SQL migrations have now
been run in the live project (`evzluixourmsefwdsieu`): `paypal-checkout.sql`
(with the `service_role` grants and the capture-to-Messages-notification
removal re-run), `admin-notifications-recycle-bin.sql`,
`admin-notifications-image-urls.sql`, `product-public-notes-es.sql`,
`product-item-year.sql` (with the `admin-notifications-checkout.sql` re-run),
and `shop-new-listing-jpg-to-webp.sql`. No SQL migrations are known to be
outstanding. This does not change the PayPal go-live blocker, which is a
Netlify environment-variable mismatch, not a database migration — see the
HANDOFF section below. App-level verification of the newly-applied migrations'
behavior (recycle bin, image URLs, ES notes, item-year persistence) is not yet
done; tracked in `TASKS.md`.

## 2026-07-02 (later) — shop-gallery cache now purged by admin order actions

Fixed the report "cancelled order items show available in admin but stay sold in
the public gallery": order-flow product writes (cancel/reopen/mark-paid,
delete-order return-to-inventory, create-order status updates, archive/hard-delete)
happened via the browser Supabase client and never revalidated the `shop-catalog`
tag, so the gallery stayed stale up to 5 min. All now call the new bulk
`adminRevalidateProducts()` server action. Verified live on dev (signed-in):
Mark Paid ? bracelet left /shop in ~3s; Cancel ? back in ~3s. Convention: any
client-side `products` write must be followed by `adminRevalidateProduct(s)`.
Note: the Test 7 leftover order `a565d7f4…` is now `cancelled` (used for this
verification); the cleanup SQL below still applies.

## 2026-07-02 — PayPal approval-return hardening (reload/eviction resume)

> ?? **Superseded 2026-07-03.** The confirm-on-return screen and the
> sessionStorage + `order-status` resume machinery described below were removed in
> favor of capture-on-approve (see the 2026-07-03 entry above). The **stale-total
> reuse fix** further down in this entry still stands. Kept as a record.

Investigated the report "after PayPal authorization the user lands on a random
other tab" (mobile). Conclusion: the tab-focus behavior is the mobile OS/browser's
app hand-off quirk, not app code (checkout has no `return_url`, `window.open`, or
tab logic — the PayPal JS SDK owns the whole round-trip). But the audit surfaced a
real defect: all post-approval state was React-only, so a mobile tab eviction or
reload during/after approval silently dropped an APPROVED-but-never-captured
payment (buyer taps "Pay Now", returns to a blank form).

**Shipped:** sessionStorage hand-off record (`nej-paypal-pending`) + new
`GET /api/paypal/order-status` resume route + `getPayPalOrder()` in `lib/paypal.ts`.
Details in `features/paypal-checkout.md` (Flow §4).
**Verified:** `npx tsc --noEmit` clean; changed files eslint-clean (5 pre-existing
errors elsewhere: `react-hooks/set-state-in-effect` in an admin editor,
unused-vars in `OrderDetailPanel`/`ShopFilters`); `npm run build` passes with the
route registered; endpoint probed live on dev :3002 (no param ? 400; unknown
order ? `{state:'none'}`).
**Test 7 (approved-branch resume) PASSED live** the same day: owner approved in
the sandbox window, a full reload of /checkout restored the Confirm screen with
the payer email re-fetched from PayPal and no console errors. The unfinished
approval left order `858bbf06-358a-4ba6-8a10-d3505521ca11` (unpaid, approved at
PayPal — expires on its own if never captured); included in the cleanup below.

**Also fixed same day: stale-total reuse bug.** The create-order reuse path used
to rebuild the PayPal order from the original order rows even if the buyer had
edited the cart/shipping after cancelling — wrong charge. Now it recomputes the
draft and reuses only on an exact product-set + totals match, else cancels the
stale order and falls through to a fresh one; the client also drops the reusable
order id when the cart/shipping fingerprint (`payloadKey` in `nej-paypal-pending`)
diverges. **Verified live signed-in on dev :3002:** resume 'none' branch clears the
record on /checkout mount; create ? order-status `pending`; same-payload retry
reuses the order id; changed-shipping retry returns a fresh order id.

?? **Leftover test rows from this verification** (products were never reserved —
create no longer holds inventory before capture): orders
`cc3c6996-6853-421d-ac13-91e3777b1b67` (cancelled) and
`a565d7f4-7f49-4f56-adbb-b80593210409` (unpaid), both `payment_method='paypal'`,
`customer_email='resume-test@example.com'`, plus the Test 7 order
`858bbf06-358a-4ba6-8a10-d3505521ca11` (unpaid, approved-never-captured), all
created 2026-07-02. Clean up in Supabase:
```sql
DELETE FROM orders WHERE customer_email = 'resume-test@example.com';
DELETE FROM orders WHERE id = '858bbf06-358a-4ba6-8a10-d3505521ca11';
```

## ?? HANDOFF — PayPal checkout: where testing stands (2026-06-30)

**The site is deployed and the checkout page renders, but PayPal checkout fails on the
deployed site with "Something went wrong with PayPal. Please try again." Root cause
identified — see the Netlify env-var fix below.** Code is complete and verified on the
local dev server. Full technical runbook: `project-docs/features/paypal-checkout.md`.

### ?? BLOCKER: Netlify has the wrong PayPal app credentials

The deployed site serves `PAYPAL_CLIENT_ID = AcSsWn15M34eZNC-2OksAzaKof6Uj4dC6p-TgwSUVlr0AKKwvRcowHnFIJts92cKrA9qaL_73xtNhR5g`
(extracted from live checkout HTML), but the verified working sandbox app in
`next-app/.env.local` has `PAYPAL_CLIENT_ID = AbscNftOUogWVeuutMWwSWjnjtmqn5k3r9F3AXGl5PW27mR4Tx1xd-hzUHX5qbcvnZZtYF3mD_eo0eMm`.
**These are different PayPal apps.** The server's `getAccessToken()` call (Basic
auth with the Netlify-set id+secret) receives `401 invalid_client` from PayPal
? `createPayPalOrder` throws ? route returns 502 ? the client shows the error.

**Fix (requires Netlify dashboard access):** Update all 4 PayPal env vars to the
working sandbox set from `next-app/.env.local`, then trigger a redeploy:
- `PAYPAL_CLIENT_ID` = `AbscNftOUogWVeuutMWwSWjnjtmqn5k3r9F3AXGl5PW27mR4Tx1xd-hzUHX5qbcvnZZtYF3mD_eo0eMm`
- `PAYPAL_CLIENT_SECRET` = the `EG0py…` value from `next-app/.env.local`
- `PAYPAL_ENV` = `sandbox`
- `PAYPAL_WEBHOOK_ID` = `64C82950G8312001A`

?? **All 4 must belong to the same PayPal app and environment.** Mixing id/secret
from different apps, or setting `PAYPAL_ENV=live` with sandbox creds (or vice versa),
causes the same `401 ? 502`. See DECISIONS (2026-06-30, PayPal credential-set rule).

**Diagnostic confirmation:** `reserve_paypal_order` RPC and all Supabase grants are
confirmed working on the live DB (probe returned 502, not 503 — the RPC succeeded;
the failure was the downstream PayPal API call). The bracelet reservation was
automatically rolled back. One leftover `cancelled` diagnostic order row remains in
the `orders` table (created 2026-06-30, `payment_method='paypal'`); clean it up in
Supabase with:
```sql
DELETE FROM orders
WHERE payment_method = 'paypal'
  AND payment_status = 'cancelled'
  AND created_at::date = '2026-06-30';
```
`order_items` cascades; products are already back to `available`.

### Environment / config state
- **Code:** complete. Routes `/api/paypal/{create-order,capture-order,webhook}`, `lib/paypal.ts`,
  `lib/checkout-pricing.ts`, `components/checkout/PayPalCheckoutButton.tsx`, and the
  checkout/admin-orders UI are all in place. `tsc` clean; `npm run lint` shows only the 3
  known pre-existing issues.
- **Credentials:** SANDBOX creds are in `next-app/.env.local` (`PAYPAL_ENV=sandbox`,
  `PAYPAL_WEBHOOK_ID=64C82950G8312001A`) and verified to authenticate against the sandbox
  endpoint. (An earlier set of LIVE creds was swapped out — Live creds fail against the
  sandbox endpoint with `401 invalid_client`.) **Netlify has a DIFFERENT set** — see blocker above.
- **Supabase migrations:** `order-item-line-discounts.sql` applied. `paypal-checkout.sql`
  applied **with** the `service_role` grants, the ambiguous-`order_id` fix, and the
  re-run that drops the capture-to-Messages notification insert (owner confirmed all
  pending SQL migrations run 2026-07-03) -- a real capture no longer posts a "Paid
  order" row to `/admin/messages`; it only shows on the Orders-tab badge.
- **Deployed:** the app is live on Netlify. The Netlify secrets-scan issue was fixed
  (added `PAYPAL_CLIENT_ID` to `SECRETS_SCAN_OMIT_KEYS` in root `netlify.toml` — it is
  intentionally public per PayPal's design). PayPal checkout is broken only because of the
  credential mismatch; all other site features work.
- **Note:** one orphaned sandbox capture sits in the PayPal sandbox account from an earlier
  tangled attempt — harmless test funds, no action needed.

### Sandbox test matrix
| # | Test | Status |
|---|------|--------|
| 1 | Successful payment | ? **PASSED live (local dev)** end-to-end (create ? approve ? capture ? `paid`/`completed`, product `sold`, capture idempotent) — predates the no-reservation change; re-run recommended |
| 5 | Concurrent-buyers race (no reservation) | ? **NOT run** — new model (2026-07-03): two buyers both approve the same one-of-one, both capture; first wins (`sold`), second gets `item_conflict` ? order flagged `failed` for manual refund + 409 message. Needs the `no-reservation-checkout.sql` migration + two sandbox approvals. (Replaces the old "reserve returns 409" test.) |
| — | Validation/error paths + webhook signature gate | ? PASSED (empty cart, missing contact, bad ids ? correct 400/404; unsigned webhook ? 401) |
| 3 | Failed/denied capture | ? Partial — graceful 502 + order stays unpaid on an unapproved capture is verified; the `PAYMENT.CAPTURE.DENIED` **webhook** branch is NOT live-tested (needs deploy) |
| 6 | Amount mismatch | ? Logic verified (capture compares amount+currency ? flags order `pending` + admin notification, no auto-sell); NOT forced live |
| 2 | Canceled checkout | ? NOT run live (onCancel handler exists) |
| 4 | Duplicate webhook | ? NOT run — needs deployed site + PayPal "Resend"/simulator (idempotency is coded via `webhook_events` unique `event_id`) |
| 7 | Reload-during-approval resume | ? **N/A — feature removed 2026-07-03.** The confirm-on-return screen + sessionStorage resume route were reverted in favor of capture-on-approve; there is no longer a client screen to restore across a reload. With no reservation, a tab evicted mid-capture just leaves the item available. |

### What's left to do, in order
1. **Fix the Netlify credential mismatch** (see BLOCKER above): update the 4 PayPal vars in
   the Netlify dashboard to the verified sandbox set, then redeploy (env-var changes only take
   effect on a new deploy).
2. ~~Re-run `supabase/paypal-checkout.sql`~~ Done -- owner confirmed re-run 2026-07-03;
   paid orders no longer post to the Messages center.
3. **Register the sandbox webhook** in the PayPal Developer dashboard ? URL `https://naplesestatejewelry.co/api/paypal/webhook`, events `PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED/REVERSED` + `CUSTOMER.DISPUTE.CREATED`; confirm its id matches `PAYPAL_WEBHOOK_ID`.
4. **Finish the sandbox tests on the deployed site:** Test 2 (cancel), Test 3 (denied capture — sandbox negative testing or the webhook simulator's DENIED event), Test 4 (duplicate webhook via "Resend"). Optionally force Test 6 by editing `orders.total` while the PayPal popup is open.
5. **Only after sandbox passes ? go LIVE:** create a Live PayPal app, swap in live client/secret/webhook id, set `PAYPAL_ENV=live`, redeploy, and run one real low-value order.

### How to verify the fix without touching the UI
After updating Netlify env vars and redeploying, run this probe — a working config
returns a `paypalOrderId` (the reservation self-cleans on rollback):
```bash
curl -s -i -X POST https://naplesestatejewelry.co/api/paypal/create-order \
  -H "Content-Type: application/json" \
  -d '{"productIds":["italian-milor-14k-rose-gold-semi-solid-fancy-link-bracelet-24"],"shippingMethod":"local-pickup","customer":{"name":"Diag Test","email":"diag@example.com","phone":"2390000000"}}'
```
A 200 with `paypalOrderId` = credentials are correct. A 502 = still wrong credentials.

### How to verify/clean during testing
- Test orders/reservations were created and cleaned up via the Supabase service role (PostgREST). To inspect old tests: query `orders` (filter `payment_method=eq.paypal`) and products linked through `order_items`. To clean a test order: set its unpaid product(s) back to `status='available'` (+ null `reserved_until`/`reserved_order_id` if present) and delete the order (order_items cascade).
- A successful sandbox payment marks a REAL product `sold` and creates a real order — revert it after testing unless you want to keep an example.

## Supabase SQL migrations -- all applied (confirmed by owner 2026-07-03)

All previously pending migrations have been run in the live Supabase project
(`evzluixourmsefwdsieu`), owner-confirmed 2026-07-03:

- `supabase/paypal-checkout.sql` (including the `service_role` grants and the
  re-run that drops the capture-to-Messages notification insert)
- `supabase/admin-notifications-recycle-bin.sql`
- `supabase/admin-notifications-image-urls.sql`
- `supabase/product-public-notes-es.sql`
- `supabase/product-item-year.sql` and the `admin-notifications-checkout.sql` re-run
- `supabase/shop-new-listing-jpg-to-webp.sql`

?? **One SQL migration is outstanding as of 2026-07-03:**
`supabase/no-reservation-checkout.sql` — the no-reservation checkout model. An
earlier copy of it **is confirmed applied on the live DB**: a 2026-07-03 attempt to
re-run `paypal-checkout.sql` failed with `42P13: cannot change return type of
existing function` on `capture_paypal_order`, which proves the live function is the
newer no-reservation version (with the `item_conflict` return column). But the file
was **enhanced 2026-07-03** to also drop the old `reserve_paypal_order` +
`release_expired_paypal_reservations` functions and rewrite
`apply_paypal_order_event` — so **run the current copy once, by itself** (do NOT
re-run `paypal-checkout.sql` first; it is fully applied and re-running it downgrades
the capture function, requiring no-reservation to be run again — it now carries a
`drop function` guard so a re-run at least no longer errors with 42P13). Until the
current copy runs, the orphaned 30-min reservation functions still exist in the DB
(unused by the app, but present).

App-level verification of the other applied migrations (recycle bin, image URLs
rendering, ES notes, item-year persistence) is tracked separately in `TASKS.md`.


## Current App

- The current deploy target is the **Next.js app in `next-app/`**.
- Root `netlify.toml` sets `base = "next-app"`, runs `npm run build`, and
  publishes `.next` with `@netlify/plugin-nextjs`.
- The retired root static HTML site has been removed: root `*.html`, `es/`,
  `scripts/`, root `assets/`, `tools/`, and old `netlify/functions/` are gone.
- Keep runtime code and public assets under `next-app/`.

## What Is Currently Working

- **Localized marketing site** with EN/ES routes for home, about, contact, free
  evaluation, FAQ, privacy, and service/category pages.
- **Online shop** (`/shop`, `/shop/[id]`) backed by Supabase `products`, with
  filters, product detail pages, local/Supabase image support, and live metal
  pricing.
- **Online checkout + payments via PayPal** on `/checkout` (Orders API v2,
  **sandbox**): create-order computes authoritative totals and creates the order
  **without holding inventory** (no reservation — items stay available through the
  PayPal window), the sale captures the moment the buyer hits **Pay Now** in the
  PayPal window (capture verifies amount/currency, marks the order paid + products
  sold, and resolves the concurrent-buyer race so the first payment wins), and a
  signed idempotent webhook reconciles capture/denied/refund. On return the buyer
  lands directly on the "Order Received" confirmation — no confirm-on-return step.
  Sold items leave the shop gallery promptly; new/unseen active orders surface as a
  badge on the admin **Orders** tab (not Messages); the order detail page + invoice show the
  shipping address. **Pending go-live steps** (run `no-reservation-checkout.sql`, set
  Netlify env, register webhook, run sandbox test matrix) — see the HANDOFF section
  above and TASKS.
- **Admin Orders** (`/admin/orders`, `/admin/orders/[id]`) with create/manage,
  delete (with optional return-to-inventory), and an unseen active-orders nav badge.
- **Live metal pricing** via
  `next-app/src/app/api/metal-prices/route.ts`,
  `next-app/src/lib/spot-price.ts`, and `next-app/src/lib/pricing.ts`.
- **Customer accounts** through Supabase Auth and Next routes
  `/account/sign-in`, `/account/sign-up`, and `/account`.
- **Admin, users, and inquiries** through Next admin pages and API routes under
  `next-app/src/app/[locale]/admin*` and `next-app/src/app/api/inquir*`.
- **SEO** through Next metadata, `robots.ts`, and `sitemap.ts`.
- **Carousel hero** on the home page — a windowed/infinite 3D ring of curated
  pieces with a per-photo White/Black swept background, `next/image` optimization
  + preloading, offscreen pause, and admin-configurable selection, ordering, group
  colors, show-price, and desktop/mobile ring sizes. See
  `project-docs/features/carousel-hero.md`.

## What Was Recently Completed

> Full dated history lives in `CHANGELOG.md` (newest first, back to project start).
> This section keeps only the last few sessions as a quick-scan summary.

- **2026-07-02 (later):** Shop-gallery cache now purged after every admin
  order-flow product write (cancel/reopen/mark-paid, delete-order
  return-to-inventory, create-order status updates, archive/hard-delete) via the new
  `adminRevalidateProducts()` action — fixes items staying "sold" in the public
  gallery after being returned to available in admin.
- **2026-07-02:** PayPal checkout hardened against mobile tab eviction during
  the approval round-trip (sessionStorage hand-off + `GET /api/paypal/order-status`
  resume route) and a stale-total bug in the create-order retry path (now
  recomputes and re-validates totals before reusing an order). Also
  investigated and closed out the "returned to a random tab after PayPal"
  report — confirmed to be mobile OS/browser tab-focus behavior, not app code.
- **2026-06-29:** PayPal Orders API v2 checkout wired into `/checkout`
  (replacing the old manual "Submit Order"), with server-side authoritative
  pricing, one-of-one inventory reservation, signed/idempotent webhook, and
  admin Orders-tab delete/return-to-inventory. Sandbox Test 1 (successful
  payment) passed end-to-end. See the PayPal HANDOFF section above for full
  status and `features/paypal-checkout.md` for the technical runbook.
- **2026-06-25:** A four-phase web performance/security + compliance pass —
  fixed silently-failing contact/free-evaluation forms (moved off Netlify
  Forms onto `/api/inquire`), unified the admin inbox across
  inquiries/messages/orders, added the "Message Us Directly" contact form,
  bilingual product notes, a full Spanish orthography sweep, create-account
  duplicate-email handling, and a shop gallery/list view toggle.
- **2026-06-13 ? 2026-06-24:** The legacy static HTML site was fully removed
  and the Next.js/Supabase app (`next-app/`) became the sole deploy target;
  sales workflow (orders/invoices/lifecycle statuses), the AI listing
  assistant, compliance/legal pages, and a broad shop/responsive/performance
  pass were all built out. See `CHANGELOG.md` for the day-by-day detail.

## Current Priorities

1. **Bring PayPal checkout live** — see the ?? HANDOFF section above for the
   exact blocker (Netlify credential mismatch) and ordered steps. This is the
   top priority; everything else in `TASKS.md` Backlog is secondary to it.
2. ~~Apply the pending Supabase SQL migrations~~ Done -- all confirmed applied
   2026-07-03 (see "Supabase SQL migrations" section above).
3. See `TASKS.md` Backlog for the full prioritized list of deferred shop
   performance work and app-level verification follow-ups for the newly
   applied migrations — it is kept in sync with this file and is the source
   of truth for backlog ordering.
4. Fill in the remaining unknowns in `CLIENTS.md` (Netlify site name/ID, DNS
   registrar, maintenance plan, billing status, credential locations) —
   confirmed still blank as of 2026-07-02.

## Active Blockers

- **PayPal checkout cannot process real payments on the deployed site** until
  the Netlify PayPal env vars are corrected to match the verified sandbox
  credentials — see the ?? HANDOFF section above.
- No CI beyond Netlify's `npm run build` on deploy.

## Verification

- Last known good local commands from `next-app/`:
  `npx tsc --noEmit`, `npm run lint` (0 problems as of 2026-07-07), and
  `npm run build` — all pass.
