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

- **Mobile shop card cart button overflow fixed (2026-06-13):** shop gallery
  cart buttons now use tighter card-specific spacing and compact Add/Remove
  labels on slim mobile screens, preventing "Remove from Cart" overflow.
  Verified 320px and 375px mobile widths in-browser; `npm run build` passes.
- **Shop sort dropdown added (2026-06-13):** the shop filter pop-out now
  includes a Sort dropdown for inventory order, price low/high, price high/low,
  weight low/high, and weight high/low. Sorting is URL-backed via `sort` and
  preserves Available items before Sold items. Verified `/shop?sort=price-asc`
  and `/shop?sort=weight-desc` in-browser; `npm run build` passes.
- **Estate route redirect loop fixed (2026-06-13):** updated the Next proxy so
  internal English-locale rewrites keep the locale header on the second pass.
  `/estate-jewelry`, `/estate-services`, and Spanish equivalents now render
  without looping. Verified `/estate-jewelry` in-browser; `npm run build`
  passes.
- **Admin drag-to-reorder inventory added (2026-06-13):** product admin now
  shows an Order grip column in the clean master list. Dragging a row onto
  another row saves the reordered `sort_order` values to Supabase for the
  matching Available/Sold group, updating gallery inventory order. Sorting,
  search, and filters disable drag mode until the view is reset. Verified
  `/admin` render in-browser; `npm run build` passes.
- **Account profile full-name field hidden (2026-06-13):** removed the visible
  Full Name input from the complete account profile form while continuing to
  maintain `full_name` internally from first/last name. Verified `/account`
  in-browser; `npm run build` passes.
- **Complete customer profiles added (2026-06-13):** expanded account profiles
  with editable first/last/full name, contact email, phone, alternate phone,
  complete address, country, and marketing opt-in fields. Added
  `supabase/profile-contact-fields.sql` for existing Supabase projects and
  updated checkout prefill to use saved profile contact data. Verified
  `/account` render in-browser; `npm run build` passes.
- **Checkout account prefill added (2026-06-13):** checkout now looks up the
  signed-in Supabase user/profile and fills blank customer fields from known
  account data, including profile name, auth email, and phone metadata when
  present. Fields remain editable. Verified build and in-browser email prefill;
  `npm run build` passes.
- **Checkout-to-payment step added (2026-06-13):** removed the checkout
  secure-payment placeholder, changed the checkout submit button to "Continue
  to Payment," and added a new `/payment` route with payment fields plus a
  second shared order summary that carries the selected shipping option.
  Verified in-browser; `npm run build` passes.
- **Checkout shipping rates added (2026-06-13):** checkout shipping now prices
  Local Pickup at $0, Express Overnight Insured at $75, and Priority Insured at
  $45, with the selected shipping cost included in the estimated total.
  Verified in-browser; `npm run build` passes.
- **Checkout shipping option selector added (2026-06-13):** added a shipping
  dropdown under Florida sales tax in the checkout order summary with Local
  Pickup, Express Overnight, and Priority Insured options. Verified in-browser;
  `npm run build` passes.
- **Checkout summary remove control added (2026-06-13):** the right-hand
  checkout order summary now has a per-item remove button wired to the shared
  cart state, so removing an item updates the summary totals immediately.
  Verified in-browser; `npm run build` passes.
- **Shop length filter scoped by item type (2026-06-13):** length buttons now
  appear only after choosing Necklace or Bracelet in Item Type. Necklace shows
  chain lengths only, Bracelet shows bracelet lengths only, and server-side
  filtering ignores incompatible hidden length values. Verified in-browser;
  `npm run build` passes.
- **Shop length buttons made checkable (2026-06-13):** updated the horizontal
  length multi-select controls to read as checkable buttons with an embedded
  checked-state indicator while preserving URL-backed multi-select behavior.
  Verified in-browser; `npm run build` passes.
- **Shop card cart button alignment fixed (2026-06-13):** standardized gallery
  card title height and pushed action rows to the card bottom so cart buttons
  align consistently across cards with different title lengths. Card buttons
  now keep a fixed-height/no-wrap layout. Verified desktop/mobile in-browser;
  `npm run build` passes.
- **Shop length selector layout refined (2026-06-13):** moved the shop length
  multi-select out of the dropdown grid and into a horizontal row of selectable
  buttons underneath the main filter dropdowns. Verified in-browser;
  `npm run build` passes.
- **Shop length multi-select added (2026-06-13):** changed the shop gallery
  length filter from a single dropdown to a checkbox group so shoppers can
  select multiple lengths at once. The filter stays URL-backed with a stable
  comma-separated `length` value. Verified in-browser; `npm run build` passes.
- **Product detail scrap value added (2026-06-13):** individual shop product
  pages now show the current scrap gold/silver value directly under "This is
  your price," using the same live spot melt calculation as the trade-in callout.
  Verified in-browser; `npm run build` passes.
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
