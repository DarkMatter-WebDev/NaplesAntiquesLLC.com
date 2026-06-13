# Tasks

> Move tasks between sections as work progresses. Keep it current at the end of
> every session. Newest/most important first within each section.

## Backlog

- Do a Netlify preview smoke test after the legacy cleanup deploy:
  `/`, `/es`, `/shop`, one product page, `/contact`, `/free-evaluation`,
  `/account/sign-in`, `/admin`, `/api/metal-prices`, `/robots.txt`,
  `/sitemap.xml`.
- Continue pruning or rewriting older feature docs in `project-docs/features/`
  that still describe the retired static site.
- Verify Supabase **Auth -> URL configuration** redirect URLs include
  `https://naplesestatejewelry.co/**`, `http://localhost:3000/**`, and
  `http://127.0.0.1:3000/**`.
- Fill in unknowns in `CLIENTS.md` (Netlify site name/ID, DNS registrar,
  maintenance plan, billing status, credential locations).
- Keep Supabase product inventory current through the Next/Supabase product
  flow.
- Expand shop beyond gold (silver / diamonds / antiques categories) when
  inventory is ready.
- Consider real checkout/payments (for example Stripe) vs. the current
  contact-to-buy flow.
- Add basic analytics if not already present.
- Confirm whether a self-hosted metal-price API key/rate limit is needed for
  production traffic.

## In Progress

- (None)

## Completed

- **Shop card cart toggle updated** (2026-06-13): gallery Add to Cart buttons
  now show a brief local confirmation, switch to Remove from Cart after adding,
  and remove the item on the next click. Verified in-browser and `npm run build`.
- **Admin inventory numbers added** (2026-06-13): added an "Inv #" admin table
  column tied to the unfiltered public shop gallery order. Verified against
  `/shop` and `npm run build`.
- **Admin product table sorting added** (2026-06-13): made product admin table
  headers clickable for sorting by each data column, including numeric current
  price sorting. Verified in-browser and `npm run build`.
- **Shop menu reorganized** (2026-06-13): changed Shop into a header
  dropdown/mobile accordion with Store (`/shop`) and Auctions (`/auctions`), and
  removed Auctions as a standalone top-level nav item. Verified desktop/mobile
  in-browser and `npm run build`.
- **Checkout split into standalone page** (2026-06-13): changed the cart drawer
  to stay cart-only, moved checkout into `/checkout`, and made the drawer's
  "Proceed to Checkout" action navigate to the standalone page. Verified
  in-browser and `npm run build`.
- **Auctions page and header link added** (2026-06-13): added a localized
  `/auctions` route, placed Auctions between Sell and About in the header, and
  added the route to the sitemap. Verified in-browser and `npm run build`.
- **About menu and Services page added** (2026-06-13): changed the header About
  item into a dropdown with "About Us" and "Other Services," added `/services`
  with buttons to Free Evaluation and Estate Services, and added the route to
  the sitemap. Verified in-browser and `npm run build`.
- **Sell submenu labels updated** (2026-06-13): changed English header submenu
  labels to "Sell Us Gold," "Sell Us Silver," and "Sell Us Bullion." Verified
  in-browser and `npm run build`.
- **Header Sell label shortened** (2026-06-13): changed the English main
  header nav label from "Sell To Us" to "Sell." Verified in-browser and
  `npm run build`.
- **Shop card price amount bolded** (2026-06-13): increased the gallery card
  price amount font weight. Verified computed styles in-browser and
  `npm run build`.
- **Shop card price label matched to price** (2026-06-13): made "Your price"
  the same font size and bold weight as the price amount. Verified computed
  styles in-browser and `npm run build`.
- **Shop card spacing/spec text refined** (2026-06-13): tightened the gallery
  card title-to-price spacing and increased the purity/grams line size/weight.
  Verified rendered card metrics in-browser and `npm run build`.
- **Shop gallery widened for desktop** (2026-06-13): widened the shop page
  container and adjusted responsive columns so the gallery shows more listings
  per row on large and widescreen desktop displays. Verified 1440px, 1536px,
  and 1800px in-browser and `npm run build`.
- **Shop card action row simplified** (2026-06-13): removed the Inquire button
  from gallery cards and changed the card cart button to “Add to Cart.”
  Verified in-browser and `npm run build`.
- **Shop card typography tuned** (2026-06-13): decreased the gallery card title
  font size and increased the purity/grams spec line size. Verified in-browser
  and `npm run build`.
- **Shop card price/spec display updated** (2026-06-13): gallery cards now show
  “Your price” beside the price and replace the spot-context line with purity
  and grams. Verified in-browser and `npm run build`.
- **Shop live metal price strip added** (2026-06-13): displayed live silver to
  the left of the shop search bar and live gold to the right, reusing existing
  spot-price data. Verified desktop/mobile layout in-browser and
  `npm run build`.
- **Shop item-type filter added** (2026-06-13): added a URL-backed Item Type
  dropdown to the shop filter panel for necklaces, bracelets, earrings, rings,
  pendants, and watches. Verified Bracelet filtering in-browser and
  `npm run build`.
- **Shop filters collapsed behind Filter button** (2026-06-13): hid the metal,
  purity, chain type, gender, length, and available-only controls until the
  shopper opens the Filter panel. Verified panel open and filter application
  in-browser; `npm run build` passes.
- **Product images fit without cropping** (2026-06-13): product photos now use
  fit/contain rendering across shop cards, detail galleries, admin thumbnails,
  cart thumbnails, and wishlist thumbnails; gallery zoom accounts for contained
  image bounds. Verified in-browser and `npm run build`.
- **Mobile product image magnification added** (2026-06-13): product detail
  images now support touch/pen press-and-drag zoom on mobile, with the floating
  magnifier offset away from the finger. Desktop hover zoom still works.
  Verified the product route in-browser and `npm run build`.
- **English redirect loop fixed** (2026-06-13): patched the Next proxy so
  unprefixed English URLs render successfully, direct `/en` URLs canonicalize
  once to unprefixed paths, and Spanish prefixed URLs continue to work. Verified
  `/`, `/shop`, `/en`, `/en/shop`, `/es`, `/es/shop`, and `npm run build`.
- **Legacy static site removed** (2026-06-13): deleted root static pages, `es/`,
  old vanilla scripts, root copied assets, old Netlify Function, obsolete static
  tooling, empty staging folders, old static admin, and unused Next starter
  SVG/reference assets.
- **Docs updated for Next cleanup** (2026-06-13): rewrote `AGENTS.md`,
  `ACCOUNT_SETUP.md`, `STRUCTURE.md`, `INTEGRITY.md`, and `ARCHITECTURE.md` for
  the Next.js app; updated current status, changelog, overview, client notes,
  and root Netlify redirects.
- **Legacy removal audit completed** (2026-06-13): generated
  `project-docs/LEGACY_REMOVAL_REPORT.md`, confirmed root Netlify config builds
  from `next-app`, confirmed the Next shop uses Supabase `products`, checked
  mirrored assets, and verified `npm run build` passes from `next-app/`.
- Created the `project-docs/` memory framework (2026-06-01).
