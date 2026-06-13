# Current Status

> Reflects the present state of development. **Update this at the end of every
> work session.** Last updated: **2026-06-13**.

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
- **Live metal pricing** via
  `next-app/src/app/api/metal-prices/route.ts`,
  `next-app/src/lib/spot-price.ts`, and `next-app/src/lib/pricing.ts`.
- **Customer accounts** through Supabase Auth and Next routes
  `/account/sign-in`, `/account/sign-up`, and `/account`.
- **Admin and inquiries** through Next admin pages and API routes under
  `next-app/src/app/[locale]/admin*` and `next-app/src/app/api/inquir*`.
- **SEO** through Next metadata, `robots.ts`, and `sitemap.ts`.

## What Was Recently Completed

- **Shop card cart toggle updated (2026-06-13):** gallery card "Add to Cart"
  buttons now show a brief local "Added to cart" confirmation, switch to
  "Remove from Cart" after adding, and remove the item when clicked again.
  Verified in-browser; `npm run build` passes.
- **Admin inventory numbers added (2026-06-13):** added an "Inv #" column to
  the product admin table. Numbers are derived from the public shop's unfiltered
  master-gallery order: available items first, then sold items, preserving
  `sort_order` inside each group. Verified against `/shop`; `npm run build`
  passes.
- **Admin product table sorting added (2026-06-13):** made product admin table
  headers clickable for sorting by image presence, title, category, gender,
  chain type, length, purity, weight, price mode, current price, and status.
  Verified in-browser; `npm run build` passes.
- **Shop menu reorganized (2026-06-13):** changed the header Shop item into a
  dropdown/accordion with "Store" linking to `/shop` and "Auctions" linking to
  `/auctions`, and removed the standalone top-level Auctions nav item. Verified
  desktop/mobile in-browser; `npm run build` passes.
- **Checkout split into standalone page (2026-06-13):** changed the cart drawer
  to remain cart-only, moved checkout into a dedicated `/checkout` route with
  customer form/order summary/confirmation state, and made "Proceed to
  Checkout" navigate to that page. Verified in-browser; `npm run build` passes.
- **Auctions page and header link added (2026-06-13):** added a localized
  `/auctions` route, placed an Auctions nav item between Sell and About in the
  header, and added the page to the sitemap. Verified in-browser;
  `npm run build` passes.
- **About menu and Services page added (2026-06-13):** changed the header About
  nav item into a dropdown with "About Us" and "Other Services," added a new
  `/services` route with buttons to Free Evaluation and Estate Services, and
  added the route to the sitemap. Verified in-browser; `npm run build` passes.
- **Sell submenu labels updated (2026-06-13):** changed English header submenu
  labels to "Sell Us Gold," "Sell Us Silver," and "Sell Us Bullion." Verified
  the shop header in-browser; `npm run build` passes.
- **Header Sell label shortened (2026-06-13):** changed the English main
  header navigation label from "Sell To Us" to "Sell." Verified the shop header
  in-browser; `npm run build` passes.
- **Shop card price amount bolded (2026-06-13):** increased the gallery card
  price amount weight while keeping the "Your price" label bold. Verified
  computed styles in-browser; `npm run build` passes.
- **Shop card price label matched to price (2026-06-13):** changed the gallery
  card "Your price" label to match the price amount font size and bold weight.
  Verified computed styles in-browser; `npm run build` passes.
- **Shop card spacing/spec text refined (2026-06-13):** tightened the vertical
  space between gallery card titles and prices, and increased the purity/grams
  line size/weight. Verified rendered card spacing in-browser; `npm run build`
  passes.
- **Shop gallery widened for desktop (2026-06-13):** widened the shop page
  container and increased gallery density so desktop shows 4 columns, 2xl
  screens show 5 columns, and very wide screens show 6 columns. Verified at
  1440px, 1536px, and 1800px in-browser; `npm run build` passes.
- **Shop card action row simplified (2026-06-13):** removed the Inquire button
  from gallery product cards and changed the compact cart button label to “Add
  to Cart.” Verified in-browser; `npm run build` passes.
- **Shop card typography tuned (2026-06-13):** decreased gallery card product
  title size and increased the purity/grams spec line size for better scan
  balance. Verified computed card text sizes in-browser; `npm run build` passes.
- **Shop card price/spec display updated (2026-06-13):** changed gallery cards
  so the price row includes “Your price” beside the price and the former
  spot-price context line now shows each item’s purity and gram weight. Verified
  the shop cards in-browser; `npm run build` passes.
- **Shop live metal price strip added (2026-06-13):** added live silver and
  gold spot-price badges around the main shop search bar, using the existing
  `fetchSpotData` data already fetched for product pricing. Verified desktop
  and mobile layout in-browser; `npm run build` passes.
- **Shop item-type filter added (2026-06-13):** added an Item Type dropdown to
  the hidden shop filter panel for broad product categories such as necklaces,
  bracelets, earrings, rings, pendants, and watches. The filter is URL-backed
  via `itemType` and was verified in-browser; `npm run build` passes.
- **Shop filter panel collapsed behind button (2026-06-13):** updated
  `next-app/src/components/shop/ShopFilters.tsx` so the main shop keeps search
  and result count visible while hiding metal, purity, chain type, gender,
  length, and available-only controls behind a Filter button. Verified opening
  the panel and applying a filter in-browser; `npm run build` passes.
- **Product images fit without cropping (2026-06-13):** changed product image
  displays from cover/crop to contain/fit on shop cards, product detail
  galleries, admin thumbnails, cart thumbnails, and wishlist thumbnails. Updated
  gallery zoom math for contained images. Verified product/shop pages
  in-browser and `npm run build`.
- **Mobile product image magnification added (2026-06-13):** updated
  `next-app/src/components/shop/ProductImageGallery.tsx` so product-detail
  galleries support touch/pen press-and-drag zoom on mobile while preserving
  desktop hover zoom. Verified the product route in the in-app browser and
  confirmed `npm run build` passes.
- **English redirect loop fixed (2026-06-13):** updated `next-app/src/proxy.ts`
  so unprefixed English routes (`/`, `/shop`, etc.) rewrite internally to
  `/en/...` without being canonicalized back to themselves. Direct `/en` URLs
  still redirect to unprefixed canonical English URLs, and `/es` routes remain
  unchanged. Verified `npm run build` passes.
- **Legacy static site removed (2026-06-13):** deleted root static pages, `es/`,
  old vanilla scripts, root copied assets, old Netlify Function, static tooling,
  empty staging folders, old static admin, and unused create-next-app
  SVG/reference files.
- **Docs updated for the Next app (2026-06-13):** rewrote `AGENTS.md`,
  `ACCOUNT_SETUP.md`, `STRUCTURE.md`, `INTEGRITY.md`, and `ARCHITECTURE.md`;
  updated current status, tasks, changelog, overview, client notes, and root
  Netlify redirects.
- **Legacy removal audit (2026-06-13):** generated
  `project-docs/LEGACY_REMOVAL_REPORT.md`, identifying current Next runtime
  files, root static-site deletion candidates, files to keep, and the cleanup
  plan.

## Current Priorities

1. Run a Netlify preview smoke test after the cleanup deploy.
2. Continue pruning/revising older `project-docs/features/*` files that still
   describe the retired static site.
3. Keep Supabase product inventory current through the Next/Supabase product
   flow.
4. Confirm Supabase Auth redirect URLs include `https://naplesestatejewelry.co/**`
   and localhost dev URLs.
5. Fill in unknowns in `CLIENTS.md` (Netlify site name/ID, DNS registrar,
   maintenance plan, billing status, credential locations).

## Active Blockers

- No CI is documented yet beyond Netlify running `npm run build`.
- A production preview smoke test is still needed after this cleanup.

## Verification

- Last known good local command before ending this cleanup session should be:
  `npm run build` from `next-app/`.
