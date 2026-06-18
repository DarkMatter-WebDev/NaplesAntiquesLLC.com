# Jewelry Carousel — Implementation Handoff (React/Next.js + Supabase)

A 3D rotating photo carousel for the storefront, populated from the Supabase
`products` table. A **store admin** curates which pieces appear (and in what
order) via a form in the admin settings; every shopper sees that same curated,
ordered set. The carousel shows **images only on a white background by
default**, and the admin form can change the **background color** and toggle
showing each piece's **price**.

This package ships the storefront component + all data/SQL plumbing **done**.
The **admin form UI is specified, not built**, so you can implement it to match
the site's existing design system (see §6).

---

## 1. What's in this package

| File | Purpose | Status |
|---|---|---|
| `components/Carousel.tsx` | Storefront 3D carousel (the visual widget) | ✅ ready |
| `components/Carousel.module.css` | Scoped 3D styles for the carousel | ✅ ready |
| `lib/supabaseClient.ts` | Shared browser Supabase client | ✅ ready |
| `lib/carouselConfig.ts` | Column mapping (wired to your schema) | ✅ ready |
| `lib/carouselData.ts` | All data fns: fetch products, selection, settings | ✅ ready |
| `sql/inspect-schema.sql` | Read-only schema inspector (already used) | reference |
| `sql/setup.sql` | Creates selection + settings tables, RLS policies | ▶ run once |
| `HANDOFF.md` | This document | — |

The carousel renders a cylinder of portrait cards on a cream backdrop with a
soft lateral fade, spinning continuously (32s/rotation, slowed to 128s when the
user prefers reduced motion). Cards are clickable links to each product page.

---

## 2. Prerequisites

- **Dependency:** `@supabase/supabase-js` (v2). Install if not present:
  `npm i @supabase/supabase-js`
- **Env vars** (`.env.local`):
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://evzluixourmsefwdsieu.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
  ```
- **Place the files** under your project. Paths assume `lib/` and `components/`
  at the import roots used in the files (`../lib/...`). If you use a path alias
  like `@/`, adjust imports accordingly.

---

## 3. Step one — run the SQL

Open `sql/setup.sql` in the Supabase SQL editor and run it once. It creates:

- **`carousel_selection`** — `product_id text` (FK → `products.id`) + `position int`.
  Holds which products are featured and their order.
- **`carousel_settings`** — single row with `show_price boolean` (default false)
  and `bg_color text` (default `#ffffff`).

It also enables **row-level security**: anyone (anonymous or a logged-in
shopper) can *read* both tables (so the storefront works), but **only the store
admin — the account logging in with `rcman12589@aol.com` — can *write*** (curate
the carousel). This is enforced at the database level by the `is_carousel_admin()`
function, so even a logged-in shopper crafting raw requests cannot edit it.

To change the admin email later: edit the address in `is_carousel_admin()` in
`sql/setup.sql` **and** `ADMIN_EMAIL` in `lib/carouselConfig.ts`, then re-run
that function statement.

---

## 4. Step two — confirm the config

`lib/carouselConfig.ts` is already mapped to your `products` schema:

| Carousel field | Your column | Notes |
|---|---|---|
| id | `id` | text/slug primary key |
| image | `images` | JSON array — **first** entry is used |
| name | `title` | used as alt text + (optional) caption |
| price | `price_label` | preformatted string (e.g. `"$4,033.18"`); may be null |
| link | `id` | builds the product href |
| status | `status` | only `"available"` rows are shown |

**Current route mapping:** `productHref()` builds links as `/shop/{id}`, which
matches this Next app's public product detail route.

Notes on your data:
- Images are a mix of full Supabase Storage URLs and site-relative
  `/assets/...` paths. Both render as-is on your own domain — handled.
- Spot-priced items have a `null` `price_label`; with the price toggle on, those
  cards simply show no price (we don't recompute live spot prices here).

---

## 5. Step three — drop the carousel on the storefront

```tsx
import { Carousel } from "@/components/Carousel";

export default function FeaturedSection() {
  // images only, square cards, white bg — honors the admin's saved settings
  return <Carousel />;
}
```

Props (all optional):

| Prop | Default | Purpose |
|---|---|---|
| `spin` | `32` | seconds per full rotation |
| `cardWidth` | `17.5` | base card width (em) |
| `aspect` | `"1 / 1"` | card aspect ratio (square default; e.g. `"7 / 10"` for portrait) |
| `perspective` | `35` | em; smaller = more extreme 3D |
| `bg` | *(saved setting → white)* | force background color, ignoring the saved one |
| `showPrice` | *(saved setting → off)* | force price caption on/off, ignoring the saved toggle |
| `items` | *(fetched)* | supply `CarouselItem[]` directly to bypass Supabase (great for a live admin preview) |

The component is a client component (`"use client"`) and fetches the selection +
display settings (background color, show-price) on mount. It renders graceful
empty/error states.

**Click-through:** each card is a link to that product's detail page
(`/shop/{id}`, configurable via `productHref()` in `carouselConfig.ts`).
The spin **pauses while the viewer hovers** so a card is easy to click, and
clickable cards get a pointer cursor + subtle hover lift.

> Note: cards use a plain `<a>` tag for portability, which does a full page
> navigation. For client-side (SPA) navigation, swap the `<a>` in
> `Carousel.tsx` for Next's `<Link>` — the `href` value is already correct.

---

## 6. Step four — build the admin selection form (your design)

Build this inside your existing admin settings area, styled to match the site.
**All the data work is already done** — you only build UI on top of the
functions in `lib/carouselData.ts`. Do **not** re-query Supabase by hand; use
these:

```ts
import {
  fetchAllProducts,   // (search?: string, limit?: number) => Promise<CarouselItem[]>
  fetchSelectionIds,  // () => Promise<string[]>  (current selection, in order)
  saveSelection,      // (orderedIds: string[]) => Promise<void>
  fetchSettings,      // () => Promise<{ showPrice: boolean; bgColor: string }>
  saveSettings,       // (s: { showPrice: boolean; bgColor: string }) => Promise<void>
  type CarouselItem,  // { id, imageUrl, name, priceLabel, href, status }
} from "@/lib/carouselData";
```

### Required behavior
1. **On load:** call `fetchAllProducts()`, `fetchSelectionIds()`, and
   `fetchSettings()`. Seed local state from them.
2. **Browse + search:** show available products (use `item.imageUrl` for the
   thumbnail, `item.name` for the label). Wire the search box to
   `fetchAllProducts(searchText)` (debounced) — it filters by title server-side
   and already returns only `available` products.
3. **Select / deselect:** clicking a product toggles its membership in the
   selection. Track the selection as an **ordered list of ids** (order = the
   carousel's left-to-right order).
4. **Reorder:** let the admin reorder the selected items (drag-and-drop or
   simple up/down buttons). Order maps directly to `position`.
5. **Display options:**
   - a "Show price on carousel" toggle bound to `showPrice`;
   - a **background color** input (`<input type="color">` and/or a few preset
     swatches) bound to `bgColor`. Default is white (`#ffffff`).
6. **Save:** on submit, call `saveSelection(orderedIds)` **and**
   `saveSettings({ showPrice, bgColor })`. Show success / error feedback.
   Disable the button while saving.
7. **States:** handle loading, empty catalog, and error (surface the thrown
   `error.message`).

### Recommended (optional)
- **Live preview:** render
  `<Carousel items={selectedItemsInOrder} showPrice={showPrice} bg={bgColor} />`
  beside the form so the admin sees the exact result (including background and
  price) before saving. Build `selectedItemsInOrder` by mapping the ordered ids
  back to their `CarouselItem`s from `fetchAllProducts()` results.
- Show a count / cap hint (e.g. "8–12 pieces looks best").

### Auth requirement
Writes (`saveSelection`, `saveSettings`) succeed **only** for the admin email
(`rcman12589@aol.com`), enforced by RLS — a non-admin's save will be rejected by
the database. For UX, **gate the admin form** with the provided helper so
shoppers never see it:

```ts
import { isCurrentUserAdmin } from "@/lib/carouselData";

const [isAdmin, setIsAdmin] = useState(false);
useEffect(() => { isCurrentUserAdmin().then(setIsAdmin); }, []);
if (!isAdmin) return null; // or redirect / 404
```

`supabase` must carry the logged-in session (it does automatically with the
supabase-js client once the user has signed in).

### Implementation notes
- `saveSelection` does a delete-all-then-insert (not a single transaction).
  Fine for a single admin saving occasionally; if you expect concurrent admins,
  wrap it in an RPC/Postgres function instead.
- `fetchAllProducts` caps at 200 rows by default — raise the `limit` arg or add
  pagination if the catalog is larger and you want everything browsable.

---

## 7. Security / RLS

`sql/setup.sql` grants **public read** (needed for the storefront) and
**admin-only write**, where "admin" = the account whose email is
`rcman12589@aol.com`. This is correct for a site where shoppers also have
accounts: a logged-in shopper can browse the store but cannot edit the carousel,
because the `is_carousel_admin()` check in the RLS policies only passes for the
admin email.

- Enforcement is at the **database** level — even hand-crafted API requests from
  a non-admin session are rejected.
- The client also hides the admin UI via `isCurrentUserAdmin()` (§6), but that's
  convenience only; the DB policy is what protects the data.
- To change the admin (or add more), edit `is_carousel_admin()` in
  `sql/setup.sql` (e.g. `email in ('a@x.com','b@x.com')`) and `ADMIN_EMAIL` in
  `lib/carouselConfig.ts`, then re-run the function statement.

The anon key in the browser is safe **only because** RLS restricts it — don't
disable RLS, and never ship the service-role key to the client.

---

## 8. Tuning & gotchas

- **Container height:** the carousel fills 80vh by default (set in
  `Carousel.module.css` `.scene`). Change `block-size` there to resize.
- **Browser support:** uses CSS `tan()` and `rotate: y` syntax — Chrome/Edge
  111+, Safari 16.4+, Firefox 128+. Fine for current evergreen browsers.
- **Sharper images:** images come straight from your `images` array at their
  stored resolution; no transform is applied.
- **Schema cache:** after running `setup.sql`, the embedded `products` join
  needs PostgREST to know the FK. The SQL ends with `notify pgrst, 'reload
  schema';`; if the join 404s, reload the schema from the Supabase dashboard.

---

## 9. Verification done so far
The 3D visual was rendered and confirmed: the spinning cylinder, lateral fade,
rounded **square** cards, and **white** backdrop all display correctly. The
Supabase wiring is mapped to the live `products` schema you provided (text id,
`images` array, `price_label`, `slug`, `status`). End-to-end data flow
(selection, settings, click-through) should be verified in your app once
`setup.sql` is run and the admin form is built.
