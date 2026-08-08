# Feature: Carousel Hero

## Summary

The **home page** hero (`/`, `/es`) is a 3D rotating photo carousel of curated
estate pieces, replacing the old MP4 ring video. It is:

- **Windowed / infinite** — only a few cards exist on the ring at once (admin-set,
  default 6 desktop / 4 mobile) on a tight, intimate radius; the full curated list
  cycles through them as cards pass the hidden back. Item count barely affects the
  look or performance.
- **Per-photo background, swept** — each photo belongs to a **White** or **Black**
  group. The carousel auto-orders them into a white arc + a black arc, and the
  hero background is a horizontal gradient that **sweeps** as a group boundary
  rotates through the front: the incoming color leads the incoming photo while the
  outgoing color fades off the far side. The headline text flips light/dark to
  match whichever color is centered behind it.
- **Image-optimized** — photos route through `next/image` (AVIF/WebP, right-sized
  per display, `quality 90`), with an off-screen **preloader** that warms the next
  batch so cycled-in cards never pop in.
- **Performance-guarded** — an `IntersectionObserver` pauses the CSS spin and the
  per-frame rAF loop whenever the hero scrolls out of view.

The same `Carousel` widget also powers the admin live preview. Storefront CTAs
route directly to `/shop`; the retired `/store` chooser route no longer exists.

## Key Files

- `next-app/carousel/components/Carousel.tsx` — the engine. Windowing, the
  per-frame `sample()` loop (centered-card detection, swept-background gradient,
  slot cycling), offscreen pause, and the off-screen image preloader.
- `next-app/carousel/components/Carousel.module.css` — 3D ring CSS. Per-card
  `--card-bg` (falls back to `--bg`), edge fades, ring pointer-events passthrough.
- `next-app/carousel/lib/carouselData.ts` — Supabase data access + types
  (`CarouselItem`, `CarouselSettings`, `SelectionEntry`), `groupByBackground()`,
  resilient fetch/save (degrade gracefully when optional columns are unmigrated).
- `next-app/carousel/lib/carouselConfig.ts` — table/column mapping, `DEFAULT_BG`,
  `DEFAULT_VISIBLE_COUNT` / `MIN_VISIBLE_COUNT` / `MAX_VISIBLE_COUNT`.
- `next-app/src/components/home/HomeHero.tsx` — the hero section. Owns the
  imperative background paint + text theme, uses the server-provided initial
  payload, picks the desktop/mobile visible count via `matchMedia`, and lays out
  the split overlay (headline up top, sign-up form + Buy/Sell/Trade down low).
- `next-app/src/lib/home-carousel-server.ts` — public server read for the
  curated selection/settings, optional-column compatibility, five-minute
  tagged cache, and fallback resolution.
- `next-app/src/lib/home-carousel-payload.ts` — pure one-payload resolver and
  fallback settings used by the server read and regression tests.
- `next-app/src/components/home/HomeSubscriberForm.tsx` — sign-up form; inputs use
  a solid light fill so they stay legible over both white and black hero phases.
- `next-app/src/components/admin/AdminCarouselSettingsPanel.tsx` — admin curation:
  product search, ordered selection, per-photo White/Black group, show-price,
  desktop/mobile visible counts, and a live preview (mirrors the home sweep).
- `next-app/src/app/[locale]/(home)/page.tsx` — resolves and passes the
  authoritative initial items/settings to `HomeHero`.

## Data Model (Supabase)

- `carousel_selection` — curated list. `product_id` (FK → `products.id`),
  `position` (order), `bg_color` (per-photo White/Black). **NULL no longer means
  "inherit white"**: since 2026-08-07 a NULL falls back to the product's own
  `image_padding`, so a black-backdrop photo added without the swatch set paints
  black instead of showing white bars. An explicitly set swatch still wins.
- `carousel_settings` — single row (`id = 1`). `show_price`, `bg_color` (legacy
  global default, now fixed to white), `visible_count` (desktop ring size),
  `visible_count_mobile` (mobile ring size).
- Both tables are public-readable; only the admin (email-gated `is_carousel_admin()`
  in `setup.sql`) may write. Reads/writes in `carouselData.ts` use **tiered
  fallbacks** so a missing optional column never breaks the carousel or blocks a
  save — it just drops the unmigrated field.

## How It Works

**Windowing.** `effectiveVisible = min(visibleCount, items.length)`. The ring
renders that many slot cards (radius derived from the count → intimate). State
`slotItems[p]` maps each slot to a `data` index. As a slot crosses ~180° (hidden
back), it advances by `effectiveVisible`, so the window scrolls the whole list
forward. Cards are keyed by **slot**, not item, so the ring keeps spinning and only
the image swaps.

**Centered card + swept background.** Each animation frame, `sample()` reads the
live CSS-animation clock, finds the front-center slot (most-centered, front-facing),
and builds the background. Block seams are projected to a horizontal screen position
via the sine of their net angle; the result is a `linear-gradient` whose boundary
sweeps. Applied **imperatively** to the section's `style.background` (no React
re-render per frame). The text theme (`--hero-text`, eyebrow, button colors) flips
via React state only when the centered color changes.

**Two-block grouping.** `groupByBackground()` orders all White-group items first,
then Black, so the ring has exactly two seams — long solid stretches with one clean
sweep at each boundary.

**Image optimization + preload.** Cards use `next/image` (`fill`, viewport-based
`sizes`, `quality 90`); `next.config.ts` sets `formats: ['image/avif','image/webp']`
and `qualities: [75, 90]`. An off-screen layer renders the upcoming batch
(`slots.map(s => (s + ev) % n)`) with identical `sizes` so the browser fetches the
exact same optimized variant ahead of time.

**Offscreen pause.** Two layers, because one is not enough (see DECISIONS,
"Only on-screen slideshows animate"):

- `Carousel`'s own `IntersectionObserver` gates on `intersectionRect` **area**
  (never `isIntersecting`, which is `true` for a zero-area intersection) with a
  threshold ladder (`threshold: 0` alone fires once and never again when the
  boolean never flips). This covers standalone uses like the admin preview.
- Inside the hero stack, `HomeHeroStack` passes an explicit `paused` prop through
  `HomeHero` to `Carousel`, derived from the same conditions that set `inert`.
  Geometry cannot be made airtight through a transformed, clipped ancestor, and
  the stack already knows exactly which panes are offscreen.

Net effect, measured across 11 scroll positions: **3.0 concurrent rAF loops → 1.55
average, 1 at rest**, peaking at 2 only mid-crossing when both panes really are
on screen.

**Initial payload + cache.** The localized Server Component resolves
`carousel_selection` and `carousel_settings` before rendering `HomeHero`.
`unstable_cache` keeps that combined public read for five minutes under the
`home-carousel` tag. The client receives that one set in the initial HTML and
does not refetch or replace it after hydration. Saving carousel settings calls
the authenticated `/api/admin/carousel/revalidate` endpoint to expire the tag
immediately. Bundled products appear only if the server query fails or the
curated selection is empty.

## Admin Controls (`/admin/settings` → Store Carousel Hero)

- Search + add/remove products; reorder with ↑/↓; per-row **White/Black** group
  swatch; remove (✕). Rows are compact (thumbnail + 2-line title).
- **Show price on carousel** toggle.
- **Cards visible at once** — separate **Desktop** and **Mobile** number fields
  (3–12). The preview uses the desktop value.
- Save persists selection (with per-photo bg) + settings and invalidates the
  public carousel cache. The panel lives in a wider `max-w-[1800px]` container
  so the two tables extend on widescreen.

## Migrations

Run in the Supabase SQL editor (all idempotent). `setup.sql` is the full,
re-runnable source of truth; the deltas exist for incremental installs:

- `next-app/carousel/sql/setup.sql` — full schema (selection, settings, RLS, grants).
- `next-app/carousel/sql/add-per-item-bg.sql` — `carousel_selection.bg_color`.
- `next-app/carousel/sql/add-visible-count.sql` — `carousel_settings.visible_count`.
- `next-app/carousel/sql/add-visible-count-mobile.sql` — `…visible_count_mobile`.

Until a column is migrated, its feature degrades quietly (per-photo colors don't
persist; mobile count mirrors desktop), but nothing breaks.

## Tuning Knobs

- `BAND` in `Carousel.tsx` (`computeSweepBackground`) — seam softness (~0.13).
- `visibleCount` defaults in `carouselConfig.ts` and the admin fields.
- Scale / `--perspective` / `--cardW` per breakpoint in `HomeHero.tsx`'s `<style>`.
- `.home-hero-bottom` `bottom` offsets — vertical placement of the form/buttons.

## Gotchas

- Do not reintroduce a client-side selection/settings bootstrap in `HomeHero`.
  The server-provided payload is deliberately the only set present before and
  after hydration; local products are resilience assets, not a staging set.
- The dev preview runs the tab **hidden** (rAF + CSS animation frozen) and reports
  a 0px viewport — verify motion, the desktop breakpoint, and live sizing in a real
  browser, not the embedded preview.
- `-webkit-line-clamp` on a flex item gets "blockified"; clamp an inner span.
- Background is painted per-frame imperatively, so there is **no** CSS `transition`
  on the hero background (it would lag the sweep).
