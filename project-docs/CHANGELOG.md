# Changelog

## 2026-07-28 - Audited equal Available and Sold shop counts

- Reproduced Silver + Everything Else with Available and Sold selected in the
  local preview. Both views report `29 of 127 pieces` and paginate as
  `Showing 1-24 of 29`.
- Confirmed the URLs, selected radios, product status badges, first products,
  and price ranges all change correctly between the two views. The current
  catalog genuinely contains 29 matching products in each status.
- Verified in source that status participates in the database query, cache key,
  and final in-memory filter. The numerator is the filtered result count; the
  denominator deliberately remains the whole visible public inventory.
- No application code, database data, or production configuration changed.

## 2026-07-28 - Verified all security SQL after owner rerun

- Re-ran the live read-only Supabase privilege and catalog probes after the
  owner applied the scripts again. Both subscriber RPCs and the rate-limit RPC
  are blocked for `anon`/`authenticated` and remain executable by
  `service_role`.
- Confirmed the rate-limit function is `SECURITY DEFINER`, pins
  `search_path=public`, contains parameter validation, upsert behavior, and the
  current deterministic one-percent/one-day cleanup, and has
  `rate_limits_window_start_idx`.
- Reconfirmed all seven internal product columns are unreadable to
  `authenticated` while `products.id` remains readable. Every final verification
  boolean returned true.
- The owner deferred the currently missing Cloudflare Stream, OpenAI
  server-voice, and scheduled-Etsy variables because those features are not
  priorities for this deployment.
- No application code or additional production state was changed during this
  verification.

## 2026-07-28 - Audited live SQL hardening and Netlify variable names

- Ran read-only production catalog/privilege probes in Supabase. The
  authenticated product internal-column hardening is fully applied.
  Subscriber hardening is incomplete because the subscribe RPC remains
  executable by `anon` and `authenticated`, although unsubscribe is blocked.
  Rate-limit execution grants, `SECURITY DEFINER`, and `search_path=public` are
  correct, but the latest cleanup logic and supporting index are absent.
- Inspected the `naplesantiques` Netlify environment-variable configuration by
  key name only; no values were revealed or recorded. Core Supabase, URL,
  email, PayPal, Anthropic AI, Etsy, and eBay entries are present. The four
  documented Cloudflare Stream variables, `OPENAI_API_KEY`, and
  `ETSY_CRON_SECRET` are absent, with the latter two affecting only
  server-generated read-aloud and optional scheduled Etsy price pushes.
- No application code, database rows, database definitions, environment
  variables, or deployed site content were changed.

## 2026-07-27 - Cleared production build and dependency blockers

- Revalidated the findings before editing against current Next.js guidance,
  GitHub advisories, live npm registry versions, a fresh production audit, and
  the current failing build.
- Moved the reusable shop renderer and metadata helper out of the special
  `page.tsx` route module into colocated `shop-page-renderer.tsx`. The route now
  exposes only valid Next exports, while `/shop-modern` imports the shared
  renderer directly.
- Updated Next.js and `eslint-config-next` to 16.2.12 and Sharp to 0.35.3.
  Production overrides pin PostCSS 8.5.23 and Sharp 0.35.3 throughout nested
  dependencies, including Next's bundled image dependency.
- Confirmed `npm audit --omit=dev` reports zero vulnerabilities. The full audit
  retains nine development-only findings through ESLint 9's old matching
  stack. The suggested ESLint 10 upgrade was tested, rejected, and reverted
  because Next's stable React lint plugins fail at rule startup; the supported
  ESLint 9 configuration passes.
- All 452 tests and lint passed. Next.js completed TypeScript, generated all 419
  static pages, and exited 0. English/Spanish shop routes, `/shop-modern`, the
  affected multi-image detail page, checkout, contact, auth redirect, and metal
  prices returned expected responses. Desktop shop and 390px product-detail
  browser checks found no console warnings/errors or horizontal overflow.

## 2026-07-27 - Audited manual-deploy readiness without code changes

- Ran the full 452-test suite and lint; both passed.
- Re-ran the exact Netlify build command. Compilation succeeded, but Next's
  generated route contract still rejected the named `renderShopPage` export
  from the shop route module, so the project is not deploy-ready.
- Re-ran production and full dependency audits. The production audit reported
  high-severity findings in Next.js 16.2.10, PostCSS 8.5.15, and Sharp 0.34.5;
  the full audit reported 14 high-severity findings including development
  tooling.
- A parallel cold-preview probe reproduced the intermittent development JSON
  parse failure. Both translation JSON files validated, and after a clean
  preview restart, sequential checks returned 200 for English/Spanish home and
  shop, the affected multi-image detail page, checkout, contact, and metal
  prices; Admin correctly redirected to sign-in. Mobile-user-agent checks also
  returned the expected shop/detail content without a server-error response.
- No application code, configuration, database, or site content changed.

## 2026-07-24 - Added AI change confirmation and read-aloud

- Added an application-enforced review classifier after every AI listing
  response. Only high-confidence descriptive values entering blank fields can
  auto-apply; every overwrite, sensitive fact, and low/medium/missing-confidence
  value remains pending until the admin chooses Accept Proposed.
- Added per-field Current/Proposed review cards, Keep Existing, Accept Proposed,
  Keep All, and Accept All controls. Warnings, uncertainties, and unchanged
  values without high confidence now produce deterministic clarification
  questions rather than relying only on model behavior.
- Updated prompt v18 to require confidence for every populated field while
  keeping the server-side classifier authoritative.
- Added Read Aloud/Stop to every assistant response plus an optional persisted
  automatic-play preference. The authenticated `/api/admin/ai-speech` route
  streams `gpt-4o-mini-tts` audio with the `marin` default voice and keeps the
  API key server-side; the browser falls back to its built-in voice if the
  service is unavailable.
- A live Admin test produced two overwrite proposals and confirmed neither
  changed the form initially. Accepting one changed only that field, keeping
  the other preserved its original value, Undo restored the accepted field,
  and read-aloud exposed working playback/Stop controls through the local
  device fallback. The test draft was closed without saving.
- Eighteen focused tests and all 452 tests passed; lint passed. `npm run build`
  compiled successfully before the unchanged `renderShopPage` route-contract
  error stopped type checking.

## 2026-07-24 - Replaced Available-only toggle with status radios

- Replaced the public shop's `Available only` checkbox with mutually exclusive
  `Available` and `Sold` radio controls (`Disponible` / `Vendido` in Spanish).
- A missing, invalid, or Available status now resolves to Available-only
  inventory; Sold inventory appears only when the shopper explicitly selects
  Sold. Clear Filters therefore returns to Available rather than showing both
  statuses.
- Available is not counted as an extra active filter because it is the shop's
  default state; Sold is counted and remains URL-backed as `?status=sold`.
- Browser checks confirmed the default, Available → Sold → Available round
  trip, exclusive checked state, matching results, and Spanish labels.
- The focused 18-test filter suite, all 443 tests, and lint passed.
  `npm run build` compiled successfully before the unchanged
  `renderShopPage` route-contract error stopped type checking.

## 2026-07-24 - Made homepage carousel server-authoritative

- Moved the public homepage carousel selection/settings read into the server
  render. The first HTML now contains the current Supabase-curated products,
  and `HomeHero` no longer fetches a second image set after hydration.
- Kept the six bundled products strictly as a server-query/empty-selection
  fallback, so a Supabase outage can still render a usable hero without
  introducing a normal-load handoff.
- Added a five-minute tagged server cache and an authenticated admin
  revalidation endpoint. Saving carousel settings now expires that cache
  immediately; a failed invalidation still self-recovers within five minutes.
- Added three payload-resolution regression tests. Six preview reloads all
  started with the curated Rolex item and never contained the fallback name or
  path; direct initial-HTML inspection confirmed the same. The preview console
  had no warnings/errors.
- `npm run lint` passed and the full suite passed all 442 tests.
  `npm run build` compiled successfully before the unchanged
  `renderShopPage` route-contract error stopped type checking.

## 2026-07-24 - Audited homepage carousel image handoff

- Confirmed the homepage does not currently load from one authoritative image
  set. Initial HTML renders six hard-coded fallback products, then client-side
  Supabase reads replace them with the current admin-curated selection.
- Eight local reload traces showed the fallback DOM for 296–828 ms, always at
  opacity 0 under normal-motion settings before the curated set appeared.
- The deployed homepage reproduced the same sequence. Its Netlify-cached
  initial HTML contained fallback names and no current curated Rolex image,
  while the settled browser showed the curated set.
- Reduced-motion CSS bypasses the hidden/loading state, providing a concrete
  path for the fallback set to flash before replacement. Browser cache may
  affect timing, but it is not the root cause.
- Audit only: no application code, configuration, database rows, or carousel
  settings changed. Tests, lint, and build were not rerun.

## 2026-07-24 - Added iterative AI listing feedback

- Converted the Smart Listing Assistant from one-shot generation into a
  multi-turn conversation inside Add/Edit Listing.
- Every turn now sends the current form as its baseline, returns a complete
  revised draft, explains changes and limitations, and asks targeted questions
  for missing required or conflicting facts.
- Typed and spoken follow-up replies can repeatedly revise the listing. Undo
  restores the form before the latest AI turn, and opening another listing
  clears the conversation so product context cannot leak.
- The conversation is bounded request context only; no schema or database
  storage was added, and nothing persists until the admin uses the normal Save
  action.
- A real two-turn Admin preview asked four relevant questions, accepted the
  answers, preserved requested values, and shortened the description. Nine
  focused tests, all 439 tests, and lint passed. The production build compiled
  before the unchanged `renderShopPage` route-contract error stopped type
  checking.

## 2026-07-24 - Restored shop position from product details

- Product links in both gallery and list shop views now remember the exact
  localized shop URL and scroll position for the active browser tab.
- Back to Shop returns to that remembered page, filters, and position when the
  buyer came from the same shop product; direct detail-page entries continue to
  use the normal shop fallback.
- Focused return-state tests passed (2), `npm test -- --run` passed all 437
  tests, `npm run lint` passed, and a browser check returned from page 2 to
  1,150px. `npm run build` compiled before the unchanged `renderShopPage`
  route-contract error stopped type checking.

## 2026-07-24 - Fixed customer-page reveal deadlock

- Updated the shared customer reveal to ignore intentionally lazy images and
  reveal after 1.4 seconds even when a non-lazy image or background stalls.
- The 15-image Egyptian silver tray now remains visible at 390px while
  offscreen thumbnails remain deferred.
- Audited 28 public English/Spanish routes at 390px: no pending/hidden reveal
  containers and no browser console warnings/errors.
- `npm run lint` and `npm test -- --run` (435 tests) passed. `npm run build`
  compiled successfully before the unchanged `renderShopPage` route-contract
  error stopped type checking.

## 2026-07-24 - Confirmed local development preview

- Started the Next.js development server at `http://localhost:3000`.
- Browser smoke-checked the homepage and `/shop`; both rendered successfully.
- No source, database, or customer-data changes were made.

## 2026-07-24 - Diagnosed mobile product-detail blank state

- Reproduced the affected product at a 390px viewport.
- Confirmed the route returned HTTP 200 with no browser console errors.
- Found the shared customer-reveal wrapper waiting on offscreen lazy gallery
  thumbnails, leaving the product content at `opacity: 0` after the initial
  flash. No source, database, or customer-data changes were made.

## 2026-07-23 - Removed Admin Products summary cards

Removed the shared Admin Products block that displayed the Total, Available,
and Sold inventory boxes. The inventory table and filters remain unchanged, and
the removal applies to all viewport sizes. `npm run lint` passed; `npm run build`
compiled successfully but still stops at the known generated `renderShopPage`
route-contract error.

## 2026-07-23 - Locked Admin Products to viewport

Changed the Admin Products shell to a fixed dynamic-viewport flex layout. The
page no longer scrolls at the document level; only the product table wrapper
scrolls vertically and horizontally. `npm run lint` passed, and the preview
confirmed the document/body height matches the viewport.

## 2026-07-23 - Changed nav icons to icon-only motion

Removed the remaining nav-icon hover shadow and container lift. Desktop Saved
Items and Cart now retain color feedback while moving only the Material Symbol
glyph itself, with press scaling on the glyph. `npm run lint` passed and the
desktop preview confirmed transparent backgrounds and no button box shadow.

## 2026-07-23 - Removed nav icon hover background fill

Removed the pale yellow hover background from the desktop Saved Items and Cart
nav buttons while preserving their color, shadow, lift, and press feedback.
`npm run lint` passed, and the refreshed desktop preview confirmed transparent
nav-icon backgrounds with no hover background declaration.

## 2026-07-23 - Added desktop button hover affordances

Audited the public storefront and added desktop hover/press feedback to the
header Saved Items and Cart controls, newsletter Join, shop-card wishlist and
list-view cart actions, product gallery thumbnails, account/contact/cart
dismissals, and checkout address/quantity controls. Mobile-only menu and cart
controls were intentionally left outside this pass. `npm run lint` passed. The
app compiled during `npm run build`, which still stops at the known generated
route-contract error for `renderShopPage`.

## 2026-07-23 - Compacted and reconciled project memory

Converted the three mandatory startup files from cumulative session archives
into bounded current references. `CURRENT_STATUS.md` now describes the present
system and known deployment/build state, `TASKS.md` contains open work plus a
short recent-completions summary, and `DECISIONS.md` contains only durable
decisions that still govern the project. This removed roughly 800 KB of
duplicated startup reading while preserving the full dated history in this
changelog and feature-specific detail in the existing runbooks.

Reconciled `README.md`, `PROJECT_OVERVIEW.md`, `STRUCTURE.md`, `INTEGRITY.md`,
`ARCHITECTURE.md`, `CLIENTS.md`, and the Etsy/eBay feature docs. Corrections
include the current 6% Florida tax basis, centralized shipping/address modules,
separate marketplace status actions, applied marketplace schemas, PayPal
environment ownership, the known `renderShopPage` build blocker, and the
source-of-truth folder's no-git workflow.

Removed only three verified generated artifacts: two stale July 17 dev-server
logs and the regenerable TypeScript build cache. Retained both marketplace plan
folders because code, SQL, and runbooks actively reference them. Retained root
`banner.png` because visual inspection proved it is a newer, materially
different candidate than the shipped eBay WebP; its remaining website URL and
owner decision are now explicit in `TASKS.md`.

Verification was documentation-focused: generated artifacts were rechecked as
absent, startup-memory sizes and links/references were audited, and stale
cross-document phrases were searched. No app code, SQL, environment, customer
data, product data, order, or payment changed, so app tests/build were not
rerun; the current 435-test/lint/build baseline remains in
`CURRENT_STATUS.md`.

## 2026-07-23 - Included shipping in Florida sales tax

Changed the owner-selected Florida tax policy so charged shipping is included
in the 6% taxable base. Local Pickup remains merchandise-only in practice
because its fee is $0, and non-Florida shipping continues to receive $0 Florida
tax.

Added `calculateFlSalesTax` as the shared calculation for customer checkout,
authoritative PayPal pricing, cart estimates, and admin manual orders. Updated
order-detail and invoice discount recalculation to infer the stored rate against
merchandise plus shipping.

Rendered checks confirmed exact totals for Local Pickup, $45 Priority Insured,
$75 Express Overnight Insured, and a California destination. All 435 tests and
lint pass. The production build compiled in 12.3 seconds before the unchanged
generated `renderShopPage` route-export type error. No SQL, orders, payments, or
customer/product data changed.

## 2026-07-23 - Hardened domestic checkout shipping

Restricted checkout delivery to U.S. addresses and replaced free-text State
with a canonical selector for all 50 states plus D.C. ZIP input now validates
five-digit and ZIP+4 formats, canonicalizes nine-digit values, and shows a
specific inline error. The create-order route independently normalizes the
address and rejects missing fields, state typos, invalid ZIPs, international
countries, and unknown shipping methods before creating any order.

Moved Local Pickup ($0), Priority Insured ($45), and Express Overnight Insured
($75), including labels, default, validation, and database mapping, into
`src/lib/checkout-shipping.ts`. The browser summary and authoritative server
pricing now consume one definition.

Florida DOR guidance was rechecked during this work. The owner subsequently
superseded the merchandise-only calculation with the shipping-tax policy
recorded above. County surtax was intentionally left unchanged. Browser checks
confirmed Florida and California estimates, ZIP+4 normalization, and the fixed
U.S. country. Four tampered API requests returned the intended 400 errors.

## 2026-07-23 - Audited checkout shipping and sales-tax handling

Performed a read-only implementation, legal-source, and aggregate-order audit.
The checkout currently charges 6% for local pickup or an entered Florida state,
zero for other states, and separately adds server-authoritative $45 priority or
$75 express insured shipping. PayPal receives a reconciled merchandise, tax,
shipping, and total breakdown. Florida guidance supports leaving the optional,
separately stated shipping fee outside the taxable base.

The audit found that Florida destination-county surtax is not implemented and
that free-text state input can turn a misspelled Florida destination into a
zero-tax order. It also found duplicated UI/server shipping definitions,
domestic flat fees available to arbitrary two-letter countries, a flat 6%
pre-address mini-cart estimate, and no jurisdiction/parity regressions.

The website has one paid shipped order in 2026: $1,986.61 merchandise to
California with $75 shipping and no tax. This is far below California's
$500,000 remote-seller threshold, but California counts marketplace sales, so
the owner's Etsy/eBay and other-channel totals remain part of the nexus review.
Five focused checkout/PayPal tests pass. No application code, SQL, orders, or
customer/product data changed.

## 2026-07-23 - Audited shop thumbnail delivery before deployment

Performed a read-only code, browser, and response-header audit of gallery and
list thumbnails. The 96-item gallery mounts one cover per card, uses responsive
Next image candidates for 81 remote covers, and keeps 15 local WebP covers
between 17.3 and 56.5 KiB. First-row images are preloaded, later images remain
lazy, offscreen cards use `content-visibility`, and carousel neighbors mount
only after interaction.

Normal desktop and mobile scroll passes had no pending visible thumbnails. Only
deliberate multi-thousand-pixel jumps briefly outran lazy loading, and those
images completed within 250 ms. A sampled live Netlify 256 px transform was a
3,992-byte WebP with `public,max-age=3600` and a confirmed edge hit. Two
development LCP warnings identified second-row/large-jump lazy images as a
minor optional tuning opportunity. No application code, SQL, or data changed;
tests and builds were not rerun.

## 2026-07-22 - Replaced and compressed the navigation logo

Added the supplied navy-and-gold Naples Estate Jewelry mark to the desktop
header as `public/assets/images/branding/nav-logo.webp`. The source was resized
from 1254x1254 to 160x160 and encoded as a 5,442-byte WebP, reducing the
original 1,708,329-byte PNG by 99.68%. The original root PNG was removed after
the new asset and header reference were verified. The pre-existing
`logo.webp` was intentionally retained for its structured-data consumers.

The rendered desktop logo loads through Next's image optimizer at 40x40, and
the existing image-hidden mobile wordmark behavior remains intact. Desktop and
mobile checks found no horizontal overflow. `npm run lint` passes. The
production build compiled in 12.8 seconds before the unchanged generated
`renderShopPage` route-contract error. No SQL or data writes were involved.

## 2026-07-22 - Added gallery-card image progress

Added a three-pixel gold progress fill to the bottom edge of modern multi-image
product photos. Its unfilled portion is transparent, leaving only the completed
progress visible. It appears while the image is hovered and uses the
existing active carousel index, so cover, autoplay, and arrow navigation all
share one exact fraction. Each image adds one segment and the final image fills
the track completely. The indicator ignores pointer input and drops its 700 ms
transition for reduced-motion users.

A rendered 12-item gallery produced 12 correctly initialized indicators, and a
follow-up computed-style check confirmed the track is `rgba(0, 0, 0, 0)`. A
four-image card reached `scaleX(1)` at image four and removed its Next arrow;
list view rendered no indicators and no page overflow. Browser logs had no
runtime errors. All 424 tests and lint pass. The production bundle compiled in
13.2 seconds before the unchanged generated `renderShopPage` route-contract
error. No SQL or data writes were involved.

## 2026-07-22 - Fixed narrow shop toolbar and pagination formatting

Extended compact pagination through 440 px, resolving the measured 421-431 px
inner-row spill with a small safety buffer. At the same breakpoint, the results
toolbar now wraps into a stable view/count row plus a full-width Sort row. The
Spanish select grew from about 41 px to 191 px at 320 px and displays long
values without clipping. Corrected Weight-high-to-low copy to
`Peso: mayor a menor`.

Browser checks covered gallery/list, long Spanish sort selection, expanded
general and Necklace Length/Width filters, the 440/441 px transition, and 320,
390, 440, 441, 768, 1024, and 1440 px control bounds. No customer control left
the viewport and no page-level overflow remained. Eight focused tests, all 424
tests, and lint pass. The production bundle compiled in 16.6 seconds before
the unchanged generated `renderShopPage` route-contract error. No SQL or data
writes were involved.

## 2026-07-22 - Buyer-tested the new shop pagination without writes

Ran first, middle, and final-page customer flows through real links; verified
Previous/Next, browser Back, result ranges, disabled boundary controls,
filtered Necklace URLs, per-page reset, and short sequences that show every
page. English and Spanish compact pagination updated its localized page status
correctly at 320/420 px with no page-level overflow or runtime errors.

Found one minor responsive follow-up: at 421-431 px a middle-page numbered row
spills about five pixels beyond each side of its inner border, while remaining
inside the outer card; it fits at 432 px. Added a Backlog item to extend the
compact breakpoint with a small buffer; the subsequent responsive fix above
closed that item. Keyboard Enter activation was inconclusive in the browser
harness and is not classified as a product defect.
Console inspection also surfaced one unrelated existing Next.js image LCP
warning. No application code, SQL, tests, or data changed in this session.

## 2026-07-22 - Replaced ambiguous shop page jumps with ellipses

Changed long shop pagination sequences to mark omitted ranges explicitly. The
first current catalog page now renders `1 2 ... 11`, middle pages retain their
neighbors between two ellipses, and result sets of seven pages or fewer still
show every page. A one-page gap is expanded to the actual page number rather
than represented by an ellipsis.

At 440 px and below, the number sequence is replaced by localized `Page X of Y`
text between the unchanged arrow controls. A 320 px Spanish browser check
showed the localized page 6 of 11 status without component or page overflow,
and Previous moved correctly to page 5. Desktop page-one/middle and 390 px
English checks also passed.

Added five pagination-sequence regressions. Eight focused pagination tests,
all 424 tests, and lint pass. The production bundle compiled successfully in
13.0 seconds before the unchanged generated `renderShopPage` route-contract
error. No SQL or data writes were involved.

## 2026-07-22 - Reconciled latest shop feature documentation

Updated the durable Online Shop runbook to cover canonical Length handling,
the conditional Necklace/Bracelet Width ranges and cleanup rules, list/gallery
attribute parity, left-aligned Width controls, and the shared animated hover
underline. Corrected the completed Width QA history so its Length mismatch
points to the subsequent completed fix rather than an obsolete backlog note.

This pass changed documentation only. Application code, SQL, and customer or
product data were untouched, so implementation tests and builds were not
rerun.

## 2026-07-22 - Animated text-action hover underlines

Added a shared `hover-underline-grow` interaction modeled on the desktop nav.
The one-pixel line now grows from left to right over 190 ms instead of appearing
as an immediate solid text decoration. Pointer hover and keyboard focus share
the effect; reduced-motion preferences remove the transition.

Migrated every former `hover:underline` text action across the storefront,
checkout, account pages, cart, Saved Items, footer, and admin. Shop card and
list-row titles now use the same treatment. Persistent underlines and active
state indicators were intentionally preserved.

A fresh browser render verified the compiled zero-width starting state and
190 ms background-size transition. All 419 tests and lint pass. The production
build compiled in 18.8 seconds before the unchanged generated `renderShopPage`
route-export error. No SQL or data writes were involved.

## 2026-07-22 - Aligned Width filter checkboxes

Left-aligned the checkbox marker and label inside every Necklace/Bracelet Width
range button. The two-column layout, button sizes, selection behavior, and
Length controls are unchanged, but differing label lengths no longer shift the
markers toward each button's center.

Browser geometry checks measured the same 11 px marker inset for all five
buttons across both desktop columns, and visual inspection confirmed the
corrected sidebar. All 419 tests and lint pass. The production build compiled
in 19.7 seconds before the unchanged generated `renderShopPage` route-export
error. No SQL or data writes were involved.

## 2026-07-22 - Hardened manual and AI product-length input

Made decimal-equivalent Length/Size inputs canonical in the shared product
normalizer: `24`, `24 in`, `24 inches`, `24"`, and `24.0 in` now all produce
`24`, while `7.50 in` produces `7.5`. The Add/Edit form already used this helper
on change and again before saving the database column and compatibility tag;
its placeholder now explicitly shows that the `in` suffix is accepted.

Bumped the product extraction prompt to v16 and added Length to the
non-overridable field contract. AI extraction may interpret plain or
inch-suffixed transcript evidence but must return a bare canonical numeric
string. Added direct product-normalizer and AI-coercion regressions, including
custom-prompt enforcement.

The three focused suites passed 35 tests, all 419 tests passed, and lint passed.
A signed-in, no-write Add Product browser test observed `24`, `24`, and `7.5`
after entering `24`, `24 in`, and `7.50 in`; the draft was cancelled. The build
compiled in 15.8 seconds before the unchanged generated `renderShopPage`
route-export error; `npx tsc --noEmit` reports that same existing issue. No
migration or product-row update is required.

## 2026-07-22 - Fixed Necklace and Bracelet Length filters

Replaced direct Length string comparison with a shared numeric-inch
normalization contract. Current `24 in` controls now match stored `24` values,
while unitless, decimal, `inches`, and quoted legacy links remain compatible.
Invalid/non-positive values are ignored, equivalent selections are
de-duplicated, and the filter controls continue to show/write their existing
readable labels. Added focused regression coverage for normalization and
product matching.

Buyer verification covered direct and clicked 24-inch selections, legacy URLs,
22/24-inch multi-select, two Width intersections, Bracelet 7.5-inch, malformed
and incompatible links, available-only, gallery/list, Spanish mobile, and a
short desktop viewport. Counts matched inventory: 5 for 24 inches, 7 for 22 or
24 inches, 4 and 2 for the tested Length/Width intersections, and 3 for the
7.5-inch Bracelet filter. Spanish mobile retained its selected Longitud/Ancho
controls without horizontal overflow.

`npm test -- --run src/lib/__tests__/shop-filter-state.test.ts` passed 17 tests,
`npm test -- --run` passed all 415 tests, and `npm run lint` passed. The
production build compiled successfully in 16.8 seconds before the unchanged
generated `renderShopPage` named-export route-contract error; `npx tsc
--noEmit` reports that same existing error. No migration or data update is
required.

## 2026-07-22 - Extensively buyer-tested Width filtering without writes

Compared every Necklace/Bracelet width range and representative combinations
against an anonymous live inventory read, then exercised clicks, rapid
multi-select, back/forward, Clear Filters, type/category cleanup, availability,
search, purity, link type, grid/list, sorting, pagination, zero results,
malformed/shared URLs, and EN/ES layouts. More than 50 route/interaction checks
and 13 viewport sizes from 320x568 through 2560x1440 passed. Seven direct routes
returned HTTP 200, all 413 tests passed, and browser logs contained no runtime
errors; only existing development LCP advisories appeared.

The new Width implementation behaved correctly throughout. The pass found one
separate pre-existing Length bug: controls submit unit-bearing values such as
`24 in`, while stored lengths are numeric strings such as `24`, so direct string
comparison yields zero results. Tasks now tracks the required normalization
fix. No application code, database rows, buyer state, or settings changed.

## 2026-07-22 - Added Necklace and Bracelet width filters

Added a localized Width section beneath Length whenever Necklace or Bracelet is
selected. Buyers can combine Under 3 mm, 3-4.9 mm, 5-6.9 mm, 7-9.9 mm, and
10 mm+ checkbox-style choices. Selected ranges use OR behavior with one another
and continue to intersect with every other active shop filter.

Moved the conditional Length and Width groups directly after Link Type and
before Brand in the main filter grid. The full-width dependent row uses a
subtle left rule to connect those measurements visually with the selected
Necklace/Bracelet type instead of leaving them easy to miss below Price.

Added allowlisted/de-duplicated width URL state, automatic cleanup on item-type
or category changes, and exact `width_mm` range matching with non-overlapping
boundaries. Unsupported item types hide and ignore width state, while products
with null width remain visible unless a width range is active. No migration is
needed.

All 413 tests and lint pass. The build compiled in 11.8 seconds before the
unchanged generated `renderShopPage` route-export error. Browser verification
covered EN/ES, single and combined ranges, Necklace-to-Bracelet cleanup, stale
Ring URLs, 390x844 mobile, and a 1024x400 desktop sidebar. Counts and displayed
widths matched the read-only inventory audit, with no horizontal overflow or
runtime errors and no product/buyer writes.

Post-move desktop/mobile checks confirmed the Item Type, Link Type,
Length/Width, Brand order, no 390x844 overflow, and an unchanged five-result
Under-3-mm necklace filter. Focused tests (15) and lint pass; the build compiled
in 13.5 seconds before the same known route-export error.

## 2026-07-22 - Fixed constrained sticky shop filters

Constrained the desktop shop filter sidebar to the viewport height available
below its sticky header offset, with a 1rem bottom margin. Added a `100vh`
fallback plus `100dvh`, vertical overflow scrolling, a stable thin scrollbar,
and natural scroll chaining back to the product page when the sidebar reaches
its boundary. The existing collapsible 768-1023 px tablet layout is unchanged.

Verified 1024x600, 1024x768, 1180x820, 1366x768, 1440x900, and 1440x1200. The
previously inaccessible final control is reachable without changing page scroll
at every constrained size; the 1,324 px expanded necklace panel, Spanish route,
focus visibility, 1023x768 collapse behavior, scroll-boundary handoff, and
horizontal overflow also pass. All 411 tests and lint pass. The production
build compiled in 18.8 seconds before the unchanged generated `renderShopPage`
route-export error, confirmed independently by `npx tsc --noEmit`.

A subsequent 34-case responsive pass covered 320x568 through 2560x1440,
including the 767/768, 1023/1024, and 1279/1280 breakpoint edges, 1024x400,
portrait tablets, expanded Necklace filters, EN/ES, and gallery/list routes.
Every control remained reachable, desktop internal scrolling did not move the
page, and no horizontal overflow or runtime error appeared. The only console
warning was the pre-existing development LCP image advisory. This follow-up made
no application or buyer-data changes.

## 2026-07-22 - Reproduced responsive filter-sidebar clipping

Ran a no-write viewport matrix against the public shop. Portrait tablets and
the 768-1023 px tablet breakpoint passed: filters stay collapsed until opened,
remain in normal document flow, and all controls are reachable by page scroll.

At 1024 px and wider, the filter toggle disappears and the full approximately
1,031 px panel becomes sticky 104 px below the viewport top without a maximum
height or internal scrolling. Six common landscape-tablet sizes and five
compact-desktop sizes clipped the lower controls. The expanded necklace panel
at 1024x768 reached 1,315 px and left its final control 598 px below the
viewport until the page bottom. No application code or user data changed; the
viewport-constrained scrolling fix is tracked in Tasks.

## 2026-07-22 - Matched product list attributes to gallery tiles

Added eligible necklace/bracelet width as the fourth list-view spec pill,
immediately after purity, weight, and length, using the same
`productWidthDisplay` helper as gallery cards. The list view already rendered
the tile's other product attributes, so this closes the only data-display gap
without changing the compact row structure. Unsupported types and null widths
remain hidden, and EN/ES accessible labels use Width/Ancho respectively.

Focused width tests (9), all 411 tests, and lint pass. The final production
build compiled in 17.1 seconds before reaching the unchanged generated
`renderShopPage` route-export error; `npx tsc --noEmit` confirmed that same
single known error. Live EN/ES checks displayed `6.5 mm` for inventory `#26`,
kept all four pills on one line at 390x844, omitted width from a non-applicable
ladle, and showed no horizontal overflow.

## 2026-07-22 - Added necklace and bracelet width

Added `products.width_mm` as a nullable millimeter measurement with a guarded,
re-runnable Supabase migration and public column grants. Updated the canonical
products setup, shared Product type, normalizer, formatter, and shop query. The
catalog retries without the new column before migration so existing cards stay
available.

Added a conditional Width (mm) number field to the shared Add/Edit product
drawer. It appears only for Necklaces and Bracelets, clears for other types,
validates positive values up to 1000 mm, and blocks saving a non-null width if
the migration has not been applied. Smart Listing Assistant prompt/schema v15
now extracts explicitly stated width from speech, converts centimeters/inches
to millimeters, preserves the distinction from length, and ignores width for
non-applicable types even with an older saved custom prompt.

Product cards show eligible width at the right side of the price row. Focused
tests (2 files, 14 tests), all tests (44 files, 411 tests), and lint pass. The
build compiled in 13.5 seconds and then reached the unchanged generated
`renderShopPage` route-export error. A signed-out public browser check rendered
24 filtered cards without a catalog error before migration. The owner then ran
the migration successfully: Supabase reported `numeric(8,2)` with true anon and
authenticated read privileges, a direct anonymous REST query returned HTTP 200
with `width_mm`, and a fresh shop request returned HTTP 200. Authenticated
Add/Edit and populated-card verification remain pending because the available
preview session was signed out of admin.

Post-migration functional testing inserted a uniquely named Draft Bracelet with
`width_mm = 8.5`, read the exact value back, confirmed PostgreSQL rejected a
zero-width draft with constraint code `23514`, deleted the valid draft, and
verified zero test rows remained. The 14 focused AI/product-width tests passed
again.

Reviewed all 39 existing Necklace/Bracelet records and backfilled 35 null
widths from explicit title, description, note, or tag evidence. The backfill
used the primary chain/body-link width when a listing described multiple
components: inventory `#12` received 5.5 mm rather than its 13 mm connector
width, and `#89` received 15 mm rather than its 20 mm widest point. Inventory
`#48`, `#77`, `#87`, and `#91` remain null because their measurements describe
diamonds, charms, beads, or decorative discs instead of the wearable width.

Conditional writes required every target width to still be null. Read-back
verification confirmed all 35 exact values, and independent service-role and
anonymous queries both returned 39 applicable rows with 35 populated widths.
A fresh Tiffany-filtered public catalog query displayed `Width: 6.5 mm` for
inventory `#26` in the intended price-row position and omitted width from a
non-applicable ladle. No application code changed during this data backfill.

## 2026-07-22 - Completed Spanish legal copy and LCP loading fixes

Added complete Spanish copy for Privacy, Terms, Returns and Refunds, Shipping,
Accessibility, Cookie Preferences, Auction Terms, and Vendor Terms, including a
localized updated date and all body paragraphs and bullets. Added shared
localized metadata for Payment and Unsubscribe so titles receive the site name
once, and localized the Spanish Unsubscribe heading and preference content.

Updated image loading so every currently visible homepage carousel card is
eager, with high fetch priority limited to the front card, while offscreen
preloads remain lazy. Product detail now eagerly loads its duplicate first
thumbnail/video poster alongside the eager/high main hero; later thumbnails
remain lazy. Added focused regression helpers and tests for both loading rules
and the new localization contracts.

Focused tests (4 files, 22 tests), all tests (44 files, 407 tests), and lint
pass. The build compiles in 14.9 seconds before stopping at the unchanged
`renderShopPage` named-export route contract error. Browser verification covered
all eight Spanish legal pages, EN/ES Payment and Unsubscribe, homepage carousel,
and product gallery attributes; every route returned 200 and fresh server output
contained no LCP warning. No migration is required.

## 2026-07-22 - Extended customer regression across secondary routes and dense flows

Ran a no-write buyer pass across navigation, search edges, combined filters,
sorting, list/grid and availability modes, 96-item pagination, product lightbox,
temporary Saved Items/cart state, sold inventory, stale checkout, fulfillment
switching, account forms, inquiry handoffs, EN/ES policy pages, secondary
payment/unsubscribe routes, missing products, direct HTTP requests, and server
logs. Temporary state was removed; the original sold cart item remains.

Core flows passed with no application errors. The dense catalog rendered 96
cards/images in about 1.6 seconds without overflow, the tested route set returned
expected 200/404 responses, six repeated shop requests returned 200, and all 401
automated tests passed. Added follow-ups for English body copy on Spanish policy
pages, duplicated/unlocalized Payment and Unsubscribe metadata/UI, and remaining
homepage/product LCP warnings. No application code, account, order, payment, or
database data changed.

## 2026-07-22 - Fixed extended customer-QA follow-ups

Added shared storefront query normalization so repeated spaces collapse before
both filtering and URL navigation. Added centralized localized metadata for
eight legal/policy routes, localized contact and free-evaluation metadata, and
localized Spanish legal H1s and section headings. Route titles now rely on the
root template for one brand suffix instead of duplicating Naples Estate Jewelry.

Removed the cart line-item area's forced fill height so the summary follows the
last item, and made the active product image explicitly eager/high priority while
keeping gallery thumbnails lazy. Browser verification confirmed 47 products for
`yellow   gold`, correct English/Spanish titles and headings, a 29px cart content
gap, and the intended image attributes. Focused tests (29), all tests (41 files,
401 tests), and lint pass. The production build compiles and then stops at the
unchanged existing `renderShopPage` named route export. No migration is required.

Repeat verification later the same day again passed all 401 tests in 11.4
seconds. Live checks reconfirmed the normalized 47-result search, Spanish
shipping title/H1, product hero loading attributes, and compact cart spacing.
No application code or buyer data changed during the repeat.

## 2026-07-21 - Extended customer regression across desktop, tablet, and mobile

Repeated the buyer journey without application or data changes and extended it
through multi-filter sorting, list/grid modes, 96-item pagination from the page
bottom, product lightbox controls, temporary Saved Items and mixed cart state,
checkout availability and fulfillment guards, account forms, inquiry handoff,
English/Spanish policy routes, missing products, responsive menus, and overflow.
The temporary available item was removed from cart and Saved Items; the original
sold cart item remains.

Core flows passed with no application errors. The representative HTTP matrix
returned expected 200 responses and a correct missing-product 404, ten repeated
shop requests all returned 200, and server output was clean. Added backlog items
for repeated interior search whitespace, incomplete Spanish/legal metadata and
headings, excess mobile cart-drawer whitespace, and the product hero image's
Next.js LCP loading warning. No lint/build run was needed because only project
documentation changed.

## 2026-07-21 - Fixed extended buyer-QA storefront findings

Replaced product tickers' time-dependent hydrating text with deterministic,
localized next-update copy and an asynchronous post-hydration countdown. Search
now trims surrounding whitespace before both URL commits and server filtering.
Added route-specific localized metadata for account authentication, shop,
auctions, checkout, and missing pages; localized Spanish product size and all
gallery accessibility controls; corrected the Spanish checkout H1; and removed
the duplicated site name from checkout titles. Generated a real 32px
`favicon.ico` from the existing palm-tree `icon.png`.

Focused tests (23), all tests (40 files, 384 tests), the final ticker regression
(2), and lint pass. The optimized build compiles and then stops at the unrelated
existing `renderShopPage` named route export. Buyer browser checks passed for
search, hydration, metadata, localization, checkout, and restored cart/Saved
state; final product and favicon HTTP requests returned 200. No migration is
required.

## 2026-07-21 - Extended buyer QA across storefront routes and mobile layouts

Retested the complete buyer journey without application or data changes, adding
account signup/reset, auctions, malformed query strings, missing products,
inquiry handoff, direct-checkout protection, Spanish metadata/copy, repeated
HTTP requests, and mobile overflow checks to the earlier coverage. Available
and sold products, media/lightbox, Saved Items cleanup, cart availability
blocking, filters, sorting, pagination/history, responsive navigation, and
localized forms remained usable. The pre-existing sold cart item was preserved.

Found reproducible follow-ups for the product price-update ticker hydration,
untrimmed search whitespace, account/Spanish metadata and localization, a
duplicated checkout title, and missing `/favicon.ico`. One early development
shop request returned 500 with an incomplete-JSON parse error, but the route
matrix and eight repeated shop requests subsequently returned 200, so it was
not treated as a confirmed application defect. No lint/build run was needed for
this documentation-only session.

## 2026-07-21 - Blocked unavailable carts before checkout

Added a shared cart-availability selector and used it in the cart drawer and
checkout. Any sold, archived, or zero-stock item now disables and relabels the
drawer CTA as Remove Unavailable Items; both the initial checkout handler and
guest continuation also guard against stale availability. The existing sold
test item showed the warning and disabled CTA on desktop and 390x844 without
opening the checkout gate. Added two selector regressions. All 379 tests and
lint pass; build compiles before the unrelated existing `renderShopPage` route
export error. No migration is required.

The earlier apparent pagination regression was a semantic browser-command
artifact that also affected ordinary product links. A real pointer click on the
unchanged control advanced to `/shop?page=2` and displayed 25-48 of 129, so no
pagination implementation change was retained.

## 2026-07-21 - Buyer-tested storefront, cart, and checkout without writes

Ran a desktop and 390x844 mobile buyer journey through navigation, search,
filters, sorting, product cards/details, sold presentation, Saved Items, cart,
guest checkout, and shipping/pickup mode. Saved Items was returned to empty, the
pre-existing one-item cart was preserved, and no order, payment, account, app
code, or database data was created or changed. The pass found that a sold cart
item blocks payment correctly but the enabled checkout CTA permits an avoidable
trip through the guest gate first. Its initial pagination result was later
identified as a semantic browser-command limitation and superseded by a passing
real-pointer check.

## 2026-07-21 - Fixed rapid-filter pagination hydration errors

Separated pagination's deterministic rendered hrefs from pending navigation
state. Server and first-client link attributes now use committed URL params;
event-time pending state is merged only when a page link is actually clicked.
Immediate Gold/category and 700ms search/era browser reproductions now produce
zero hydration errors, and filtered page 2 still preserves filters and scrolls
to the results start. Added three URL-construction regressions. All 377 tests
and lint pass; build compiles before the unrelated existing `renderShopPage`
route-export type error. No migration is required.

## 2026-07-21 - Browser-tested shop filters and deep links

Exercised baseline, combined metal/purity/sort, non-jewelry category, filtered
page-size/page-2, search, era, list, Spanish catalog/filter, product-detail/back,
and empty-result paths. Counts, sorting, preserved queries, scroll landing,
loading feedback, and one-image-per-card behavior passed. Six representative
deep links returned HTTP 200. Found and documented one unresolved rapid-click
hydration race in pagination hrefs; settled interactions do not reproduce it and
visible results remain correct. No application code or data changed.

## 2026-07-21 - Made shop cards and max-page navigation lightweight

Changed gallery cards from mounting every carousel image to one cover image
until interaction, then only the active image and immediate neighbors. Removed
the image polling, image-gated card reveal, blur, stagger delays, and broad
`will-change`; added responsive offscreen content visibility. Compacted duplicate
image arrays and URL-keyed padding metadata after catalog pagination. Per-page
changes now scroll to the results start, and navigation feedback is fixed in the
viewport. At 96 items, mounted images dropped 715 -> 96, DOM elements 4,341 ->
~3,712, HTML 2.92 MB -> 1.21 MB, and the measured 24-to-96 transition 2.58s ->
1.24s. Added six image-window/data-compaction regressions. All 374 tests and
lint pass; build compiles before the unrelated existing `renderShopPage`
route-export type error. No migration is required.

## 2026-07-21 - Audited shop gallery loading without code changes

Measured the default and maximum per-page catalog flows in the local preview.
The 24-item view produced 1,511 DOM elements, 165 gallery images, and a 739 KB
HTML response; 96 items produced 4,341 DOM elements, 715 gallery images, and a
2.92 MB response. Confirmed that visible cards load every opacity-hidden
carousel image and that changing page size at the bottom preserves the old
scroll position because the select does not invoke the page links' existing
results-scroll helper. Recorded a staged remediation in Tasks and Decisions.
No app code, database data, or configuration changed; no build was required.

## 2026-07-21 - Clarified PayPal details-entry and processing messages

Replaced PayPal checkout's single early processing state with separate hosted
details/approval and capture stages. Buyers opening PayPal or the card form are
now told to complete and review their details and that payment is not processed
until submission. The processing message appears only after approval. Updated
English and Spanish copy and retained idle resets for cancellation and errors.
All 368 tests and lint pass; the preview returns 200. The optimized build
compiles before the unrelated existing `renderShopPage` route-export type
error. No payment session or database migration was used.

## 2026-07-21 - Displayed exact cents in cart and checkout totals

Replaced the cart drawer and checkout summary's duplicated whole-dollar
formatters with one exact two-decimal checkout currency formatter. Displayed
subtotal, tax, shipping, quantity line totals, and grand total now retain cents,
and estimate arithmetic uses the authoritative cents-rounding helper. The live
$1 test item shows $1.00 subtotal, $0.06 Florida tax, and $1.06 estimated total.
Added two regressions; all 368 tests and lint pass, and the preview returns 200.
The optimized build compiles before the unrelated existing `renderShopPage`
route-export type error stops build/typecheck. No migration is required.

## 2026-07-21 - Cleaned up pickup order address details

Changed the customer account order dialog to ignore country-only checkout
address objects and to render Additional Details only when meaningful notes or
address values exist. Pickup orders without an entered address no longer show
a blank Shipping address row or lone "United States" value; an optional real
pickup address is labeled Address. Added three formatter regressions. All 366
tests and lint pass, and the restarted preview returns HTTP 200. Authenticated
visual verification on pickup order `NEJ-20260721-VGKOX` confirmed the modal
ends after Customer and Totals without the empty section or console errors.
Build/typecheck remain blocked by the unrelated existing `renderShopPage`
named export in the Shop page route.

## 2026-07-21 - Fixed resumable Etsy sync and added bulk recovery

Expanded the Etsy atomic queue from pending-only to every resumable state,
preserved queued updates during remote reconciliation, retained content-drifted
rows during enqueue, and corrected partial-image progress/stall accounting.
Added a repair-only API/claim path and an Admin Actions confirmation that finds
and resumes all linked interrupted/out-of-date listings without creating new
drafts. After the owner applied the migration, the live one-click run repaired
all 36: zero repairable/error rows remain, inventory #117 continued from 4 to
8 to 10 image checkpoints, and 72 repair-run logs contain no error outcome.
Also fixed update-mode inventory writes to retain their pushed-price baseline.
Added 5/8/9-image and inventory-checkpoint regressions. All 363 tests,
TypeScript, lint, authenticated UI checks, and the 416-page build pass.

## 2026-07-21 - Investigated recent Etsy out-of-date listings (no code change)

Read-only live data and sync-log analysis traced all 36 recent out-of-date Etsy
rows to bulk continuation after the four-image request budget. Each affected
listing has more than four source photos, exactly four app checkpoints, no
inventory/update completion, and no content hash. Inventory #105 completed in
one request because it has four photos; #110 became current after a later full
retry. Recorded the durable queue-continuation repair and safe per-item recovery
path. No application code, database data, token, or Etsy listing was changed.

## 2026-07-21 - Fixed selected Etsy sync skipping out-of-date rows

Corrected the selected Etsy enqueue filter so linked `out_of_date` listings are
queued instead of silently discarded. Added deduplication, already-pending
counting, candidate regression tests, and clearer selected/queued progress
copy. A read-only live audit found 36 affected available listings: all are
active on Etsy and all lack a last-pushed content hash, so they genuinely need
a baseline sync even though the app cannot prove a particular field differs.
No Etsy write was performed. All 355 tests, TypeScript, lint, authenticated UI
checks, and the 417-page build pass; no migration is required.

## 2026-07-21 - Split Etsy and eBay status checks

Replaced the combined marketplace-status card with separate Etsy and eBay
actions. The selected-products results modal now reconciles, displays, retries,
drills into, and returns from posting for only the chosen marketplace. Fixed
the adjacent singular selected-product accessibility label. Authenticated
one-item checks confirmed independent Listed results without pushing listing
content. All 352 tests, TypeScript, lint, desktop/mobile checks, and the 417-page
build pass; no migration is required.

## 2026-07-21 - Added bulk Etsy draft publishing

Added Publish all ready to Etsy beside the eBay command in the Admin Products
Actions modal. Completed review drafts can now be explicitly promoted to active
through a counted confirmation and bounded progress flow. The backend accepts
only linked draft-review rows, rechecks product availability, contains and logs
per-item failures, and refreshes Etsy status chips after close. Authenticated
desktop/mobile and zero-ready summary checks made no Etsy writes. Focused tests,
all 352 tests, TypeScript, lint, and the 417-page build pass; no migration is
required.

## 2026-07-21 - Consolidated marketplace bulk controls in Actions

Removed Sync All to Etsy, Sync All to eBay, and Publish all ready from the
Admin Products toolbar. Added the existing global eBay publish workflow to the
Actions modal and kept that modal accessible without selected products, with
only selection-scoped choices disabled in the empty state. Authenticated
selected/empty and desktop/mobile checks passed without marketplace writes, as
did all 351 tests, TypeScript, lint, and the 416-page production build.

## 2026-07-21 - Added optional sold-item price masking

Added a second Shop Visibility checkbox that shows Sold/Vendido instead of a
price for sold inventory across customer catalog, detail, wishlist, cart, and
live checkout views. Stored prices, completed-order receipts, admin data, and
marketplace flows remain unchanged. Added stale saved-item refresh, structured
data handling, a backward-compatible settings read, canonical schema updates,
and an idempotent migration. Focused tests, all 351 tests, TypeScript, lint, the
416-page build, and authenticated desktop/mobile UI checks pass. Production requires
`supabase/shop-sold-price-visibility-2026-07.sql` before the toggle can persist.

## 2026-07-21 - Added missing-Spanish regeneration to listing edits

Added a bottom-of-editor action that translates only blank Spanish title,
description, and notes fields from their English counterparts. Concurrent
Spanish edits and changed English sources are preserved, translations remain
pending until normal save, and the paid API now has a distributed per-admin
hourly limit. Added four regressions for request selection and stale-result
merging. Authenticated no-write desktop/mobile checks, all 350 tests,
TypeScript, lint, and the 416-page production build pass.

## 2026-07-21 - Hardened API abuse controls and cleared security advisories

Added Netlify edge throttling for all API paths, changed the shared distributed
limiter to fail closed, added stale-counter cleanup, and rate-limited PayPal
capture plus PayPal/eBay/Cloudflare/Resend webhooks before upstream work.
Moved newsletter subscription to the service role and added SQL that revokes
direct anon/authenticated subscription RPC execution. Restricted canonical
product SELECT grants to public columns, duplicated browser security headers
through Next, updated Next to 16.2.10, and patched all audited transitive
dependencies. Added security regressions. All 346 tests, TypeScript, lint, both
dependency audits, the 416-page build, and local header/status smoke checks
pass. Production deployment and three idempotent Supabase scripts remain manual.

## 2026-07-21 - Added reviewed Etsy category correction and type fallback

Added Etsy's exact-category picker to the selected-item review form with
in-place preflight refresh. Pinned live taxonomy mappings for Grape Shears,
Serving Set, Coaster, and Matchbox Holder/Vesta Case, resolving the four current
unmapped-type failures. Added an approximate generic collectible fallback for
future custom types and regression coverage. Authenticated no-write UI checks,
TypeScript, lint, all 339 tests, and the 416-page build pass. No migration or
manual database reset is required.

## 2026-07-21 - Fixed duplicate Etsy review warning keys

Labeled Etsy upload advisories by photo rank, deduplicated repeated per-photo
messages, and accumulated warnings across every bounded reviewed-sync request.
Added defensive non-colliding React keys and focused formatter tests. Focused
tests, TypeScript, lint, all 338 tests, and the 416-page build pass; no live
marketplace content was submitted.

## 2026-07-21 - Fixed marketplace status drift

Changed active Etsy/eBay reconciliation to preserve local `out_of_date` instead
of replacing it with `active`/`published`. Status results now distinguish a
live listing with pending local updates. Added regression tests for both
marketplaces, restored inventory #53's verified eBay flag with a guarded
one-row update, and confirmed a real status check leaves it **Live, updates
needed**. TypeScript, lint, all 336 tests, and the 416-page build pass.

## 2026-07-21 - Diagnosed marketplace status drift

Confirmed that Etsy/eBay lifecycle reconciliation can erase a valid local
`out_of_date` signal without pushing content or refreshing its hash. Inventory
#53 reproduced the eBay case: all compared remote fields match except its
fulfillment policy, which should now use the high-value tier after its mapped
price crossed $1,000. A catalog-wide read-only hash audit found only #53 hidden,
#73 visibly out of date on both marketplaces, and no false out-of-date rows.
Documented the cross-marketplace correction as pending; no app or database code
was changed.

## 2026-07-21 - Added posting actions to Not listed results

Widened the focused marketplace status detail and added Post to Etsy/eBay on
each Not listed product. The action opens the existing one-item immediate or
review-first sync flow, keeps the full table selection, and returns to a fresh
combined status check after close or completion. Authenticated no-write checks
passed for both marketplace routes; TypeScript, lint, all 334 tests, and the
416-page production build pass.

## 2026-07-20 - Fixed the marketplace-result Back icon

Replaced the status-detail Back button's missing `arrow_back` Material Symbols
ligature with a font-independent arrow. Browser verification confirmed the
correct glyph and zero raw ligature text. Audited all current direct icon text,
icon expressions, and configured icon fields against the committed subset;
`arrow_back` was the only mismatch. Documented a proposed manifest-backed
lint/build integrity gate for owner approval without implementing the broader
permanent change. TypeScript, lint, and the production build pass.

## 2026-07-20 - Compacted marketplace status results

Replaced the default per-item Etsy/eBay result lists with three clickable,
mutually exclusive totals: Listed, Not listed, and Needs attention. Nonzero
totals open a focused detail view with inventory numbers, titles, and exact
marketplace states; Back restores the summary without rerunning checks, and
zero totals are disabled. A live mixed-status check produced 1 Listed / 1 Not
listed for both marketplaces and verified both drill-downs. Added focused
grouping tests; TypeScript, lint, all 334 tests, and the production build pass.

## 2026-07-20 - Added per-item marketplace status results

The combined selected-product Etsy/eBay check now lists every selected product
under each marketplace with its inventory number, title, and final state such
as Live, Draft, Not listed, Ended, or Hidden (sold). Remote check failures are
identified per item. Removed the misleading Updated tile from the dialog while
retaining the internal reconciliation counter for API compatibility. A live
read-only two-item check showed inventory #21 and #24 as Live on both Etsy and
eBay, with both titles present in both sections. TypeScript, lint, all 332
tests, and the 416-page production build pass.

## 2026-07-20 - Added review-first selected Etsy/eBay sync

Selected-product marketplace posting now offers immediate batch sync or a
sequential review flow. The review flow shows each Etsy/eBay preflight, submits
one product through the existing bounded sync endpoint, advances on success,
and supports refresh, retry, skip, carried warnings, and final counts. Sync to
both hands the selection from Etsy to an independent eBay method choice. No
live marketplace write was used during browser verification; TypeScript, lint,
332 tests, and the production build pass.

## 2026-07-20 - Added selected Etsy/eBay status checks

Added one combined Check Etsy and eBay action to the selected-products Actions
modal. The two status routes reconcile optional validated product IDs in
parallel, retain separate progress/results and retry behavior, refresh both
table chips, preserve the selection, return completed checks to the Actions
modal, and never push listing content. Authenticated live read-only desktop and
320px checks passed for one linked Etsy listing and one linked eBay offer with
no horizontal overflow; TypeScript, lint, 332 tests, and the production build
pass.

## 2026-07-20 - Standardized instant customer button feedback

Audited all 88 customer-facing buttons. Added immediate busy/disabled labels to
sign-out, cart checkout authentication, and public error retry; removed the
150 ms shop navigation-overlay delay; disabled active view/cookie no-ops; and
added a global pressed response for custom buttons. Browser checks confirmed
the shop, cookie, and cart flows, and 332 tests, TypeScript, lint, and the
416-page production build pass.

## 2026-07-20 - Fixed compact admin modal overflow

Portaled the Admin Users Delete Account confirmation out of its no-wrap table
cell and added explicit text wrapping, long-token handling, viewport-bounded
scrolling, and narrow-phone action stacking. Applied the same overflow guards
to selected-product actions and the Etsy/eBay bulk sync and publish dialogs.
Authenticated desktop and 320px checks found zero horizontal overflow across
all five dialogs; TypeScript, lint, and the 416-page production build pass.

## 2026-07-20 - Verified the corrected PayPal hardening migration

Confirmed the corrected hardening SQL is live: `orders.refund_amount` and the
refund ledger are readable, the dependency-aware readiness RPC returns `true`,
and a zero-write refund probe reaches the intended missing-order guard instead
of the former missing-column error. Repeated the complete SQL inventory across
59 files, 33 tables, 479 table/column contracts, and 22 function names with no
unexpected missing live artifact. There are no known pending migrations.

## 2026-07-20 - Audited the live schema after PayPal hardening

Confirmed the hardening ledger and PayPal RPC contracts are live, then found
that `orders.refund_amount` was still absent and caused `apply_paypal_refund()`
to fail with `42703`. Made the hardening SQL add that dependency itself and
replaced its unconditional readiness response with concrete table/column/RPC
checks. The updated hardening file must be re-run. A complete additive-schema
comparison covered 206 artifacts across all 59 SQL files and found no other
missing live table or column. The same read-only audit found every app-used RPC,
zero stale product/order image paths, zero old `new-listing-*` IDs, and the
expected anonymous product-column and payment-RPC restrictions. A sweep of all
22 SQL-defined function names found no unexpected missing callable function;
tests (332), TypeScript, lint, and the 416-page production build pass.

## 2026-07-20 - Hardened PayPal checkout and added real admin refunds

Added deterministic create/refund idempotency, capture-first persistence,
buyer retry lockout after ambiguous captured-payment failures, retryable webhook
claims with checked RPC errors, capture-ID refund/dispute lookup, receipt
finalization retries, a 50-line cart limit, and winning-order sold-price binding.
Capture-refunded webhooks now calculate the increment from PayPal's cumulative
refunded total, and refund pending/failed events update the ledger without
changing the order's refunded total.
Admin full and partial PayPal refunds now move money through PayPal and reconcile
once through the new `paypal_refunds` ledger; manual-order status controls remain
local. Ambiguous capture responses now use a PayPal order lookup, every
captured/unresolved branch activates a reload-persistent same-cart payment lock,
different refund targets are blocked while one is pending, and automatic
receipt/owner retries use Resend idempotency keys. Added
`supabase/paypal-checkout-hardening-2026-07.sql`, which must be run
before deployment. Full tests (332), TypeScript, lint, build, and authenticated
desktop/mobile admin checks pass; no payment or refund was submitted.

## 2026-07-20 - Defaulted Admin Products to available items

The main Admin Products table now opens showing only available inventory.
Existing status filters and clear/reset controls remain available for other
product states. Verified in the authenticated admin preview and with the
TypeScript, lint, and production build checks.

## 2026-07-20 - Stabilized homepage carousel thumbnail clicks

Hardened the homepage 3D carousel so far-side projected cards cannot steal
clicks, front-facing cards stack by viewer depth, and the ring pauses as the
pointer enters or engages the scene. Verified the exact mobile product-link
navigation plus TypeScript, lint, and production build.

## 2026-07-20 - Aligned Admin Products totals footer

Removed the extra bottom padding that was lifting the sticky Melt/Price totals
bar above the table's lower edge. The footer now rests directly above the
horizontal scrollbar and no longer overlays the last visible rows. Verified in
the authenticated admin preview with TypeScript, lint, and production build
passing.

## 2026-07-20 - Added selected-product marketplace actions

Added product-table checkboxes, select-all-visible behavior, and a top Actions
modal for syncing selected products to Etsy, eBay, or both. Selected runs send
explicit product IDs through the existing queue/drain flows; the combined run
waits for a successful Etsy completion before opening eBay. Verified the live
admin preview and passed the full Vitest suite, TypeScript, lint, and build.

## 2026-07-20 - Kept seller suggestions out of AI buyer copy

Added an immutable buyer-facing copy firewall to Smart Listing Assistant
generation, including requests using saved/custom admin prompts. Seller
suggestions, guesses, opinions, requested wording, and unverified
identifications are excluded from title, description, and public notes. Direct
seller-attribution sentences are also removed by response coercion and moved
to uncertainties for admin review. Added focused regression coverage and
verified TypeScript, lint, and production build.

## 2026-07-20 - Restored missing Material Symbols video glyphs

Audited recent admin, marketplace, and storefront icon usage against the
self-hosted subset. Regenerated the two versioned font assets so the product
edit form's `videocam` icon and the storefront gallery's `play_circle` icon
render as glyphs instead of raw ligature text. Removed temporary font and
keep-list artifacts. Verified `/admin`, the edit form, a storefront product,
the Etsy manager, and the eBay manager in the authenticated browser, with
TypeScript, lint, and production build passing.

## 2026-07-20 - Added Admin Products quick-actions modal

Clicking a product thumbnail, title, or any neutral cell in the main Admin
Products table now opens a quick-actions modal with a larger image, key inventory/pricing facts,
the same row actions as the right-edge dropdown, and compact Manage Etsy /
Manage eBay launchers with current sync status chips. The full marketplace
workflows moved to dedicated pages at `/admin/products/[id]/etsy` and
`/admin/products/[id]/ebay`, reusing the existing product panels on a page-sized
surface instead of embedding them in the modal.

Verified with `npx tsc --noEmit`, `npm run lint`, `npm run build`, and an
authenticated browser smoke check at `/admin` confirming neutral-cell modal
open, fixed icon rendering, full-size image preview, Manage Etsy navigation,
eBay page controls, and the existing dropdown remaining independent.

## 2026-07-20 - Recorded applied SQL migrations and verified order email table

Updated project docs after the owner ran
`product-videos-cloudflare-stream-2026-07.sql`,
`product-sold-price-lock-2026-07.sql`, `order-shipping-tracking-2026-07.sql`,
and the current `no-reservation-checkout.sql` copy. A read-only service-role
schema check also confirmed `order_emails` exists with 14 rows, so
`order-emails.sql` is no longer tracked as pending.

Backlog items now focus on Cloudflare environment/webhook setup and live
behavior verification rather than applying those SQL files. Audited the
unreferenced-by-filename `supabase/*.sql` candidates and removed none, because
they remain useful schema repair/setup/audit/recovery scripts rather than
disposable scratch files.

## 2026-07-20 - Added Admin Products table Melt and Price totals

Added a sticky bottom totals row to the main Admin Products table. The footer
shows the visible row count plus totals under Melt and Price, calculated from
the current filtered table using the same helpers that render each row.

Verified by restarting the port 3000 preview, checking `/admin` in the browser
for a 21-cell sticky footer with Melt/Price totals, and running `npm run lint`,
`npx tsc --noEmit`, and `npm run build`.

## 2026-07-19 - Fixed admin Quantity field clearing

Updated the Add Listing/Edit Listing Quantity input so admins can delete the
current number, see a blank field while typing, and enter a replacement value
without the control snapping back to 1. Leaving it blank and blurring restores
the documented default of 1, while save-time quantity normalization is unchanged.

Verified with `npm run lint`, `npx tsc --noEmit`, `npm run build`, and a local
preview response check at `/admin`.

## 2026-07-19 - Optimized the proposed eBay description banner

Converted the owner-supplied 2169x725 root PNG to a visually verified 1400x468
WebP using quality 90/high-effort encoding. The asset fell from 2,136,002 bytes
to 113,460 bytes (about 94.7% smaller) and now lives at
`next-app/public/assets/marketplaces/ebay-description-banner.webp`. Removed the
superseded root PNG only after verifying the output format, dimensions, file,
and rendered appearance.

No marketplace mapper or listing was changed. The asset contains a visible
phone number and off-eBay domain, so integration is held pending a compliant
artwork revision.

## 2026-07-18 - Added Draft to the main Products-table menu

Added a Draft action to each non-draft product's Actions menu and a distinct
purple Draft badge. Draft rows can use the existing Available action to return
to the public shop. New/Edit Item already supported Draft, and the storefront's
existing public-status contract continues to exclude draft products.

Added regression coverage for draft normalization, public visibility, and
purchasability while preserving Available/Sold behavior. Verified with
`npx tsc --noEmit`, strict lint, `npm test` (23 files, 318 tests),
`npm run build`, and a signed-in read-only admin browser check.

## 2026-07-17 - Built the Cloudflare Stream product-video workflow

Added one-video-per-product persistence, direct resumable TUS provisioning,
admin-only upload/status/commit/delete APIs, signed idempotent webhook handling,
download generation, provider-first cleanup, bounded orphan recovery, and
marketplace out-of-date marking. Added the product editor's mobile Record/
Choose flow and staged Save/Cancel semantics, plus ready-only mixed public
gallery playback and `VideoObject` metadata without adding video work to shop
list queries. Expanded the Netlify CSP for Stream/upload hosts and added
`tus-js-client`.

Also fixed product-detail fallback detection for the still-pending `sold_price`
migration, which local preview testing exposed as a 404 on otherwise valid
product links. Added five product-video constraint/state/media/webhook tests.
`npm test` passes (316/316), strict lint, TypeScript, and production build pass.
The signed-in admin preview passed; real provider/mobile/marketplace checks are
deployment-gated and explicitly documented.

## 2026-07-17 - Added full-size admin table image previews

Made each Products-table thumbnail clickable and keyboard accessible. It now
opens the original product image in the shared full-screen admin viewer, with
the product title as alt text and without the editor-only Crop command.

Added a prominent top-right close icon, Escape dismissal, backdrop dismissal,
and temporary body scroll locking. Desktop and 390x844 browser walkthroughs
confirmed image rendering and every close path. `npm test` (311/311), strict
lint, TypeScript, and production build pass.

## 2026-07-17 - Froze admin product headers and identity columns

Converted the Products table wrapper into a bounded vertical/horizontal scroll
area. The entire header row now stays visible vertically; Order, Inv #, Image,
and Title stay visible horizontally through the divider before Brand; and
Actions remains fixed on the right. Mobile uses a narrower frozen Title column
to preserve room for scrolling data.

Corrected header classification so Etsy and eBay, which are non-sortable, are
no longer accidentally styled as right-sticky Actions columns. Desktop and
390x844 browser walkthroughs passed in both scroll directions. `npm test`
(311/311), strict lint, TypeScript, and production build pass.

## 2026-07-17 - Fixed Etsy image upload progress counting

Changed the per-product Etsy sync display from per-request batch progress to
cumulative progress against the original fixed total. Multi-request uploads now
advance `4/17`, `8/17`, `12/17` rather than showing `4/17`, `4/13`, `4/9`.
Partial failures advance only by successful operations.

Added focused regression tests. `npm test` (311/311), strict lint, TypeScript,
and the production build pass. A real browser Sync Updates run for inventory
#83 completed Active with no error; Etsy skipped image work because all 17
checkpoints already matched, so no live image was altered merely to force the
counter onto the screen.

## 2026-07-17 - Reconciled current Etsy/eBay states without content pushes

Ran the authenticated Check Etsy statuses and Check eBay statuses workflows
across all 83 Etsy links and 79 eBay offers. No marketplace read errors were
reported. Identified Etsy inventory #83 and eBay inventory #53 as the only
linked available listings needing updates; eBay inventories #83 and #84 remain
optional first-time publishes. Inventory #82 remains live but detached.

The eBay bulk summary exposed an existing local scan issue that briefly marked
sold inventory #6 out of date despite its remote quantity already being zero.
The normal read-only status check restored `hidden_oos`. No listing content,
price, quantity, publication state, or availability was pushed in this session.

## 2026-07-16 - Audited and hardened all Etsy/eBay API sync paths

Read every linked record through the connected marketplace APIs. Etsy's 83
links resolved to 70 active, 7 edit-state, and 6 rate-limited-then-successfully-
retried active listings; eBay's 79 offers resolved to 73 active, 5 out of stock,
and inventory #82's known ended predecessor. No duplicate eBay SKU offers or
unexplained local/remote state mismatches were found.

Hardened eBay offer creation, bulk result validation, crash recovery, publish/
restore ID handling, detached-relist write guards, and API-specific 404
classification. Hardened Etsy writable-state checks, true remote reactivation,
and manual/scheduled failure accounting. Added regression coverage for offer
duration/selection, item-level bulk failures, and Etsy lifecycle guards.

Browser-tested inventory #82's guarded Sync Updates and Push price only paths;
both stopped with the reattachment warning. `npm test` (309/309), `npm run lint
-- --max-warnings=0`, `npx tsc --noEmit`, and `npm run build` pass.

## 2026-07-16 - Fixed eBay relisted items drifting to Ended

Added a seller-authenticated Trading `GetItem` reader and structured XML parsing
for eBay relist metadata. Status verification now follows `RelistedItemID`,
checks the seller SKU at every hop, adopts an active replacement listing ID,
and rejects mismatches or malformed loops. A detached relist is shown as Live
with an explicit warning, while app-side sync, price, and delist writes are
blocked/skipped until the live listing is deliberately reattached.

Live-tested inventory #82: the old completed listing `800320565937` points to
active relist `800354878200`; two consecutive admin status checks now remain
Live and View on eBay uses the active ID. Added five regression tests for XML
parsing and relist resolution. `npm test` (305/305), `npm run lint`,
`npx tsc --noEmit`, and `npm run build` pass.

## 2026-07-16 - Reduced admin authentication, catalog, and order-page latency

Changed protected admin pages, the shared admin-action guard, and session proxy
from the always-networked Supabase `getUser()` lookup to cryptographically
verified `getClaims()`. The project exposes an ES256 public signing key, so the
SDK can verify claims locally with cached JWKS data. Database authorization still
checks `profiles.is_admin`; no trust was moved to unverified session data.

Replaced the Products page's initial `select('*')` transport with a compact
summary contract. The full private/editor product is now loaded on demand for
Edit, Duplicate, image padding, and permanent-delete cleanup. Summaries retain
all canonical image references but omit the mirrored legacy array and editor
text. Deferred the Orders page's entire product catalog and metal-price lookup
until Create Manual Order opens, and parallelized the Recycle Bin count.

Local browser measurements reduced Products generated HTML from 1,008,716 to
about 759,900 characters and serialized data from 468,404 to about 219,600.
Orders dropped from 261,444 to about 72,000 HTML characters and from 238,121 to
about 48,700 serialized characters. Browser-tested the authenticated routes,
full nine-image product editor, and populated manual-order picker without
submitting writes. `npm test` (300/300), `npm run lint`, `npx tsc --noEmit`, and
`npm run build` pass.

## 2026-07-16 - Verified order email delivery and clarified sender identity

Queried the configured Resend account for order `NEJ-20260715-HT3P1` and found
the exact customer receipt and shipped-update records. Both were sent from
`Naples Estate Jewelry <noreply@naplesestatejewelry.co>` to
`c.reatiga@yahoo.com`, and both report `delivered`. The AOL account previously
shown as `Sent by` was the signed-in admin who initiated the update, not the
email sender.

Admin Email History now shows the actual From address and labels a human sender
action as `Initiated by`, while retaining the automatic-order-confirmation
label. Hardened both customer order email paths so they only log and report
success after Resend returns an accepted email ID; API-level rejections can no
longer appear as successful history entries. `npm test` (296/296),
`npm run lint`, `npx tsc --noEmit`, `npm run build`, and the refreshed admin
browser check all pass.

## 2026-07-16 - PayPal now receives and locks the checkout delivery address

Changed shipped PayPal orders from `NO_SHIPPING` to
`SET_PROVIDED_ADDRESS` and added the validated checkout name/address to the
PayPal purchase unit. Buyers now see the same destination held on the internal
order and cannot replace it with a different wallet address during PayPal
approval. Local Pickup retains `NO_SHIPPING` and omits shipping data.

Hardened PayPal order retries so contact/address validation also runs before the
reuse branch and edited buyer/address fields are saved before a replacement
PayPal order is created. Added delivery/pickup payload regression tests.
`npm test` (296/296), `npm run lint`, `npx tsc --noEmit`, and `npm run build`
pass. A deliberate live approval-screen check remains an owner task.

## 2026-07-16 - Sold products now lock their final storefront price

Added a durable `products.sold_price` lock and applied it consistently to
storefront price display/sorting, wishlist prices, order snapshots, and Etsy/eBay
price mappings. Admin Sold actions capture the current resolved price, while
paid-order actions provide the exact `order_items.price_snapshot`. The database
trigger covers PayPal checkout and other status-only writes. Relisting an item
as Available clears the lock so manual or spot-driven updates resume.

The idempotent `supabase/product-sold-price-lock-2026-07.sql` migration also
backfills existing Sold products when an authoritative order snapshot exists.
Legacy manually Sold rows without a snapshot are intentionally not assigned an
invented historical amount. The app's compatibility reads/writes keep the local
preview usable before migration. Added Sold/Archived/relisted pricing and
marketplace regression tests. `npm test` (294/294), `npm run lint`,
`npx tsc --noEmit`, and `npm run build` pass.

## 2026-07-16 - Fixed archived product deletion and hid archives by default

Changed the Admin Products table's default Status view to `All except Archived`.
Admins can still select `Archived` for only retired listings or `All Statuses`
for the complete table, and clearing filters restores the default archive-hidden
view.

Fixed Delete repeatedly archiving a product that already had Archived status.
Products with order history still archive on the first delete as a guard. An
explicit `Delete permanently` on an already archived product now removes the
catalog row while the database retains order/invoice snapshots and nulls their
live product link. Confirmation text explains both paths.

Browser-tested the entire flow with the owner-authorized `test-item-60`: default
83/84 view, archived-only 1/84 view, permanent deletion, and final 83/83 view.
Database read-back confirmed the product is gone and its order line still has
the title, $1 price, image snapshot, and null `product_id`. No browser errors or
warnings. `npm test` (289/289), `npm run lint`, `npx tsc --noEmit`, and
`npm run build` pass.

## 2026-07-16 - Fixed invoice thumbnails missing from physical print output

Investigated the admin invoice thumbnail path after the image appeared in the
preview but left a blank spot on a laser-printer page. The live WebP URL loaded
cleanly at 1016x1200, ruling out a missing asset. The generated Print Now window
was printing immediately after writing its HTML, before remote images were
guaranteed to load or decode.

Print Now now waits for invoice images to load/error, decodes successful images,
allows the finished layout to settle briefly, and then opens the print dialog.
The wait has an eight-second fallback so printing still proceeds if an image host
is unavailable. `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass;
browser verification found a fully loaded thumbnail and no console warnings or
errors. A physical laser-printer confirmation remains after deployment.

## 2026-07-16 - Admin invoice print output now uses a 98% scale

Applied a print-only `zoom: 0.98` to both invoice printing paths: the clean
Letter-sized window opened by Print Now and direct browser printing of the
invoice page. This gives the document the same small reduction the owner was
manually selecting to keep the footer from spilling onto page two. The on-screen
invoice and preview remain full size.

Browser verification confirmed an unchanged 816px preview paper, no screen zoom,
the active 98% print-media rule, and no overflow/console errors. Focused ESLint,
`npx tsc --noEmit`, and `npm run build` pass.

## 2026-07-16 - Shipped fulfillment now saves and emails carrier/tracking details

Added optional `shipping_carrier` and `tracking_number` fields to orders through
the idempotent `supabase/order-shipping-tracking-2026-07.sql` migration and the
fresh-install sales schema. Admin order detail now requests those values when
marking an order Shipped, displays saved shipment details, and lets an admin add
or edit them on an already-shipped order.

Fulfillment email previews and delivered HTML/plain-text messages include any
saved carrier and tracking number. The server email route reads shipment values
from the authoritative order row. Added a compatibility query so order detail
continues loading before the migration is applied, with shipment tracking
controls withheld until the schema is ready.

Added two fulfillment-email tests. `npm test` (289/289), `npm run lint`,
`npx tsc --noEmit`, and `npm run build` pass. Browser-tested the pre-migration
fallback on the current shipped admin order with a clean console. Live migration
and one deliberate delivered-email check remain owner steps.

## 2026-07-16 - Additional shop walkthrough fixed hidden Silver on stale links

Ran a second customer-facing shop matrix across all 24 visible Item Types,
category/type transitions, realistic combined filters, pagination, list/grid
views, price and weight ordering, era/price controls, English/Spanish routes,
stale query strings, and the mobile filter drawer at 390x844.

Fixed one shared/bookmarked URL edge case: when a specific jewelry Item Type
supersedes `itemGroup=everything-else`, normalization now removes the category's
auto-owned metal/color/purity state as well as the category itself. The
reproduced Rings URL changed from zero results with hidden Silver filtering to
all seven Rings. Added a focused regression test. `npm test` (287/287),
`npm run lint`, `npx tsc --noEmit`, and `npm run build` pass; the browser had no
console warnings/errors or horizontal overflow.

## 2026-07-16 - Item Type menu now hides types with no public inventory

Changed the public shop's Item Type options to derive from the full public
catalog, retaining configured and dynamic types only when at least one
`available` or `sold` product uses them. The list stays stable across Category
and other filters, preserving cross-category navigation. Old links that select
a now-unavailable type fall back to All items and clear type-owned chain/length
state instead of producing a hidden zero-result constraint.

Added an availability regression test and browser-tested bare shop, category
switching, and a stale Coins URL. `npm test` (286/286), `npm run lint`,
`npx tsc --noEmit`, and `npm run build` pass; browser console remained clean.

## 2026-07-16 - Full shop-filter audit removed category/type locks and rapid-change races

Reworked public shop filter state after Coins and other non-jewelry Item Types
silently activated Everything Else, forced Silver, and removed all jewelry types
from the menu. Categories now activate only when explicitly selected; Item Type
and Brand keep complete catalog-wide option lists; choosing a specific type
releases an active category and its Silver constraint; conflicting shared URLs
are normalized; and invalid link/length/metal/purity dependents are ignored or
cleared. Added shared in-flight query composition across Filters, Sort, View,
Year, and Pagination so rapid changes no longer drop earlier selections.

Added `src/lib/shop-filter-state.ts` plus 9 regression tests. Browser-tested all
entry/switch/clear/history paths on desktop and 390x844 mobile, including
zero-result recovery and rapid multi-control changes. `npm test` (285/285),
`npm run lint`, `npx tsc --noEmit`, and `npm run build` pass.

## 2026-07-16 - eBay account-deletion flood investigated; admin activity cleaned up

Investigated why Admin Settings showed many `account_deletion` rows. Live
Supabase read-only audit found 10,922 unique processed
`MARKETPLACE_ACCOUNT_DELETION` events since 2026-07-10, almost all first
delivery attempts, so this is eBay compliance notification volume rather than
an app retry loop. Changed the eBay admin status feed to exclude
`account_deletion` from Recent eBay Activity, keeping real seller sync actions
visible. Also changed future eBay account-deletion webhook inserts to sanitize
`webhook_events.payload`, preserving notification metadata but stripping eBay
user identifiers (`username`, `userId`, `eiasToken`) before storage. Added a
sanitizer regression test. Existing live payload rows still need an
owner-confirmed DB scrub; tracked in `TASKS.md`.

Verification: eBay webhook tests 10/10 pass, `npm run lint`, `npx tsc
--noEmit`, and `npm run build` pass.

## 2026-07-16 - Hide fine-metal weight math when storefront spot/melt value is hidden

Changed the public product detail spec row so items with Admin -> "Show spot /
melt value on storefront" unchecked show only the total gram weight, not the
calculated fine gold/silver grams or fine troy-ounce breakdown. Verified against
the Rolex GMT-Master II example (`209.30 g total`) and ran `npm run lint`,
`npx tsc --noEmit`, and `npm run build` successfully.

## 2026-07-11 (continued, 2) - Removed a `sameAs` schema error; discovered naplesjewelrybuyers.com is a live competing site

While researching "what else to optimize" per the owner's ask, checked the
two "related domains" that were listed in the `JewelryStore` `sameAs`
array and in `PROJECT_OVERVIEW.md`/`CLIENTS.md`:

- **`naplesestatejewelry.com` is NOT owned.** It's a parked GoDaddy domain
  listed for sale ($2,100) — not this business's property. It was
  incorrectly added to `sameAs` in an earlier session by trusting stale
  project-doc claims without verifying. Removed it from
  `[locale]/layout.tsx`'s `sameAs` array (a wrong `sameAs` link is a real
  schema-accuracy problem, not just cosmetic) and corrected
  `PROJECT_OVERVIEW.md`/`CLIENTS.md`. Flagged to the owner as a possible
  defensive-purchase opportunity given how closely it matches the brand.
- **`naplesjewelrybuyers.com` is real, live, and independently built** —
  its own full site with `LocalBusiness`/`Jeweler` + `WebSite` + `FAQPage`
  schema, own FAQ copy, a "photo submission portal," and its own buy-side
  positioning ("Sell Gold, Silver & Jewelry in Naples, FL"). It targets
  nearly the same keywords as the `/sell` + `/sell/[city]` pages built
  earlier today on the main site — a real keyword-cannibalization risk
  between two of the owner's own properties. Not changed — this needs the
  owner's input on what that site is actually for (a separate ad-landing
  page? phased out? should be consolidated?) before touching it. Flagged
  as the top strategic SEO question going forward.

`tsc` clean after the `sameAs` fix; verified locally that the JSON-LD now
only lists the real domain.

## 2026-07-11 (continued) - GSC verified + sitemap submitted; Google Business Profile built (pending address verification)

Owner deployed the pending code changes, then asked to finish Search Console
and set up a Google Business Profile.

**Google Search Console — fully live:**
- Confirmed the deploy landed (live `sitemap.xml` now includes `/sell` +
  all 6 city pages; `/sell/fort-myers` returns 200; the verification meta
  tag is present in production `<head>`).
- Returned to the pending GSC property and re-triggered verification —
  **"Ownership auto verified"** via the HTML-tag method.
- Submitted `sitemap.xml` — Google read it successfully, **107 pages
  discovered** immediately.
- Requested indexing for the new `/sell` hub page directly (individual
  per-URL requests are quota-limited, so did not spam every city page —
  the sitemap submission already covers discovery for all 107 URLs).

**Google Business Profile — built, one manual step left for the owner:**
- Checked for name conflicts first: no existing Google Business/Maps
  listing under "Naples Estate Jewelry"; the one close match on Florida's
  Sunbiz registry (**"NAPLES ESTATE JEWELRY, INC.", doc# P98000005757) is
  status INACT** (dissolved) — safe to proceed, flagged to the owner for
  awareness.
- Created a new Business Profile: name "Naples Estate Jewelry", primary
  category **"Jewelry buyer"** (the precise buy-side GBP category),
  **service-area business** (no public storefront — matches the real
  mobile/appointment-only model; deliberately did not enter a location
  address for public display), all 6 service areas (Naples, Marco Island,
  Bonita Springs, Estero, Fort Myers, Cape Coral), phone + SMS chat number
  (239) 404-8505, website, hours Mon–Sat 10am–5pm (matches the site's
  existing `JewelryStore` schema hours exactly), and a ~540-character buy-
  side business description mentioning every service (gold, estate
  jewelry, sterling silver, diamonds, coins, watches) and every city.
  Skipped storefront/product photos (no real photos available to use —
  left for the owner) and the Google Ads $500 credit offer (a spending/
  billing decision, not something to accept unilaterally).
- **Confirmed built correctly** via the profile dashboard (name, category,
  6 service areas, hours, phone, website all present).
- **🔴 Blocked on the owner:** the profile shows "NOT PUBLICLY VISIBLE"
  until verified. Owner supplied the private mailing address (4243 30th
  Ave SW, Naples, FL — Google's address autocomplete corrected the ZIP to
  the valid 34116-8311; the owner-typed 34166 is not a real Naples ZIP)
  and it was entered and saved on the profile. **Postcard mail
  verification is no longer offered for this listing** — Google now only
  offers **video verification** (record a short video showing the
  business location/equipment/proof of management) for this
  service-area-business profile type. That requires the owner in person
  and was correctly left undone — a fabricated video would be a real
  integrity problem with Google's system, not something to fake. Saved
  progress via "Verify Later" rather than attempting it. **Owner action:**
  go to business.google.com → Naples Estate Jewelry → Get verified →
  submit a short business video when ready.
- **🟢 Duplicate profiles removed (owner-directed).** Owner asked to
  delete the 2 other unverified profiles found in the same account.
  Verified both were still unverified drafts (no live data, no reviews)
  before removing, then selected exactly "Naples Estate Jewelry Co" and
  "Naples Gold and Jewelry Buyers" (leaving the correct "Naples Estate
  Jewelry" / 04174729584373572986 unchecked) and used Business Profile
  Manager's bulk "Remove businesses" action. Confirmed via the account's
  business list afterward: **1 business remaining** — only "Naples Estate
  Jewelry."

## 2026-07-11 - Google Search Console property added (pending deploy); SEO health-checked live production

Owner asked to set up Google Search Console and submit the sitemap, using
the browser (owner already signed in to Google). Used the Claude-in-Chrome
extension (owner's real browser session) since the sandboxed preview
browser has no Google login.

- **Added the GSC property** `https://naplesestatejewelry.co` (URL-prefix
  type) via search.google.com/search-console, signed in as
  info@surettesystems.com. Chose the HTML-tag verification method (no DNS
  changes) and captured the verification token.
- **Added `verification: { google: '...' }`** to the root metadata object
  in `next-app/src/app/layout.tsx` — Next's Metadata API turns this into
  `<meta name="google-site-verification" ...>` in `<head>`, matching how
  title/OG/twitter metadata already work there. Verified locally that the
  tag renders. `tsc` clean.
- **Verification is NOT complete yet — blocked on deploy.** This project's
  production site is updated by the owner manually copying this folder to
  a separate GitHub repo (see `AGENTS.md`); confirmed live
  `naplesestatejewelry.co/sitemap.xml` still lacks `/sell` and the new city
  pages from the earlier session, so the verification tag isn't live
  either. **Owner action needed:** deploy, then ask to finish — I'll click
  Verify in Search Console and submit the sitemap (already includes
  `/sell` + all 6 city URLs from the prior session, no further sitemap
  code change needed here).
- **Ran Google's Rich Results Test against the live production homepage**
  (read-only, no auth) to sanity-check current structured data before the
  new deploy lands: 2 valid items (JewelryStore local-business + Organization),
  crawled clean. Only "non-critical" flags were the optional
  `streetAddress`/`postalCode` fields, which are deliberately omitted —
  this is a mobile, appointment-only business with no public storefront,
  and publishing a specific address for a business that transacts in
  precious metals would be a real physical-security consideration, not an
  oversight. Not changed.
- **Checked Bing Webmaster Tools** — not signed into any Microsoft account
  in the owner's browser, so did not attempt setup (would require creating
  a new Microsoft account, which needs the owner present). Flagged as a
  recommended follow-up instead.
- **Google Business Profile** — not created. This is the single highest-
  leverage remaining local-SEO lever for buy-side searches ("gold buyers
  near me", etc.) but creating one is a bigger, semi-public commitment
  (business info decisions, phone/postcard verification tied to the real
  business) that needs the owner's direct involvement, not something to
  spin up unilaterally via browser automation.

## 2026-07-11 - Brand-name sweep: "Naples Estate Jewelry & Antiques" / "Naples Antiques" cleanup

Owner asked to change every "Naples Antiques" / "Naples Estate Jewelry &
Antiques" usage to just "Naples Estate Jewelry". Swept the whole project
(`Antiques` case-insensitive across app + docs). Findings:

- **The live app already only uses "Naples Estate Jewelry."** A prior
  session (see the 2026-07-XX entry below: "Standardized the public brand
  to 'Naples Estate Jewelry' everywhere") had already dropped "& Antiques"
  from every user-facing surface — footer, JSON-LD, product schema `brand`,
  emails, page titles/metadata, translations. Nothing to change there.
- **Deliberately left as-is:** Terms/Privacy still say "operated by Naples
  Antiques LLC" — that is the actual registered legal entity name (not a
  brand choice), and the same prior session explicitly kept it there "for
  legal validity." Renaming a real LLC's legal name in a legal disclosure
  would misstate the entity, so this needs the owner's explicit sign-off if
  it should also change — flagged, not touched.
- **Left untouched (not brand-name usage):** every other "antiques" mention
  in the app (FAQ title, About page bio, Estate Services copy) uses the
  word as a service category — "jewelry, silver, antiques" — describing
  what the business actually buys, not the company name.
- **Updated the two remaining descriptive mentions** in `project-docs/`:
  `PROJECT_OVERVIEW.md`'s Project Purpose line and `CLIENTS.md`'s client
  section heading/table row, both changed from "Naples Estate Jewelry &
  Antiques" to "Naples Estate Jewelry (legal entity: Naples Antiques LLC)".
  Historical records (this changelog, `meetings/2026-06-01-notes.md`) were
  left untouched as history.

No SEO changes were needed beyond this — the brand name was already
consistent across metadata, JSON-LD, sitemap, and translations from the
prior standardization pass.

## 2026-07-11 - Buy-side local SEO: city landing pages + technical SEO fixes

Owner clarified the primary SEO goal is ranking for BUY-side searches
(people wanting to sell to us): "jewelry buyers naples", "sell gold naples",
"sell sterling naples", "sterling buyers naples", etc., across all service
cities. Implemented:

- **New buy-side local landing pages.** `src/lib/service-areas.ts` (6 cities:
  Naples, Marco Island, Bonita Springs, Estero, Fort Myers, Cape Coral, each
  with a unique intro + nearby-area list) powers a new `/sell` hub page and
  `/sell/[city]` pages (bilingual EN/ES, prerendered SSG). Each city page
  front-loads high-intent headings — "Sell Gold in {City}", "Sterling Silver
  buyers in {City}", "Sell Diamonds in {City}", etc. — plus How-It-Works,
  a 5-question local FAQ, and cross-links to the other cities. Structured
  data per city page: a city-scoped `JewelryStore` (areaServed = city +
  neighborhoods), `BreadcrumbList`, and `FAQPage`.
- **Enriched the global `JewelryStore` JSON-LD** (`[locale]/layout.tsx`):
  added `sameAs` (related domains), `logo`, `email`, `@id`, `alternateName`,
  `knowsAbout`, `makesOffer`, and expanded `areaServed` from 4 to all 6
  cities. Description reoriented to buying.
- **Reoriented site + home metadata** to buy-side keywords (root
  `layout.tsx` default title/description/OG; home `generateMetadata`).
- **Fixed the OG share image** from 1983×793 (~2.5:1) to a proper 1200×630
  (1.91:1) center cover-crop so social cards no longer letterbox/crop.
- **Wiring:** removed the `/sell`→/free-evaluation redirect (now a real
  hub); added `/sell` + all city URLs to `sitemap.ts` with hreflang; added
  an "Areas We Serve" footer section (sitewide internal links) and pointed
  the header "Sell To Us" nav at the `/sell` hub; changed the footer's
  first column from shop links to sell-to-us links. Sitemap static-page
  `lastModified` now uses a stable content date instead of churning "now".

Icons on the new pages use only glyphs already present in the committed
Material Symbols subset (the full font isn't in the repo to regenerate
from): paid, redeem, star, diamond, toll, watch, call, home, payments,
verified_user — each verified to resolve in the subset and to render as a
single glyph (rendered width == font-size) in the live preview.

`tsc`/`lint` clean; `npm run build` succeeds with `/sell` and all 6
`/sell/[city]` routes as SSG (● in the manifest, EN+ES). Verified live in
preview: correct titles, self-referencing canonical + en/es/x-default
hreflang, all four JSON-LD blocks present and valid, sitemap includes the
new URLs, footer links render, no console errors.

## 2026-07-10 - Added instant "press" feedback to shop buttons whose effect isn't immediately visible

Owner reported that clicking some shop buttons gave no indication anything
happened until the page finished loading/filtering. Added a CSS `:active`
press animation (quick scale-down, ~50ms) to every shop control whose click
triggers an async navigation/filter rather than an instant local UI change:
the Category buttons (Jewelry & Watches / Everything Else), the product
card photo prev/next arrows, era filter buttons + reset, the gallery/list
view toggle, pagination controls, length filter chips, clear-filters
buttons, the price-range reset, the "Save and Apply Filters" button, and
the shared `.gold-button`/`.outline-button` classes used site-wide
(including the shop's "Filters" toggle). Native `<select>` dropdowns
(sort, metal, brand, etc.) were left alone since opening the dropdown is
already immediate feedback. All new transforms respect
`prefers-reduced-motion`. `tsc`/`lint`/`build`/`vitest` (275/275) clean;
verified live that filtering still works correctly after the change and
that every new `:active` rule is present in the compiled stylesheet.

## 2026-07-10 - Fixed: shop "Jewelry & Watches" / "Everything Else" filter buttons silently no-op'd in production

Owner reported the shop's Category sidebar buttons stopped working. Root
cause: the 2026-07-09 (session 12) "shop performance" work added a
`next.config.ts` rewrite sending bare `/shop` (no filter query params) to a
static/ISR twin page (`shop-index`) for faster first loads. That rewrite
broke client-side filter navigation in a real production build — verified
live in dev only, never in a production build, so the regression went
unnoticed. Once a visitor's browser had been routed through the static twin,
every subsequent filter click (category buttons, and likely metal/brand/
sort/etc.) updated the URL via `router.push()` but the page content silently
stayed unfiltered. Confirmed via a local production build (`next build && next
start`): a full page load of a filtered URL always rendered correctly, but a
soft client-side navigation from the bare page never picked up new search
params. Fixed by removing the `/shop` → `/shop-index` rewrite and deleting
the now-orphaned twin page, restoring `/shop` to the single always-dynamic
route it was before session 12. `tsc`/`lint`/`build`/`vitest` (275/275) all
clean; verified live in a production build (not just dev) on both desktop
and mobile viewports — category buttons now correctly filter, toggle
active state, and deselect on re-click. See `DECISIONS.md` 2026-07-10 for
the full root-cause writeup.

## 2026-07-09 - eBay sync built: Phase 0 webhook + Phase 1 + Phase 2, code-complete

Implemented the full eBay sync integration from `ebay-sync-plan/` per
`BUILD-PROMPT.md`: the account-deletion compliance webhook
(`/api/webhooks/ebay-account-deletion`), `lib/ebay/` (client/auth/mapping/
sync/store, mirroring `lib/etsy/`'s shape), 16 admin API routes under
`/api/admin/ebay/`, `supabase/ebay-sync.sql` (written, not run), and the
admin UI (`EbaySettingsPanel`, `EbayProductPanel`, `EbayBulkSyncModal`,
wired into `AdminSettingsPanel.tsx`/`AdminShell.tsx`). Added the eBay
auto-delist/relist hook next to every existing Etsy call at all three
product-status chokepoints (`app/actions/admin-products.ts` ×2,
`app/api/paypal/capture-order/route.ts`, `app/api/paypal/webhook/route.ts`).
238 vitest tests pass (58 new eBay tests + all 180 pre-existing tests
unchanged); `tsc`/`lint`/`build` all clean. No live eBay account was
available to verify against — see `project-docs/features/ebay-sync.md` for
every `TODO(ebay-verify)` and `ebay-sync-plan/OWNER-SETUP.md` for the
finalized manual setup + verification checklist.

## 2026-07-09 - eBay Business Policies created live; new price-tiered express shipping feature (Q16)

Created all four Business Policies on the owner's real eBay account via
browser automation, owner-confirmed at each decision point: two shipping
policies (standard "NEJ Insured Flat Rate" and a new "NEJ Express
High-Value" tier), one return policy, one payment policy. Mid-session the
owner requested an automatic price-based shipping upgrade — items over an
admin-editable threshold (seeded $1000) route to the express policy instead
of the standard one — recorded as Q16 and threaded through the field
mapping, database schema, admin UX, account-prerequisites, sync-lifecycle,
BUILD-PROMPT, and OWNER-SETUP docs. The policy choice is a pure mapping-time
branch in our own sync code; eBay's Business Policies have no conditional
logic themselves. `OWNER-SETUP.md` step 7 is now marked done with the real
policy names. No app code or database changes — only live eBay account
configuration and plan documentation.

## 2026-07-09 - eBay plan build-ready: BUILD-PROMPT.md and OWNER-SETUP.md added

Completed the handoff artifacts in `ebay-sync-plan/` (same sequence the Etsy
plan followed): `BUILD-PROMPT.md` is the verbatim implementing-agent prompt
with the 15 decided answers encoded as hard requirements plus a
never-modify-the-Etsy-integration rule; `OWNER-SETUP.md` is the ordered
10-step manual checklist (registration → migration → env vars → deploy →
keyset-activating account-deletion subscription → RuName → Seller Hub
policies → connect → live verification → optional cron), marked DRAFT until
the build finalizes file:line specifics. README index updated. Owner can
start the registration and Seller Hub policy steps immediately; everything
else waits on a build greenlight.

## 2026-07-09 - eBay plan: all 15 owner decisions made; plan docs updated in place

Same-day follow-up to the entry below: the owner answered every question in
`ebay-sync-plan/13-open-questions.md` (now rewritten in the decided format,
reasoning preserved). Notable non-defaults: **coins/bullion are excluded
from eBay** (jewelry/watches/silverware only — narrower than the Etsy
full-catalog choice, which deletes the coin grading regime and bullion
policy handling from scope), and **selling limits are confirmed a
non-issue** (owner's existing account holds the catalog easily — limit
checks stay only as informational safety nets). Everything else landed on
the recommended defaults: review-first publishing, admin-variable markup
seeded 15%, Etsy-style daily 1%-threshold price push, vermeil→Fashion
Jewelry, standard Pre-owned condition template, quantity-zero sold
handling, flat-rate insured+signature/30-day-returns/immediate-pay
policies, Best Offer off, subscribe to account-deletion notifications,
SKU = products.id, no Store subscription, Phase 3 deferred. Affected plan
docs updated in place. Still planning-only — no code, SQL, or eBay-side
setup.

## 2026-07-09 - eBay sync architecture plan written (planning only, no code)

New `ebay-sync-plan/` folder at the project root: a 17-doc architecture plan
for pushing the catalog to eBay as a second secondary channel, deliberately
mirroring `etsy-sync-plan/`'s structure and grounded in deep research of
eBay's RESTful APIs (OAuth, Sell Inventory/Account/Metadata/Fulfillment,
Commerce Taxonomy/Media/Notification, call limits, sandbox, compliance).
Key design outcomes: ~3–4 API calls per publish (eBay ingests our public
WebP image URLs itself — no transcode/upload pipeline), non-rotating
18-month refresh token, review-first publishing because eBay has no draft
state, quantity-zero + Out-of-Stock Control for sold items, and a Phase 0
marketplace-account-deletion webhook that gates production keyset
activation. 15 owner decisions collected in
`ebay-sync-plan/13-open-questions.md` — **all OPEN**; no code, SQL, or
eBay-side setup has happened. Existing functionality (including the live
Etsy sync) is untouched; the only planned shared edit is Phase 2 adding an
eBay call next to the Etsy call at the existing product-status chokepoints.

## 2026-07-09 - Bare /shop is now static/ISR; facet query slimmed down

Split `/shop` into two pages: the existing dynamic page (unchanged, still
handles every real filter/sort/page/search) and a new static/ISR twin
(`shop-index`) that a `next.config.ts` rewrite routes bare `/shop` requests
to when no filter query params are present — URL stays `/shop` throughout.
Build manifest confirms the split (`● shop-index` SSG vs `ƒ shop` Dynamic).
Also narrowed the facet-only catalog query (Brand/Item Type dropdown
options) from ~31 columns to ~12, dropping the heavy image JSONB fields;
verified brand options are identical before/after across several filter
combinations. Full DB-side range-pagination was scoped but deliberately not
implemented — most real filters are JS-only today (including price range,
which needs the live, non-stored spot price), so a safe fast path is
narrower and riskier than it sounds; see `DECISIONS.md` for the full
reasoning. Also found (not this session's work) that the icon-font
subsetting and oversized-image sub-items from the same backlog entry were
already done by earlier sessions. `tsc`/`lint`/`build`/171 vitest tests all
pass; verified live in the preview (correct content + interactivity across
bare/filtered/sorted/paginated URLs, desktop/mobile/ES, no console errors).
Netlify CDN cache-hit behavior itself needs confirming after a real deploy —
dev mode never performs real static generation.

## 2026-07-09 - Owner confirmed the remaining pending items too (Quantity/special-price/show-spot-price migrations; CSP)

Follow-up to the same-day entry below: owner confirmed the Quantity
migrations, `product-special-price-override-2026-07.sql`,
`shop-special-price-default-2026-07.sql`, and `product-show-spot-price-2026-07.sql`
are applied and working live. Checked CSP directly against `netlify.toml`
(not live testing) and found it was **already enforcing**, not Report-Only
as the stale Backlog item claimed — no code change needed. The deferred shop
performance work (DB pagination, static/ISR, ProductCard refactor, image
re-encoding, icon font subsetting) was explicitly confirmed still open —
it was never built, so it stays in Backlog rather than being marked done.
See `DECISIONS.md` 2026-07-09 (session 12, addendum).

## 2026-07-09 - Owner confirmed a batch of pending items live in production

Documentation-only update: owner confirmed PayPal checkout is live in
production (go-live blocker resolved), the Buyers + marketing-audience SQL
migrations are applied and working, Etsy sync is verified live end to end
(bulk-sync recovery, ineligible-silver fix, length/ring-size auto-push, tags,
markup/price push, necklace→Chains, corrected bracelets, custom tags, and the
remaining core-pipeline checklist), and the session 10-11 UX/email items
(Ship to→Address relabel, AI Prompt accordion, owner new-order email,
checkout stock-awareness + card-error paths) all work as built. `TASKS.md`
Backlog trimmed accordingly; see `DECISIONS.md` 2026-07-09 (session 12) for
the full list and what's explicitly still open.

## 2026-07-09 - "Combined" audience now genuinely means all three sources

"Combined" on Compose Campaign now actually combines Newsletter subscribers +
Account holders + Buyers (previously deliberately Newsletter+Accounts only).
Since the same audience-builder feeds the separate `/admin/subscribers`
"Reachable Recipients" page, this surfaced a real mislabeling bug there — a
buyer-only contact would have shown as "Newsletter subscriber" (wrong).
Fixed by replacing the old binary "both" value with a proper sorted
multi-source combination (e.g. "account+buyer") and updating the Source
column to render every combination correctly instead of only the two it
originally knew about. `tsc`/`lint`/`build` pass; `vitest` 171/171 (+4 new
tests). Not yet verified live. No new migration required.

## 2026-07-09 - New gold palm tree favicon

Replaced the browser-tab icon with the owner's new gold palm tree artwork.
This Next.js version's icon file convention doesn't support `.webp` (only
ico/jpg/jpeg/png/svg), so compressed it as a trimmed, padded, transparent
**PNG at 64×64 (4.2 KB)** instead via `sharp`, and swapped
`app/favicon.ico` for `app/icon.png`. Also added `icon` to the `proxy.ts`
middleware matcher's exclusion list alongside `favicon.ico` (defensive —
the actual route already happened to be covered by the generic extension
exclusion, but shouldn't rely on that incidentally). Verified live on both
`/en` and `/es`: correct `<link rel="icon">` tag, direct fetch returns `200
image/png` at the exact byte size on disk, no console errors. `tsc`/`lint`/
`build` pass. Deleted the leftover source PNG after confirming it worked.

## 2026-07-09 - Email Campaigns: "Buyers" added as a fourth audience

Added **Buyers** as a 4th selectable audience in the admin Email Campaigns
Compose Campaign form, alongside Newsletter subscribers / Account holders /
Combined. Along the way, gave `buyers` a real `marketing_opt_out` column so
a Buyers campaign correctly skips anyone who already unsubscribed (via the
newsletter, their account, or a prior buyers-only unsubscribe) — the
unsubscribe endpoint now updates all three tables, and the buyer-upsert
trigger carries forward a pre-existing opt-out for brand-new buyer rows
(never resets it on a later order). Also widened the `email_campaigns`
audience-scope CHECK constraint, which would otherwise have rejected a
Buyers-scope send at the database level. "Combined" is unchanged — still
Newsletter + Accounts only, not redefined to include Buyers.
`tsc`/`lint`/`build` pass; `vitest` unchanged at 167/167. Not yet verified
live (no admin session available in this environment).
**Requires running `supabase/marketing-buyers-audience-2026-07.sql`** (after
`buyers-2026-07.sql`) before the new audience option will work.

## 2026-07-09 - Buyers tab: select rows + Copy Selected Emails

Added row checkboxes (individual or "select all", with a proper
indeterminate state) to the admin Buyers table, plus a **Copy Selected
Emails** button that copies the selected rows' emails as a comma-separated
list via the existing shared clipboard helper. Deleting a row also removes
it from the current selection. No bulk-delete added — just select + copy, as
asked. `tsc`/`lint`/`build` pass. Not yet verified live (no admin session
available in this environment).

## 2026-07-09 - New admin "Buyers" tab: auto-populated customer directory

Added a **Buyers** tab to the main admin nav (between Orders and Messages):
a table of every customer who's ever paid for an order (Name/Email/Phone/
Orders/Total Spent/Last Order), with a delete action per row. Populated by a
**database trigger** on `public.orders` — not application code — because the
app has two independent order-creation paths (the PayPal RPC flow and the
admin's own manual-order form, which inserts directly with no shared code
path) and only a table-level trigger reliably catches both. Fires once per
order's real transition into `payment_status = 'paid'`, so abandoned/unpaid
carts never appear and a later edit never double-counts. A one-time backfill
in the same migration populates existing order history so the tab doesn't
start empty. Deleting a buyer only removes their directory row — their
orders/invoices are untouched, and they're re-added automatically the next
time they pay for something. `tsc`/`lint`/`build` pass; `vitest` unchanged at
167/167. Partially verified live (auth-redirect behavior only — no admin
session available in this environment to exercise the full list/delete flow).
**Requires running `supabase/buyers-2026-07.sql` in Supabase before the tab
will show anything but an error banner.** First run surfaced a real bug in the
migration itself — RLS + a policy but no base table grant, so Postgres denied
every role outright ("permission denied for table buyers") — fixed same-day
by adding the missing `grant ... to authenticated` line; the file is
idempotent, so re-running it (or just the new grant line) is all that's
needed.

## 2026-07-08 - Buyer receipts/invoices: "Ship to" becomes "Address" for Local Pickup orders

A Local Pickup buyer who optionally fills in an address (via the checkout's
address accordion) used to see it labeled **"Ship to"** on their receipt/invoice
email, even though nothing is being shipped. Fixed at the shared source
(`buildInvoiceEmailContent()` in `order-invoice-email.ts`), so it covers the
initial receipt, the admin's manual resend, the admin's email preview, and the
Print Invoice page all at once: now shows **"Address"** instead of **"Ship to"**
whenever `shipping_method` is `pickup`. Real shipping orders are unchanged. The
checkout's own on-page/printable "Order Received" receipt (`CheckoutClient.tsx`)
got the matching fix — it previously hid the address entirely for Local Pickup
even when one was provided; now it shows "Address" when present, same as the
email. The owner's own new-order notification email was deliberately left
as-is (owner-facing, not buyer-facing — outside this request's scope).
`tsc`/`lint`/`build` pass; `vitest` 167/167 (+3 new tests). Not yet verified live
(no local dev server could be started — another chat's server holds Next's
single-instance lock on this project directory).

## 2026-07-08 - Admin Settings: AI Listing Assistant Prompt also collapses into an accordion

The **AI Listing Assistant Prompt** section on `/admin/settings` (a 460px-tall
textarea that used to always render open, pushing every other settings panel
down) now loads **collapsed behind an accordion**, matching the checkout address
accordion. Click the header to expand/collapse (chevron flips); the prompt
editor and its Copy/Edit/Save/Restore controls only render while expanded. Pure
UI change in `AdminSettingsPanel.tsx` (new `promptExpanded` state), reusing the
same collapsible-header pattern already used in the admin product editor.
`tsc`/`lint`/`build` pass. Not yet verified live — no local dev server could be
started this session (another chat's server already held Next's single-instance
lock on `next-app`); verify by loading `/admin/settings` once free.

## 2026-07-08 - Checkout: address collapses behind an "Address (optional)" accordion for Local Pickup

When the shipping method is **Local Pickup**, the address fields (not needed for
pickup) are now hidden behind a collapsed **"Address (optional)"** accordion the
buyer can expand if they still want to provide one — the inputs stay optional (no
required markers). For any real shipping method the address is unchanged: always
shown and required, with the ship-to helper text. Purely a checkout UI change in
`CheckoutClient.tsx` (new `addressExpanded` state; inputs render when
`needsShipping || addressExpanded`). `tsc`/`lint`/`build` pass; verified in the
preview across all three states (shipping → shown+required; pickup → collapsed
accordion; expand → optional inputs; no console errors).

## 2026-07-08 - Owner now emailed on every new (paid) order

Previously a new order only appeared in the admin Orders list (the customer got a
receipt, but the owner got no direct email). `finalizePaidOrder` now also sends a
best-effort **owner notification** to `info@naplesestatejewelry.co` (override with
`ORDER_NOTIFICATION_EMAIL`) summarizing the order: number, total, customer
name/email/phone, line items, totals, fulfillment method + ship-to, customer
notes, and a "View order in admin" button. Sent from the verified
`noreply@naplesestatejewelry.co`, with **reply-to set to the buyer** so the owner
can reply straight to the customer. Fires alongside the customer receipt on both
capture paths (client route + webhook backstop), so it's covered even if the
buyer's browser dies after approval. Best-effort — a mail failure never affects
the completed payment; degrades gracefully if `products.quantity` isn't present
yet. New `lib/order-owner-notification.ts`. `tsc`/`lint`/`build` pass.

## 2026-07-08 - Checkout: graceful, escalating message for unknown PayPal (card) errors

A buyer paying via PayPal's hosted debit/credit-card form was bounced back with a
generic error and no guidance. Now the generic PayPal `onError` (a failure we
can't attribute — the likely card-decline case) gives card-specific help that
escalates: the **first** time it suggests re-entering and double-checking the card
number "just in case"; the **second** consecutive time it suggests trying a
different card (or calling us). The count is kept in `sessionStorage`
(`nej-checkout-unknown-errors`) so "sent back a second time" is detected even if
the card flow did a full-page redirect; it clears on a completed payment. A live
stock re-check still runs in parallel, so if the real cause was a sold-out item
the summary flags it instead. Availability-caused and create-order errors are
unaffected (they show their own specific messages and don't count toward the card
escalation). Pure helpers extracted to `lib/checkout-error-messages.ts` and
unit-tested. `tsc`/`lint`/`build` pass, 164 tests (+5).

## 2026-07-08 - Checkout/cart stock awareness: availability shown, re-checked, and clearer sold-out errors

A buyer trying to pay for an item that had sold out got only an opaque "Something
went wrong with PayPal." Now stock is surfaced and re-checked throughout:

- **Live availability on the checkout order summary** — each item shows **In
  stock** / **N available** / **Sold out — no longer available**. If anything is
  unavailable, the PayPal button is replaced with a clear "remove it to continue"
  message so the buyer never hits the opaque error.
- **Re-check on load + after a PayPal error** — checkout re-reads each item's live
  status/quantity when it loads and again if create-order/capture fails, so the
  summary updates immediately when a buyer is sent back after an error.
- **Cart drawer re-checks on open** — opening the cart re-verifies stock and shows
  an "Availability changed" banner naming anything that sold out (or dropped below
  the requested quantity) while it sat in the cart; quantities are re-clamped to
  live stock.
- **Clearer PayPal errors** — the generic "Something went wrong with PayPal" note
  now adds that a just-sold-out item may be the cause and to check the summary;
  create-order/capture failures caused by availability show a specific message
  (item sold out / won by another buyer) instead of the generic one.

Availability logic is centralized in `CartContext` (`refreshAvailability` +
`stockAlerts`), shared by the drawer and checkout via a new `StockAlertBanner`.
Reads degrade gracefully if the `quantity` column isn't present yet (status-only).
No migration required. `tsc`/`lint`/`build` pass, 159 tests; verified in-browser
(sold-out item → banner + labels + blocked pay; all-available → normal checkout;
drawer banner on open; no render loop — bounded re-check).

## 2026-07-08 - Etsy sync: custom tags + title-word broadening (⚠️ SQL migration pending)

Two tag improvements on the product drawer's Etsy section:

1. **Custom tags.** New "Additional tags" field (comma-separated) persisted per
   product on `etsy_listings.extra_tags`. `mapTags()` merges them into the
   auto-generated set **first** (guaranteed within Etsy's 13-tag cap), through
   the same clean/dedup/clamp path. New `PUT /api/admin/etsy/tags`; the dry-run
   preview returns the raw custom tags to prefill the field, and the Tags line
   shows the merged result. Re-sync pushes changes to an already-listed item.
2. **Title-word broadening (the "charm" fix).** A "…Charm Bracelet" typed only
   as a Bracelet produced no "charm" tag because tags came only from structured
   fields. `mapTags()` now also pulls meaningful words from the **title** —
   type-word phrases first ("charm bracelet"), then standalone words ("charm",
   "byzantine", "figaro"…) — filtering metal/karat/color/unit/number/grammar
   noise and the product-type word itself, capped so it can't crowd out the
   estate/vintage/antique tags.

**⚠️ Run `supabase/etsy-listings-extra-tags-2026-07.sql`** (adds
`etsy_listings.extra_tags text[]`). Reads degrade gracefully until then — the
title-word broadening works immediately (no schema dependency); only the custom
tags need the column. `tsc`/`lint`/`build` pass, 159 tests (+5). Admin drawer UI
build/type-verified (needs an admin login to drive live).

## 2026-07-08 - Shop mobile/tablet: search bar under Filters, piece count moved to toolbar

On mobile/tablet the long pill under the **Filters** button showed the piece
count ("74 pieces") while the search box was hidden inside the collapsed filter
panel. Swapped the roles: that field is now an always-visible full-width
**search bar**, and the piece count moved down beside the view-toggle buttons in
the results toolbar. Implemented responsively — the `.shop-filters-meta` block in
`ShopFilters.tsx` renders a search input below 1024px and the count pill at/above
1024px (desktop sidebar is unchanged), and `shop/(list)/page.tsx`'s toolbar gained
a mobile/tablet-only `.shop-toolbar-count` beside `ShopViewToggle`. The mobile
search binds to the same `q` param as the sidebar search; Clear Filters is
preserved. `tsc`/`lint`/`build` pass; verified in the preview at mobile (375px),
tablet (768px), and desktop (1280px) — search filters live (`?q=ring` → "12 of 78
pieces"), no console errors.

Follow-up: adding the count beside the view toggle squeezed the Sort control and
the `<select>` overflowed its pill on mobile. Root cause was pre-existing — the
base `.shop-gallery-sort select { min-width: min(11.5rem, 56vw) }` rule sits
*after* the mobile `min-width: 0` override in source order, so at equal
specificity it won and the select couldn't shrink. Fixed by bumping the mobile
override's specificity (`.shop-gallery-toolbar .shop-gallery-sort select`) so the
select shrinks to fit. Verified: select drops from 184px → 141px, no container or
page overflow.

## 2026-07-08 - Fixed failing deploy: PAYPAL_ENV false-positive in Netlify secrets scan

A deploy failed at "building site" because Netlify's secrets scanner detected
`PAYPAL_ENV`'s value across hundreds of build-output files. `PAYPAL_ENV` is not a
secret — its only values are `sandbox`/`live` (`next-app/src/lib/paypal.ts`), a
generic word the scanner substring-matches throughout vendored JS and rendered
pages. Added `PAYPAL_ENV` to `SECRETS_SCAN_OMIT_KEYS` in root `netlify.toml`,
mirroring the existing `PAYPAL_CLIENT_ID` whitelist. `PAYPAL_CLIENT_SECRET`
remains excluded from the omit list and server-side only. Re-copy the folder and
redeploy to clear the failure; the `PAYPAL_ENV` env var stays set in Netlify.

## 2026-07-08 - Checkout now defaults to shipping instead of local pickup

The buyer checkout flow previously defaulted the shipping method to **Local
Pickup** (the first `SHIPPING_OPTIONS` entry), which left the address fields
optional and assumed the buyer would collect in person. Since most buyers need
the item delivered, the default is now **Priority Insured ($45)** — a new
`DEFAULT_SHIPPING_METHOD` export in `OrderSummary.tsx` that `CheckoutClient.tsx`
seeds its `shippingMethod` state from. As a result the Street Address / City /
State / ZIP fields are required by default (they already gate on
`needsShipping`), and a buyer who wants to collect locally must deliberately
switch the shipping dropdown to Local Pickup. The Address section also gained a
bilingual helper line — "We’ll ship your order to this address. Prefer to pick
it up in person? Switch the shipping method to Local Pickup in your order
summary." — pointing buyers to the opt-in. No server change needed — the
create-order route already drives address requirements and totals off the
submitted method (its `?? 'local-pickup'` is only a fallback for a missing
value). `tsc`/`lint`/`build` all pass; verified in-browser (default select =
Priority Insured, address fields required, $45 shipping, helper line renders, no
console errors).

## 2026-07-08 - Etsy markup→price workflow made explicit + admin status chips refresh after a sync

Changing the Etsy price markup then "Sync All" left live prices unchanged
because "Sync All" skips already-live items by design — re-pricing is the job of
**"Push prices to Etsy now"** (Settings → Etsy Sync), which existed but wasn't
discoverable. Now a saved markup change flags prices as stale and shows a
highlighted callout above that button (button turns gold) guiding the owner to
push; the flag clears after the push. Separately, `AdminShell`'s Etsy status
chips (a single local DB read — no Etsy API) now refresh after the bulk sync
modal closes and after any per-item drawer action (new `onSynced` prop on
`EtsyProductPanel`), instead of only on mount. No migration; no owner action
beyond deploy. `tsc`/`lint`/`build` pass, 154 tests green. Confirmed working
live by the owner.

## 2026-07-08 - Site-wide customer trade-in price default (⚠️ SQL migration pending)

New **Customer Trade-in Price** panel in Admin → Settings: set the "Own gold or
silver? … pay as little as ___" product-page line to a signed percent over/
under the spot melt value for every item at once (negative = below spot). The
existing per-item override still takes precedence. Centralized in
`resolveAdvertisedTradeInPrice()` (`types/product.ts`): per-item override → site
default → plain melt value. Stored on the single-row `shop_settings` table
(`special_price_default_enabled`/`special_price_default_percent`); the
shop-settings admin route now takes a partial patch so the existing Shop
Visibility toggle is unaffected. Reads degrade gracefully pre-migration, so the
storefront is unchanged until the column is present. **⚠️ Run
`supabase/shop-special-price-default-2026-07.sql`** to enable. `tsc`/`lint`/
`build`/141 tests pass (5 new precedence tests).

## 2026-07-08 (later) - Etsy sync built: Phase 1 + Phase 2 code-complete (unverified live)

Implemented the full Etsy sync feature per `etsy-sync-plan/BUILD-PROMPT.md`:
`next-app/src/lib/etsy/` (client/auth/mapping/images/sync/store), 13 routes
under `/api/admin/etsy/*`, the Etsy Sync admin settings panel, a per-product
status chip + dry-run/sync/delist drawer section, a bulk "Sync All to Etsy"
modal, and Phase 2 auto-delist/relist hooked into the existing
`adminRevalidateProduct(s)`/PayPal capture/webhook chokepoints. SQL migration
(`supabase/etsy-sync.sql`, 5 tables + a queue-claim RPC) is written but not
run. Added `sharp` (explicit) and `vitest` (new test runner) as dependencies;
48 new unit tests added and passing. Fixed a timezone bug in the vintage-year
cutoff math (`getFullYear()` → `getUTCFullYear()`) found while testing.
`npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test` all pass.
Not verified live (no Etsy credentials/sandbox in this environment) and
browser UI verification was blocked by a pre-existing, unrelated dev-server
issue (every route 404s, including untouched pages). Full detail:
`project-docs/features/etsy-sync.md`; owner steps: `etsy-sync-plan/OWNER-SETUP.md`.

## 2026-07-08 - Admin carousel visible-count inputs + remove show-price toggle

- Fixed carousel admin "cards visible at once" fields (desktop/mobile): allow
  clearing/typing freely; validate `3`–`12` only on Save with an error notice.
  Removed non-functional "Show price on carousel" UI (always saves false).
  Verified: `npm run lint` pass.

## 2026-07-07 (latest) - Fix shop list view blank initial load (CustomerReveal)

- `/shop?view=list` appeared as a white page below the header until scroll.
  `CustomerReveal` hid the shop wrapper at `opacity: 0` while waiting for every
  lazy-loaded list thumbnail; gallery was already skipped via `.shop-product-grid`
  but list was not. Updated `CustomerReveal.tsx` to also skip `.shop-product-list`
  containers and to exclude `.shop-list-row` / `.shop-entry-reveal` (shop runs
  its own reveal). Verified: list load + gallery→list toggle; `npm run lint` +
  `npm run build` pass.

## 2026-07-07 - Icon font: restore v357 alias + stronger subset (fix 404 → ligature-text regression)

- User reported icons fixed mid-session then broke again after a hard refresh.
  Dev-server logs showed the browser was still requesting the **deleted**
  `material-symbols-subset-v357.woff2` (404). With `font-display: block`, a
  missing font falls back to showing ligature names as raw text — exactly the
  regression. Likely cause: cached HTML/preload still pointed at v357 while the
  file had been removed during the v358 swap.
- Regenerated the subset (still `v358`, now 59,112 bytes / 168 glyphs) with the
  full `a-z0-9_` component-alphabet baseline so GSUB ligatures stay stable, and
  **also wrote an identical `material-symbols-subset-v357.woff2` alias** so any
  cached page requesting the old filename gets a real font (both URLs now 200).
- Added standard `font-feature-settings: 'liga'` alongside the existing
  `-webkit-` rule in `globals.css`. `regenerate-material-symbols-subset.py`
  now always emits the legacy alias copy.
- Verified: both font URLs return `200`; `npm run lint` + `npm run build` pass.

## 2026-07-07 - Fix icon ligature text flash: regenerate subset (v358, includes drag_indicator)

- Icons such as `drag_indicator` in the admin product table were rendering as
  raw ligature text again. Root cause: the v357 subset was built from quoted-
  string extraction only; icons whose names sit on their own line inside a
  `<span class="material-symbols-outlined">` (multiline JSX) were never included.
- Regenerated the subset as `material-symbols-subset-v358.woff2` (58,144 bytes)
  via `next-app/scripts/regenerate-material-symbols-subset.py`, which now scans
  element text (including multiline), `icon:` fields, ternaries in `{…}` icon
  spans, and quoted literals, then keeps only names that resolve to real GSUB
  ligatures (unwrapping Material Symbols' ExtensionSubst → ligature lookups).
  Coverage is a superset of v357 (132 resolved icons; adds `drag_indicator`,
  `filter_list`, `colorize`, `receipt_long`, etc.; loses none).
- Updated `@font-face` + `preload` to v358; deleted v357 subset. Documented the
  multiline-extraction gap and the regen script in DECISIONS.md.
- Verified: `npm run lint` + `npm run build` pass; all resolved icons present in
  the new subset.

## 2026-07-07 - Customer special pricing: add "percentage over spot" override mode

- The per-item override for the "Own gold or silver? Put it toward this piece
  and pay as little as ___" trade-in line can now be expressed two ways instead
  of just a flat dollar amount:
  - **Fixed amount ($)** — the existing behavior (`special_price_override_amount`).
  - **Percentage over spot** — `meltValue * (1 + percent/100)`, which auto-tracks
    the live spot price (`special_price_override_percent`).
- DB: new `special_price_override_mode` (`'amount'` default | `'percent'`) and
  `special_price_override_percent numeric(6,2)` columns
  (`supabase/product-special-price-percent-2026-07.sql`, mirrored into canonical
  `supabase/products.sql`). Existing rows default to `'amount'`, so behavior is
  unchanged until an admin opts a listing into percent mode. **Run the new SQL
  migration in Supabase.**
- Types: `resolveSpecialTradeInPrice(product, meltValue)` +
  `normalizeSpecialPriceOverrideMode()` in `types/product.ts` replace the direct
  amount lookup at the product-page call site (`shop/[id]/page.tsx`), which now
  passes the computed melt value so percent mode resolves against real spot.
- Admin add/edit (`AdminShell.tsx`): when the override is on, an **Override Type**
  select toggles between the amount field and a percent field; percent mode shows
  a live preview of the resulting dollar figure at the current spot price. Save
  payload stores only the field for the active mode (clears the other), and
  validation requires the right field per mode.
- Verified: `npm run lint` + `npm run build` pass.

## 2026-07-07 - Subset Material Symbols to ~65KB (fixes icon-name-as-text rendering bug)

- Fixed icons rendering as raw ligature text ("shopping_bag", "chevron_right")
  scattered across the site: with `font-display: block`, the self-hosted 2.33MB
  variable font blew past the ~3s block window on real connections and fell back
  to showing the ligature names as text.
- Subset the woff2 to only the ~156 icons actually used
  (`material-symbols-subset-v357.woff2`, 66,204 bytes — a 97% cut from 2.33MB),
  keeping the FILL/opsz/wght variable axes so all `fontVariationSettings` uses
  still work. Deleted the full 2.33MB font (it must not ship in `public/`).
- Added a `preload` for the subset in `[locale]/layout.tsx` `<head>`
  (`crossOrigin="anonymous"` to match the CORS webfont fetch) so it lands inside
  the block window — icons paint immediately, no text flash.
- Ligature-font subtlety + exact regeneration steps recorded in DECISIONS.md
  (naive `--text` subsetting keeps all glyphs because the icon set uses every
  letter; must subset by resolved ligature target glyphs with `--no-layout-closure`).
- Verified: `npm run lint` + `npm run build` pass; all 156 used icons resolve in
  the subset; dev server serves it `200 font/woff2` 66,204 bytes, the preload is
  in the HTML, and the old 2.33MB URL now 404s.

## 2026-07-07 - First-paint: self-host Material Symbols (drop render-blocking font link)

- Removed the render-blocking third-party stylesheet
  (`<link rel="stylesheet" href="fonts.googleapis.com/...Material+Symbols...">`)
  and both Google `preconnect`s from `[locale]/layout.tsx` `<head>`. On
  high-latency mobile this external CSS sat on the critical render path and
  delayed first paint.
- Self-hosted the icon font instead: the exact variable woff2 Google served
  (all `opsz,wght,FILL@20..48,100..700,0..1` axes) is committed to
  `public/assets/fonts/material-symbols-outlined-v357.woff2` (2.33MB) and
  declared via an inline `@font-face` + `.material-symbols-outlined` base rule in
  `globals.css`. Served same-origin under the existing `/assets/*` immutable
  cache; `font-display: block` (unchanged intent) keeps glyphs invisible until
  loaded rather than flashing raw ligature text. Versioned filename keeps future
  updates cache-safe. All existing `fontVariationSettings` (FILL/wght/opsz) still
  work since it's the same variable font.
- Body fonts (caslon/hanken) were already self-hosted by `next/font`, so no
  runtime Google Fonts connection remains at all.
- Verified: `npm run lint` + `npm run build` pass; dev server serves the font
  (`200 font/woff2`, 2,333,768 bytes) and the page HTML no longer references
  `fonts.googleapis.com`. CSP unchanged (`font-src 'self'` already allowed;
  leftover Google allowances are harmless).

## 2026-07-07 - Homepage boot splash covers cold mobile/tablet loads

- Problem: the branded loading screen (`(home)/loading.tsx` → `SiteLoadingScreen`)
  is a Next.js Suspense fallback that only shows on soft (client-side) navigations
  or dynamic streams. The homepage is statically prerendered (`● /[locale]`), so a
  cold hard load — the common mobile/tablet first visit — serves complete static
  HTML and the fallback never appears, leaving a blank during TTFB (Netlify cold
  start) + the render-blocking Material Symbols stylesheet in
  `[locale]/layout.tsx`. React/Suspense screens can't paint in that pre-hydration
  window.
- Fix: new `components/home/HomeBootSplash.tsx` (client) is server-rendered into
  the homepage HTML so it paints on the first frame on every device, then fades
  out on hydration (`requestAnimationFrame` + `onTransitionEnd`, with a 700ms
  removal fallback for reduced-motion). Reuses the `site-loading-*` visuals; the
  title is a `<div>` (not a second `<h1>`) to avoid duplicate headings. Rendered
  as the first child of the homepage above `SiteHeader`.
- CSS (`globals.css`): `.home-boot-splash` fixed overlay (`z-index:100`),
  opacity fade, and a `home-boot-splash-failsafe` keyframe that force-hides it at
  6s (1.2s under reduced-motion) so it can never stick even if JS is slow/disabled.
- Homepage-scoped, additive, self-dismissing. No schema change. `npm run lint`
  and `npm run build` pass.

## 2026-07-07 - Abandoned PayPal checkouts no longer linger as open orders

- New route `POST /api/paypal/cancel-order` (`app/api/paypal/cancel-order/
  route.ts`): soft-cancels an unpaid, uncaptured order by setting
  `order_status`/`fulfillment_status` to `cancelled`. Never touches
  `payment_status`; guards against paid/captured orders (conditional update with
  `.neq('payment_status','paid').is('paypal_capture_id', null)`); rate-limited
  60/hr per IP; fails open / no-ops on unknown order.
- `PayPalCheckoutButton`: tracks the create-order order id in `createdOrderIdRef`;
  `onCancel` now fire-and-forgets a `keepalive` POST to cancel-order so closing
  the PayPal window doesn't leave a stale open order in the admin. The ref is
  cleared on successful capture so a paid order is never cancelled.
- `create-order` reuse path now resets a resumed order to `order_status:'open'`,
  `fulfillment_status:'pending'` (alongside the new `paypal_order_id`) so a retry
  after a cancel isn't stuck as `cancelled`.
- Reversible by design: a delayed real capture (client route or webhook) still
  runs `capture_paypal_order`, marks the order paid, and flips it to `completed`.
- No SQL/schema change. `npm run lint`, `npx tsc --noEmit`, `npm run build` pass.

## 2026-07-07 - Admin master table: Quantity column

- Added a sortable **Qty** column to the master admin product table
  (`components/admin/AdminShell.tsx`), between **Status** and the row actions
  menu. New `'quantity'` `SortKey` + `getSortValue` case
  (`normalizeProductQuantity(product.quantity)`); the cell shows the normalized
  stock count and renders in the error color when stock is `0`. Data was
  already loaded (admin page uses `select('*')`); empty-state `colSpan` auto-
  updates via `PRODUCT_TABLE_COLUMNS.length`. `npm run build` passes.

## 2026-07-07 - Per-listing Quantity / stock count — Phase 2 (buyer multi-unit purchase + atomic decrement)

- New `order_items.quantity` column (integer, default `1`, `check (quantity >=
  1)`); `price_snapshot` stays the **unit** price, line total is
  `price_snapshot * quantity`. New `supabase/checkout-quantity-2026-07.sql`
  migration (run AFTER `product-quantity-2026-07.sql`); canonical
  `supabase/no-reservation-checkout.sql` and `supabase/sales-workflow.sql`
  updated for fresh installs.
- `CartContext`: `CartItem.purchaseQuantity` (buyer's requested count, distinct
  from `stockQuantity`); `add(item, quantity?)` merges/increments capped at
  stock; new `setQuantity()`; cart `count` is now total units;
  `normalizeCartItem()` clamps requested quantity to `1..stock`.
- Shared `QuantityStepper` (in `OrderSummary.tsx`) on the product detail page,
  cart drawer, and checkout summary — capped at live stock, shown only when
  `stockQuantity > 1`, with per-line subtotals.
- `checkout-pricing.ts#buildOrderDraft` now takes quantity-aware lines
  (`{ productId, quantity }[]`, still accepts legacy `string[]`), rejects
  over-stock lines, and sums `unit * quantity`; `CheckoutOrderItem` carries
  `quantity`. `CheckoutClient` sends `items:[{id,quantity}]`; the create-order
  route parses it, matches the reuse-order guard on product+quantity, and sends
  real PayPal line-item quantities.
- SQL: `capture_paypal_order` now decrements `products.quantity` atomically
  under the existing per-product row lock (flip to `sold` only at 0) and treats
  insufficient remaining stock as the item-conflict case; `create_paypal_order`
  stores per-line quantity and rejects over-stock at creation.
- Display: admin order detail, printable order, invoice/receipt emails, and the
  customer account order views show `Qty N × unit` and correct line totals;
  line-discount ceilings use the line subtotal. Admin manual-order form gained a
  per-product quantity input.
- Verified: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build` all
  pass. Live verification pending the two SQL migrations (see TASKS.md).

## 2026-07-07 (earlier) - Per-listing Quantity / stock count — Phase 1

- New `products.quantity` column (integer, default `1`, `check (quantity >=
  0)`) — most listings stay one-of-a-kind, but a listing can now represent
  several identical units in stock. New `supabase/product-quantity-2026-07.sql`
  migration; canonical `supabase/products.sql` updated for fresh installs.
- `types/product.ts`: new `normalizeProductQuantity()` helper (missing/null →
  1); `isProductPurchasable(status, quantity?)` gained an optional second
  argument and now also requires `quantity > 0`, backward-compatible with
  every existing single-argument call site.
- Threaded live quantity into every purchasability check that has it
  available: `ProductCard`, `ProductListRow`, `CartDrawer`, the shop list's
  purchasable-first sort, `checkout-pricing.ts#buildOrderDraft`'s
  server-side gate, and the admin `OrdersPanel`'s available-products filter.
  `CartItem` gained `stockQuantity` (units in stock, distinct from a future
  "how many is the buyer buying" concept) so `CartButton`'s add-to-cart gate
  also respects it.
- Admin New Item / Edit Item form (`AdminShell.tsx`): new **Quantity** number
  input next to Inventory #, default 1. Saving a listing down to quantity 0
  auto-flips `status` to `sold`; restocking a `sold` item does not
  auto-restore `available` (must be changed explicitly) — see DECISIONS.md
  for the reasoning.
- AI listing assistant: new `quantity` field (`ai-product-schema.ts`'s
  `cleanQuantity()`, integer 1–500) filled only when the seller explicitly
  states multiple identical units; a matched pair (e.g. earrings) is
  explicitly called out in the prompt as one listing, not quantity 2. Bumped
  `PROMPT_VERSION` to `product-listing-extraction-v13`.
- Storefront: shop card badge, list-row status text, and the product detail
  page show "N in stock" / "N units in stock" when `quantity > 1`.
- **Phase 2 (deferred, tracked in TASKS.md):** buyer-facing quantity
  selection in cart/checkout and atomic stock decrement in the PayPal capture
  RPC — deliberately scoped out of this pass so the payment-capture rewrite
  gets its own isolated review.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass. **Needs the SQL migration run** before live use — see
  TASKS.md.

## 2026-07-07 (a bit earlier) - Admin override for the product-page "customer special pricing" line

- Product detail pages (`/shop/[id]`) show an "Own gold or silver? Put it
  toward this piece and pay as little as ___" trade-in line, which always
  mirrored the computed scrap/melt value shown in the box just above it. Added
  a per-item admin override: a new **"Override customer special pricing"**
  checkbox in the edit product form, plus a custom-amount input that appears
  once checked, let an admin replace just that line's price with a flat
  number (e.g. a rounder, more attractive advertised price) without touching
  the real computed scrap-value box above it.
- New `products` columns: `special_price_override_enabled` (boolean, default
  `false`) and `special_price_override_amount` (numeric(12,2), nullable).
  Added to `supabase/products.sql` (fresh installs) and to a new incremental
  migration, `supabase/product-special-price-override-2026-07.sql`, for the
  live database (mirrors `product-show-spot-price-2026-07.sql`'s pattern,
  including the explicit anon/authenticated column grants needed because the
  2026-07 security-hardening scripts replaced blanket `SELECT` on
  `public.products` with a column allow-list computed at the time they ran).
- `types/product.ts` gained `getSpecialPriceOverrideAmount()`: an
  enabled-but-empty/zero/negative override amount is treated as "off" so the
  page never shows a bogus $0 price and instead falls back to the computed
  scrap value. `shop/[id]/page.tsx` computes a `tradeInValue` (override amount
  if set, else the existing `scrapValue`) and uses it only for the trade-in
  line — the scrap-value/spot-per-oz box keeps using the real `scrapValue`
  unconditionally. The admin form (`AdminShell.tsx`) validates that an amount
  is entered whenever the checkbox is checked.
- Follows the existing optional-column fallback convention: both new columns
  are added to `OPTIONAL_PRODUCT_DETAIL_COLUMNS` / `OPTIONAL_PRODUCT_COLUMNS`
  so the product page and admin save both retry without them (defaulting to
  "no override") if the SQL migration hasn't run yet on a given database.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass. Confirmed live against the current (pre-migration)
  database that `/shop/18k-heraldic-cross-band-ring-01` still renders 200
  with the trade-in line intact via its scrap-value fallback.
- **Pending manual step:** run `supabase/product-special-price-override-2026-07.sql`
  in the live Supabase project (see TASKS.md).

## 2026-07-07 (a bit earlier) - Home hero loading spinner + shop console warning fix

- **Home hero loading spinner.** `HomeHero.tsx` now shows a small centered
  gold spinner over the blank spot that used to appear before the hero's
  carousel/headline content fades in (client-side data fetch + image
  preload). Driven by the same `heroReady`/`.is-ready` state the hero's
  existing fade-in animations already use, so it appears on first paint with
  no flash and disappears the instant the real content is ready — no
  artificial minimum display time. Hidden outright under
  `prefers-reduced-motion`, where the hero content is already forced to full
  opacity immediately with nothing to wait for. Sized at 4.5rem (bumped up
  once from an initial 2.25rem per follow-up feedback) with a proportionally
  thicker ring. `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run
  build` all pass; confirmed live that the spinner mounts, and that its
  computed opacity is `0` once `.is-ready` is present.
- **Fixed a React 19 dev console error on `/shop`:** "Encountered a script
  tag while rendering React component..." pointing at the blocking inline
  `<script>` in `shop/(list)/page.tsx` (the one that skips the shop hero's
  entry-reveal replay on a repeat visit via `document.currentScript`). This is
  a known, currently-unresolved React 19 limitation — ANY literal `<script>`
  JSX host element triggers this dev-only warning on hydration, even when (as
  here) it's necessary and correct, running once via the browser's native
  HTML parse with no clean first-party replacement API that preserves the
  same "before paint, at this exact DOM position" guarantee (confirmed via
  `facebook/react#34008` and `shadcn-ui/ui#10104`, the latter hitting the
  identical warning for `next-themes`' equivalent anti-flash script and
  officially recommending the same console-filter workaround shipped here).
  Added `components/shop/ScriptTagWarningGuard.tsx` — a tiny client component
  whose module-scope side effect (runs once, before hydration reaches the
  script below it) patches `console.error` to drop only that exact known
  message text, dev-only, leaving every other warning/error untouched.
  Verified live: the script still runs correctly (`shop-repeat-visit` class
  applies, sessionStorage flag set) and `console.error` is confirmed to be
  the patched wrapper with the expected filter logic. `npx tsc --noEmit`,
  `npm run lint` (0 problems), `npm run build` all pass.

## 2026-07-07 (dev-infra) - Fixed the recurring Turbopack dev-cache corruption (OneDrive-caused)

Root-caused and fixed the "sticky 500s / stuck dev server" issue noted in
several earlier sessions (see the 2026-07-05 "Dev-infra" note below and
DECISIONS.md). Confirmed via a live GitHub issue (vercel/next.js #95495,
opened 2026-07-05) that Turbopack's dev cache (`.next/dev/cache/turbopack`,
a RocksDB-style store) reliably corrupts on Windows when something else holds
a file lock on it mid-write — OneDrive's background sync, which was
continuously scanning/uploading this project folder (including build output),
is exactly that kind of interferer. A real engine-level fix (skip a
Windows-only directory-fsync call) merged into Next.js on 2026-07-06, but only
ships in `16.3.0` canary/preview builds, not a version appropriate for this
project's stable `16.2.9` yet.

- **`next-app/.next` is now an NTFS junction** to
  `%LOCALAPPDATA%\dev-cache\NaplesEstateJewelry\next-app\.next` (outside the
  OneDrive-synced tree; OneDrive does not traverse/sync directory junctions).
  A sibling **`node_modules` junction** at
  `%LOCALAPPDATA%\dev-cache\NaplesEstateJewelry\next-app\node_modules` (pointing
  back to the real, in-place `next-app/node_modules`) was required alongside
  it: Node resolves the `.next` junction's dynamically-generated chunk files to
  their real on-disk location before doing its `node_modules` upward-directory
  search, so without this second junction, `next dev` 500'd on every route
  with `Cannot find module 'react/jsx-runtime'` / `next/dist/build/adapter/...`
  (discovered and fixed live this session). Both junctions are pure local
  machine/filesystem state — `.next` and `node_modules` are already
  `.gitignore`d and were never part of the repo-ready copy, so nothing here
  affects the source tree, git, or the Netlify build (which does a fresh
  checkout with no junctions).
- **New `predev` safety net** (`next-app/scripts/dev-cache-guard.mjs`, wired
  via a new `"predev"` script in `package.json`): before every `npm run dev`,
  detects a Turbopack cache folder that has only bookkeeping files
  (`CURRENT`/`LOCK`/`LOG*`) and no real `.sst`/`.meta` data — the exact shape
  left behind by a failed first commit — and clears just that subfolder so the
  dev server rebuilds cleanly instead of failing sticky for the rest of the
  session. This is a backstop for any future lock contention (antivirus,
  another process, an unclean shutdown), not the primary fix.
- Verification: killed the two old orphaned/unresponsive `next dev` processes
  from a prior session first (their ports were still `LISTENING` but no longer
  answering requests — same underlying symptom). After the junction fix,
  confirmed live: `npm run dev` starts clean with no "filesystem cache has
  been deleted" warning, `GET /` and `GET /shop` both `200`, and the relocated
  cache folder fills with real `.sst`/`.meta` files (checked via `cmd /c dir`
  — PowerShell's `Get-ChildItem` oddly under-reports contents through this
  junction in this session; not investigated further since it doesn't affect
  Next.js/Node, which resolve it correctly). `npx tsc --noEmit`, `npm run
  lint` (0 problems), and `npm run build` all pass with the `package.json`/new
  script changes in place.

## 2026-07-07 (latest, branding) - New default OG/Twitter card image

- Added `next-app/public/assets/images/pages/og-preview.webp` — a lossless
  WebP conversion (via `sharp`, `{ lossless: true }`) of a new branded banner
  graphic (`logo.png`, 1983×793) dropped at the project root. Original PNG
  deleted after conversion, no leftover scratch scripts.
- `next-app/src/app/layout.tsx` — site-wide `openGraph.images` /
  `twitter.images` now point at `og-preview.webp` instead of `trust.webp`.
  Per-product `/shop/[id]` OG images are unaffected (still generated per
  listing from that product's own photo).
- Note: this asset is intentionally lossless per explicit request, so at
  ~1.77MB it's much larger than other page images; it's only fetched by
  social/link-preview crawlers (never rendered inline on-page), so this
  doesn't affect on-site performance. Re-encode losslessly is easy to redo as
  lossy later if a smaller file is wanted.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems); visually
  confirmed the WebP round-trips pixel-identical to the source PNG.

## 2026-07-07 (later still, shop) - Default per-page changed to 24

- `shop/(list)/page.tsx`'s `DEFAULT_PER_PAGE` changed from `48` to `24`, so a
  bare `/shop` (no `perPage` param) now shows 24 items per page. This also
  aligns the page default with `ShopPagination.tsx`'s "Per page" select, which
  already special-cased 24 as the implicit default (omits `perPage` from the
  URL when 24 is picked).
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass; confirmed live that `/shop` now renders 24 cards and 3 pagination
  pages, with the Per Page select showing 24 selected.

## 2026-07-07 (later, shop) - Category buttons deselect on re-click

- `ShopFilters.tsx`'s `updateItemGroupFilter` now checks whether the clicked
  Category button (`Jewelry & Watches` / `Sterling Silver`) is already the
  active `currentItemGroup` — if so it clears `itemGroup` (and the `metal`/
  `metalColor`/`metalType`/`purity` params that value pins) instead of
  re-applying it, so re-clicking an already-selected category button
  deselects it back to "no category filter."
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass; confirmed live that clicking an active category button clears the
  URL back to bare `/shop` and both buttons show unselected.

## 2026-07-07 (shop) - Loading spinner for filter/sort/pagination navigations

- Added `components/shop/ShopNavigationProgress.tsx`: a shared
  `ShopNavigationProvider`/`useShopNavigation()` context (wraps the catalog
  section of `shop/(list)/page.tsx`) that runs filter/sort/view/year/per-page
  `router.push` calls inside `useTransition`, plus a `LinkPendingBridge`
  (`next/link`'s `useLinkStatus`) so `<Link>`-based pagination reports into the
  same shared pending state.
- Added `ShopLoadingOverlay`, a small centered spinner shown over the results
  panel (`.shop-results-panel`) only once a navigation has been pending for
  150ms and hidden the instant the new content commits — avoids a flash on
  instant/prefetched navigations while never leaving the page looking frozen
  on slower ones.
- Updated `ShopFilters.tsx`, `ShopSortSelect.tsx`, `ShopViewToggle.tsx`,
  `ShopYearFilter.tsx`, and `ShopPagination.tsx` to call the shared `push()`
  instead of each calling `useRouter().push()` directly. No URL/behavior change.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass. Confirmed live via CDP network throttling (900ms latency) on both a
  1280px and a 390px viewport: the spinner shows ~150–200ms after a dropdown
  change or a pagination click and disappears the moment the new results render.

## 2026-07-06 (even later, shop) - Filter dropdowns no longer self-narrow

- Fixed `/shop` (and `/shop-modern`, same shared `renderShopPage`): the Brand
  dropdown (and the dynamic extra Item Type entries) used to only list whatever
  remained in the *already brand/metal/purity/status-filtered* result set, so
  selecting a value hid every other choice next time you opened that dropdown.
- `shop/(list)/page.tsx` now computes `brandOptions`/`itemTypeOptions` from a
  second, always-unfiltered `loadShopCatalog` read (shares the unfiltered cache
  entry when no filters are active — no extra DB cost in the common case).
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass; confirmed live that `/shop?brand=Taxco` renders the full 16-brand list
  in the Brand dropdown instead of just "Taxco" + "All brands".

## 2026-07-06 (later, shop + admin products) - Per-item "Show spot/melt value" toggle

- Added `products.show_spot_price` (boolean, default `true`) and a matching admin
  **"Show spot / melt value on storefront"** checkbox in the New Item/Edit Item
  pricing section, for items that aren't 100% precious metal.
- `/shop/[id]` now hides the "Scrap gold/silver value" + "Based on spot $/oz" box
  and the "Own gold or silver? Put it toward this piece…" line when the toggle is
  off, replacing them with a short bilingual note. The actual "Your price" value
  and its computation are unchanged.
- Added `supabase/product-show-spot-price-2026-07.sql` (adds the column + the
  explicit anon/authenticated column grant the 2026-07 hardening scripts now
  require for any new product column) and updated `supabase/products.sql` so a
  fresh install includes the column from the start.
- Verification: `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`
  all pass from `next-app/`; confirmed live on the dev server that a product page
  still renders correctly (falls back to `true`) before the SQL migration runs.

## 2026-07-06 (admin products) - Manual Reserved status removed

- Removed the manual **Reserved** product status from the active admin app:
  no top-of-table Reserved count, no status dropdown option, no row **Reserve** action,
  and no quick-fill status token.
- Legacy database values of `reserved` now normalize to `available` in the app layer
  so old rows do not keep a hidden reservable state alive.
- Updated the AI listing prompt, current architecture/shop/PayPal docs, and the pending
  security-hardening status constraint so the current lifecycle is `draft`,
  `available`, `pending_payment`, `sold`, and `archived`.
- No destructive Supabase cleanup was run; vestigial reservation columns/functions in
  old migration history remain a separate confirmed database cleanup if desired.
- Verification: `npm run lint` and `npm run build` pass from `next-app/`; browser
  preview confirmed Product Admin shows Total/Available/Sold only, the row action menu
  does not include Reserve, and the New Item status dropdown excludes Reserved.

## 2026-07-06 (admin orders) - Orders badge tracks unseen active orders

- Changed `AdminOrdersLink` from a paid/pending-fulfillment count to a
  notification-style unseen-order count.
- The badge now counts only active orders (`orders.deleted_at is null`) created after
  the current admin/browser last viewed the active Orders area.
- Visiting active `/admin/orders` or an order detail page stores the last-seen timestamp
  and clears the badge immediately; visiting the Recycle Bin does not make trashed
  orders count as new.
- Verification: `npm run lint` and `npm run build` pass from `next-app/`; browser
  preview confirmed the old **Orders 8** badge clears on `/admin/orders` and remains
  cleared on `/admin`.

## 2026-07-06 (admin products) - Manual pricing consolidated into Price Label

- Removed the **Asking Price** field from the shared New Item/Edit Item product form.
  Manual fixed pricing now relies on the existing **Price Label** field.
- Folded old asking-price flows into the label path: quick-fill accepts "price",
  "manual price", "price label", and legacy "asking price" aliases as Price Label;
  AI `asking_price` values are formatted into `manual_price_label`; product saves clear
  `asking_price` to `null` so hidden stale values cannot override the visible label.
- Added shared manual-price parsing/normalization: bare numeric entries like `1` and
  `1200` now become `$1` and `$1,200`, and the same parser is used by shop display,
  cart totals, checkout totals, and order snapshot pricing.
- Added a **Quick add** checkbox on New Item. It switches the listing to manual fixed
  pricing and bypasses the spot-pricing gates (purity/weight/multiplier), while still
  requiring the basic title, inventory number, and price label needed for a sellable
  product.
- Checkout now treats unparseable cart price labels as stale product info and hydrates
  the current product row; if the product is manual-priced, it uses the normalized live
  `manual_price_label` instead of leaving the checkout subtotal as `-`.
- Checkout snapshot pricing now uses `manual_price_label` first for manual-price items,
  retaining `asking_price` only as a legacy fallback for old rows missing a label.
- Verification: `npm run lint` and `npm run build` pass from `next-app/`.

## 2026-07-05 (admin order inventory restore) - Explicit inventory return controls

- Added a **Restore item to inventory** button on `/admin/orders/[id]`. It marks the
  order's linked product rows `available` without changing the order status or payment
  record, so admins can intentionally re-list inventory even when an order is already
  paid/completed.
- Changed order-detail delete confirmation into two explicit paths: **Yes, Move to
  Recycle Bin** soft-deletes only the order record; **Move to Recycle Bin and return to
  inventory** first marks the linked products `available`, then soft-deletes the order.
  Paid orders are no longer blocked from the Recycle Bin flow.
- Verification: `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass. Browser
  UI verification was blocked by the in-app browser redirecting to sign-in for admin;
  the code path and build are verified.

## 2026-07-05 (admin order print preview) - Direct print from order detail

- Added a **Print Order** action to `/admin/orders/[id]`. It opens a dedicated
  `/admin/orders/[id]/print` preview window/tab instead of sending straight to the
  browser print dialog.
- Added the admin-authenticated print preview route with a paper-style order detail:
  order number/invoice number, created/printed dates, payment/fulfillment/order status,
  customer/contact details, shipping/billing addresses, item snapshots, discounts,
  totals/refund amount, customer notes, and internal notes.
- The preview toolbar has **Close Preview**, **Back to Order**, and **Print**. Print
  CSS hides the toolbar and shared layout chrome so only the paper preview prints.
- Verification: `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass.
  Browser preview confirmed `Print Order` opens
  `/admin/orders/31cfb202-fe5e-41db-8264-a9dfa32c62fd/print`, shows the printable order
  paper and Print button, and hides cookie/cart/wishlist chrome from the preview.

## 2026-07-05 (invoice generation) - Draft invoices at order creation + admin recovery button

- Added a shared server helper, `upsertOrderInvoice`, so order-linked invoice rows are
  generated idempotently from the order header/totals instead of being duplicated across
  payment/admin paths.
- New PayPal checkout orders now create a draft invoice row during
  `/api/paypal/create-order`; the paid capture finalization path reuses the same helper
  and upgrades the invoice to `paid` when payment succeeds.
- New manual admin orders now call the admin invoice endpoint after order creation, so
  admin-created orders get a draft invoice record without a separate follow-up step.
- Added `POST /api/admin/orders/[id]/invoice` and an order-detail **Generate Invoice /
  Refresh Invoice** button. This covers older/test orders that were created before the
  auto-generation fix and currently show "No invoice generated yet."
- Verification: `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass.
  Browser preview on `http://localhost:3002/admin/orders/31cfb202-fe5e-41db-8264-a9dfa32c62fd`
  confirmed the missing-invoice paid test order now exposes **Generate Invoice**. The
  button was not clicked because it writes to the live database.

> Track meaningful changes. Newest at the top. One dated section per day of work;
> bullet the notable changes. Keep entries short.

## 2026-07-05 (orders recycle bin) — Soft-delete admin orders + modal warning fix

- Added an Orders Recycle Bin on `/admin/orders?view=trash`. Active order deletes now
  set `orders.deleted_at` instead of hard-deleting; the bin can restore an order record
  or permanently delete it after a browser confirmation. Restoring does **not** change
  product inventory statuses automatically.
- Added `supabase/orders-recycle-bin.sql` (idempotent) to add `orders.deleted_at` plus
  active/trash indexes. Until it is run, the admin Orders page shows a clear migration
  notice and blocks recycle-bin delete/restore actions.
- Fixed the paid-order "return to inventory" warning from the Orders list modal: the
  delete dialog now closes before the warning is shown, so it no longer appears behind
  the grayed overlay.
- Verification: `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass.
  Browser preview verified `/admin/orders` and `/admin/orders?view=trash` render the
  Recycle Bin entry point, pending-SQL notice, empty trash view, and Back to Orders link.
- Follow-up: owner ran `supabase/orders-recycle-bin.sql`; the Supabase verify query
  returned `deleted_at` / `timestamp with time zone`, and HTTP checks now show
  `/admin/orders` + `/admin/orders?view=trash` return 200 with the migration notice gone.

## 2026-07-05 (checkout UX) — Guest checkout gate + printable order confirmation

Two owner-requested checkout features (tsc/lint/build clean; guest gate verified live;
admin tax + order-detail render verified live signed in as admin):

- **Sign-in / guest gate before checkout.** "Proceed to Checkout" in the cart drawer is
  now a button (was a direct link). Signed-in shoppers still go straight to `/checkout`;
  **signed-out** shoppers get a modal (`CheckoutGate` in `CartDrawer.tsx`) offering
  **Log In** (→ `/account/sign-in?next=/checkout`), **Create Account** (→ `/account/sign-up`),
  or **Continue as Guest** (→ `/checkout`). Auth is resolved via a cookie-session
  `getUser()` check when the drawer opens (with an on-click fallback). **Verified live:**
  signed-in → straight to checkout (gate skipped); signed-out → gate shows all three
  options; Guest → `/checkout`; Log In → sign-in with the `?next` back to checkout.
- **Printable order confirmation.** The post-PayPal "Order Received" screen
  (`CheckoutClient.tsx`) keeps everything it showed before and adds a **View Order
  Details** button (guests: **View & Print Order Details**). It reveals a complete,
  printable receipt — business header + order number, the full item list & totals
  (reusing `OrderSummary` read-only, so tax/shipping match exactly), and the
  contact/ship-to block — plus a **Print** button (`window.print()`). The order is
  snapshotted client-side at capture success **before** the cart is cleared, so a guest
  (no account to look it up later) can still print. Print CSS hides the header/footer/
  buttons (`@media print { header, footer, .no-print { display:none } }`).
  **Verified by build + code review;** the live PayPal→confirmation→print round-trip
  needs a sandbox buyer login (owner to run — I have the app creds but not a PayPal
  sandbox *buyer* account).
- **Also verified live this session (were build-only before):** admin manual-order tax
  on the Create-Order form — FL+shipping → **6%** ($368.07 on a ~$6,135 piece), non-FL
  → **$0** (checked without saving); and the **Reopen Order** button renders
  conditionally (correctly *absent* on an open order — no cancelled orders exist to
  exercise the click, which the owner can confirm by cancelling any order).

## 2026-07-05 (final batch) — Tax → 6%, Reopen-order button, lint to zero, product-page query dedup

Owner-directed batch (all `tsc`/`lint`/`build` clean; customer-facing bits verified live
on dev; admin bits verified by build only — see notes):

- **FL sales tax is now 6% everywhere when taxable** (was 7% checkout / 6.5% admin —
  they had drifted). Centralized the rate: `FL_TAX_RATE` (+ new `FL_TAX_RATE_LABEL`)
  in `lib/checkout-pricing.ts` is now the **single source of truth**, imported by
  `CartDrawer`, `OrderSummary`, and admin `OrdersPanel` (each had its own copy). The
  out-of-state exemption from earlier today still applies. **Verified live:** cart
  "FL Sales Tax (6%) $52"; checkout FL+overnight → 6% $52 / total $998; CA → "FL Sales
  Tax $0" / total $946. (Existing orders keep their originally-charged rate — the admin
  order-edit recalculation derives the rate from the stored order, not the constant.)
- **Admin "Reopen Order" button** added to `OrderDetailPanel` — appears only when an
  order is `cancelled`, calls the restored `reopenOrder()` (sets status `open` /
  fulfillment `pending`; returns unpaid products to `pending_payment` with a shop-cache
  revalidation; leaves paid products `sold` for review). Mirrors the wired
  cancel/delete pattern. **Build-verified only** — admin surface needs an owner login
  to exercise live.
- **Lint is now at ZERO problems** (was 12 at session start). Fixed the 5
  `react-hooks/set-state-in-effect` errors: sign-in's `nextUrl` became a `useRef`
  (it's only read on submit, never rendered — a real fix, no re-render); the other 4
  (AccountDashboard ×2, AdminHeader, AdminShell) are **intentional** hydration-safe /
  derived-state patterns the code already documents, so each got a scoped
  `eslint-disable-next-line` **with a reason** rather than a "fix" that would reintroduce
  a hydration mismatch. The `google-font-display` warning was folded into the existing
  suppression on the Material Symbols `<link>` (block is intentional for an icon font).
- **Perf: product-page query dedup.** `fetchPublicProduct` in `shop/[id]/page.tsx` is
  now wrapped in `React.cache`, so `generateMetadata()` and the page component share one
  DB query per request instead of two (the second query was introduced earlier today by
  the 404 `notFound()` in `generateMetadata`). Verified the product page still renders.
- **Not done, deliberately (need verification the owner reserved for live/prod):** the
  bigger shop-perf refactors — DB-side pagination/faceting, making bare `/shop`
  static/ISR, server-rendering `ProductCard` — and re-encoding the oversized `/public`
  images (visual quality check). Shipping those blind to a near-live store is the wrong
  call; left in TASKS as a focused follow-up.
- **Env note (owner):** all working env is set in **Netlify** (PayPal sandbox, AI
  assistant, service role, webhook secrets, etc.); `next-app/.env.local` is **stale** and
  must not be relied on. Only final testing remains, done **live after deployment** — the
  owner owns that testing. `chris@naplesestatejewelry.co` confirmed a real mailbox.

## 2026-07-05 (later still) — Lint cleanup: cleared the 6 dead-code / stale-directive warnings

Cleared the 6 pre-existing lint warnings that were pure code hygiene (tsc + build stay
clean; verified `/shop` filters still work live with no console errors):
- `OrderDetailPanel.tsx`: dropped the unused `setInvoices` setter (`invoices` is
  read-only) and **removed the unused `reopenOrder()` function** — a fully-implemented
  "reopen a cancelled order" admin action that was never wired to any button (its
  sibling cancel/delete actions are wired; reopen wasn't). Also removed a stale
  `eslint-disable jsx-a11y/no-autofocus` directive that no longer suppressed anything.
- `PrintInvoiceClient.tsx`: removed a stale `eslint-disable react/no-danger` directive.
- `ShopFilters.tsx`: removed the unused `hasDrawerFilters` computed value.
- `lib/seo.ts`: inlined the runtime `LOCALES` const into the `AppLocale` type
  (`'en' | 'es'`) since it was only ever consumed by `typeof`.

**Left as a tracked follow-up (see TASKS):** the 5 `react-hooks/set-state-in-effect`
**errors** (sign-in, AccountDashboard ×2, AdminHeader, AdminShell — all the same
read-URL/localStorage-once-in-useEffect pattern) and the 1 `google-font-display`
warning. Each needs a different, individually-verified fix and two live in admin/
account surfaces not exercisable without credentials this session; none block the
build. **Also flagged:** decide whether to rebuild+wire an admin "Reopen order" button
(the removed `reopenOrder` was the implementation).

## 2026-07-05 (later still) — Saved-items drawer: Add to Cart button + a provider-nesting bug fix

Added an "Add to Cart" icon button to each row in the Saved Items (wishlist) drawer,
next to the existing Remove (✕) button — owner asked for this after the earlier
walkthrough flagged that saved items could only be reached by clicking through to the
product page. `CartButton` (the same component used on shop cards/product pages) is
reused with `variant="icon"`, fed a minimal `CartItem` built from what the wishlist
already stores (id, title, image, status, the live price computed for display, purity,
weight). Saving the item to cart does **not** remove it from the wishlist. Checkout's
existing "backfill missing product fields" effect (`CheckoutClient.tsx`) fills in the
richer fields (metal, chain type, length, brand…) automatically — verified live: the
checkout page rendered the full spec line ("10K · YELLOW GOLD · NECKLACE · CUBAN LINK
· 20.5 IN · 12.45G · MONACO") for an item added this way.

**Found and fixed a real crash while verifying this.** `src/app/[locale]/layout.tsx`
nested `<WishlistProvider><CartProvider>{children}</CartProvider></WishlistProvider>`.
`WishlistProvider` renders `<WishlistDrawer>` as a **sibling** to `{children}`, not
inside it — so `WishlistDrawer` sat entirely outside the `CartContext.Provider` tree.
The moment a saved item's row rendered the new `CartButton` (which calls `useCart()`),
it threw `useCart must be used within CartProvider`, crashing the whole app to a blank
"page couldn't load" state (reproduced live, confirmed via the dev-server log showing
no failing request — it was a client-side render crash, not a server error). **Fixed**
by swapping the nesting so `CartProvider` wraps `WishlistProvider`
(`CartDrawer` has no reverse dependency on `WishlistContext`, confirmed by grep, so
this order is safe both ways). Re-verified: saving an item, opening the drawer, and
clicking Add to Cart all work with no crash and no console errors; a full route sweep
(home, shop, product, checkout, account, contact, free-eval, EN+ES) still returns 200;
the ordinary product-page → cart-drawer flow (unaffected by the reorder) still works.
`tsc`/build clean; lint unchanged at the 12 pre-existing problems.

## 2026-07-05 (later) — FL sales tax no longer charged on out-of-state shipments

Owner decision: FL sales tax should not apply to orders shipped out of state. Fixed
at the authoritative source and every place tax is displayed (build/tsc clean;
verified on dev — no orders were created during testing, confirmed via network log).

- **`lib/checkout-pricing.ts` (authoritative — used for the real PayPal charge).**
  New `isFloridaState()` (matches "FL"/"Fla"/"Florida", any case/whitespace/trailing
  period) and `chargesFlSalesTax(shippingMethod, shippingState)`: tax applies for
  **local pickup** (always completed in Naples, FL) or when the **shipping address
  state is FL**; any other shipping destination is untaxed. `buildOrderDraft` gained
  an optional `shippingState` param and now computes `tax` conditionally instead of
  unconditionally applying 7%.
- **`/api/paypal/create-order`** now passes `customer.state` to both `buildOrderDraft`
  calls (the fresh-order path and the stale-order-reuse recompute), so a buyer who
  edited their shipping address after cancelling PayPal gets the correct tax on retry
  too.
- **Checkout page estimate (`OrderSummary.tsx` + `CheckoutClient.tsx`)** now matches
  the authoritative calc — `OrderSummary` takes a `shippingState` prop and only adds
  tax when `chargesFlSalesTax` is true; the row label drops "(7%)" when tax is $0 so
  it doesn't read as a bug. Verified live: CA address → "FL Sales Tax $0" / Est. Total
  $946; switching back to FL → "FL Sales Tax (7%) $61" / $1,007; Local Pickup with a
  non-FL state still charges the $61 (pickup always happens in Naples).
- **Admin manual-order form (`OrdersPanel.tsx`)** — tax there is auto-computed with no
  editable override, so the same rule now applies: charges its (separate, pre-existing,
  unchanged) 6.5% rate unless `shipping_method === 'shipping'` to a non-FL `state`.
  Note the admin rate (6.5%) has always differed from checkout's (7%) — that
  discrepancy predates this change and was left alone; only the out-of-state
  exemption was added. Not exercised live (no admin session in this environment) —
  covered by `tsc`/build only.
- **`CartDrawer.tsx` (the header mini-cart) intentionally left unchanged.** It has no
  address input at all, so it can't know the destination; it keeps the flat 7%
  pre-checkout estimate under its existing "Tax is an estimate" disclaimer. The
  checkout page (which does collect the address) is the one that must match the real
  charge, and now does.

## 2026-07-05

- **UX-friction fixes from the walkthrough (build/tsc clean; lint unchanged at the
  12 pre-existing problems; each verified live on dev :3002).**
  - **Free evaluation no longer forces photos.** The photo input was `required`,
    blocking description-only sellers despite copy promising "a quick description or a
    few photos". Photos are now optional (`EvalForm.tsx`), the label reads "Photos —
    optional but helpful", and a client guard requires at least a photo **or** a short
    description so the lead isn't empty. Success copy generalized from "review your
    photos" to "review your submission".
  - **Sign-in shows friendly copy.** Raw Supabase strings (e.g. "Invalid login
    credentials") are mapped to human, locale-aware messages ("The email or password
    you entered is incorrect.", plus email-not-confirmed and rate-limit cases) via a
    new `friendlyAuthError()` in the sign-in page.
  - **Saved-items drawer shows the live price.** Spot-linked saves showed only a "Live
    gold price" label. The drawer now lazily fetches `/api/metal-prices` on open and
    computes each item's price with `calcSpotPriceValue` (category inferred from
    purity: gold ≤24 karat, silver >24), falling back to the label if spot is
    unavailable or fields are missing. Verified: a saved 10K necklace shows "$871".
  - **ES nav "Tienda / Tienda" fixed.** Both `nav.shop` and `nav.store` translated to
    "Tienda". Renamed the store entry to **Catalog / Catálogo** (en+es messages) so the
    Shop dropdown reads "Tienda ▸ Catálogo / Subastas".
  - **Cart/checkout pluralization.** "1 item(s)" → "1 item" / "2 items" (and ES
    "artículo/artículos") in `CartDrawer` and `OrderSummary`.
  - **Follow-up: account auth pages fully localized.** `/es/account/sign-in`,
    `sign-up`, and `reset-password` rendered entirely in English (labels, buttons,
    placeholders, validation errors, success screens). All user-visible strings are
    now bilingual via inline `isEs ? … : …`. Also fixed a latent bug: the sign-in
    "Create one" link was missing the `/es` locale prefix. Verified: ES pages render
    Spanish (Iniciar Sesión / Crear Cuenta / Restablecer Contraseña / Mi Cuenta …),
    EN unchanged. (The account-dashboard `<title>` metadata stays "My Account" — a
    static export, negligible.)
  - **Final full walkthrough passed** (fresh dev server): every major route 200 in
    EN+ES, garbage `/shop/[id]` → 404, redirects (`/sell`,`/cart`,`/wishlist`,
    `/saved`) intact, `/api/metal-prices` live, shop sort+search, add-to-cart →
    "1 item" drawer, sold-page caption/CTA, and localized auth pages all confirmed;
    no console errors; `npm run build` clean.
  - **Not changed (by design):** checkout address `*` + missing-field naming were
    already handled (dynamic `*` when a ship method is selected; clicking the dimmed
    pay button surfaces a red alert listing the exact missing fields) — the audit's
    DOM query had missed the asterisks. Left the owner-verified pay-gate as-is. The 7%
    FL sales tax on out-of-state shipping addresses is a business/legal decision, left
    for the owner.

- **Fixed two shop bugs found in the UX walkthrough (build/tsc/eslint clean on the
  changed files; verified end-to-end on dev :3002).**
  - **Product soft-404 → real 404 (E04).** Unknown `/shop/[id]` URLs returned HTTP 200
    with the "Product Not Found" UI because a `loading.tsx` streaming boundary committed
    a 200 shell before the page's `notFound()` ran. Root cause was the **`shop/loading.tsx`
    ancestor boundary** wrapping `[id]` (removing only `[id]/loading.tsx` wasn't enough).
    Fix: moved the shop-list page + its loading skeleton into a **`shop/(list)/` route
    group** so the loading boundary is scoped to `/shop` only and no longer wraps
    `shop/[id]`; removed `shop/[id]/loading.tsx`; and added an early `notFound()` in the
    product `generateMetadata` (before the stream) as the first line of defense. Now
    `/shop` keeps its skeleton, valid products render, and garbage/hidden product URLs
    return a genuine 404 (verified: `/shop` 200, `/shop/[valid]` 200, `/shop/[garbage]`
    404 in EN+ES, `/shop-modern` 200, `npm run build` passes). Note: the product-detail
    page no longer has its own loading skeleton (removing it was required for the 404);
    client-side nav keeps the prior page visible until ready, so no blank flash.
    `shop-modern/page.tsx` import updated to `@/app/[locale]/shop/(list)/page`.
  - **Sold product detail page no longer claims it's for sale.** A sold item still
    rendered its live price captioned "✓ This is your price" and hid every CTA. Now
    non-purchasable items show a "Sold — one of a kind" caption (localized "Vendido —
    pieza única") in place of "This is your price", and keep an **Inquire about a similar
    piece** + **Call** CTA (no Add to Cart). Available items are unchanged. JSON-LD
    availability already reflected SoldOut.

## 2026-07-04

- **Guest checkout + the remaining ecommerce-flow (PUB-E) items (build/tsc/eslint clean, verified on dev).**
  - **Guest checkout (E01):** removed the sign-in wall on `/checkout` (page no longer
    redirects anonymous visitors). Backend already supported guest orders (`user_id`
    null). Added an optional "Have an account? Sign in for faster checkout — optional"
    nudge, shown only to signed-out visitors (client-side `getUser` check). Verified:
    `/checkout` returns 200 for guests (was 307→sign-in).
  - **E05 shop count:** the "Showing 59 of 59 pieces" filter summary (ShopFilters) was
    misleading next to a 48/page grid; reworded to "59 pieces" (unfiltered) / "N of M
    pieces" (filtered). The paginated `ShopPagination` still shows the true "1–48 of 59".
  - **E10 wishlist/saved:** wishlist is localStorage (anonymous save already works via
    the drawer); added `/wishlist`, `/saved`, `/account/saved` → `/shop` redirects so
    those URLs stop 404-ing (like `/cart`).
  - **E11 authenticity/shipping trust copy:** product pages now show "Ships fully
    insured · Authenticity guaranteed" on purchasable items; rewrote the Shipping
    policy from hedge-everything ("may…") to concrete commitments (fully insured,
    discreet packaging, authenticity guarantee tied to the 5-day return). (The
    "signature required" claim was removed at owner's request — not always applicable.)
  - **E15 sign-up:** added an account-benefit line ("Track your orders, save favorites,
    check out faster… an account isn't required — you can check out as a guest").
    Password rule left at the existing `minLength={6}` per owner (no complex rules).
  - Also fixed a `Date.now()` `react-hooks/purity` lint error on the product page
    (priceValidUntil now derives from `spotData.fetchedAt`).
- **Final audit batch — real reviews + the four deferred items (build/tsc clean, verified on dev).**
  - **Real Google reviews** swapped into the homepage testimonials (Nolan Olivier,
    Onur, Yisel Perez), EN + ES; removed the placeholder warning.
  - **Per-locale `<html lang>` (item c):** moved the `<html>/<head>/<body>` shell into
    `[locale]/layout.tsx` (`lang={locale}`), made root `layout.tsx` a passthrough
    (metadata + globals only), extracted fonts to `lib/fonts.ts`, and gave root
    `not-found.tsx` its own `<html>`. Verified: `/` → `lang="en"`, `/es` → `lang="es"`,
    jsonLd intact, 404 renders. Next 16 accepts the passthrough root layout.
  - **CSP enforced (item a):** `netlify.toml` CSP flipped from Report-Only to enforcing
    with a full allowlist for Supabase, gold-api, Google Fonts, **TradingView**
    (s3.tradingview.com script + *.tradingview.com/*.tradingview-widget.com frame/
    connect) and **PayPal** (www.paypal.com script + *.paypal.com/*.paypalobjects.com),
    plus `worker-src blob:` and `base-uri 'self'`. The Report-Only line is kept
    commented for one-line rollback. ⚠️ Netlify headers can't be tested by `next dev`
    — verify on the deployed site (home, /gold-services chart, /checkout once PayPal
    creds are fixed); rollback instructions are in the file.
  - **Server-rendered spot price (item d):** gold-services and silver-services now
    render "Gold $4,176/oz" / silver server-side via `fetchSpotData()` next to the
    TradingView chart, so the price shows even with JS blocked. Verified live.
  - **Re-slug new-listing products (item b):** `next.config.ts` 301s from
    `/shop/new-listing-0X` → keyword slugs, paired with
    `supabase/reslug-new-listing-products-2026-07.sql` (renames the six product ids;
    guarded transaction — run it and deploy the redirects together). Deliberate,
    documented exception to the permanent-id invariant (old ids were auto-junk).
- **Trust/content batch from the audit (code-only, build + tsc/eslint clean, verified on dev).**
  - **Returns policy rewritten** to the owner's terms: all sales final (volatile
    metal prices), with a **5-day misrepresentation refund** exception; removed the
    stale "order request / inventory hold" language that contradicted the live
    PayPal capture flow.
  - **Homepage testimonials section** added ("Trusted Across Southwest Florida", 3
    cards). ⚠️ **The quotes are PLACEHOLDERS** (owner's request) — a code comment
    flags that fabricated reviews violate Google/FTC rules and must be swapped for
    real Google reviews before relying on them.
  - **"100% Accuracy — GUARANTEED VALUATION" badge** on gold-services replaced with
    "Live-Market Pricing — Tested In Front Of You" (credible, non-puffery).
  - **Shop H1**: added an sr-only `<h1>` "Shop Estate Jewelry in Naples, FL" (page
    had none; visual design unchanged).
  - **Mobile tap-to-call**: gold phone icon in the header on mobile/tablet (the
    CALL NOW button is desktop-only) — the #1 conversion CTA is now tap-visible.
  - Homepage call CTA now says "Mon–Sat · By appointment".
- **SEO + technical batch from the audit (code-only, build + tsc clean, verified on dev).**
  - **Canonical + hreflang everywhere:** new `lib/seo.ts#alternatesFor`; all 13 content
    pages (home, shop, service pages, about, contact, free-evaluation, faq, auctions)
    converted from static `metadata` to `generateMetadata` with self-canonical +
    en/es/x-default alternates; product pages too. Verified: `/faq` → canonical
    `/faq` + hreflang en/es/x-default; `/es/free-evaluation` → `/es/...` canonical.
  - **`<html lang="en">`** set on the root (was missing entirely). Per-locale lang for
    the `/es` tree is deferred — it needs moving `<html>` into `[locale]/layout.tsx`,
    which would break the root `not-found.tsx` (depends on the root layout for fonts/
    html), so it's a scoped follow-up.
  - **Titles:** removed the doubled brand suffix (template appends it once) and gave
    service pages seller-intent titles ("Sell Gold in Naples, FL", "Estate Jewelry
    Buyer in Naples, FL", etc.). Home uses `title.absolute`.
  - **Product schema/OG (`shop/[id]`):** locale-aware title/description (uses
    `title_es`/`description_es` on /es), canonical + hreflang, full OG + twitter,
    **absolute** schema image URL, `priceValidUntil` (today+2, verified 2026-07-06),
    `offers.seller`, and a **BreadcrumbList**. Not-found returns `robots:noindex`.
  - **FAQPage JSON-LD** emitted from the existing `FAQ_ITEMS` (locale-aware) — verified
    8 Question/Answer nodes.
  - **Global OG/Twitter** defaults added in the root layout metadata (was product-only).
  - **Sitemap:** one entry per page with `alternates.languages` (en/es hreflang) +
    `lastModified` (products use `updated_at`).
  - **robots.ts:** added `/checkout`, `/payment`, `/shop-modern`, and the `/en/*`
    admin/account/checkout/payment prefixes. **`/shop-modern`** now `robots:noindex`.
  - **Quick wins:** `/sell`→`/free-evaluation` and `/cart`→`/shop` redirects
    (`next.config.ts`); `info@naplesestatejewelry.co` added to the footer; branded
    `[locale]/error.tsx` boundary; removed empty `store/` + `silver-tableware/` route
    dirs; **fixed the Netlify `/assets` caching** (the `/*` `max-age=0` catch-all was
    ordered after the immutable `/assets/*` rule and clobbered it — moved it first so
    the immutable rule wins). JewelryStore `paymentAccepted` now lists PayPal + cards;
    schema hours kept as appointment availability (schema.org has no by-appointment
    flag; the "by appointment" wording carries it).
- **CODE-D04 residual closed (⚠️ second manual SQL step pending).** Signed-up
  (`authenticated`) users could still read internal product columns because the
  admin editor read them from the browser under that role. Fixed by moving the
  admin product read to the **service role**: `admin/page.tsx` now loads products
  via `createServiceClient()` (behind the existing `is_admin` gate), and
  `AdminShell` new-product insert no longer chains `.select()` (uses the optimistic
  `payload`, which already holds the generated id + all fields — mirrors the update
  path). Admin writes are unchanged (RLS still admin-gates them). **Pending manual
  step: run `supabase/products-internal-columns-authenticated-2026-07.sql`** (after
  deploying the code) — it revokes SELECT on cost_basis/minimum_price/internal_notes/
  acquisition_*/private_price_label/live_spot_snapshot from `authenticated`. Verified
  on dev signed-in: admin table loads all 59 rows via the service role with no
  permission error. Build + tsc clean (only the pre-existing AdminShell:915
  set-state-in-effect lint error).
- **Messaging fixes from the audit (copy-only, build + tsc clean).** (1) Killed the
  "walk-in" contradiction: footer, homepage "We Buy Gold", and the JewelryStore schema
  description now say on-the-spot / by-appointment / "we come to you" (matches the
  mobile appointment-only model; Spanish already said "en el acto"). (2) Standardized
  the public brand to **"Naples Estate Jewelry"** everywhere — dropped "Co" from the
  footer, product JSON-LD `brand` (fixes the Product-vs-JewelryStore name mismatch),
  order invoice/receipt + fulfillment emails, marketing email footer, inquiry
  auto-reply, and the account receipt header; dropped "& Antiques" from Terms/Privacy/
  Accessibility while keeping "operated by Naples Antiques LLC" for legal validity.
  (3) Reworded the trade-in copy to phone-driven (owner: no online mechanism) — the
  product-page line and shop banner now invite a call ((239) 404-8505) instead of
  implying an automatic online trade-in. (4) JewelryStore `paymentAccepted` now
  includes PayPal + Credit/Debit (was Cash/Check/Wire only). Note left: the schema
  still carries fixed Mon–Sat 10–17 hours — defensible as appointment availability,
  flagged for the owner to confirm vs the mobile model.
- **Security hardening from the full-site audit (⚠️ one manual SQL step pending).**
  Fixed three confirmed holes. Code (built + tsc/eslint clean): `/api/checkout/order`
  now calls `create_checkout_order` via the **service-role** client (and returns a
  generic error instead of the raw DB message); `buildOrderDraft` in
  `lib/checkout-pricing.ts` now **rejects any $0/negative line item** (409) so a
  "Contact for price"/incomplete product can never be sold online for nothing —
  covers both manual checkout and PayPal. **Pending manual step: run
  `supabase/security-hardening-2026-07.sql` in Supabase** — it (1) revokes the blanket
  `profiles` INSERT/UPDATE grant from `authenticated` and re-grants all columns except
  `is_admin`/`is_vip`/`account_type`/`internal_notes` (closes admin self-promotion,
  CODE-S01), (2) revokes `create_checkout_order` EXECUTE from anon/authenticated →
  service_role only (CODE-S02; the route change above is required for this), (3)
  revokes anon SELECT on internal `products` columns (cost_basis/minimum_price/
  internal_notes/acquisition_*/private_price_label/live_spot_snapshot) via a
  column-level grant (CODE-D04), and (4) adds NOT-VALID CHECK constraints on
  products status/price_mode/non-negative amounts (CODE-D07). Residual on CODE-D04:
  logged-in `authenticated` users can still read those columns (admin editor reads
  them from the browser) — needs admin reads moved to service role in a later pass.
- **Checkout: clicking pay before ready no longer flashes/jolts the PayPal flow.**
  Previously the PayPal Buttons `onClick` returned `actions.reject()` when the buyer
  wasn't ready, which let PayPal begin opening (spinner/popup flash) before bouncing
  back — a hard visual jolt. Now, while `!ready`, an invisible click-swallowing
  overlay sits over the (dimmed, opacity 0.5) PayPal button in `PayPalCheckoutButton`
  so the click never reaches PayPal — it just shows the red reminder. The overlay is
  removed once ready, so real clicks pass through normally; the `onClick` reject is
  kept only as a keyboard-activation fallback. `tsc`/`eslint` clean. **Verified working
  by the owner 2026-07-04** — no more jolt; this also confirms the inline reminder's
  new position/wording and the required checkbox gate (below).

- **No-reply customer emails no longer invite a reply.** The receipt/invoice email
  (`order-invoice-email.ts`, paid + unpaid notes) and the fulfillment-update email
  (`order-fulfillment-email.ts`) are sent from `noreply@naplesestatejewelry.co` but
  told buyers to "reply to this email." Dropped the reply invite; the notes now read
  "Call or text us at (239) 404-8505 with any questions…". Checked the other
  no-reply customer emails (legacy `/api/checkout/order`, inquiry confirmation) —
  they don't invite replies, so no change. Owner-facing notifications that set a
  real reply-to (contact-message, marketing "Chris" sender) are unaffected. `tsc`/
  `eslint` clean.

- **Checkout: required-fields prompt is now an inline red reminder, not a modal —
  placed above the pay button and explicit about the checkbox.** When the buyer
  clicks PayPal/card before they're ready, `PayPalCheckoutButton` shows a compact
  red inline alert **above** the pay button (was a full-screen modal). The wording
  now spells out the confirmation checkbox — e.g. "Before you can pay, please check
  the box above to confirm your information is correct" (and appends "; and complete:
  …" for any empty form fields) — so a buyer who's visually confident their info is
  right still understands there's a box to tick. Implemented via a new
  `needsInfoConfirmation` prop (the checkbox is no longer folded into `missingFields`)
  and a `missingHint` `{ fields, needsConfirm }` state; the reminder auto-hides once
  ready (render gated on `!ready`, no set-state-in-effect). EN/ES. `tsc`/`eslint`
  clean. **Verified working by the owner 2026-07-04** (exercised alongside the jolt fix
  above).

- **Shop list view: status flag moved off the thumbnail, next to the metal label.**
  In `ProductListRow`, the Available/Sold flag was absolutely positioned on the
  image; it now renders inline as the first item of a new `.shop-list-metal-row` in
  the details column — so the row reads **[Available] [Yellow Gold]** with the flag
  where the metal label used to be and the metal label to its right. Same on desktop
  and mobile. `.shop-list-status` CSS changed from absolute-on-image to an inline
  badge (0.52rem); added `.shop-list-metal-row` (flex) and gave `.shop-list-metal`
  ellipsis. Verified live at desktop + 375px: flag off the image, left of the metal
  label, same line, correct colors. `tsc`/`eslint` clean.

## 2026-07-03

- **Auto-send the buyer a receipt when their order is paid; invoice email is now
  paid-aware.** On a successful PayPal capture (the moment the order becomes paid),
  `capture-order` now automatically emails the buyer — best-effort, so an email
  failure never fails the capture, and it only runs on the fresh capture (an
  already-paid order returns earlier → no duplicate). `buildInvoiceEmailContent`
  is now paid-aware: a **paid** order reads as a **Receipt** (subject/header
  "Receipt for order NEJ-…", a green "PAID IN FULL" badge, "Total Paid", and
  paid-wording intro/note); an unpaid order stays an **Invoice**. Extracted a
  shared `lib/order-invoice-mailer.ts` (`sendOrderInvoiceEmail`: fetch order →
  build paid-aware content → Resend → log to `order_emails`) used by both the
  admin `email-invoice` route and the capture auto-send. The admin panel's
  button/modal now say **Email Receipt** / **Send Receipt Email** for paid orders
  (Invoice otherwise), and the email-history card labels auto-sent rows "Receipt …
  Sent automatically". The auto-receipt email sends even before the `order_emails`
  migration (it just isn't logged until then). `npm run build` passes, `tsc` clean,
  `eslint` clean (only pre-existing OrderDetailPanel warnings). Not exercised live
  (needs a PayPal sandbox capture + admin view + the `order-emails.sql` migration).
  See DECISIONS 2026-07-03.
  - **Note on unpaid orders (answered a question):** unpaid orders are normal, not
    DB edits — `create_paypal_order` inserts the order as `unpaid` when the PayPal
    window opens (before capture; abandoned/failed checkouts stay unpaid), admin
    order-create inserts `unpaid`, and the legacy `/api/checkout/order` route does too.

- **Order detail page now records + shows an email history.** Every email an admin
  sends from `/admin/orders/[id]` (invoice emails and fulfillment-update emails) is
  logged and displayed in a new **Email History** card **under the Summary block** on
  the right. New table `order_emails` (`supabase/order-emails.sql`: order_id, type,
  recipient, subject, status, sent_by/sent_by_email, created_at; admin RLS via
  `is_admin_user`). Both `email-invoice`/`email-update` routes best-effort insert a
  row after a successful send (never blocks the email) and return the record; the
  order page loads history and passes it + the admin email to `OrderDetailPanel`,
  which prepends each just-sent email optimistically. Degrades gracefully pre-migration
  (missing table → empty history, emails still send). **Manual step: run
  `supabase/order-emails.sql`.** `npm run build` passes, `tsc` clean, `eslint` clean
  (only pre-existing OrderDetailPanel warnings). Not exercised live — admin session
  had lapsed (won't type owner credentials) and the table isn't migrated yet. See
  DECISIONS 2026-07-03.

- **New photo uploads default to white image padding (new + existing products).**
  Two changes in `AdminShell.tsx`: (1) `emptyProduct()` seeds `image_padding:
  'white'` (was `'none'`), so a new listing's photos are white-padded by default;
  (2) `handleImageUpload` now gives each freshly uploaded photo a per-photo white
  entry in `image_padding_by_image` when the product's product-level padding isn't
  already white — so uploading a new photo to an **existing** product (which may use
  another padding) defaults that photo to white without touching the product's other
  photos. New products stay clean (product-level white → no per-photo pins). The
  per-photo chooser (white / black / none / custom) is unchanged, so the admin can
  still change any photo. Existing photos are never retroactively re-padded. `tsc`
  clean; the only AdminShell eslint error is the pre-existing `set-state-in-effect`
  at L915 (unrelated). Not exercised via a signed-in upload (admin session had
  lapsed; avoided creating junk inventory) — verified by type-check + the save/render
  path the chooser already uses.

- **Shop Visibility toggle: migration applied + verified end-to-end.**
  `supabase/shop-settings.sql` was run. Verified live (admin): toggle ON → `/shop`
  59/59 with 7 sold shown; OFF → 52/52, `?status=sold` empty (sold removed from
  results, total, and facets); back ON → 59/59. Setting restored to `true` after
  testing. (Feature added earlier same day — see below.)

- **Admin can show/hide sold items in the shop gallery.** New **Shop Visibility**
  section in `/admin/settings` with a "Show sold items in the shop gallery"
  checkbox. New single-row `shop_settings` table (`show_sold_items`), new
  admin-gated `/api/admin/shop-settings` (GET/PUT, service-role writes, PUT busts
  the `shop-catalog` cache tag), new `src/lib/shop-settings.ts` store (defaults to
  `true`/graceful), new `AdminShopVisibilityPanel` rendered by `AdminSettingsPanel`,
  and `shop/page.tsx#queryShopCatalog` now filters to available-only
  (`AVAILABLE_ONLY_SHOP_PRODUCT_STATUSES`, new export in `types/product.ts`) when the
  toggle is off. Available items are always shown; the detail page still renders sold
  items. **Manual step: run `supabase/shop-settings.sql`.** Pre-migration it defaults
  to showing sold (no behavior change) and Save returns a graceful 500. `npm run
  build` passes, `tsc`/`eslint` clean; verified live (panel renders, GET ok, PUT
  graceful 500, `/shop` unchanged). See DECISIONS 2026-07-03.

- **Shop list view: Add-to-Cart is now a labeled rectangular button.** Added a
  new `list` variant to `CartButton` — a rectangular (6px radius) gold button
  reading "Add to Cart" (→ "In Cart" once added, gold-outline), replacing the
  circular cart icon in `ProductListRow`'s actions. The favorite/wishlist button
  stays a circular icon next to it. The new variant reuses the existing
  add/remove `handleClick`; labels are EN/ES ("Add to Cart"/"Agregar",
  "In Cart"/"En carrito"). Verified live at 375px: rectangular 124×33px button,
  wishlist still a 28px circle, clicking adds to cart (badge 1→2, label →
  "In Cart"). Gallery cards' Add button is unchanged. `tsc`/`eslint` clean.

- **Shrank the Available/Sold status flag in the shop list view.**
  `.shop-list-status` (in `ShopProductGrid.tsx`'s list-branch styles) went from
  `font-size: 0.5rem` / `padding: 0.1rem 0.34rem` / `letter-spacing: 0.08em` to
  `0.4rem` / `0.07rem 0.26rem` / `0.06em`. Both the Available and Sold flags share
  this class (Sold only differs by background via `[data-sold]`), so both shrink.
  Verified live at 375px: Available flag now 6.4px (was 8px). `tsc`/`eslint` clean.

- **Ring size chip on shop gallery + list views now shows a "Sz" prefix.**
  `formatLengthChip` (duplicated in both `ProductCard.tsx` and
  `ProductListRow.tsx`) extracted the bare number from a `"Size: N"` value (so the
  spec chip read e.g. "6"); it now returns `"Sz N"` (e.g. "Sz 6", "Sz 7.5") in
  both. Non-ring length chips (inches, e.g. "18in") are unchanged. The product
  detail page was intentionally left as-is. Verified live at 375px on
  `?itemType=ring` (gallery) and `?itemType=ring&view=list`. `tsc`/`eslint` clean.

- **Slightly enlarged the mobile shop-card link-type/brand flag.** Bumped the
  bottom-left flag's mobile (`≤640px`) font size in `ProductCard.tsx`:
  `.shop-card-brand-tag-link` and `.shop-card-brand-tag-brand` 0.4rem→0.46rem,
  `.shop-card-brand-tag-fit-medium` 0.36rem→0.42rem,
  `.shop-card-brand-tag-fit-long` 0.32rem→0.38rem. Verified live at 375px:
  "CUBAN LINK" etc. now render at 7.36px (was 6.4px), long labels at 6.08px —
  more legible, still fit the card. `tsc`/`eslint` clean.

- **Enlarged the mobile shop-card icon buttons' tap targets (not their size).**
  Users reported the cart / favorite corner icons on gallery cards took 2–3 taps
  to hit on mobile. Added a transparent `::before` overlay (`inset: -0.85rem`,
  `≤640px` only) to `.shop-card-cart-icon-button` / `.shop-card-wishlist-button`
  in `ProductCard.tsx`, extending each button's clickable area to ~49px from the
  ~29px visible icon while leaving the icon's appearance unchanged. The overlay
  reaches past the card corner (clipped by the image container's rounded
  `overflow:hidden`), so tapping the corner now reliably hits the button.
  Verified live at 375px: visible icon still 29px; hit area ~49px and registers
  1–2px from the corner; a tap in the extended zone toggles the cart; the two
  buttons' hit areas stay ~74px apart (no overlap). `tsc`/`eslint` clean.

- **Removed the "Optional for local pickup" address hint on checkout.** The
  address section's helper line now only renders when a shipping method is
  selected (`needsShipping`) — showing "Required for the delivery method you
  selected." For local pickup no hint shows at all. Verified live both ways.
  `tsc`/`eslint` clean.

- **Tightened the checkout page hero on mobile further.** Hid the
  "Complete your details to check out the items in your cart." subtitle on
  mobile (`hidden md:block` — still shown on desktop) and dropped the `<h1>`
  bottom margin to 0 on mobile (`mb-1.5`→`mb-0`, `mt-2`→`mt-1`) plus trimmed
  `.checkout-hero` mobile padding/margin (`1rem 1.1rem`→`0.75rem 1.1rem`,
  margin-bottom `1rem`→`0.85rem`). The mobile hero is now just the back link +
  "Checkout" in a compact box. Verified live at 375px (subtitle `display:none`,
  still in DOM for `md:`). `tsc`/`eslint` clean.

- **Tightened the checkout Order Summary further.** In `OrderSummary.tsx`'s
  `expanded` variant: moved the "N item(s)" count onto the same row as the
  "Order Summary" heading (right-aligned, `flex-row` at all widths instead of
  stacking below on mobile); shrank the item title (`text-sm md:text-base` →
  `text-[0.8rem] md:text-sm`); and compacted spacing overall — aside padding
  `p-5 md:p-7`→`p-4 md:p-6`, header margin `mb-5`→`mb-3`, item grid gap/margin
  `gap-4 mb-5`→`gap-3 mb-4`, item-row padding `p-2.5 md:p-3`→`p-2 md:p-2.5`,
  thumbnail `20/24`→`16/20` (rem-scale), and the totals block
  `px-4 py-4 pt-4`→`px-3.5 py-3 pt-3`. Verified live at 375px: count is
  right-of-heading on one row, title is 12.8px, and the block is noticeably
  shorter. `tsc`/`eslint` clean.

- **Checkout: address always collected in Contact Details; required only for
  shipping.** Moved the address fields out of the left review column (where they
  only appeared when a shipping method was selected) into the **Contact Details**
  panel under Email, always rendered. When the delivery method is local pickup the
  fields show an "Optional for local pickup" hint, no `*`, `required={false}`, and
  never block payment; when a shipping method is chosen they show `*`,
  `required`, and the existing `payReady`/`missingFieldLabels` gate blocks payment
  until street+city+state+ZIP are filled (unchanged logic). `buildPayPalPayload`
  now always sends the address (server still only requires a complete one for
  shipping — `buildAddressObject` tolerates blanks). Removed the now-unused
  `.checkout-address-block` styles. Verified live: pickup → optional/no-asterisk,
  payment allowed with blank address; shipping → required/asterisks, payment gated
  until complete. `tsc`/`eslint` clean. Supersedes the 2026-06-30 checkout-layout
  decision (see DECISIONS).

- **Compacted the checkout page header on mobile.** The `< Back to shop` /
  "Checkout" heading / subtitle block (`checkout-hero`) used the same padding,
  heading size, and margins at every width — on mobile (`≤640px`) that meant
  ~48px of page top-padding, a 30px heading, and generous margins before the
  Order Summary even started, pushing it and the payment form well below the
  fold. Added a `max-width: 640px` rule that tightens `.checkout-page`'s top
  padding (3rem→1.25rem) and `.checkout-hero`'s padding/margin, and shrunk the
  `<h1>`/subtitle to smaller mobile-first Tailwind sizes (`text-2xl`/`text-sm`,
  tighter `mt`/`mb`) that scale back up at `sm:`/`md:`. Desktop/tablet (`md:`
  classes) untouched. Verified live at 375px — the same viewport height that
  previously showed only the hero now also fits the entire Order Summary box
  and the start of Contact Details. `tsc`/`eslint` clean.

- **Compacted checkout Order Summary item rows; removed the description.**
  `OrderSummary.tsx`'s `expanded` variant (used on `/checkout`) gave each cart
  item a separate bordered "PRICE" panel (label + large price text) in a
  `md:grid-cols-[...]` right column — on mobile that column drops below the
  item info as a large, nearly full-width box, and each row also showed a
  product description line, making the list tall. Replaced the boxed price
  panel with the same small inline bold price line the `compact` variant
  (cart drawer) already used, right under the title, and removed the
  description line entirely (kept the Ca./purity/metal/length "specs" line —
  only the description was requested removed). Removed the now-dead
  `description` variable in `SummaryRow`. Verified live at 375px and desktop
  widths — item rows are now a fraction of their prior height. `tsc`/`eslint`
  clean.

- **Checkout requires a "confirm your information" checkbox before paying.**
  Added a required checkbox in a bordered box directly above the PayPal /
  Debit-or-Credit-Card buttons on `/checkout` ("I confirm that I have reviewed
  my order and that my contact details, shipping address, and other information
  above are correct before proceeding to payment."). Wired into the existing
  `payReady` gate (`CheckoutClient.tsx`) alongside the contact/shipping checks,
  so `PayPalCheckoutButton`'s `onClick` guard rejects the PayPal window and shows
  the existing "required fields" modal (now listing this item too) until it's
  checked. EN/ES copy. Verified live, signed in: unchecked → PayPal blocked +
  "Complete the required details…" message shown; checked → message clears and
  the PayPal/card buttons unlock; unchecking again re-locks. `tsc`/`eslint` clean.

- **Enlarged the mobile shop-card cart and favorite icon buttons.** On the
  gallery cards' mobile view (`≤640px`), the top-left Add-to-Cart icon and
  top-right favorite (wishlist) icon were `1.35rem` — noticeably smaller than
  their `1.75rem` desktop/tablet button-variant size and easy to mis-tap.
  Increased both to `1.8rem` (icon glyphs 11px→14px cart, 12px→15px wishlist);
  corner positions unchanged. Styles live once in `ProductCard.tsx`'s
  deduplicated `<style>` block (rendered by the first card only, applies
  globally via class selectors). Verified live at a 375px viewport: both
  buttons measure ~28.8px (up from ~21.6px). `tsc`/`eslint` clean.

- **Add to Cart no longer opens the cart drawer.** `CartButton`'s `detail`/`icon`
  variants (product detail page, list-view rows) previously called both
  `notifyAdded()` (the "Item added" mini popup anchored under the header cart
  icon) and `openDrawer()` (the full slide-in cart panel) on every add. Removed
  the `openDrawer()` call — adding an item now only shows the mini popup (with
  its existing "Go to cart" / "Clear Cart" actions), matching the shop-grid
  `card` variant's existing inline-confirmation-only behavior. Verified live:
  popup renders with correct copy/actions, cart drawer stays `aria-hidden`,
  translated off-screen, and its backdrop never mounts. `tsc`/`eslint` clean on
  `CartButton.tsx`.

- **Checkout inventory: 30-minute reservation removed — whoever pays first gets
  the item.** Items stay `available` through the PayPal window (no hold), so
  multiple buyers can check out the same one-of-one piece at once; the sale is
  decided at capture. The app code was already on this model (`create-order` →
  `create_paypal_order` with no hold; `capture-order` handles the `item_conflict`
  race). This change tears down the leftover reservation machinery and fixes the
  docs: `supabase/no-reservation-checkout.sql` now also **drops**
  `reserve_paypal_order` + `release_expired_paypal_reservations` and rewrites
  `apply_paypal_order_event`'s `denied` branch (no reservation release);
  `paypal-checkout.sql` got a header pointing to it. Checkout subtitle copy changed
  from "reserve the items" to "check out the items"; a stale "double-reserve"
  comment corrected. Vestigial `reserved_until`/`reserved_order_id` columns left in
  place (always null). The manual admin **Reserved** product status is unrelated and
  unchanged. `tsc` clean, `npm run build` passes. **Manual step: run the current
  `no-reservation-checkout.sql` in Supabase, by itself.** Follow-up the same day: an
  owner attempt to re-run `paypal-checkout.sql` failed with `42P13` (cannot change
  return type of `capture_paypal_order`) — which confirmed the live DB already holds
  the no-reservation `item_conflict` capture function from an earlier apply; added a
  `drop function if exists` guard before that definition in `paypal-checkout.sql`
  (with a warning that re-running it downgrades capture and requires
  no-reservation-checkout.sql again). See DECISIONS 2026-07-03.

- **PayPal checkout: capture-on-approve; confirm-on-return flow removed.** The
  sale now completes when the buyer hits Pay Now in the PayPal window (capture
  runs in the Buttons `onApprove` callback) and they land directly on the "Order
  Received" confirmation on return. Removed the intermediate "Confirm Your Order"
  review screen + client-side capture-on-confirm, and the sessionStorage hand-off
  (`nej-paypal-pending`) + `GET /api/paypal/order-status` resume route +
  `getPayPalOrder()` in `lib/paypal.ts` that supported it. `PayPalCheckoutButton`
  dropped its `onApproved` hand-off prop (now always captures in `onApprove`).
  In-tab order-id reuse for cancel-then-retry is kept; with no reservation (see the
  no-reservation entry above), a tab evicted mid-capture just leaves the item
  available and the `PAYMENT.CAPTURE.COMPLETED` webhook reconciles any capture that
  landed. Verified: `rm -rf .next && npm run build` passes (order-status
  route gone), `tsc --noEmit` clean, changed files lint clean. Not exercised in
  the browser (checkout is auth-gated; capture needs a PayPal sandbox approval).
  See DECISIONS 2026-07-03. Reverts the 2026-07-02 reload/eviction-resume work
  (the stale-total reuse fix from that day stands).

- **Docs: all previously pending Supabase SQL migrations recorded as applied.**
  Owner confirmed running `paypal-checkout.sql` (final re-run dropping the
  capture-to-Messages notification insert), `admin-notifications-recycle-bin.sql`,
  `admin-notifications-image-urls.sql`, `product-public-notes-es.sql`,
  `product-item-year.sql` (with the `admin-notifications-checkout.sql` re-run),
  and `shop-new-listing-jpg-to-webp.sql` on the live Supabase project. Updated
  `CURRENT_STATUS.md` (new dated entry, replaced the "Pending manual SQL"
  section, updated the PayPal HANDOFF migration notes) and `TASKS.md`
  (converted the "Apply supabase/X.sql" backlog items into app-level
  verification tasks, since the SQL itself is no longer outstanding). The
  PayPal go-live blocker is unchanged — it is a Netlify env-var mismatch, not
  a migration.

## 2026-07-02 (later)

- **Fixed: shop gallery stayed stale (e.g. "sold") after admin order actions.**
  The admin Products tab purged the `shop-catalog` cache via the
  `adminUpdateProductStatus` server action, but every order-flow product write
  went straight through the browser Supabase client with no revalidation, so the
  public gallery served its cached page (revalidate: 300) for up to 5 minutes.
  Added bulk `adminRevalidateProducts(ids)` to `app/actions/admin-products.ts`
  and call it after each client-side write: `OrderDetailPanel.updateProducts`
  (cancel/reopen/mark-paid/mark-unpaid), `OrdersPanel` delete-order
  return-to-inventory and create-order reserve, and `AdminShell` archive +
  hard-delete. Verified live signed-in: Mark Paid removed the bracelet from
  /shop within ~3s; Cancel Order returned it within ~3s. `tsc` clean, changed
  files carry only pre-existing lint issues, `npm run build` passes.
  **Convention going forward: any client-side `products` write must be followed
  by `adminRevalidateProduct(s)`.**

## 2026-07-02

- **PayPal checkout now survives a reload/tab-eviction during the approval
  round-trip.** Mobile OSes can evict the checkout tab while the buyer is off in
  the PayPal window/app; previously the post-approval state (`pendingPaypalOrderId`,
  `payerEmail`, `orderIdRef`) lived only in React state, so the buyer returned to a
  blank form after tapping "Pay Now" and the approved order was silently never
  captured. Now `CheckoutClient` persists a hand-off record (`nej-paypal-pending`,
  sessionStorage) at create/approve and, on mount, asks the new
  `GET /api/paypal/order-status?orderId=…` route (backed by `getPayPalOrder()` in
  `lib/paypal.ts`, PayPal `GET /v2/checkout/orders/{id}`) where the payment stands:
  `approved` → restores the Confirm screen, `paid` → success screen, `pending` →
  keeps the reusable order id, `none` → clears the record. Record is cleared on
  capture success and on "Back to checkout". Verified: `tsc` clean, changed files
  lint clean, `npm run build` passes, endpoint behavior verified live on the dev
  server (400 without orderId; `{state:'none'}` for unknown order → record cleared).
  Full resume path (approve in sandbox → reload → Confirm screen restored) still
  needs a signed-in sandbox run — added to the test matrix in CURRENT_STATUS.
- **Fixed: PayPal retry could charge stale totals.** If the buyer cancelled the
  PayPal window, edited the cart or switched shipping method, and paid again, the
  create-order reuse path rebuilt the PayPal order from the ORIGINAL order rows
  (old items/totals). Now the reuse path recomputes the draft from the submitted
  payload and only reuses when the product set and subtotal/shipping/total still
  match; otherwise it cancels the stale order and creates a fresh one. Client side,
  `CheckoutClient` fingerprints the cart+shipping the order was created for
  (`payloadKey`, persisted in the `nej-paypal-pending` record) and forgets the
  reusable order id as soon as the payload diverges. Verified live (signed-in dev
  session): same-payload retry reuses the same order id; changed-shipping retry
  returns a fresh order id; unapproved order → order-status `pending`; fake
  order id → `none` + record self-clears.
- Diagnosed the "returned to a random other tab after PayPal" report: mobile
  OS/browser tab-focus behavior on app hand-off, not app code (no return_url,
  window.open, or tab logic exists in the checkout). The eviction-resume above is
  the actionable defect that fell out of the investigation.

## 2026-06-29

- **Checkout shipping selector lives on the Order Summary's "Shipping" row.** The
  delivery-method dropdown was removed from the right form entirely; the Order Summary
  "Shipping" line is now an inline `<select>` (CheckoutClient passes
  `onShippingMethodChange` again; OrderSummary renders the editable select inline on
  the row, options = method names, the Shipping Cost row shows the price). Selecting a
  method there still reveals the left-column Shipping Address block and updates totals.

- **Checkout layout reorganized.** Delivery method dropdown (was three radio cards
  that ate vertical space). The Shipping Address block moved out of the right form
  into a new left "review" column (`.checkout-review`) directly beneath the Order
  Summary, rendered as a card at the same width as the summary. Verified: address
  block sits in the review column at identical width to the summary (688px === 688px).
- **Order pipeline: notify on the Orders tab, not Messages; show the address.** New
  paid orders now surface as a badge on the admin **Orders** nav (new
  `AdminOrdersLink`, self-fetching the count of `payment_status='paid'` +
  `fulfillment_status='pending'` orders; clears as they're fulfilled) instead of the
  Messages center — `capture_paypal_order` no longer inserts an `admin_notifications`
  row (requires re-running `supabase/paypal-checkout.sql`). The order detail page
  (`OrderDetailPanel`) and the invoice email (`order-invoice-email.ts`) now render
  the customer's **shipping/billing address** (both already stored it but neither
  displayed it); detail page also labels the Customer Notes block. Verified live: a
  paid test order showed the "Orders 1" badge (no Messages badge) and the full
  Naples shipping address on the detail page.
- **Delivery method picker moved into the checkout form, next to the address.** The
  shipping method is now a set of radio cards (Local Pickup / Express / Priority,
  with prices) in the contact form directly above the Shipping Address section, so
  choosing a shipping method reveals the address right below it — the conventional
  ecommerce layout. The Order Summary's shipping line is now read-only text
  reflecting the choice (the editable `<select>` stays only on the placeholder
  payment page, which still passes `onShippingMethodChange`).
- **Checkout collects a shipping address + conventional wording.** When the buyer
  picks a shipping delivery method (anything other than Local Pickup), a required
  Shipping Address section (street, apt, city, state, ZIP, country) now appears on
  the checkout form and is sent through to the order (`shipping_address`); payment
  is gated until it's filled. It stays hidden for pickup. Reworded the panel header
  from "How should we contact you?" to "Contact information" to match a standard
  ecommerce checkout. Added `autoComplete` hints on the contact + address fields.
- **Checkout PayPal/Debit‑Credit buttons always render.** Previously hidden until
  name/email/phone were filled; now shown immediately. Contact details are validated
  in PayPal's `onClick` (rejects the popup + prompts if missing), and create‑order
  still validates server‑side. A gentle helper note appears under the buttons when
  the form isn't complete. The buttons now initialize once (on SDK load) instead of
  re‑initializing on every keystroke.
- **Reserved items leave the shop gallery promptly.** The gallery already excluded
  `reserved` at query time, but the `/shop` catalog is cached (`unstable_cache`, tag
  `shop-catalog`, 300s). The PayPal reserve/capture/release paths + denial/refund
  webhook now call `revalidateTag('shop-catalog', 'max')` (Next 16's two-arg form) so
  a reserved item drops out within a refresh cycle (~1-2s) instead of up to 5 min.
  Also trimmed the Orders table Items column to a count ("3 items") — full titles
  stay on the order details page.
- **Delete order from the admin Orders table.** Added a Delete action to each row
  (desktop table + mobile cards) in `OrdersPanel`, with a confirmation modal that
  shows the order number + line-item count and an opt‑in (default on) to **return
  the order's products to `available` inventory**. Deletes the order (its
  `order_items` cascade), optionally releases held/sold products, updates the list,
  and refreshes. Admin RLS authorizes the delete. Verified live: deleting a paid
  order removed it + its items and returned the product to `available`.
- **Found: admin Orders table was blank because `order_items.discount` was never
  added.** The Orders query embeds `order_items(… discount …)`; without that column
  the whole query 422'd and *no* orders rendered (Messages were unaffected — different
  table). Resolved by applying `supabase/order-item-line-discounts.sql`.
- **PayPal checkout: post‑test fixes.** (1) Amount rounding — round to cents at the
  source and derive the PayPal `value` from the rounded breakdown parts, so PayPal's
  breakdown validation can't 422 (proved 0 mismatches across 2M cent values).
  (2) `capture_paypal_order` ambiguous `order_id` — qualified `order_items.order_id`
  so capture no longer 500s. (3) `service_role` table grants added to
  `paypal-checkout.sql` (capture/webhook/create‑order need direct table access).
  Sandbox Test 1 (successful payment) then passed end‑to‑end (paid/completed,
  product sold, admin notification, idempotent).
- **PayPal checkout added to `/checkout`.** Replaced the manual "Submit Order"
  button with a PayPal JS SDK button (`components/checkout/PayPalCheckoutButton.tsx`)
  that only renders when the cart is valid and contact fields are filled. New
  backend: `lib/paypal.ts` (Orders v2 + webhook verify), `lib/checkout-pricing.ts`
  (server-side authoritative subtotal/tax/shipping/total, also adopted by the
  legacy `/api/checkout/order` route), and routes `/api/paypal/create-order`,
  `/api/paypal/capture-order`, `/api/paypal/webhook`. New
  `supabase/paypal-checkout.sql` adds PayPal/reservation columns, the
  `webhook_events` table, and the reserve/capture/release/event RPCs. One-of-one
  items are reserved (row-locked, 30-min expiry); capture verifies amount+currency,
  marks the order paid + products sold, and notifies admin; the webhook is
  signature-verified and idempotent. No amounts are trusted from the browser.
  Sandbox (`PAYPAL_ENV=sandbox`); pending manual: run the SQL, set Netlify env
  vars, register the webhook, run the sandbox test matrix. tsc/lint/build clean;
  preview smoke passed. See `features/paypal-checkout.md`.

## 2026-06-26

- **CRITICAL FIX — Messages panel showed stale lists across view switches.**
  `MessagesPanel` seeded its list from `useState(notifications)`, which captures the
  prop only on mount. Next.js soft-navigation between `?view=inbox` and `?view=trash`
  (and `router.refresh()` after an action) re-renders the component with new props but
  does NOT remount it, so the list stayed frozen on the first view's data — inbox
  messages appeared inside the Recycle Bin, and (worst of all) Restore/Delete‑Forever
  fired against the **stale rows' ids**, so the wrong messages were acted on/deleted.
  Fixed with React's "reset state when a prop changes" pattern: when the incoming
  `notifications` array identity changes, reset `items` and clear `selected`. Verified
  live: inbox↔bin soft-nav now always shows the correct server list in both
  directions; 0 console errors; lint clean. Note: during the buggy window the message
  center dropped from 5 notifications to 2 (3 purged); the underlying `orders` /
  `inquiries` rows are stored in separate tables and are unaffected by notification
  deletion.
- **Recycle Bin for admin messages (soft delete).** "Delete Selected" in
  `/admin/messages` now moves messages to a Recycle Bin (`admin_notifications.deleted_at`)
  instead of removing them. New `?view=trash` view lists deleted messages where the
  admin can **Restore** or **Delete Forever** (the latter behind a confirm). Inbox
  filters `deleted_at is null`; a "Recycle Bin (N)" link shows the bin count. Soft
  delete also sets `is_read = true` so trashed items drop out of every unread badge
  (which keys off `is_read = false`) without touching the 9 count call sites. All
  three mutations go through SECURITY DEFINER RPCs (`trash_admin_notifications`,
  `restore_admin_notifications`, `delete_admin_notifications`) — same proven pattern
  as `create_checkout_order`, so no table-grant dependency. Page degrades gracefully
  pre-migration (bin link hidden, trash empty). **Requires SQL:**
  `supabase/admin-notifications-recycle-bin.sql`. Lint clean on changed files;
  verified inbox + trash render with 0 console errors.
- **Fixed message delete (42501 → SECURITY DEFINER RPC).** Bulk-delete in
  `/admin/messages` failed with "permission denied for table admin_notifications":
  `service_role` had INSERT but never DELETE, and a plain `grant delete` did not
  resolve it in the live DB. Switched the delete path to a SECURITY DEFINER function
  `delete_admin_notifications(uuid[])` (runs as owner, internal admin check), called
  with the authenticated admin's session — the same mechanism that makes
  `create_checkout_order` work. Confirmed working live.
- **Admin: delete user accounts.** `/admin/users` rows (desktop + mobile) now have a
  Delete button that opens a confirm modal warning the action is permanent (extra
  warning if the target is an admin). New `DELETE /api/admin/users/[id]` verifies the
  caller is admin, blocks self-deletion, removes the Supabase Auth user via service
  role, and deletes the profile row as a cascade fallback. The logged-in admin's own
  row has no Delete button.
- **Admin nav: removed Inquiries.** Every inquiry already surfaces in Messages
  (unified inbox), so the redundant Inquiries tab was dropped from `AdminHeader`. The
  `/admin/inquiries` page still exists by direct URL.
- **Contact form is now the only contact section; phone required, name/email
  optional.** Removed the "Submit Your Item" (`ContactForm`) section from `/contact`
  so the page is just "Message Us Directly". Made **phone + message** required and
  name/email optional, with phone-format validation (10–15 digits) on both client and
  `/api/contact-message`. Notification title/email fall back to the phone number when
  no name is given. Shortened the subtext to "Send us a note and attach photos if you
  like. We'll get back to you as soon as we can."

## 2026-06-25

- **Contact page opens directly with "Message Us Directly" (hero removed).** The
  normal `/contact` view no longer renders the top hero ("Get in Touch" + CTAs); it
  now starts with the Message Us Directly section right under the header, followed by
  "Submit Your Item". The Message Us Directly heading was promoted to the page `<h1>`
  (responsive-title-lg) so the page keeps a proper top-level heading. The hero is
  kept **only** for the product-inquiry flow (`/contact?item=…`, reached from a
  product page), which relies on it for its heading context. Verified: hero copy
  gone, `#message-us` is the first `<main>` child at y=64, h1 = "Message Us Directly",
  Submit Your Item below, 0 console errors. Build clean.
- **Unified admin inbox — every inquiry now also posts to the message center.**
  `/api/inquire` (Free Evaluation, Submit Your Item, product inquiry) now writes an
  `admin_notifications` row (`type: 'inquiry'`) alongside the `inquiries` record, so
  all incoming submissions show in `/admin/messages` next to "Message Us Directly"
  messages and order notifications — with uploaded photos attached and the unread
  badge covering everything. Inquiries still also appear in `/admin/inquiries`
  (status workflow) and still email the owner. New shared helper
  `lib/admin-notify.ts` (`createAdminNotification`, best-effort, with the image_urls
  column fallback); `/api/contact-message` refactored to use it. The notification
  insert is best-effort — a failure never fails the submission (the inquiry row +
  email already captured it). Notification titles are type-aware and human ("Free
  evaluation request from {name}", "Item submission from {name}", "Inquiry about
  {product} from {name}", "Message from {name}"; dropped the redundant "New" since
  the panel already shows an unread badge), and `MessagesPanel` shows a color-coded
  type chip (Inquiry / Message / Order) so the mixed inbox is scannable. Live test: a
  free-eval submission returned 200 and the
  `admin_notifications` insert succeeded with no error (so `service_role` already has
  the grant; `service-role-insert-grants.sql` appears unnecessary — kept as an
  idempotent safety net). Build + lint clean.
- **Fixed lead forms failing with "permission denied for table inquiries" (42501).**
  Free Evaluation / Submit Your Item / product inquiry submissions were 500ing:
  `/api/inquire` inserted the row with the **service-role** client (`db = service ??
  …`), but `service_role` has no INSERT grant on `inquiries` (grants went to `anon`/
  `authenticated`; inserts were meant to run as `anon` under the public-insert
  policy). Configuring the service key for photo uploads silently switched the
  insert to `service_role`, which then failed. Fix: insert as the **anon role** via
  `createPublicClient()` (both the multipart and JSON paths); the service client is
  used only for the Storage upload. Verified live — the exact free-eval path now
  returns 200 (was 500), no 42501 in logs. Build + lint clean. Also added
  `supabase/service-role-insert-grants.sql` granting `service_role` INSERT on
  `admin_notifications` (same latent issue for the "Message Us Directly" form, which
  has no anon path) — **pending manual apply**; until then that form falls back to
  the email backup. See DECISIONS (2026-06-25).
- **Customer photos now surface in the admin panel (inquiries + messages).**
  `/admin/inquiries` now selects `uploaded_image_urls` and renders submitted photos
  as clickable thumbnails in each inquiry's expanded view (graceful fallback if the
  column is absent). The "Message Us Directly" form gained an optional multi-photo
  upload; `/api/contact-message` now accepts multipart, uploads photos to the
  `product-images` bucket under a `messages/` prefix, and stores URLs in a new
  `admin_notifications.image_urls` column that `/admin/messages` renders as
  thumbnails. Registered the new upload destination with the Storage GC reference
  scan so message photos aren't GC'd. Thumbnails use `next/image` (unoptimized).
  **Pending manual:** run `supabase/admin-notifications-image-urls.sql`. Verified
  build clean (205 pages), lint only the 3 known issues, message form renders the
  photo zone, API validates under multipart. See DECISIONS (2026-06-25).
- **"Message Us Directly" form added to the contact page.** New section below the
  `/contact` hero (above "Submit Your Item") with name, email, optional phone, and
  a large message textarea. New `components/contact/MessageUsForm.tsx` (bilingual,
  honeypot, privacy notice) posts JSON to the new `/api/contact-message` route,
  which inserts a `type: 'message'` row into `admin_notifications` via the
  service-role client so it appears in `/admin/messages`, plus a best-effort owner
  email (reply-to the sender) as backup. Validation verified (missing/invalid →
  400, honeypot → dropped); page renders the section directly under the hero;
  build clean (205 pages); lint only the 3 known issues. Needs
  `SUPABASE_SERVICE_ROLE_KEY` + the `admin_notifications` table (already required
  elsewhere). See DECISIONS (2026-06-25).
- **Performance/security audit fixes (4 phases).**
  - **Forms now deliver.** `/contact` (submit-item) and `/free-evaluation` were
    silently failing — they used Netlify Forms (`data-netlify`), which Netlify's
    static form-detector cannot see on client-rendered React, so submissions
    were lost while the UI faked success. Rewired both to `fetch` the existing
    `/api/inquire` pipeline (Resend + Supabase `inquiries` + `/admin/inquiries`).
    `/api/inquire` now content-type-branches: JSON (product InquiryForm,
    unchanged) vs multipart (lead forms). Lead photos upload server-side via the
    service-role client to the `product-images` bucket and are recorded in
    `inquiries.uploaded_image_urls` (graceful fallback to message text if the
    column isn't present). Honeypot kept and checked server-side. Did NOT create
    `public/__forms.html` — using the API route, not Netlify Forms.
  - **netlify.toml consolidated + hardened.** Deleted duplicate
    `next-app/netlify.toml`; root file is authoritative. Added `/*` security
    headers (X-Frame-Options DENY, X-Content-Type-Options nosniff,
    Referrer-Policy strict-origin-when-cross-origin, HSTS, Permissions-Policy)
    with CSP in **Report-Only** mode (Supabase + Google Fonts + gold-api allowed).
    Added immutable 1y cache for `/_next/static/*` and `/assets/*` and short
    `max-age=0, must-revalidate` catch-all. Added 410 `force` redirects for
    `/wp-admin/*`, `/wp-login.php`, `/xmlrpc.php`, `/.env*`, `/config.json`,
    `/.git/*` → new `public/410.html`. Tightened `robots.ts` to disallow
    `/admin`, `/account`, `/api` (+ `/es` variants).
  - **Image/video optimization.** Converted `silver.jpg`,
    `shop-new-listing-06-04.jpg`, `shop-new-listing-06-05.jpg` → WebP (2048/q80),
    deleted JPGs; recompressed `money.webp` (862→323KB), `bullion.webp`
    (529→236KB), `jeweler.webp` (370→64KB), `logo.webp` (480→**5KB**). Deleted
    unused `homepage-hero.mp4` (4.78MB; replaced by carousel). Updated
    `silver-services` ref + netlify redirect targets; added shop JPG→WebP
    safety-net redirects and `supabase/shop-new-listing-jpg-to-webp.sql` to
    repoint product rows.
  - **Root `app/not-found.tsx` added** (self-contained — no SiteHeader/Footer,
    which need next-intl context unavailable outside `[locale]`). Spot-checked 5
    pages: meta descriptions all unique. Build clean; lint only the 3 known
    pre-existing issues.

- **Mobile header oversized text fixed (MENU + Saved Items).** On mobile the
  MENU toggle and the "Saved Items" (Favorites) mobile-menu row rendered at 16px
  instead of their intended `text-[10px]`/`text-xs`. Root cause: the global
  `globals.css` reset `button, input, select, textarea { font: inherit }` is
  unlayered, so its `font-size: inherit` overrode Tailwind's layered text
  utilities on `<button>` elements (link/`<a>` rows were unaffected). Fixed
  narrowly in `SiteHeader`'s own CSS by setting explicit `font-size` on
  `.menu-toggle` (0.625rem; 0.75rem at `md`, matching the adjacent language
  toggle) and `.mobile-nav-link` (0.75rem, matching the link rows) — higher
  specificity than the global `button` rule, so no other buttons are affected.
  Verified at 375px: MENU = 10px, all mobile menu rows = 12px. Build clean.
- **Product listing notes made bilingual (Notes EN / Notes ES).** Replaced the
  add/edit listing form's admin-only **Internal Notes** field with a public
  **Notes (ES)** field, and relabeled **Public Notes → Notes (EN)**. New column
  `products.public_notes_es` (ES counterpart to `public_notes`); the /es product
  detail page renders it with fallback to the English note, mirroring
  `description_es`. Notes (ES) auto-translates from Notes (EN) on save (extended
  `ai-translate` + `/api/admin/translate` to carry `notes`/`notes_es`) and is
  manually editable. Quick Fill targets updated (Notes (EN)/Notes (ES)); legacy
  Quick Fill prompt copy updated. Scope is products only — `orders`/`inquiries`/
  `profiles` `internal_notes` left unchanged (unrelated admin fields). Reads and
  writes degrade gracefully before the migration via a generalized
  missing-optional-column fallback (`item_year` + `public_notes_es`). **Pending
  manual:** run `supabase/product-public-notes-es.sql` in Supabase. Verified
  `npm run build` clean (204 pages), `npm run lint` only the 3 known issues, and
  `/en` + `/es` product detail pages return 200 against the un-migrated DB. See
  DECISIONS (2026-06-25).
- **AI listing prompt collapsed to a single editable value.** Removed the
  "default + override / Custom vs Default" duality from the AI listing-assistant
  prompt. There is now **one** prompt: the admin edits it in `/admin/settings`
  and the saved value becomes the prompt permanently; the code constant
  `PRODUCT_EXTRACTION_SYSTEM_PROMPT` (v11) is only its built-in starting value,
  recoverable via a renamed **Restore Built-In** action. `/api/admin/ai-settings`
  now returns `systemPrompt` + `builtInPrompt` (dropped `isCustom`/`defaultPrompt`);
  store helpers renamed to `fetchStoredSystemPrompt`/`saveSystemPrompt`; the panel
  drops the Custom/Default badge and reframes copy/labels around one prompt. The
  persistence mechanism (saved value wins, blank clears to the built-in) is
  unchanged. Verified `npm run build` clean (204 pages) and `npm run lint` shows
  only the 3 known pre-existing issues. See DECISIONS (2026-06-25).
- **Spanish localization orthography sweep.** Corrected missing accent marks,
  inverted punctuation (`¿`/`¡`), and related orthography across all Spanish UI
  strings — placeholders, headings, labels, navigation, forms, product/shop
  pages, legal pages, banners, footers, tooltips, and messages. Started with the
  homepage newsletter signup (`HomeSubscriberForm` placeholder
  `Correo electronico` → `Correo electrónico`; `FormPrivacyNotice` disclaimer
  `informacion` → `información`, `Politica` → `Política`), then fixed ~124
  occurrences across 22 files (e.g. `about`, `privacy`, `terms`, `auctions`,
  `services`, `shop`, `ShopFilters`, `ShopPagination`, `AccountDashboard`,
  `AccountProfileForm`, `CartDrawer`, `CheckoutClient`, `OrderSummary`,
  `PaymentClient`, `SiteFooter`, legal components). `messages/es.json` was
  already correct. Wording/meaning unchanged; only orthography. Verified
  `npm run build` clean and `npm run lint` shows only the 3 known pre-existing
  issues; `/es` pages return 200 and the newsletter section renders the accented
  copy with no console/server errors.
- **Create-account duplicate-email block + password reset offer.**
  The Create Account form (`account/sign-up/page.tsx`) now detects when the
  entered email already belongs to an account and, instead of silently sending a
  confirmation, shows a notice ("This email already has an account") with a
  **Reset Password** button and a "Go to Sign In" link. Detection uses Supabase's
  documented signal for email-confirmation projects — `signUp` returns a user
  with an empty `identities` array for an existing **confirmed** account — plus a
  fallback for configs that return an explicit "already registered" error. The
  Reset Password button calls `resetPasswordForEmail(..., { redirectTo })` and
  confirms "reset link sent". New recovery page `account/reset-password/page.tsx`
  is dual-mode: with no session it requests a reset email; arriving from the
  emailed link (recovery session) it shows a "Set a New Password" form
  (`updateUser({ password })`). Added a "Forgot password?" link on the sign-in
  page pointing to it. Verified: `npm run build` clean (route registered EN/ES),
  `npm run lint` only the 3 known pre-existing issues, a brand-new email still
  reaches "Check your email" with no false-positive (live Supabase), reset-request
  page renders. **Manual steps:** (1) confirm Supabase Auth → URL Configuration
  Redirect URLs allow `…/account/reset-password` (covered by the existing
  `https://naplesestatejewelry.co/**`, localhost, and 127.0.0.1 `/**` entries);
  (2) end-to-end verify the existing-account notice + reset email with a known
  confirmed account (couldn't be exercised in dev — the test email was not a
  confirmed account there).
- **Shop gallery/list view toggle added.**
  The public `/shop` gallery toolbar now has a grid/list view toggle (next to
  Sort) that switches the catalog between the existing gallery cards and a new
  compact list mode, on both desktop and mobile. The gallery card layout/markup
  is completely untouched — list mode is a separate `ProductListRow` component
  rendered only when active. State lives in a `view=list` URL param (mirrors the
  `sort` pattern), so it is shareable/back-button safe and defaults to gallery.
  New files: `components/shop/ShopViewToggle.tsx`, `components/shop/ProductListRow.tsx`.
  `ShopProductGrid.tsx` takes a `view` prop and renders the list branch (+ its
  scoped CSS); `shop/page.tsx` parses `view`, adds the toggle, and passes it down.
  List rows show thumbnail + Available/Sold badge, metal label, full title,
  brand/link flag, circa year, purity/weight/length chips, "Your price", and the
  wishlist + cart icon buttons; the price/actions row drops below the row on
  phones. Verified: gallery view byte-identical to before, list view renders on
  mobile (~450px) and desktop (1280px, 3-column row grid confirmed via inspect),
  toggle switches both ways, 0 console errors. `npm run build` clean (202 pages);
  `npm run lint` shows only the 3 known pre-existing issues.

## 2026-06-24

- **Shop cold-load performance pass.**
  Acted on a file-cited audit of why `/shop` is slow on a cold external visit.
  (1) Wrapped the catalog read (product scan + total-inventory count) in
  `unstable_cache` keyed by the DB-level filter set, so concurrent cold visitors
  share one DB round trip per 300s window instead of each triggering a full-table
  scan (`shop/page.tsx`). (2) Added a 1.5s `AbortSignal.timeout` to the upstream
  metal-price fetch so a slow/cold gold-api can no longer inflate shop TTFB; it
  falls back to the cached/known value (`lib/spot-price.ts`). (3) Set real
  `priority` (preload + fetchpriority=high) on the first-row product cover images
  — previously only `loading="eager"` was set, never `priority` — and set
  `prefetch={false}` on the 48 dynamic product-card links so they no longer
  background-prefetch 48 SSR routes on viewport (`ProductCard.tsx`). (4) Dropped
  the unused `GRAD` axis from the Material Symbols icon-font request to shrink the
  variable WOFF2 (`layout.tsx`). (5) Removed `unoptimized` from the header logo so
  next/image serves it at display size: the per-page logo preload went from
  **491,738 B → 1,321 B** (raw webp → 64w AVIF, measured via curl). Verified:
  `npm run build` clean (202 pages, 0 TS errors); `/shop` renders 48 cards /
  "Showing 48 of 54"; `/shop?metal=gold` correctly returns 47/54 (cache-key
  filtering preserved); product detail page renders. `npm run lint` shows only
  the 3 known pre-existing issues (AdminShell setState-in-effect, ShopFilters
  unused var, icon-font display=block warning) — no new findings.
- **Luxury skeleton loaders + CLS prevention.**
  Added warm ivory/gold shimmer `loading.tsx` skeletons for `/shop` (header bar,
  hero band, filter toolbar, product-card grid) and `/shop/[id]` (gallery +
  details two-column), plus a shared `.nej-skeleton` shimmer utility in
  `globals.css` (respects `prefers-reduced-motion`). They stream instantly while
  the dynamic page renders, so there are no blank screens, and they reserve the
  same layout boxes (aspect-square image wells, fixed header height) to avoid
  layout shift. Verified skeleton computed style renders the brand tone
  (`rgb(239,231,212)`) with the shimmer animation active.
- **Cookie banner compactness + symmetry (mobile) and carousel hero lift.**
  Made the mobile cookie banner smaller (tighter padding, `text-xs` body,
  `0.62rem` buttons) and symmetrical: Privacy/Preferences as equal halves in a
  2-col grid with Accept full-width below as the primary action; reverts to the
  inline desktop row at `md`. Banner height at 320px dropped 220px → 191px.
  Lifted the homepage carousel ring on mobile (`translateY -6svh → -12svh`,
  `scale 1.14 → 1.06`, `≤640px` only) so photos clear the "Get first look"
  sign-up block instead of sitting behind it. Verified across 320, 360, 375,
  390, 430, 768, and 1024px.
- **Cookie banner responsive fix + header logo overflow fix.**
  Cookie notice buttons now stack full-width vertically below 480px and switch
  to a single horizontal row at 480px+, preventing the wrapped "Accept" button
  from overflowing the banner's white/backdrop-blur background at 320–430px.
  Added `flex-shrink-0` to the button row at `md` so it never shrinks into its
  own children when the banner uses the horizontal `justify-between` layout at
  768px+. Added `min-w-0` to the text div so it wraps gracefully instead.
  Also added `overflow-hidden` to the logo `<Link>` in `SiteHeader` so the
  `whitespace-nowrap` brand text is clipped at the link boundary rather than
  overflowing 32px into the adjacent actions area at 320px.
  Verified: `npm run build` clean (202 pages, 0 TypeScript errors). Playwright
  viewport sweep at 320, 360, 480, 768, 1024, 1280, and 1440px — cookie banner
  contained at all widths, 0 horizontal-overflow failures across /, /shop,
  /contact, /estate-jewelry, and /about.

## 2026-06-22

- **Completed a production performance/caching pass.**
  Added a cookie-free public Supabase client for anonymous shop/product reads,
  scoped proxy session refresh to user-state routes, enabled static locale
  params for `next-intl`, made many localized public pages SSG, added explicit
  compression/cache configuration and reusable compression/timing probes,
  parallelized independent `/shop` reads, narrowed product-detail payloads,
  changed admin reorder saves to one bulk upsert, made homepage subscriber
  submit optimistically reversible, and removed repeated shop-card style HTML.
  Verified typecheck, production build, compression probes, route timing probes,
  and in-app browser `/shop` smoke. `/shop` remains dynamic pending a larger
  cached-shell/client-filtering or RPC-backed filtering follow-up.
- **Added mobile shop filter apply button.**
  The expandable `/shop` filter panel now has a large gold "Save and Apply
  Filters" button at the bottom on mobile/tablet. It commits any typed price
  range and closes the panel, giving shoppers a clear end to the filter flow.
- **Refined homepage carousel first-load behavior.**
  The baked-in fallback carousel now waits longer before revealing and becomes
  a hard fallback rather than a temporary visible state, preventing fallback
  product photos from flashing before the live curated starting items appear.
  Verified timed browser samples on `/` after restarting the local preview.
- **Fixed homepage and shop reveal stalls.**
  The home carousel hero now fails open if carousel settings/data, fonts, or
  visible-image preloads stall, and shop product cards fail open if a cover
  image load signal is missed. Restarted the local production preview and
  verified `/` shows the hero at opacity 1 and `/shop` shows all 48 product
  cards with no horizontal overflow.
- **Completed a responsive layout audit/refactor.**
  Added shared responsive layout primitives and clamp/minmax helpers; tightened
  base overflow/media/control behavior; refactored the header, shop grid/hero,
  home/contact/about sections, checkout/payment form layouts, cart drawer, admin
  header/table wrappers, and `/admin/users` mobile cards. Verified a local
  Chrome viewport sweep at 320, 375, 390, 430, 768, 1024, 1280, 1440, and
  1920px across 12 major routes with 0 horizontal-overflow failures. Build and
  typecheck pass; lint remains blocked by unrelated existing lint issues.

## 2026-06-21

- **Added a top Clear Filters button to the shop filter panel.**
  The left filter panel now shows a compact Clear Filters button at the top
  whenever filters are active, in addition to the existing bottom clear link.
  It uses the same clear-all handler and keeps the unfiltered state clean.
- **Added a gallery-level shop sort dropdown.**
  A compact rectangular Sort dropdown now sits at the top right above the shop
  product cards, matching common storefront layouts while keeping the existing
  left-filter sort control. Both surfaces share the same `ShopSortSelect`
  component and URL-backed `sort` parameter, so Inventory, Price, Weight, and
  Brand sorting stay synchronized and reset pagination on change.
- **Hid draft/reserved inventory from the public shop.**
  Storefront visibility is now centralized around available/sold statuses:
  `/shop` queries, public counts, derived filter options, and normal
  `/shop/[id]` detail access exclude draft, reserved, pending-payment, and
  archived products. Existing admin/account return links can still preview
  product details. Verified typecheck, build, local preview smoke, rendered HTML
  against live product statuses, and `/shop?status=reserved` empty-state
  behavior; lint remains blocked by unrelated existing lint issues.

## 2026-06-20

- **Account menu tabs shrink to fit on mobile (no more horizontal scroll).**
  The account tab bar (Overview / Orders / Wishlist / Admin and Security) used a
  `min-width: 9.5rem` per tab on mobile, forcing a horizontal scroll with the last
  tab cut off. On `max-width: 700px` the tabs are now equal-width (`flex: 1`,
  `min-width: 0`) with the icon stacked above a small label, so all four fit in one
  row. Desktop is unchanged. Applied in both `account/page.tsx` and
  `account/security/page.tsx` (duplicated styles).
- **Mic heads-up before the Smart Assistant starts listening.**
  Tapping "Let's begin - tap here to talk" now opens a dialog ("Before you start
  talking") that warns the browser may request microphone access (tap Allow/Approve)
  and that their spoken words will appear in the box after a few moments, with a
  final "Start recording" button (Cancel backs out). Recording only begins on
  confirm; the talk button still stops an in-progress recording directly.
  `AdminShell.tsx` (`showMicPrompt`).
- **New-listing form starts blank/consistent.**
  The "New listing" form no longer prefills fields with real values — `emptyProduct()`
  now blanks metal_type/metal_variant/product_type/jewelry_type/gender (and clears
  pricing_multiplier), so Product Type and Multiplier show example placeholders and
  Metal Type / Metal Color / Gender start on a "— Select —" option. Operational fields
  that must hold a value keep sensible defaults: Price Mode (Spot × Multiplier),
  category (Gold under the hood), Status, and Location. Existing-item edits are
  unaffected (still show their saved values). `AdminShell.tsx`.
- **Mobile-optimized the listing editor (collapsible blocks, app-like).**
  On phones, each editor block (Photos, Smart listing assistant, Listing details)
  collapses under a tappable header with a chevron; tap to expand. Desktop is
  unchanged (always expanded, no chevrons) — driven by `data-collapsed` +
  `editor-collapse-header` and a `@media (max-width:767px)` rule that hides
  non-header children; subtitles hide when collapsed via `max-md:hidden`. Also:
  Title (English) is now a 2-line textarea; the pricing row (Mode/Purity/Weight/
  Multiplier) is 2-up on mobile and 4-up on desktop (was a cramped 4-up on
  mobile); reduced modal body padding on mobile. The footer buttons (Cancel /
  Save / Save + Add Another / Save and Close) now lay out as a 2-up grid on
  mobile so none overflow off-screen, and stay a single row on desktop.
  `AdminShell.tsx`, `globals.css`.
- **Listing editor: no outside-click close + confirm on close/cancel/save.**
  The New/Edit listing modal no longer closes when clicking the backdrop — only the
  top-right ✕, Cancel, or a Save button. Each of those now routes through a
  confirmation dialog: ✕ and Cancel show "Close this listing? Any unsaved changes
  will be lost." (Keep editing / Close); the Save buttons show "Save this listing?"
  (Keep editing / Save). `AdminShell.tsx` (`editorConfirm` state, `requestCloseEditor`/
  `requestSaveEditor`).
- **Collapsed admin product-table row actions into an "Actions" dropdown.**
  The per-row button strip (View, Edit, Duplicate, Pad, Reserve/Sold/Archive,
  Delete) is now a single "Actions ▾" button that opens a dropdown with the same
  options (status options still conditional on current status). Click-outside
  closes it; the open row's cell raises z-index so the menu overlays rows below.
  Actions column narrowed 224px → 116px. `AdminShell.tsx`.
- **AI listing assistant now handles sterling silver tableware + any silver fineness.**
  Prompt (v6) broadened from jewelry-only to estate catalog (jewelry/gold/sterling):
  classifies specific tableware forms (Goblet, Tray, Salver, Fork, Salad Server,
  Tomato Server, etc.) rather than generic "Silverware", fills only fields that
  apply to the item (leaving jewelry-only fields null), and reads silver purity as
  parts-per-thousand fineness (sterling=925, "800 silver"=80%, any number=/1000).
  `cleanPurity` widened to accept any karat (1–24) or fineness (100–1000) — e.g.
  830/835 now persist; the admin silver-purity input changed from a fixed dropdown
  to a free-form number field with preset suggestions ("Purity (/1000)"), and the
  detail-page purity display shows fineness as a correct percent (835 → 83.5%).
  Scrap/melt calc already handles silver fineness correctly. `ai-product-provider.ts`,
  `ai-product-schema.ts`, `AdminShell.tsx`, `shop/[id]/page.tsx`.
- **AI listing assistant now infers the made-year ("Ca.") from photos (prompt v8).**
  Added `item_year` to the AI autofill field set (schema type/keys/empty/coercion via
  `normalizeProductItemYear`, the `AI_PRODUCT_FIELD_LABELS` map, and `applyAiDraftToForm`).
  The prompt treats it as photo-inferable: use a stated/visible year or date mark, else
  estimate a representative era year from style/construction/cut/hallmark date letters/
  patina (Art Deco→~1925, mid-century→~1960, Victorian→~1880), confidence low. Description
  rule relaxed to permit a visible style/era observation consistent with the estimate
  without claiming verified provenance.
- **AI infers metal family from color when unmarked (prompt v7).** Reversed the old
  "a yellow tone is NOT Gold" rule: with no hallmark or spoken metal, the assistant now
  infers the metal family from the item's dominant color (yellow/rose/gold → Gold,
  silver/white/gray → Silver) instead of always defaulting to Gold. This sets only the
  category/pricing routing — color never becomes a karat/fineness or "solid gold"/
  "sterling" claim; that still needs a mark or stated fact. "STERLING"/"sterling"/"925"
  flags Silver.
- **Fixed homepage carousel order + removed edge fades.**
  The carousel now renders in the admin's curated order. The order was being
  overridden by `groupByBackground()` in `HomeHero.tsx` (it re-sorted all
  white-bg photos before all black-bg photos); removed that call so the
  `carousel_selection.position` order is respected end to end. Also removed every
  edge fade on the carousel: the lateral viewport masks (the `.scene` mask in
  `Carousel.module.css` and the overriding mask in `HomeHero.tsx`) and the
  per-card `.card::after` vignette + bottom gradient. Note: with photos no longer
  grouped by color, the hero background sweep now changes at each white/black
  boundary instead of two clean arcs.
- **Added full-size image lightbox to product pages.**
  Clicking the main product photo opens a full-screen viewer (in addition to the
  existing hover magnification): the image at full size, a thumbnail strip
  beneath it mirroring the on-page gallery, prev/next arrows, and a close X
  top-right. Supports Escape to close, arrow keys to navigate, click-outside to
  dismiss, and body scroll lock. Rendered via a `react-dom` portal to `body` so
  ancestor reveal transforms don't clip the fixed overlay
  (`ProductImageGallery.tsx`).
- **Added shop "Era / Year" range slider.**
  A full-width dual-handle slider sits directly below the shop hero, spanning
  1837→current year with labeled estate-jewelry era bands and boundary-year tick
  marks. Eras are multi-level: a primary contiguous row (Victorian, Edwardian,
  Art Deco, Retro, Mid-Century, Modern, Contemporary) plus a stacked row above
  it for the overlapping Art Nouveau (1890–1910) movement; both rows share the
  same line-based band styling and the overlap band adds small end-cap ticks at
  its exact start/end years. Each title is clickable and snaps the range to that
  era. The left end is labeled "1837 & earlier" and imposes no lower limit, so
  selecting the floor captures pre-Victorian pieces. More overlapping eras can
  be added via the `level` field in `jewelry-eras.ts`. Both handles start at the extremes (readout "All years") so the full
  span shows everything; narrowing either end filters to items whose `item_year`
  falls in range and hides items with no year. The era titles are clickable
  buttons that snap the range to that era and highlight it as active. Drives
  `yearMin`/`yearMax` URL params (cleared at full span), filtered in
  `shop/page.tsx`. New files
  `src/lib/jewelry-eras.ts` (shared era/bounds defs) and
  `src/components/shop/ShopYearFilter.tsx`. Verified `tsc`, lint, and a `/shop`
  browser smoke (48 cards at full span; narrowing to 1915–1935 yields the empty
  state as expected until years are entered).
- **Changed Product Date to a year (item made year).**
  The "Date" field now records the year the physical piece was made (e.g. 1930),
  not the listing-creation date. Renamed `products.item_date` (`date`) →
  `products.item_year` (`smallint`) and `order_items.item_date_snapshot` →
  `order_items.item_year_snapshot` across the app (admin form is now a year
  number input "Date (Year Made)", types/helpers `normalizeProductItemYear` /
  `formatProductItemYear`, shop/cart/checkout/invoice/order surfaces, and SQL).
  New migration `supabase/product-item-year.sql` drops the old `item_date`
  column, clearing the listing-creation dates that had been backfilled into it;
  re-run `admin-notifications-checkout.sql` afterward for the checkout function.
  Buyer-facing the year is labeled "Ca." (circa) — e.g. "Ca. 1930" on cards,
  detail spec, cart, checkout, and invoice — while the admin label stays "Date".
  Verified `npx tsc --noEmit`, targeted lint, and a local `/shop` browser smoke.
- **Added Product Date support.**
  Product Admin now has a Date field for the item creation date, with
  `products.item_date` and `order_items.item_date_snapshot` SQL support. Date
  displays on product cards, product detail specs, cart/checkout summaries, and
  admin/order surfaces when present. Reads/writes fall back safely before the
  live migration is applied. Verified typecheck, lint, build, and local browser
  smoke on `/shop`.
- **Added customer-facing loaded-block reveals.**
  Shared reveal behavior now fades customer-facing page blocks in only after
  each block's images/background images/fonts are ready, skips admin routes,
  avoids large shop gallery parents, and respects reduced-motion/print. The
  homepage carousel hero is exempt from the shared coordinator and now uses its
  own top-down loaded fade: headline first, carousel second,
  subscriber/actions last, while its 3D scene and centered hero content stay
  unchanged. Verified lint, build, and browser smoke on `/` and `/shop` with no
  pending reveal blocks, broken images, or console errors.
- **Added staged shop gallery card reveal.**
  `/shop` now renders product cards through a client grid coordinator so cover
  images load first, then cards fade in row-by-row with responsive column-aware
  stagger timing. Verified typecheck, lint, build, and browser smoke with no
  broken images or console errors.
- **Tightened Storage GC fail-closed behavior.**
  The admin Storage GC route now aborts before object listing/deletion if any
  required reference read fails, and a service-role grant migration was added
  for products, order items, and inquiries.
- **Raised upload cap and converted oversized local images.**
  Admin image upload/crop longest-edge caps now use 2048px. Oversized local PNGs
  were converted to WebP; page references were switched and page PNG originals
  removed. The DB-backed shop image conversion was completed in the follow-up
  bullets below.
- **Prepared DB-backed shop image WebP migration.**
  Converted the remaining DB-referenced shop PNGs that lacked WebP siblings and
  added an explicit SQL migration to repoint product image arrays from shop PNG
  paths to confirmed WebP paths.
- **Deleted repointed shop PNG originals.**
  After the WebP data migration was applied and verified, removed the 114
  original local shop PNGs that had WebP replacements.
- **Ran confirmed Storage GC cleanup.**
  After service-role table grants were applied, the dry-run reported 293
  objects, 202 referenced paths, and 91 old unreferenced/deletable objects. The
  91 paths were archived locally, deleted with `confirm: true`, and the
  follow-up dry-run reported 202 objects, 202 referenced paths, 0 orphans, and 0
  deletable paths.
- **Reconciled repo-ready folder state.**
  Removed the generated Storage GC archive and temporary shop PNG delete-list
  JSON, tightened root ignore rules for build output/caches/logs/env files, and
  updated agent/doc memory rules for the source-of-truth folder workflow.
- **Fixed legacy image snapshots after PNG deletion.**
  Added a narrow local image URL normalizer so persisted cart/wishlist,
  checkout, account-order, order-detail, and invoice-email snapshots that still
  reference deleted `/assets/images/shop/*.png` files render the corresponding
  WebP replacements.
- **Applied order item snapshot WebP migration.**
  Added and applied `supabase/order-item-image-snapshots-png-to-webp.sql` so
  historical `order_items.image_snapshot` rows are repointed from local shop PNG
  paths to WebP at the database source. Verification returned 0 remaining
  `/assets/images/shop/*.png` snapshot rows; runtime normalization remains for
  browser-local snapshots.
- **Swept rendered mojibake artifacts.**
  Replaced accidental artifact characters in auth labels/placeholders,
  about-page copy, and the admin Quick Fill multiplier parser. Verified the app
  source scan is clean for `â`/`Ã`/`Â`/replacement characters and smoke-tested
  `/account/sign-in`.
- **Implemented data/object-storage optimization pass.**
  Added safe product-image cleanup for admin remove/replace/delete flows, a
  dry-run-first admin Storage GC endpoint and Settings panel, upload
  cache-control and size/count guardrails, narrower Supabase selects, order
  lookup index SQL, responsive `next/image` size hints, and optimized oversized
  local PNG assets. Verified typecheck, lint, build, and `/shop` browser smoke.
- **Swept docs, agent files, and stale local artifacts.**
  Updated setup/readme/agent docs and current feature guidance for the active
  Next/Supabase app. Removed verified redundant root image references, local dev
  logs, the superseded email-marketing handoff, and the unused `AdminShell`
  Quick Fill archive copy while keeping historical docs as history.
- **Fixed header hydration mismatch on `/shop`.**
  Normalized `en` and `es` locale prefixes in `SiteHeader` before calculating
  active nav state and alternate locale URLs, so the server and browser agree on
  the Shop active link and `/es/shop` href. Verified in-browser, `npm run lint`,
  and `npm run build`.
- **Refreshed supporting docs for the current app.**
  Rewrote stale feature runbooks for the shop, listing workflow, lead capture,
  and Spanish localization so they describe the active Next.js/Supabase app
  instead of the retired static site. Updated structure, integrity,
  architecture, overview, status, tasks, and client notes around the current
  route model, Supabase products, Supabase Storage image boundary, and cleanup
  follow-ups.
- **Started product image/object-storage audit.**
  Opened the local `/shop` preview and audited live product image references.
  The database stores URL/path strings only, with no inline `data:` image
  payloads found. Current catalog split is 28 Storage-only products, 19
  local-asset-only products, and 1 mixed product; all 202 DB-referenced Storage
  objects exist. The 91 old unreferenced objects found by that audit were later
  removed through the confirmed Storage GC flow.

## 2026-06-19

- **Enabled Cufflinks and custom product types.**
  Cufflinks now appears as a shared product type and public shop Item Type
  option under Jewelry & Watches. The admin Product Type field now accepts new
  item forms via combobox, AI fill can return concise custom product types, and
  `/shop` can surface saved custom product types as filter options.
- **Broadened shop hero copy to precious metals.**
  The English `/shop` hero now refers to precious metals, metals spot market
  pricing, exact scrap value, and gold-or-silver trade-in offers instead of
  gold-only language.
- **Refined shop category toggle labels.**
  The modern shop sidebar now labels the two category buttons as "Jewelry &
  Watches" and "Sterling Silver." Silverware / Sterling is hidden from
  the Item Type dropdown while Jewelry & Watches is active, and Bullion is no
  longer listed in the public Item Type menu. Selecting Sterling Silver also
  sets the Metal filter to Silver while hiding the Metal and Gender dropdowns,
  and its Brand and Item Type dropdowns are scoped to sterling-side products.
- **Removed the Store chooser and silver-tableware route.**
  Homepage shop CTAs, the header Shop link, and the Shop dropdown's Store item
  now point directly to `/shop` again. The localized `/store` and
  `/silver-tableware` route files were removed, and the sitemap no longer lists
  either route.
- **Opened sterling tableware to full catalog browsing.**
  `/silver-tableware` now defaults to Silverware / Sterling + Silver on plain
  visits, keeps Silverware / Sterling first in the Item Type menu, followed by
  Bullion, Coins, Watches, Brooches, the remaining jewelry types, and All items
  last, so shoppers can explicitly switch to the full catalog or another
  category from the same route.
- **Refined sterling tableware hero messaging.**
  `/silver-tableware` now uses "Sterling Tableware & More" with proof cards
  focused on heirloom beauty, reasonable prices, and transparent buying.
- **Removed sterling tableware from the Shop submenu.**
  The Shop dropdown/mobile submenu now sends shoppers to Store first; the
  Store tile remains the path into `/silver-tableware`.
- **Tinted live metal spot badges.**
  The shared shop filter spot-price pills now style Silver / oz with a
  cool silver tint and Gold / oz with a warm gold tint across desktop and
  mobile.
- **Added dedicated sterling tableware shop page.**
  `/silver-tableware` now reuses the modern shop layout for the tableware
  category path. The `/store` Sterling Silver Tablewares tile is active, the
  Shop dropdown and sitemap include the route, and the page has
  tableware-specific hero copy.
- **Removed unused product types.**
  Estate Lot, Loose Gemstone, and Loose Diamond were removed from product type
  options, shop filters, URL aliases, and AI/admin prompt guidance because they
  will not be sold through the store.
- **Added header nav underline animation.**
  Desktop header nav links now draw a fine gold underline from left to right on
  hover/focus, and active pages keep the underline visible, including grouped
  dropdown sections.
- **Anchored the shared header to viewport edges.**
  Removed the centered 1440px rail from `SiteHeader` so the brand/navigation
  group and right-side actions use the full viewport width on wide desktops,
  while preserving the mobile header layout.
- **Added email campaign sender profiles.**
  `/admin/marketing` now defaults to a Chris reply-enabled sender
  (`Chris at Naples Estate Jewelry <chris@naplesestatejewelry.co>`,
  `Reply-To: chris@naplesestatejewelry.co`) while keeping a no-reply option.
  Send Test and Send Campaign honor the selection, and campaign history records
  the selected sender when the updated SQL is applied.
- **Fixed admin manual subscriber source labels.**
  Manually-added subscribers now display as "Admin manual" on
  `/admin/subscribers` by carrying the original `homepage_subscribers.source`
  through the marketing audience model.
- **Added manual subscriber entry.**
  `/admin/subscribers` now has an Add Subscriber form for manually adding a
  name/email newsletter recipient, backed by an admin-only POST route and
  `homepage_subscribers` rows marked `source = 'admin_manual'`.
- **Added campaign-history delete controls and widened marketing admin.**
  `/admin/marketing` now has an Actions column with confirmed per-campaign
  delete controls backed by an admin-only API route, and the page uses a wider
  desktop container so campaign history fits better on large screens.
- **Cleaned up remaining lint warnings.**
  Fixed the Material Symbols font-display warning, documented the necessary
  icon-font stylesheet exception, and replaced the remaining raw admin
  preview/crop modal images with `next/image`. `npm run lint` is now clean.
- **Added email campaign preview window.**
  The `/admin/marketing` composer now has a Preview Email action that opens a
  compact iframe-backed preview dialog rendering the campaign HTML with the
  same unsubscribe and mailing-address footer used by real marketing sends.
- **Added campaign history analytics.**
  `/admin/marketing` now shows delivered, opens, clicks, bounces, complaints,
  latest event time, and basic rates/counts for each campaign by aggregating
  Resend webhook events recorded in `email_campaign_events`.
- **Implemented email marketing opt-out system.**
  Added `marketing_opt_out` account handling, centralized marketing audience
  builder, Admin Email Campaigns page, editable Admin Settings mailing address,
  campaign send/test APIs, subscriber/account unsubscribe suppression, Resend
  webhook event recording, and `supabase/email-marketing.sql`.
- **Fixed Admin Subscribers live-schema mismatch.**
  Made the marketing audience builder tolerate older `homepage_subscribers`
  tables lacking `subscribed`/`unsubscribed_at`, passed the signed-in admin
  Supabase client into the audience builder for admin reads, and updated
  `supabase/email-marketing.sql` with compatibility columns and grants.
- **Added admin marketing audience count previews.**
  The campaign composer now shows combined, newsletter-only, and account-only
  recipient counts as selectable preview chips and includes counts in the
  Audience dropdown labels.
- **Added Admin Subscribers management controls.**
  `/admin/subscribers` now has Copy All Emails plus edit/delete actions for
  newsletter subscriber rows, backed by admin-gated subscriber API updates.
- **Fixed Admin Marketing button feedback.**
  Send Test and Send Campaign now show visible validation feedback for missing
  subject/body/address/recipient requirements instead of appearing to do
  nothing while disabled.
- **Relaxed Admin Marketing subject/body validation.**
  Campaign test/send validation now requires non-empty subject and body rather
  than hidden length minimums, matching the visible admin workflow.
- **Fixed carousel lint blocker.**
  Moved latest-value ref updates out of render and removed the synchronous
  reset-effect state update from `next-app/carousel/components/Carousel.tsx`.
  `npm run lint` now passes with warnings only.
- **Added campaign-send success confirmation.**
  Successful real campaign sends now show a prominent confirmation panel with
  delivery counts and campaign ID on `/admin/marketing`.
- **Completed a public square-layout audit.**
  Rounded remaining public-facing sharp legacy surfaces across About, Free
  Evaluation, Estate Services, FAQ, Store, Shop, product detail placeholders,
  wishlist placeholders, account/auth controls, header menus, shop filters, and
  pagination. Source scan is clean for public `rounded-sm`, old gradient CTA,
  emoji photo/check placeholders, and 6px/8px scoped radii; browser-computed
  checks confirmed `/shop` and `/account/sign-up` no longer expose the square
  surfaces previously flagged.
- **Modernized contact and Sell-category surfaces.**
  Applied the rounded, lighter shop-page style to the contact submission,
  product inquiry, and free-evaluation forms plus `/estate-jewelry`,
  `/gold-services`, `/silver-services`, and `/bullion`. Updated square cards,
  upload boxes, chart panels, CTA blocks, and emoji/glyph icons to rounded
  cards, pill actions, SVG/material icons, and softer borders/shadows. Verified
  mobile/desktop target pages with no horizontal overflow and `npm run build`.
- **Fixed About page Google review CTA artifacts.**
  Replaced the broken mojibake star/external-link characters with clean text and
  an ASCII arrow. Verified `/about` no longer renders the artifact strings and
  `npm run build` passes.
- **Modernized legal and cookie UI surfaces.**
  Replaced the sharp square policy/cookie look with rounded, lighter cards and
  pill actions: global buttons/forms now use softer radii, policy pages render
  rounded white cards with numbered chips and custom bullet dots, and cookie
  preference/notice panels use rounded translucent cards with softer shadows.
  Verified `/cookie-preferences` with 16px card radii, a pill Back to Home
  action, no horizontal overflow, and `npm run build`.
- **Removed the About page process/showroom section.**
  Deleted the full "How It Works" block from `/about`, including the three
  process steps and imagined no-storefront showroom image/copy. The page now
  goes from Meet Chris directly to the final contact CTA. Verified `/about`
  returns 200, the removed text is absent from rendered HTML, and `npm run
  build` passes.
- **Redesigned the homepage service strip icons.**
  Replaced the emoji icons for We Buy Gold / We Sell Jewelry / Direct Contact
  with a custom client-rendered HTML canvas icon component and refined the strip
  spacing/dividers for a more modern editorial look. Verified desktop and 390px
  mobile with three rendered canvases, no emoji text in the section, and no
  horizontal overflow; `npm run build` passes.
- **Shortened and slightly zoomed out the Store mobile hero image.**
  Reduced the `/store` hero image's mobile-only fixed height from `36rem` to
  `30rem`, making the image feel less tall and shortening the page while
  preserving tablet/desktop sizing. Verified at 390px with no horizontal
  overflow and `npm run build`.
- **Centered the Store mobile footer legal columns.**
  Centered each link inside the mobile Legal two-column footer while preserving
  desktop left alignment. Verified `/store` at 390px with no horizontal
  overflow and unchanged compact footer height.
- **Shortened the Store mobile footer again.**
  Made the remaining mobile footer links more compact after Shop removal:
  Company is now a three-link row, Legal is a smaller two-column list, and the
  footer padding/bottom bar are tighter. Verified `/store` at 390px with no
  horizontal overflow and about 357px footer height; `npm run build` passes.
- **Reorganized the Store mobile footer lists.**
  After hiding the mobile Shop group, changed the remaining footer links so
  Company reads as a centered vertical list and Legal reads as a clearer
  two-column list. Verified `/store` at 390px with no horizontal overflow and
  `npm run build`; lint remains blocked by existing carousel ref/purity errors.
- **Compacted the Store mobile footer.**
  Tightened the shared `SiteFooter` mobile presentation on `/store` with
  smaller mobile padding/type/gaps, denser Shop and Company mini-grids, a
  compact four-column Legal grid, and a shorter copyright strip. Verified at
  390px in-browser with no horizontal overflow and `npm run build`; lint
  remains blocked by existing carousel ref/purity errors.
- **Redesigned the Store Browse Jewelry CTA.**
  Replaced the dated gold rectangle inside the `/store` Estate Jewelry tile
  with a lighter rounded editorial CTA using a white/glass surface, fine gold
  border, uppercase label, and small gold circular arrow. Verified mobile and
  desktop fit in-browser and `npm run build`; lint remains blocked by existing
  carousel ref/purity errors.
- **Removed the sign-in background image on mobile.**
  `/account/sign-in` now keeps the jewelry background image for desktop but
  switches to a plain white background on mobile. Verified computed mobile
  background at 390px and `npm run build`; lint remains blocked by existing
  carousel ref/purity errors.
- **Top-aligned mobile auth forms.**
  `/account/sign-up` and `/account/sign-in` now align their auth cards near the
  top of mobile viewports below the fixed header, with tighter mobile padding
  and desktop centering preserved. Verified both pages at 390px in-browser and
  `npm run build`; lint remains blocked by existing carousel ref/purity errors.
- **Added Show/Hide controls to account registration passwords.**
  Password and Confirm Password now each have independent text toggles with
  `aria-label`/`aria-pressed`, preserve typed values while toggling, and fit
  cleanly at a 390px mobile viewport. Password matching, min length, and
  Terms/Privacy consent behavior are unchanged. Verified in-browser and
  `npm run build`; lint remains blocked by existing carousel ref/purity errors.
- **Added password confirmation to account registration.**
  `/account/sign-up` now asks for Password and Confirm Password, validates that
  they match before calling Supabase, and shows `Passwords do not match.` when
  they differ. Verified in-browser and `npm run build`; lint remains blocked by
  existing carousel ref/purity errors.
- **Implemented a website compliance foundation.**
  Added expanded Privacy Policy, Terms of Service, Cookie Preferences,
  Accessibility Statement, Returns & Refunds, Shipping Policy, Auction Terms,
  Vendor Terms, and Unsubscribe routes. Updated the shared footer legal links,
  sitemap, checkout/payment policy links, Auctions page policy link, and added
  an essential cookie/storage notice.
- **Added consent and disclosure plumbing.**
  Account sign-up now uses one required Terms/Privacy acceptance checkbox,
  stores acceptance metadata in Supabase Auth, and has supporting profile
  columns in `supabase/compliance-consent.sql` and `supabase/schema.sql`.
  Contact, item submission, free evaluation, checkout, and homepage subscriber
  forms now show a privacy disclosure with a Privacy Policy link.
- **Revised account registration compliance to the ecommerce pattern.**
  Removed the separate age-confirmation checkbox and age-confirmation database
  fields. Age eligibility now lives in the Terms of Service, while signup stores
  Terms/Privacy acceptance timestamps and accepted policy version.
- **Added marketing unsubscribe support.**
  Added `/unsubscribe`, `/api/unsubscribe`, `UnsubscribeForm`, and updated
  `supabase/homepage-subscribers.sql` with `subscribed`, `unsubscribed_at`, and
  `unsubscribe_homepage`.
- **Documented the audit.**
  Added `project-docs/COMPLIANCE_AUDIT.md` with what exists, what was missing,
  risk levels, and remaining legal/manual review items. Verified `npm run
  build`; `npm run lint` remains blocked by existing carousel ref/purity errors.

## 2026-06-18

- **Reformatted the shared footer on mobile.**
  Updated only `SiteFooter` so all pages get a cleaner mobile footer: centered
  full-width brand/contact block, Shop and Company in two compact columns,
  tappable phone button, and a centered bottom legal/domain bar that wraps
  inside the viewport. Desktop remains a three-column footer. Verified `/store`
  at 390px in-browser with no horizontal overflow, plus `npm run build`.
- **Simplified the Store chooser to two hero buttons.**
  `/store` no longer has separate hero text or a below-image category/card
  section. The page now uses only two large square category controls floating
  over the main store hero image, spaced left and right. Estate Jewelry links
  to `/shop`; Sterling Silver remains disabled/coming soon. Mobile uses a
  taller cropped hero image and locked square button dimensions. Verified
  desktop and 390px mobile in-browser, plus `npm run build`. `npm run lint`
  remains blocked by existing carousel ref/purity errors.
- **Rebuilt the carousel as the home-page hero and overhauled it end to end.**
  Moved the 3D carousel from `/store` to the home hero (replacing the MP4 ring
  video); `/store` is now a static category chooser. The carousel is now
  **windowed/infinite** — only an admin-set number of cards (default 6 desktop /
  4 mobile, separate fields, 3–12) live on a tight intimate radius while the full
  list cycles through as cards pass the hidden back. Backgrounds are **per-photo**:
  each piece is assigned a White or Black group, the ring auto-orders into a white
  arc + a black arc, and the hero background **sweeps** (a per-frame horizontal
  gradient, painted imperatively) so the incoming color leads the incoming photo
  while the outgoing fades off the far side; the headline text flips light/dark to
  match the centered photo. Photos route through `next/image` (AVIF/WebP, right-
  sized, `quality 90`) with an off-screen preloader for cycled-in cards, and an
  `IntersectionObserver` pauses the spin + rAF loop when the hero scrolls offscreen.
  The home overlay was split (headline centered up top; sign-up form + Buy/Sell/
  Trade centered in the open space below the pieces) and the sign-up inputs given
  a solid light fill so they read over both white and black phases. Admin gained
  per-photo White/Black swatches, desktop/mobile visible-count fields, a sweeping
  live preview, compacted product/order rows, and a wider (`max-w-[1800px]`) panel.
  New columns: `carousel_selection.bg_color`, `carousel_settings.visible_count`,
  `carousel_settings.visible_count_mobile` (migrations under
  `next-app/carousel/sql/`; reads/writes degrade gracefully until run). Verified
  in-browser (admin controls, windowing cap, swept-gradient generation, offscreen
  pause, optimized image requests) with no console errors. See
  `project-docs/features/carousel-hero.md`. **Live persistence requires running the
  carousel SQL migrations in Supabase.**
- **Made the live AI listing-assistant prompt editable from Admin Settings.**
  The Settings panel's prompt editor was a leftover tied to the disabled Quick
  Fill workflow and did not affect the real assistant. It now reads/writes the
  actual extraction system prompt via a new admin-gated API
  (`GET`/`PUT /api/admin/ai-settings`) backed by a single-row `ai_settings`
  table. `PRODUCT_EXTRACTION_SYSTEM_PROMPT` in `ai-product-provider.ts` is now
  the exported default; the provider accepts an optional `systemPrompt`
  override, the fill route loads the override per request, and a missing table
  or failed read falls back to the default so generation never breaks. The
  panel gained a Custom/Default badge plus an Edit → Save / Reset Default flow
  (the prompt stays read-only until Edit). Verified `GET` returns the real
  default prompt, the panel renders it, graceful `PUT` failure messaging,
  `npx tsc --noEmit`, and `eslint`. Live saves require running
  `next-app/sql/ai-settings-setup.sql` in Supabase.
- **Store/Shop header links now route through the `/store` landing page.**
  The site header's top-level Shop link and the Store dropdown item previously
  jumped straight to `/shop`, skipping the `/store` category chooser that the
  homepage hero already used. Both now point to `/store`. Verified in-browser.
- **Added Store Carousel Hero admin controls.**
  Admin Settings now has a Store Carousel Hero section below the Quick Fill
  prompt with product search, add/remove selection, up/down ordering,
  black/white background options, show-price toggle, save, and live preview.
  `/store` now reads saved carousel selection/settings on the client, falls
  back to the previous hardcoded hero items if the carousel tables are missing
  or empty, and adapts heading/fade colors for black backgrounds. Updated the
  supplied carousel route mapping to `/shop/{id}` and its Supabase helper to
  use the app browser client/session. Verified Admin Settings rendering and
  selection state, `/store` fallback rendering, `npm run lint`, and
  `npm run build`. Live persistence still requires running
  `next-app/carousel/sql/setup.sql` in Supabase.
- **Added Link Type to the wide Product Admin table.**
  The main Product Admin table now shows a sortable `Link Type` column on
  extra-wide desktop layouts and hides it below `2xl` so standard-width admin
  views keep their existing table density. Verified `/admin` at wide and
  standard desktop widths, `npm run lint`, and `npm run build`.
- **Scoped the loading screen to the homepage route.**
  Moved the localized homepage page and loading fallback into
  `next-app/src/app/[locale]/(home)/` so the branded loading screen no longer
  appears during normal internal navigation to pages like `/store`. Verified
  `/store` and `/` in-browser, `npm run lint`, and `npm run build`.
- **Added the Carousel widget to the Store hero.**
  `/store` now uses the supplied `next-app/carousel` Carousel widget as the
  main first-viewport hero. The animation/rendering engine remains intact; the
  store page passes local shop/page image variables directly as `CarouselItem`s,
  keeps prices off, and sizes the hero to fill the detected screen below the
  header. The chooser cards remain below the hero. Added narrow TypeScript casts
  in the carousel data helper so the supplied Supabase join helpers type-check
  when imported. Desktop presentation zooms the carousel larger and lets cards
  travel beyond the viewport edge, while mobile now uses proportional card and
  perspective settings for a similar close-up experience. The carousel no
  longer pauses on hover, and both desktop/mobile use a light edge fade so cards
  disappear slightly as they reach the viewport edge. The hero heading group is
  positioned higher so the category prompt sits in the open space above the
  carousel. Added foggy white edge overlays on the far left and right to echo
  the original widget fade treatment. Verified `/store` desktop and 390px
  mobile layout, 8 hero images, continuous 32s animation, no horizontal
  overflow, `npm run lint`, and `npm run build`.
- **Added a Store chooser page.**
  Added localized `/store` as an intermediate page for homepage shopping CTAs.
  It shows an active Estate Jewelry Shop choice and a disabled Sterling Silver
  Tablewares placeholder for a future category. Homepage Buy/Browse Shop links
  now route to `/store`; existing shopping/cart/account flows still point
  directly to `/shop`. Added `/store` to the sitemap. Verified `/store`,
  homepage CTA hrefs, 390px mobile layout, `npm run lint`, and
  `npm run build`.
- **Refined the branded loading fallback.**
  Localized routes now show a dark, centered `NaplesEstateJewelry.co` loading
  screen with classy supporting text and an animated gold wheel, without the
  older logo image or off-white background. The brand text now has a clean
  mobile break point plus responsive title/spinner sizing so it stays inside
  narrow phone viewports. The temporary local `/loading-preview` review route
  has been removed now that the screen is approved. Verified in-browser at
  320px and 390px, `npm run lint`, and `npm run build`.
- **Cleaned customer order item metadata.**
  Account order detail item rows no longer expose slug-like product ids in the
  subtext. They now show inventory as its own `Inv #...` chip, format gold
  purity values as `14K`/`18K`, and enrich older slug snapshots from live
  product inventory numbers when possible. Verified `/account?tab=orders`
  in-browser, `npm run lint`, and `npm run build`.
- **Reduced mobile shop card top controls.**
  Product-card Available flags and favorites icons now use smaller mobile-only
  sizing, with the badge around 12px tall and the heart button around 22px
  square at 390px. Verified `/shop` at 390px, `npm run lint`, and
  `npm run build`.
- **Shortened mobile shop card Add buttons.**
  On thin mobile screens, product-card Add buttons now use less vertical
  padding, a smaller icon, and reduced action-row top spacing for a more
  compact three-across gallery. Verified `/shop` at 390px, `npm run lint`,
  and `npm run build`.
- **Added mobile photo reorder buttons in Product Admin.**
  Add/edit product thumbnails now include tap-friendly previous/next controls
  so mobile admins can reorder photos without dragging, while desktop drag
  reorder remains intact. Verified in-browser at 390px without saving,
  `npm run lint`, and `npm run build`.
- **Reduced mobile shop card carousel arrows.**
  Product-card image arrows now have a smaller mobile-only treatment, rendering
  at about 18px square with a smaller glyph and lighter shadow in the
  three-across gallery. Desktop arrow sizing is unchanged. Verified `/shop` at
  390px, `npm run lint`, and `npm run build`.
- **Added a shop price range filter.**
  The filter panel now has a two-handle price slider plus editable min/max
  fields. It filters by the same displayed price basis used for price sorting,
  writes `priceMin`/`priceMax` URL params, and resets pagination when changed.
  Verified `/shop?priceMin=1000&priceMax=2500`, mobile 390px,
  `npm run lint`, and `npm run build`.
- **Reduced mobile shop card item flags.**
  Brand and link-type flags now use a smaller mobile-only treatment with
  tighter padding, shorter height, smaller type, and lighter shadows so they
  fit the three-across gallery cards. Longer individual flags now step down
  again so labels such as `Anchor / Gucci link` fit fully without clipping.
  Verified `/shop?itemType=necklace` at 390px, `npm run lint`, and
  `npm run build`.
- **Linked customer order items back to product pages.**
  Account order detail items now open the matching public product detail page
  when a product id is available, and product pages opened from account order
  history show a top-left `Back to Orders` return link. Verified
  `/account?tab=orders` in-browser, `npm run lint`, and `npm run build`.
- **Compacted Link Type gallery flags.**
  Link-type fallback flags now use a shorter, more compact badge in the
  lower-left image corner, while Brand flags keep their taller gold-tinted
  treatment. Verified `/shop?itemType=necklace` at desktop and mobile widths,
  `npm run lint`, and `npm run build`.
- **Separated Brand and Link Type flag styling.**
  Brand flags keep the newer gold-tinted badge, while link-type fallback flags
  use the quieter plain badge so shoppers can tell makers apart from chain/link
  styles. Verified `/shop?itemType=necklace` in-browser, `npm run lint`, and
  `npm run build`.
- **Moved Link Type next to Item Type in shop filters.**
  When shoppers choose Necklace or Bracelet, the conditional Link Type dropdown
  now appears directly after Item Type instead of lower in the filter panel.
  Verified `/shop?itemType=necklace` in-browser, `npm run lint`, and
  `npm run build`.
- **Added link-type fallback for shop card flags.**
  Product-card image flags still show Brand first, but unbranded necklaces and
  bracelets now show their link type in that same flag position. Verified
  `/shop?itemType=necklace` and `/shop?itemType=bracelet` in-browser,
  `npm run lint`, and `npm run build`.
- **Reduced mobile shop card status tags.**
  Available/Sold badges now use a smaller mobile-only style so they occupy less
  image space in the three-across gallery. Desktop badge sizing is unchanged.
  Verified `/shop` at 390px, `npm run lint`, and `npm run build`.
- **Refined shop gallery brand tag styling.**
  Brand tags now use a warmer gold-tinted gradient, stronger border, bolder
  lettering, and subtle shadow/highlight so they are more noticeable without
  overpowering product photos. Verified `/shop` in-browser, `npm run lint`, and
  `npm run build`.
- **Compacted mobile shop card spec chips.**
  Product-card purity, weight, and length/size chips now shorten dynamically so
  three-across mobile cards do not overflow. Examples include `119.41g` becoming
  `119.4g`, `925 sterling` becoming `925`, and ring sizes dropping the `Size:`
  prefix. Verified `/shop` at 390px with no spec-chip overflow, plus
  `npm run lint` and `npm run build`.
- **Changed mobile shop gallery to three across.**
  Mobile `/shop` cards now render three per row with tighter gaps, making the
  listing grid denser while keeping compact Add/Remove controls readable.
  Verified at 360px, 390px, and 430px viewports, including a 390px screenshot
  check, plus `npm run lint` and `npm run build`.
- **Expanded the shop gallery on widescreen desktop.**
  The shop grid now follows wider browser windows more closely: 4 columns near
  1440px, 5 near 1800px, 6 near 2048px, and 7 on 2400px+ viewports. The shop
  shell now expands to 2400px and card image size hints were updated. Verified
  `/shop` with browser viewport measurements, `npm run lint`, and
  `npm run build`.
- **Added brand tags to shop gallery images.**
  Branded product cards now show a small lower-left Brand tag on the first
  preview image only. The tag hides after image progression and fades when the
  desktop title tooltip or image-arrow focus/hover is active. Verified `/shop`
  in-browser, `npm run lint`, and `npm run build`.
- **Added per-line discounts for manual orders and existing order edits.**
  Create Manual Order now supports a Line Discount on each selected product,
  order detail pages can edit line discounts and recalculate totals, and the
  Email Invoice preview/send path uses matching adjusted item totals with
  original price and discount shown. Added
  `supabase/order-item-line-discounts.sql`. Verified in-browser without
  saving/sending, `npm run lint`, and `npm run build`.
- **Added thumbnails to invoice emails.**
  Email Invoice previews and sent customer emails now include small product
  thumbnails beside each item when order image snapshots are available.
  Relative image paths are expanded to absolute site URLs for email delivery.
  Verified in-browser preview, `npm run lint`, and `npm run build`.
- **Added Reopen Order for cancelled orders.**
  Cancelled order detail pages now show `Reopen Order` in place of `Cancel
  Order`. The action restores order/fulfillment status to open/pending and
  returns unpaid linked products to pending payment. Verified button visibility
  in-browser, `npm run lint`, and `npm run build`; not clicked to avoid
  changing the live order.
- **Fixed admin order item product links.**
  Order detail item `Open` links now go to the matching public product detail
  page and include a safe admin return path. Product pages opened from an order
  show a top-left `Back to Admin` link that returns directly to that order.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Added order Email Invoice send flow.**
  Order detail pages now include an Email Invoice button beside the status
  controls. It opens a modal with a close X, editable prefilled customer email,
  subject preview, formatted itemized/totals preview, and a Send Invoice Email
  action backed by a protected admin Resend route. Preview and sent email
  content share the same builder. Verified in-browser without sending a real
  email, `npm run lint`, and `npm run build`.
- **Labeled manual-order shipping fields.**
  The Create Manual Order modal now shows visible labels for Delivery Method,
  Shipping Fee, Discount, and all address inputs so the zero-value fields are
  clear on desktop and mobile. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Changed manual-order product selection to search.**
  The Create Manual Order modal now searches available products by inventory
  number, SKU/id, or title and shows matches in a dropdown. Selected products
  appear in a compact removable list, replacing the full product checklist on
  desktop and mobile. The search field also has a right-side arrow that opens
  the full available-products dropdown when needed. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Reformatted admin Orders for mobile.**
  `/admin/orders` now uses stacked order cards on mobile instead of a clipped
  horizontal table, with grouped filters, clearer order/customer/status blocks,
  and a full-width View Order action. The manual-order modal product picker now
  keeps prices visible under long product titles on phones. Verified in-browser
  mobile view, `npm run lint`, and `npm run build`.

## 2026-06-17

- **Added a Close button to the Image Padding modal.**
  The Product Admin per-photo padding modal now ends with a clear gold `Close`
  action for finishing the workflow. Verified `npm run lint` and
  `npm run build`.
- **Fixed selected-photo eyedropper in Product Admin.**
  `Pick From Selected Photo` now uses the current selected photo index outside
  React's render timing and opens the eyedropper immediately from the click, so
  non-first photos save their sampled padding color correctly. Verified
  `npm run lint` and `npm run build`.
- **Centered product detail gallery arrow icons.**
  The circular product image navigation controls now separate the button circle
  from the Material Symbols chevron so the glyph aligns cleanly in the center.
  Verified `npm run lint` and `npm run build`.
- **Added per-photo Product Admin image padding.**
  The Product Admin Pad modal now lets admins select any photo on a listing and
  apply padding to that image specifically. Public image surfaces resolve
  padding per image and fall back to the old product-level `image_padding`.
  Added the `products.image_padding_by_image` JSON column to the Supabase
  image-padding SQL. Verified `npm run lint` and `npm run build`; in-browser
  admin modal interaction was blocked by sign-in.
- **Prevented product gallery zoom from covering edge arrows.**
  Product detail image edge-arrow zones now close and suppress the magnifier
  while hovered or pressed, keeping the navigation arrows accessible. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Carried product image padding into cart and saved thumbnails.**
  Cart and wishlist payloads now include `image_padding`, older saved entries
  hydrate missing padding from Supabase, and cart drawer, checkout summary,
  saved-items drawer, and account wishlist thumbnails use the same padded frame
  background as shop/detail images. Verified cart and checkout in-browser,
  `npm run lint`, and `npm run build`.
- **Added product detail gallery carousel controls.**
  Product detail main images now advance from left/right edge clicks, the
  thumbnail rail is centered with arrow controls, and the active photo stays in
  the center thumbnail slot as the lineup wraps. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Added Gold Services Dental Gold image.**
  The `Dental Gold` acquisition card now uses the new `dental.webp` asset from
  `next-app/public/assets/images/pages/dental.webp`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Added Gold Services Scrap & Broken image.**
  The `Scrap & Broken` acquisition card now uses the new `scrap.jpg` asset from
  `next-app/public/assets/images/pages/scrap.jpg`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Swapped Gold Services Fine Jewelry image.**
  The `Fine Jewelry` acquisition card now uses the new `gold.png` asset from
  `next-app/public/assets/images/pages/gold.png`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Moved Gold Services item-acquisition section.**
  `Items We Acquire` now appears directly below the Current Gold Spot Price
  block and before Decoding Gold Markings. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Added the login hero background image.**
  The account sign-in page now uses `login.png` as a full-page
  jewelry/silverware hero background with a soft white overlay behind the auth
  card. Verified in-browser, `npm run lint`, and `npm run build`.
- **Brightened gold button fills site-wide.**
  Shared `.gold-button` CTAs, outline hover fills, shop pagination active state,
  account tab active states, and hardcoded service-page CTAs now use the
  brighter Call Now gold gradient instead of the older dark-gold fill. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Modernized shop pagination controls.**
  The bottom shop pagination/per-page area now uses a white toolbar, compact
  page buttons, icon chevrons, active-page emphasis, result count, and a cleaner
  per-page selector. Verified in-browser, `npm run lint`, and `npm run build`.
- **Added Sign Out to the account overview heading.**
  The My Account overview heading block now includes a right-aligned Sign Out
  button on desktop and stacks it full-width on small screens. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Changed the shop page background to white.**
  The modern `/shop` page main background now uses plain white instead of the
  prior warm off-white gradient. The shop filter sidebar, its inputs/selects,
  and My Account page/form/auth surfaces now use true white as well, while keeping
  borders, shadows, hero imagery, and product card styling intact. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Modernized checkout and cart drawer.**
  Checkout now presents a full-width top Order Summary with complete product
  titles, prices, and brief descriptions before the contact form. Cart items can
  carry descriptions, checkout enriches older cart rows from Supabase, and the
  cart drawer was restyled as a wider modern white/gold side panel with
  card-like item rows, larger images, descriptions, and clearer totals/actions.
  The expanded checkout Order Summary later isolated each item price into its
  own right-side Price column, then centered the label/value inside a framed
  price block, and then tightened item rows with smaller thumbnails, one-line
  descriptions, and one-line product spec strips. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Limited Silver purity filter options.**
  Shop and Product Admin purity filters now show only silver-designated options
  such as `925 Sterling` when Metal is Silver, hiding all `K` karat options and
  clearing incompatible purity selections when Metal changes. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Constrained Silverware / Sterling metal choices.**
  When Silverware / Sterling is selected in shop or Product Admin filters, the
  Metal dropdown now offers only Silver. Product Admin still snaps Metal Type to
  Silver. Verified in-browser, `npm run lint`, and `npm run build`.
- **Expanded the Silverware label.**
  Shop and Product Admin item/product type dropdowns now display
  `Silverware / Sterling` while preserving the existing `silverware`/`Silverware`
  values and URL behavior. AI/admin prompt guidance was updated to match.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Made Silverware filters snap to Silver.**
  Selecting Silverware in the shop Item Type filter or admin Product Type filter
  now automatically sets Metal to Silver. Admin also sets Metal Type to Silver
  and clears incompatible gold-only Metal Color filters. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Collapsed Product Admin filters behind a button.**
  The main admin product table now hides the full filter system by default
  behind a Filters button next to Add Product. The toolbar keeps the result
  count visible and shows an active-filter count on the button. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Matched Product Admin filters to the shop hierarchy.**
  Reordered the main admin table filters to Gender, Product Type, Brand, Metal,
  Metal Type, Metal Color, Purity, then scoped Link Type and Length/Size, with
  admin-only Status, Location, and Featured after the catalog filters. Product
  Type now controls whether Link Type, Length, or Size appears. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Normalized Product Admin Size/Length values.**
  Admin Length/Size entries now strip inch-unit text from manual input, Quick
  Fill parsing, and AI listing drafts, so the product table and saved payload
  store bare numerics like `7.75` instead of `7.75 in`. Public product displays
  still append `in` for necklace/bracelet lengths. Verified in-browser,
  `npm run lint`, and `npm run build`.

## 2026-06-16

- **Restyled the Product Admin listing form and AI assistant.**
  Add/Edit Product now opens as a wider modern listing drawer with Photos first,
  Smart Listing Assistant second, Quick Fill as the manual fallback, and product
  fields below. The assistant includes a large tap-to-talk button, guided
  listing prompts, a no-photo context warning, and an animated mic/waveform
  recording badge. Verified in-browser, `npm run lint`, and `npm run build`.
- **Added provider-neutral AI product listing assistant foundation.**
  Product Admin Add/Edit now includes an AI Listing Assistant that accepts typed
  or browser-transcribed item descriptions, calls an admin-only structured draft
  route, previews fields, applies them into the form with undo/optional
  overwrite, and keeps Quick Fill intact. Provider/model details are isolated in
  `next-app/src/lib/ai-product-provider.ts`, selected by environment variables,
  and the first allowed product images are sent as visual context. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Fixed account order chevron icon.**
  The Orders tab row chevron now preserves the Material Symbols font instead of
  rendering as literal `chevron_right` text. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Added buyer order details dialog.**
  Orders in the buyer account Orders tab are now clickable and open a full
  details window with statuses, item snapshots, customer info, totals, and
  notes/addresses when present. The dialog closes from a top-left X. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Stabilized account tab layout.**
  Shared the account tab rail and support strip between `/account` and
  `/account/security`, aligned the security-page hero/menu sizing with the main
  dashboard, and verified the tab rail no longer shifts between Overview,
  Wishlist, and Admin and Security. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Reformatted account overview detail cards.**
  The main `/account` Account Overview personal-detail tiles now use a clearer
  icon column and label/value block with tighter titles, consistent spacing, and
  better wrapping for long details like addresses. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Completed the account security menu.**
  `/account/security` now shows the full account menu: Overview, Orders,
  Wishlist, and active Admin and Security. Orders and Wishlist links return to
  `/account` with URL-backed tab selection. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Added Account Admin and Security page.**
  Removed the Profile Information tab/page and added an `Admin and Security`
  account menu link after Wishlist. The new protected `/account/security` page
  contains the Supabase Auth password-change flow and keeps the same right-side
  Admin Panel, Account Details, and Shop Now card rail as the main buyer
  dashboard. Verified in-browser, `npm run lint`, and `npm run build`.
- **Moved Profile Information to its own page.**
  The account dashboard Profile Information tab now links to the protected
  `/account/profile` route. This intermediate page was later removed when the
  account menu was simplified around Admin and Security.
- **Added real account dashboard tab views.**
  The account tab rail now switches between Overview, Orders, and Wishlist
  panels, with Profile Information linking to its own page. Admin Panel was
  removed from the top tabs but remains as an admin-only shortcut card. Orders
  read live Supabase order rows, Wishlist uses the current saved-items context,
  and Account Details now has an expandable Supabase Auth password-change form.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Restyled the buyer account dashboard.**
  `/account` now follows the supplied desktop dashboard reference with a wide
  hero, tab-style account menu, main Account Overview panel, right-side account
  action cards, and a bottom support strip. The tabs were later revised to
  current/relevant areas only: Overview, Orders, Wishlist, and Admin and
  Security. Verified in-browser, `npm run lint`, and `npm run build`.
- **Added account profile preview/edit mode.**
  The Complete Profile card now defaults to a compact read-only summary, opens
  the full editable form through an Edit Profile button, and collapses back to
  preview mode after Save Profile succeeds. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Extended the account hero image fade.**
  The `/account` jewelry image now sits on a fixed page background layer,
  remains visible behind the upper account content while the page scrolls, and
  fades softly into the cream page background instead of ending on a hard edge.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Added clear-cart actions.**
  The cart drawer footer and header added-item cart popup now include
  `Clear Cart` / `Vaciar carrito` controls wired to the shared cart provider,
  letting shoppers empty the cart in one click. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Swapped the account hero image.**
  Copied root `jewelry.png` into public assets as `account-hero-jewelry.png`,
  updated `/account` to use it as the hero background, and removed the
  temporary root file. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Redesigned the buyer account page.**
  `/account` now matches the modern white/gold dashboard direction from
  `account.png`, with a chain-image hero, wide welcome section, rounded elevated
  cards, larger profile form styling, account details card, and bottom trust
  strip. The Admin Panel card is still shown only for admin profiles. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Enlarged Product Admin form image previews.**
  Add/Edit Product photo thumbnails now render as larger 112px previews with
  more spacing, larger cover/hover controls, and a taller upload drop zone so
  admins can inspect images more easily before saving. Verified
  `npm run lint` and `npm run build`.
- **Promoted the modern shop design to `/shop`.**
  The canonical English and Spanish shop routes now use the modern layout
  prototyped on `/shop-modern`, with the same live Supabase products, filters,
  pricing, pagination, cart, wishlist, and image-preview behavior. Gender-tab
  links stay on `/shop` and `/es/shop`; `/shop-modern` remains available as a
  preview/backup route. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Swapped the modern shop hero to the new chain image.**
  Copied root `chain.png` into public assets as `shop-modern-chain.png` and
  updated `/shop-modern` to use it as a larger full-cover hero background with
  white feathering. Verified in-browser, `npm run lint`, and `npm run build`.
- **Cleaned up the modern shop hero background.**
  Switched the `/shop-modern` hero panel from cream to white and feathered the
  cropped hero image across the full panel with a white gradient, removing the
  hard right-side image edge. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Aligned the modern shop sidebar.**
  Moved the desktop `/shop-modern` left filter block down slightly so its top
  lines up with the first product-card row rather than the gender tabs. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Refined the modern shop clone.**
  Tightened `/shop-modern` against the `modern.png` reference by cropping the
  hero jewelry image into a preview-only asset, using real icon badges for the
  hero proof points, and restyling the left filter menu with search first,
  stacked live spot cards, gender pill buttons, rounded selects, and a softer
  cream/gold shell. The production `/shop` layout remains unchanged. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Added a modern shop clone preview.**
  Created `/shop-modern` as a low-risk visual prototype that reuses the live
  Supabase shop data, pricing, filters, pagination, cart, wishlist, hover image
  previews, and gender tabs from `/shop`. The clone keeps the same product-card
  information while applying the cream/gold modern layout direction from
  `modern.png`, including a larger hero panel, softer filter shell, polished
  segmented tabs, and elevated rounded product cards. `/shop` remains classic.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Fixed Quick Fill success notice coloring.**
  Product Admin Quick Fill now shows successful applies in green, including
  repeat applies that overwrite existing fields. Partial applies still list
  rejected tokens, but successful updates no longer turn the whole notice red.
  Total failures remain red. Verified `npm run lint` and `npm run build`.
- **Added shop gender path tabs.**
  The public shop gallery now includes a modern segmented Men’s / All / Ladies’
  tab control above the product grid. The tabs use the existing URL-backed
  gender filter, preserve active sidebar search/filter values, reset pagination
  when changed, and leave the left filter sidebar in place. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Refined homepage hero CTAs.**
  Buy, Sell, and Trade now use a subtle translucent gold backing, stronger gold
  border, soft glow, and light blur so the actions are more visible over the
  hero video. Verified in-browser, `npm run lint`, and `npm run build`.
- **Simplified shop card spec chips.**
  Gallery cards now use a consistent three-column row for purity, grams, and
  length/size. Purity and grams are value-only, and length values normalize to
  inches like `28 in` or `7.75 in` without the `Length:` prefix. Gold purity
  chips now use a karat-based yellow brightness ramp. Product detail top stats
  and Specifications now use the same display helper, so admin-entered numeric
  lengths are shown to buyers with `in`. Verified in-browser, `npm run lint`,
  and `npm run build`.
- **Reordered shop filter hierarchy.**
  Public shop filters now start with Gender, Item Type, and Brand before Metal,
  Metal Color, Purity, and Sort, with Link Type and Length still scoped to
  compatible item types. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Added custom product image padding colors.**
  Product Admin's `Pad` modal now shows a first-photo preview and supports a
  custom `#rrggbb` padding color through the `Pick From First Photo` browser
  eyedropper where supported. Removed the manual swatch/hex input path, added a
  dropper icon to the picker button, and made the Black Padding choice render
  as a black filled button with white text. Updated the shared image-padding
  helper and `supabase/product-image-padding.sql` so custom colors work across
  shop cards, product detail galleries, and admin thumbnails.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Added product detail inventory references.**
  Product detail pages now show a small buyer-facing `Item #` as its own first
  metadata line above metal/status whenever an inventory number is saved, and
  include that value as structured product `sku`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Added length to product detail top stats.**
  Product detail pages now include available item length in the top
  stats row before the title, ordered as status, metal color, purity, then
  length. Verified in-browser, `npm run lint`, and `npm run build`.
- **Clarified product detail fine-metal weight.**
  Specifications now label the troy ounce amount as fine gold/silver so buyers
  can tell it matches the fine-metal gram value, not total item weight. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Differentiated product detail Add to Cart.**
  Detail-page Add to Cart now uses a deep green CTA style so the purchase action
  stands apart from gold pricing accents and secondary buttons. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Matched Product Admin thumbnails to shop padding.**
  Main Products table thumbnails now apply each listing's image padding
  background, matching black/white/no-padding shop gallery previews. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Marked applied Product Admin padding.**
  Products table `Pad` actions now turn green when a listing has white or black
  image padding applied, and stay neutral when padding is unset. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Tightened the Product Admin table layout.**
  Shortened Product table headers to Type and Size, narrowed the Title column
  for two-line wrapping, and reduced repeated table cell padding. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Optimized Product Admin table spacing.**
  The Products table now sizes to content instead of stretching across the full
  desktop container, applies tighter compact column hints, truncates long Brand
  values, and keeps Actions sticky so Delete remains visible. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Added a Product Admin title/brand divider.**
  A subtle vertical divider now separates the Title and Brand columns in the
  main Products table. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Centered the Product Admin Brand column.**
  The Brand header and all Brand cell contents now center within the existing
  fixed-width Brand column, with long values still truncated. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Refined Add/Edit Product clear controls.**
  Clear buttons now refocus fields after clearing, filled native selects hide
  their dropdown arrow while the X is visible, and comboboxes use one right-side
  control that switches from dropdown arrow to X and reopens options after
  clearing. Verified in-browser, `npm run lint`, and `npm run build`.
- **Adjusted Add/Edit Product dropdown clear flow.**
  Dropdown-style controls now show an arrow first even when prefilled; opening
  choices via the native picker where available arms the control as `x`, and
  the second click clears and focuses the field. Custom comboboxes show all
  options when opened from an existing value. Verified native dropdown behavior
  in-browser; `npm run lint` and `npm run build` pass.
- **Aligned the Add/Edit Product SKU toggle.**
  The `SKU / Slug` toggle now lines up with the Inventory # input instead of the
  helper text below it. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Normalized Product Admin inventory display.**
  The main Products table now shows inventory numbers as plain numeric values
  whether they are stored on the product or generated as a fallback, removing
  mixed `#` prefixes from the column. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Added product image padding preferences.**
  Added `image_padding` support for `none`, `white`, and `black` product image
  frame backgrounds. Shop cards and product detail galleries use the setting,
  and Product Admin rows now include a compact `Pad` action with a chooser.
  Added `supabase/product-image-padding.sql`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Colorized shop card spec chips.**
  Product card Purity, Grams, and Length/Size details now render as compact
  chips with distinct subtle color treatments for easier scanning. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Refined shop card price emphasis.**
  Product card `Your price` rows now use a subtle gold-tinted band, thin
  separators, a stronger label, and a larger price amount so gallery pricing is
  easier to scan. Verified in-browser, `npm run lint`, and `npm run build`.
- **Centered shop pagination controls.**
  The shop pagination footer now keeps page selection centered, with result
  count on the left and the Per Page selector aligned to the right on desktop.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Added gallery image previews on shop cards.**
  Product cards now show compact edge-aware previous/next arrows when multiple
  photos are available. Hovering the image starts the slideshow slightly faster
  with a true stacked opacity crossfade, stops at the final photo, and returns
  to the cover photo one second after the cursor leaves. The image count badge
  was removed, and manual arrows update the preview without leaving the gallery.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Standardized the product-detail scrap/spot panel.**
  Product detail pages now show the scrap gold/silver value and Based on Spot
  panel whenever the item has structured metal weight and purity data, even for
  manual-priced or multiplier-1 items. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Simplified the visible Quick Fill area.**
  Removed the long "Best format..." helper paragraph from the Add/Edit Product
  drawer while keeping Quick Fill, Apply, Copy Prompt, and View AI Prompt intact.
  Verified `npm run lint` and `npm run build`.
- **Added clear buttons to Add/Edit Product fields.**
  Product drawer fields now expose compact right-side `X` controls for quickly
  clearing typed values or resetting dropdowns/comboboxes to safe defaults.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Tightened the Product Admin table.**
  Hid Metal Type, Gender, and Location from the main Products table so the row
  layout is narrower while preserving those fields in forms, filters, and data.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Added Product Type / Metal Type hierarchy additively.**
  Added nullable `product_type` and `metal_type` fields with legacy fallback and
  dual-write compatibility. Product Admin now presents Product Type first,
  Metal Type second, and Metal Color third; conditionally hides Link Type,
  Length/Size, and Gender where they do not apply. Public shop filters and
  product specs understand the broader Product Type list. Quick Fill accepts
  labeled Product Type/Metal Type fields and the AI prompt prefers the new
  hierarchy. Added `supabase/product-type-metal-type.sql`; the current script
  also safely adds `products.brand` for live databases that missed the earlier
  brand migration. Verified in-browser, `npm run lint`, and `npm run build`.
- **Swept Watch item type support site-wide.**
  Confirmed Watch is supported in the shared product type list, Add/Edit
  Product, admin/shop filters, product detail specs, and Supabase jewelry-type
  SQL. Expanded recognition for watch, watches, wristwatch, wrist watch, and
  timepiece, and updated Quick Fill/AI prompt guidance to use
  `Jewelry Type:Watch` without Link Type. Verified in-browser, `npm run lint`,
  and `npm run build`.
- **Strengthened Quick Fill AI Brand detection.**
  Added explicit Brand detection rules to the default AI prompt so a detected
  maker/designer/brand/manufacturer gets its own `Brand:...` line even if it is
  also in the title. Older saved Admin Settings prompt overrides now receive the
  Brand addendum automatically, and Quick Fill accepts Brand Name/Maker
  Name/Designer Name/Manufacturer Name aliases. Verified `npm run lint` and
  `npm run build`.
- **Moved product-detail CTAs directly under price.**
  The Add to Cart, Save, Inquire, and Call row now appears immediately under
  "This is your price" and above the scrap/spot pricing cards, keeping purchase
  actions higher on the page. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Shifted pricing panel to a lighter gold colorway.**
  Kept the modern segmented product-detail pricing panel shape while replacing
  the violet/lavender styling with a lighter warm gold gradient, cream surface,
  and warm neutral spot/ticker colors. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Modernized the product-detail pricing panel.**
  Restyled the scrap value and spot basis display with a soft lavender
  container, violet primary tile, white secondary tile, and 8px rounded corners
  inspired by the supplied visual reference. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Refined product-detail pricing basis block.**
  Reworked the scrap value, spot basis, and site-wide update ticker into a
  cleaner two-value panel with separate color treatments and a shorter muted
  update line. Verified in-browser, `npm run lint`, and `npm run build`.
- **Added Length/Size to shop gallery cards.**
  Product cards now show Length or Size, when available, right-aligned on the
  same detail row as Purity and Grams. Ring items use Size; other items use
  Length. Verified in-browser, `npm run lint`, and `npm run build`.
- **Added shop Brand filtering/sorting and pagination.**
  The desktop left filter sidebar now includes Brand filtering plus Brand A-Z
  and Z-A sorting. The shop grid now shows a limited number of products per
  page, defaults to 24, and includes bottom pagination plus a per-page selector
  for 12, 24, 48, or 96 listings. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Added Brand support and tightened Quick Fill labeled output.**
  Added a product Brand field across Supabase SQL, Product Admin, Add/Edit
  Product, Quick Fill, shop search, and product detail specs. Quick Fill now
  expects labeled field-targeted `Field:Value` lines from the AI formatting
  prompt, accepts `Brand:...`, and can directly populate custom Link Type or
  Length/Size values without making them permanent dropdown choices. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Moved shop filters to a desktop left sidebar.**
  The shop page now displays search, live metal price badges, filters, result
  count, clear action, and availability toggle in a sticky left sidebar on
  desktop, while mobile keeps the collapsible filter button above the grid.
  Verified desktop/mobile in-browser, `npm run lint`, and `npm run build`.
- **Stacked product-detail price notes.**
  Moved the spot-price basis sentence below the current scrap value note on item
  detail pages so the scrap value reads first, then shortened the basis copy to
  `Based on $X/oz`. Verified in-browser, `npm run lint`, and `npm run build`.
- **Refined product-detail spot wording.**
  Changed the product detail line to say "This price is based on the current
  spot price" while keeping the live per-ounce value and update countdown.
  Verified in-browser, `npm run lint`, and `npm run build`.

## 2026-06-15

- **Added product-detail spot basis and refresh ticker.**
  Individual item pages now show the current scrap gold/silver value alongside
  the current site-wide spot value per ounce, plus a live countdown to the next
  five-minute price refresh. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Added Bicolor Gold and moved the account admin shortcut.**
  Added `bicolor_gold` as a Gold metal color across product types, admin/product
  controls, filters, Quick Fill, product labels, the default AI prompt, and
  `supabase/product-metal-variants.sql`. Public broad Metal filtering now lets
  Bicolor Gold items appear under both Gold and Silver. Admin users now see the
  My Account Admin Panel shortcut above Complete Profile. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Separated Jewelry Type from Link Type.**
  Products now use `jewelry_type` for Necklace, Bracelet, Ring, Pendant,
  Earrings, Watch, or Other, while `chain_type` is treated as Link Type only for
  necklaces and bracelets. Updated admin table/form/filter behavior, Quick Fill,
  shop filters, product detail specs, default AI prompt guidance, and Supabase
  SQL. The main Products table now hides Link Type and uses a combined
  Length/Size column; ring forms/details label that field as Size. Added
  `supabase/product-jewelry-type.sql`. Verified in-browser, `npm run lint`,
  and `npm run build`.
- **Fixed Save + Add Another inventory incrementing.**
  The Add Product drawer now recalculates the next Inventory # from the
  just-updated product list after `Save + Add Another`, preventing the saved
  number from being reused in the next blank form. Verified Add Product
  auto-fill in-browser, `npm run lint`, and `npm run build`.
- **Tightened the Product Admin Actions column.**
  The Products table row actions now sit in a compact fixed-width cell and wrap
  into two rows, reducing table width after the Melt column addition. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Added a Product Admin Melt column.**
  The main Products table now has a sortable `Melt` column between Weight and
  Mode, displaying each item's raw live spot melt value before multipliers.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Added duplicate inventory-number safeguards.**
  Add/Edit Product now refuses duplicate inventory numbers and shows an inline
  collision warning. Added `supabase/product-inventory-number-unique.sql` and
  updated product workflow SQL so Supabase can enforce a unique partial index
  after current duplicates are corrected. Verified the live duplicate `#21`
  warning in-browser, `npm run lint`, and `npm run build`.
- **Widened the Product Admin table on desktop.**
  The main Products table now uses a wider large-screen container, table minimum
  width, and reserved Actions column width so far-right row controls are not
  clipped on widescreen admin views. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Fixed Product Admin View return path.**
  Product Admin table `View` links now pass `returnTo=admin`; product detail
  pages opened from admin show `Back to Admin` while normal shopper detail pages
  still show `Back to Shop`. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Fixed Quick Fill Copy Prompt fallback.**
  Product Admin and Admin Settings now share a stronger clipboard helper. If
  direct clipboard access is blocked, Product Admin opens the AI prompt modal
  with text selected for manual copy, and Admin Settings selects the prompt
  textarea. Verified in-browser, `npm run lint`, and `npm run build`.
- **Refined Quick Fill AI prompt output rules.**
  The default AI formatting prompt now requests a fenced code block, keeps gram
  weight out of titles when Weight is supplied separately, and avoids repeating
  description-covered details in Public/Internal Notes. Verified
  `npm run lint` and `npm run build`.
- **Tightened Quick Fill Metal Color guidance.**
  Add/Edit Product Quick Fill now shows current Metal Color helper text and a
  Metal Color placeholder. The default AI formatting prompt documents the
  Metal Color-to-Category mapping, and explicit Metal Color wins if Category is
  also present later in labeled Quick Fill text. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Scoped shop Metal Color choices by selected Metal.**
  The public shop now shows only gold colors when Metal is Gold and only
  Silver/Vermeil when Metal is Silver. Incompatible direct URL combinations are
  ignored server-side. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Renamed Metal Type to Metal Color in the UI.**
  Admin labels, Add/Edit Product, public shop filters, Quick Fill feedback, and
  the default AI formatting prompt now say "Metal Color." The public shop writes
  `metalColor` filter URLs while still reading older `metalType` links. Verified
  `npm run lint` and `npm run build`.
- **Added product metal subtypes.**
  Products now support a dedicated `metal_variant` for Yellow Gold, White Gold,
  Rose Gold, Tricolor Gold, Silver, and Vermeil while keeping broad Gold/Silver
  categories for pricing. Added admin Add/Edit selection, admin table
  search/sort/filter support, labeled Quick Fill support, public shop Metal Color
  filtering, subtype labels on cards/details, and subtype order item snapshots.
  Added `supabase/product-metal-variants.sql`. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Moved product detail public notes below the action row.**
  Product detail pages now render `public_notes` as a buyer-facing Notes section
  below Add to Cart / Save / Inquire / Call, preserving line breaks. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Added Product Admin table View links.**
  Each row in the main Products table now has a `View` action that navigates to
  the public product detail page in the same tab, allowing browser Back to return
  to `/admin` and the product table. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Added Admin Settings with a Quick Fill prompt editor.**
  The shared admin header now includes `Admin Settings`, linking to protected
  `/admin/settings`. The page starts with an editable Quick Fill AI formatting
  prompt, with Save Prompt, Reset Default, and Copy Prompt actions. Product
  Admin reads the browser local saved prompt override for Copy Prompt/View AI
  Prompt, falling back to the shared default. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Hid the standalone Product ID field while adding products.**
  Add Product now starts at Inventory # and uses the generated ID, while Edit
  Product still shows `ID (slug, auto-generated if blank)` for post-creation
  adjustments. Edit saves now target the original row when the ID changes.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Tightened Product Admin Quick Fill validation.**
  Quick Fill now partially applies recognized comma-separated tokens while
  blocking and listing unrecognized tokens. Chain type matching no longer uses
  loose substring matches that could produce misleading `Applied: Chain Type`
  messages. Recognized tokens can replace existing form values, with category
  changes keeping paired metal/purity fields consistent. Repeated applies now
  overwrite existing form values, explicitly blank optional fields can clear
  prior values, and the Quick Fill text box clears after a successful apply.
  Quick Fill now accepts
  plain comma values, `Field:Value` pairs, and two-line CSV header/value pastes,
  including title EN/ES, location, price mode, asking price, descriptions EN/ES,
  public notes, and internal notes. Feedback appears inside the Add/Edit Product
  drawer. Unlabeled CSV rows that do not parse cleanly as standalone tokens fall
  back to the Add/Edit Product form order, while labeled rows can be in any
  order. Form-order CSV preserves blank columns and quoted text with commas.
  Combined chain/jewelry descriptors such as `Cuban link bracelet` are rejected
  as one token; enter those concepts separately. The Quick Fill helper now keeps
  the AI formatting prompt hidden by default, while exposing Copy Prompt and View
  AI Prompt actions. The prompt asks an AI agent to format random item
  descriptions into one quick-copy `Field:Value` text block and includes
  terminology/notes rules for Italian-made pieces, chain styles, and
  public/internal notes. Verified
  in-browser, `npm run lint`, and `npm run build`.
- **Added product image cropping from admin previews.**
  Product thumbnails in Add/Edit Product now open a full-size preview with a
  Crop action. The crop editor now uses a draggable crop-box overlay with
  edge/corner resize handles, saves a compressed WebP replacement for the
  selected image in the form, starts maximized so unchanged saves are no-ops,
  and cleans up the old uploaded Supabase Storage object when it is no longer
  referenced. Verified preview/crop UI in-browser, `npm run lint`, and
  `npm run build`.
- **Gated Asking Price by manual pricing mode.**
  Add/Edit Product now disables and grays out Asking Price unless Price Mode is
  Manual / Fixed. Verified in-browser, `npm run lint`, and `npm run build`.
- **Removed Sort Order from the product form.**
  Add/Edit Product no longer exposes Sort Order; admins reorder inventory by
  dragging rows in the master product table. New and cloned products still get
  automatic sort positions. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Simplified product note fields.**
  Removed the redundant "Extra notes about this item" field from Add/Edit
  Product, kept Public Notes and Internal Notes, and stopped rendering the old
  extra-note path on public product pages. Existing extra-note values fold into
  Internal Notes when the product is next saved. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Added Inventory # auto-fill with manual override.**
  Add/Edit Product now auto-fills Inventory # and locks it by default, with a
  Manual checkbox for overrides. It now also respects displayed fallback
  inventory numbers from older rows, so Add Product skips visible numbers like
  `#1` even when the database value is still blank. Verified in-browser,
  `npm run lint`, and `npm run build`.
- **Simplified Add/Edit Product form fields.**
  Removed Minimum Price, Cost Basis, Melt Value Snapshot, Acquisition Date, and
  Acquisition Source from the shared product form while keeping Asking Price.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Hid pending-payment products from the public shop gallery.**
  Products held by checkout/manual orders no longer appear as Pending Payment
  cards on `/shop`; they return to the gallery when the order workflow restores
  them to `available`. Verified `/shop` in-browser, `npm run lint`, and
  `npm run build`.
- **Added Home link to admin header.**
  The shared admin header now starts with `← Home`, linking back to the public
  homepage. Verified in-browser, `npm run lint`, and `npm run build`.
- **Added user order/invoice visibility in admin.**
  `/admin/users` now shows whether an account has placed orders, with order
  count/total and an Invoices button for account-linked purchases. Added
  `/admin/users/[id]/invoices` to list generated invoices and purchases without
  invoices. Verified in-browser, `npm run lint`, and `npm run build`.
- **Added homepage subscribers and admin Subscribers tab.**
  Added a homepage hero subscriber CTA, `/api/subscribe`, protected
  `/admin/subscribers`, and `supabase/homepage-subscribers.sql`. Subscriber
  writes use a security-definer Supabase RPC; admins can view subscribers in the
  new tab. Verified homepage/admin in-browser, `npm run lint`, and
  `npm run build`.
- **Centralized the admin header menu.**
  Added a shared `AdminHeader` and wired all admin pages to the same
  Products/Orders/Messages/Inquiries/Users menu. Products remains gold, Messages
  keeps the unread badge, and only the active page is underlined. Verified all
  admin headers in-browser, `npm run lint`, and `npm run build`.
- **Fixed Messages header navigation.**
  Added missing Inquiries and Users links to the `/admin/messages` header so it
  matches the rest of the admin center. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Refined admin nav active styling.**
  Renamed the Product Admin header label to `Products` and removed underlines
  from inactive admin menu links so only the current section is underlined.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Aligned Product Admin menu button styling.**
  Changed Orders, Messages, Inquiries, and Users in the Product Admin header to
  match the compact underlined admin navigation style used on the Messages
  page. Verified in-browser, `npm run lint`, and `npm run build`.
- **Added an unread badge to the admin Messages tab.**
  Admin navigation now shows a compact unread count beside Messages on Product
  Admin, Orders, Order Detail, Inquiries, Users, and Messages, based on unread
  `admin_notifications`. Verified in-browser, `npm run lint`, and
  `npm run build`.
- **Added checkout admin notifications, messages, and email.**
  Checkout now creates a real unpaid order through `/api/checkout/order`, uses a
  secure Supabase RPC to snapshot items and move products to `pending_payment`,
  inserts an `admin_notifications` message for the admin center, and sends an
  order email through Resend when configured. Added protected `/admin/messages`
  and `supabase/admin-notifications-checkout.sql`. Verified `npm run lint` and
  `npm run build`.
- **Collapsed SKU in Product Admin.**
  Removed SKU from the main inventory table and moved SKU/Public Slug into an
  optional `SKU / Slug` expander in the product form, keeping Inventory # as the
  primary visible identifier. Verified `npm run lint` and `npm run build`.
- **Added Orders/Sales admin section.**
  Added `/admin/orders` and `/admin/orders/[id]` with manual order creation,
  product snapshots into `order_items`, order list filters, detail status
  controls, internal notes, and invoice record generation. Creating an order
  marks selected products `pending_payment`; Mark Paid marks them `sold`; Mark
  Unpaid returns them to `pending_payment`; cancelling unpaid orders returns
  products to `available`; refunded orders do not automatically relist products.
  Verified in-browser, `npm run lint`, and `npm run build`.
- **Added sales workflow schema and inventory lifecycle controls.**
  Added `supabase/sales-workflow.sql` for richer product lifecycle fields,
  `orders`, `order_items`, `invoices`, `saved_items`, and expanded inquiry/user
  metadata with RLS. Product Admin now supports lifecycle statuses, location,
  featured, SKU/inventory search, more filters, duplicate, reserve/sold/archive
  quick actions, and delete protection for order-linked products. Public shop,
  product, cart, wishlist, pricing, and sitemap logic now understand the new
  statuses while remaining compatible with legacy `Available`/`Sold` rows.
  Verified `npm run lint` and `npm run build`.
- **Added admin account users table.**
  Product Admin now links to `/admin/users`, a protected server-rendered table
  of live Supabase `profiles` account data with contact, location, marketing
  opt-in, VIP/admin flags, and created/updated timestamps. Added
  `supabase/admin-profile-read-policy.sql` and updated the base schema with the
  admin profile read helper/policy. Verified `npm run build` passes.

## 2026-06-13

- **Fixed mobile shop card cart button overflow.**
  Gallery card cart buttons now use card-specific spacing and compact
  Add/Remove labels on slim mobile screens, preventing the Remove from Cart
  state from overflowing. Verified 320px/375px in-browser and `npm run build`
  passes.
- **Added shop sorting controls.**
  The shop filter pop-out now includes a URL-backed Sort dropdown for price and
  weight ordering, with inventory order as the default. Available items still
  appear before Sold items. Verified sorted shop URLs in-browser and
  `npm run build` passes.
- **Fixed estate page redirect loops.**
  English internal-locale proxy rewrites now preserve the locale header on the
  second pass, so `/estate-jewelry` and `/estate-services` render correctly
  instead of redirecting to themselves. Verified `/estate-jewelry` in-browser
  and `npm run build` passes.
- **Added admin drag-to-reorder inventory.**
  Product admin now includes an Order grip column for the clean master list.
  Dragging rows persists new `sort_order` values to Supabase for the matching
  Available/Sold group, so gallery inventory numbers can be rearranged from the
  table. Verified `/admin` render in-browser and `npm run build` passes.
- **Hid the account Full Name field.**
  The complete profile form now shows First Name and Last Name only, while
  still maintaining `full_name` internally from those values. Verified
  `/account` in-browser and `npm run build` passes.
- **Added complete customer profiles.**
  Account profiles now include editable name, contact email, phone, alternate
  phone, complete address, country, and marketing opt-in fields. Added
  Supabase migration SQL for existing projects and updated checkout prefill to
  use saved profile contact data. Verified `/account` render in-browser and
  `npm run build` passes.
- **Added checkout account prefill.**
  Checkout now fills blank customer fields from signed-in Supabase account data
  when available, including profile name, auth email, and phone metadata. Fields
  remain editable. Verified build and in-browser email prefill.
- **Added checkout-to-payment step.**
  Checkout now sends shoppers to a new `/payment` page via a Continue to
  Payment button. The old secure-payment placeholder was removed, and the
  payment page includes card fields plus a second order summary with the
  selected shipping option. Verified in-browser and `npm run build` passes.
- **Added checkout shipping rates.**
  Local Pickup is $0, Express Overnight Insured is $75, and Priority Insured is
  $45. The selected shipping cost now feeds into the estimated checkout total.
  Verified in-browser and `npm run build` passes.
- **Added checkout shipping options.**
  The checkout order summary now includes a shipping dropdown under Florida
  sales tax with Local Pickup, Express Overnight, and Priority Insured options.
  Verified in-browser and `npm run build` passes.
- **Added checkout summary item removal.**
  The checkout page's right-hand order summary now includes per-item remove
  buttons that update the shared cart state and totals immediately. Verified
  in-browser and `npm run build` passes.
- **Scoped length filters by item type.**
  Length buttons now appear only when Necklace or Bracelet is selected. Necklace
  shows chain lengths, Bracelet shows bracelet lengths, and incompatible hidden
  length values are ignored by the shop filter. Verified in-browser and
  `npm run build` passes.
- **Made length filter buttons checkable.**
  The horizontal length multi-select now uses button controls with embedded
  checked-state indicators, while preserving URL-backed multi-select toggling.
  Verified in-browser and `npm run build` passes.
- **Aligned gallery card cart buttons.**
  Gallery cards now reserve consistent title height and push cart actions to the
  bottom of the card, with fixed-height no-wrap cart buttons. Verified
  desktop/mobile in-browser and `npm run build` passes.
- **Refined length filter layout.**
  Length filtering now appears as a horizontal row of selectable buttons below
  the main shop filter dropdowns, while preserving multi-select behavior.
  Verified in-browser and `npm run build` passes.
- **Added multi-select length filtering.**
  The shop gallery length filter now uses checkboxes so shoppers can select
  multiple lengths at once, backed by a stable URL value. Verified in-browser
  and `npm run build` passes.
- **Added product-detail scrap value.**
  Product detail pages now show current scrap gold/silver value directly under
  "This is your price," using the live spot melt calculation. Verified
  in-browser and `npm run build` passes.
- **Updated gallery card cart buttons.**
  Add to Cart now shows a brief local confirmation, then becomes Remove from
  Cart. Clicking Remove from Cart removes the item and restores Add to Cart.
  Verified in-browser and `npm run build` passes.
- **Added admin inventory numbers.**
  The product admin table now shows an "Inv #" column matching the unfiltered
  public shop gallery order. Verified against `/shop` and `npm run build`
  passes.
- **Added sortable admin product columns.**
  Product admin table headers now sort the filtered product list by each data
  column, including numeric current price. Verified in-browser and `npm run
  build` passes.
- **Moved Auctions under the Shop menu.**
  The top-level Shop header item now opens Store (`/shop`) and Auctions
  (`/auctions`) on desktop and mobile, and the standalone top-level Auctions
  button has been removed. Verified in-browser and `npm run build` passes.
- **Split checkout into its own page.**
  The cart drawer now stays cart-only, while `/checkout` owns the customer
  form, order summary, and confirmation flow. The drawer's "Proceed to
  Checkout" action now links to the standalone checkout page. Verified
  in-browser and `npm run build` passes.
- **Added Auctions page and header link.**
  Added a localized `/auctions` route, inserted Auctions between Sell and About
  in the header, and included the route in the sitemap. Verified in-browser and
  `npm run build` passes.
- **Added About dropdown and Other Services page.**
  The header About item now opens About Us and Other Services links. Added a
  new `/services` page with buttons to Free Evaluation and Estate Services, and
  included it in the sitemap. Verified in-browser and `npm run build` passes.
- **Updated Sell submenu labels.**
  Changed the English header dropdown items to "Sell Us Gold," "Sell Us
  Silver," and "Sell Us Bullion." Verified in-browser and `npm run build`
  passes.
- **Shortened the English header Sell label.**
  Changed the main nav label from "Sell To Us" to "Sell." Verified in-browser
  and `npm run build` passes.
- **Bolded gallery card prices.**
  Increased the shop card price amount weight while keeping the "Your price"
  label bold. Verified in-browser and `npm run build` passes.
- **Matched "Your price" to the price amount.**
  Gallery cards now render the "Your price" label at the same font size and
  bold weight as the price. Verified in-browser and `npm run build` passes.
- **Refined shop card spacing and specs.**
  Tightened the gap between gallery card titles and prices, and enlarged the
  purity/grams line for better readability. Verified in-browser and
  `npm run build` passes.
- **Widened the desktop shop gallery.**
  The shop page container now uses more available desktop width, with 4 columns
  at normal desktop, 5 columns at 2xl, and 6 columns on very wide screens.
  Verified at 1440px, 1536px, and 1800px in-browser; `npm run build` passes.
- **Simplified shop card actions.**
  Removed the Inquire button from gallery cards and changed the compact cart
  button label to “Add to Cart.”
- **Tuned shop card typography.**
  Product titles are slightly smaller on gallery cards, while purity and grams
  are larger for easier scanning.
- **Updated shop card price/spec copy.**
  Gallery cards now show “Your price” next to the price, and the former
  live-spot context line now displays item purity and gram weight.
- **Added live gold/silver prices beside shop search.**
  The main shop search row now shows live silver on the left and live gold on
  the right, reusing the same spot data already fetched for shop pricing.
  Verified desktop and mobile layouts in-browser.
- **Added an Item Type shop filter.**
  The hidden filter panel now includes broad product type choices such as
  necklaces, bracelets, earrings, rings, pendants, and watches. Filtering is
  backed by the `itemType` URL parameter and verified in-browser.
- **Collapsed shop filters behind a Filter button.**
  The shop search and result count stay visible, while metal, purity, chain
  type, gender, length, and available-only controls open on demand. The button
  shows an active-filter count. Verified in-browser and `npm run build` passes.
- **Stopped product photo cropping on upload-driven surfaces.**
  Shop cards, product detail galleries, admin thumbnails, cart thumbnails, and
  wishlist thumbnails now fit images inside their frames instead of cropping
  edges. Product zoom math now follows the contained image bounds.
- **Added mobile magnification for product photos.**
  `ProductImageGallery` now handles pointer/touch input so mobile visitors can
  press and drag on a product image to see a floating magnified view, while
  desktop hover zoom remains unchanged. Verified the product page in-browser and
  `npm run build` passes.
- **Fixed English redirect loop in the Next proxy.** `next-app/src/proxy.ts`
  now marks internal unprefixed-English rewrites so the second proxy pass
  renders `/en/...` instead of redirecting back to the canonical unprefixed URL.
  `/` and `/shop` return 200, direct `/en` and `/en/shop` redirect once to `/`
  and `/shop`, `/es` routes still return 200, and `npm run build` passes.
- **Generated legacy removal audit.** Added
  `project-docs/LEGACY_REMOVAL_REPORT.md` separating the current `next-app/`
  runtime from root static-site cleanup candidates. Confirmed root
  `netlify.toml` builds from `next-app`, the Next shop reads Supabase
  `products`, root assets are mirrored into `next-app/public/assets`, and
  `npm run build` passes from `next-app`.
- **Updated memory docs for the Next transition.** Marked the Next app as the
  current deploy target in `CURRENT_STATUS.md`, added cleanup follow-ups to
  `TASKS.md`, and indexed the new report in `README.md`.
- **Removed the legacy static-site files.** Deleted root static HTML pages,
  `/es`, old vanilla scripts, root copied assets, old Netlify Function, static
  maintenance tooling, empty staging folders, the old static admin, and unused
  create-next-app SVG/reference files. Kept `next-app`, `project-docs`,
  `supabase`, root `netlify.toml`, root `.gitignore`, root `AGENTS.md`, and
  setup docs.
- **Rewrote cleanup-sensitive docs.** Updated `AGENTS.md`,
  `ACCOUNT_SETUP.md`, `STRUCTURE.md`, and `INTEGRITY.md` so they point at the
  current Next.js app and `npm run build` instead of deleted static-site
  tooling.

## 2026-06-12

- **Replaced Jotform with Netlify Forms (EN + ES).** Removed the embedded
  Jotform script from `contact.html` and `/es/contact.html`, and added static
  Netlify Forms (`submit-item`, `submit-item-es`) with multipart photo uploads,
  honeypot spam protection, localized fields, and a large square upload target.
  The visible page is now photo-first: after the visitor chooses photos from
  their computer/camera roll, a native modal opens for details and final send.
  Repurposed `scripts/forms/submit-item-form.js` to show selected photo names
  and manage that modal without blocking submission. Removed the unused root
  `submit-item-form.partial.html` and `submit-item-form.css`.
- **Tightened lead-form phone requirement.** The EN/ES modal labels now mark
  phone as required, and the helper script blocks submit, opens the details
  modal, and focuses browser validation on the phone field if it is missing.
- **Aligned upload field with Netlify Forms limits.** Netlify supports one file
  upload per field, so the visible upload control now accepts one required image
  instead of a multi-file selection.

## 2026-06-10

- **Added compact homepage announcement banner (EN + ES).** The banner drops
  down one second after load from behind the fixed header, promotes trusted
  gold/silver/jewelry buying and this month's free mobile evaluations for
  jewelry collections, and includes a close button. Updated the ad copy with a
  reference-style dark/gold strip, clock icon, "Limited-Time: Free Jewelry
  Evaluations," "Now booking in Naples," and "Schedule your appointment today"
  language. Removed "spots are limited" / "secure yours" wording. Desktop height
  verifies at ~84px and mobile at ~86px in the in-app preview. Banner offset now
  uses the measured fixed-header height, eliminating the small top-edge overlap
  under the menu. The banner now opens the same Calendly popup as the Schedule a
  Consultation CTA when clicked, except the X close button only dismisses the
  banner. The homepage content now slides down by the measured banner height
  while the banner is open and returns when dismissed. Reverted the shadow-removal
  experiment and changed the banner background to near-black (`#030303`) so any
  lower-edge overlay reads as part of the same dark strip; integrity check passes.
- **Fixed homepage hero old-image flash (EN + ES).** Removed the old bangles
  image from the hero video `poster`, changed the video to `preload="auto"`,
  lowered the fallback image load priority, and made that still image visible
  only for reduced-motion visitors. Verified no stale poster/high-priority
  fallback references remain; integrity check passes.

## 2026-06-02

- **WebP path updates sitewide.** Page and branding references now point at
  `.webp` assets; shop listings remain `.png`/`.jpg`. Renamed branding files to
  `logo.webp` / `logo2.webp`; legacy Netlify redirects updated. Script:
  `tools/update-webp-paths.mjs`.
- **Image optimization workflow (3 groups).** Added `tools/image-optimization.md`,
  `tools/copy-all-site-images.ps1`, `tools/deploy-optimized-images.ps1`, and
  `tools/list-image-groups.mjs`. Group 3 shop listings: lossless PNG/JPEG only,
  no resize; pages use WebP q90; branding lossless (user-run in XnConvert).
- **Removed Process page (EN + ES).** Deleted `process.html` and `es/process.html`,
  removed Process/Proceso from desktop and mobile header nav on all pages, dropped
  sitemap entries, and added 301 redirects to Free Evaluation. In-page CTAs on
  gold-services and estate-jewelry now point to free evaluation instead.
- **Shop grid title alignment + Monaco listing rename.** Shortened `new-listing-03` to
  **10K Gold Monaco Cuban Link Necklace** (clasp detail stays in description). Shop cards
  now use a fixed **two-line title clamp** and `margin-top: auto` on price so scrap/trade-in
  rows line up; integrity enforces title length (EN ≤ 62, ES ≤ 85) and card `<h3>` ↔
  catalog parity. Docs updated in `shop-listings.md`, `INTEGRITY.md`, `STRUCTURE.md`.
- **Decorative hero + graphics on the Free Evaluation page (EN + ES).** Replaced the plain
  text hero with a dramatic dark image hero (B&W `jeweler.jpg` of a ring being measured,
  slow Ken-Burns pan + gradient overlays), a catchy H1 ("What's It Really Worth? Find Out
  for Free." / "¿Cuánto Vale Realmente? Descúbralo Gratis."), dual gold/outline CTAs + phone,
  and four gold trust chips (no obligation / same-day cash / live pricing / private). Swapped
  the icon "What We Evaluate" grid for a 6-tile **image montage** (gold, ring, watch, silver,
  bullion, antiques — all existing `assets/images/pages/*`) with gradient labels, each linking
  to call. Added a **"Deal directly with Chris"** owner trust band (`chris.png`) before the
  final CTA to humanize and drive contact. All styling is page-local CSS (`.fe-hero*`,
  `.fe-chip`, `.fe-tile`, `.fe-owner-photo`); ES uses root-absolute image paths + translated
  copy. Verified EN + ES in-browser; integrity passes.
- **Trade-in ("special") price box on gallery cards (EN + ES).** Added the same
  store-credit trade-in offer that appears on the product detail page to every gallery
  card, as a compact gold-bordered box labeled **"Trade-in price" / "Precio de
  intercambio"** reading "Get this for $X with store credit" / "Llévatelo por $X con
  crédito de tienda" (X = exact scrap × `TRADE_IN_MULTIPLIER`, currently 1.1x). It's
  injected/updated dynamically in `shop-pricing.js` (`applyCardTradeIn`) so no per-card
  markup was needed, and only shows for gold/spot-priced items. Styling lives in the
  `.shop-trade-in-box` rules added to `shop.html` + `es/shop.html` (mirrors the detail
  page's `border-primary/30 bg-primary/[0.06]` gold box, with a mobile size step-down).
  Bumped the `shop-pricing.js` cache token to `?v=tradein-card-20260602` on all 8 pages.
  Verified all 19 cards EN + ES at desktop and 390px mobile (2-up); integrity passes.
- **New Free Evaluation marketing page + "Services" umbrella nav (EN + ES).** Created
  `free-evaluation.html` and `es/free-evaluation.html` — a dedicated, QR-friendly landing
  page for the free, no-obligation evaluation offer (what we evaluate, how it works,
  trust points, call/text CTAs, `Service` JSON-LD, full hreflang). To keep the header
  compact, the standalone **"Estate Services"** nav link was replaced by a **"Services"**
  dropdown (`nav-buy-group`) containing **Free Evaluation** + **Estate Services**, applied
  to desktop and mobile nav on every full-nav page (EN + ES) via a one-off migration
  script (since deleted). Added a prominent Free Evaluation CTA banner to both homepages
  (above the quick-nav grid), a footer link, and sitemap entries with hreflang. ES uses
  root-absolute paths and translated labels (Servicios / Evaluación Gratuita / Servicios
  de Patrimonio). Verified EN + ES nav (desktop dropdown + mobile group), both new pages,
  and homepage banners in-browser; integrity check passes.
- **Gallery card text shrink + "Your price" label + "Exact gold scrap value" (EN + ES).**
  Three things: (1) Added a small **"Your price" / "Tu precio"** eyebrow above the
  sale price on every gallery card (CSS `::before` on `[data-shop-price]`, localized
  per file). (2) Renamed the gallery scrap line from "Gold scrap value" →
  **"Exact gold scrap value"** ("Valor exacto de fundición del oro") to match the
  product page — changed in `shop-pricing.js` (`buildScrapContext`) and the static
  pre-JS fallback text on all 19 cards in `shop.html` + `es/shop.html`. (3) Fixed the
  oversized/"cartoony" mobile card text: an editorial hero rule
  (`main > section:first-of-type p { font-size: clamp(1rem,…) !important }`) was
  bleeding into the shop grid and forcing the price/scrap `<p>` up to ~16px on small
  screens. Added scoped `!important` font sizes for `[data-shop-price]` (0.85rem) and
  `[data-shop-price-context]` (0.62rem) on the cards to win, plus smaller mobile
  title/category. Bumped `shop-pricing.js` cache token to `?v=scrap-yourprice-20260602`
  on all 8 pages. Verified EN + ES at 390px; integrity check passes.
- **Removed the gallery card description entirely (EN + ES).** Per request, the
  per-item description paragraph is now hidden on the shop gallery cards at **all
  breakpoints** (`.shop-product-card .shop-product-body p.flex-1 { display: none; }`),
  so cards are much shorter — they now show image, category, title, price, gold
  scrap value, and the Inquire/Call actions only. The full description still renders
  on the product detail page. Removed the now-unnecessary mobile 3-line clamp rule.
  CSS-only in `shop.html` and `es/shop.html`; verified in-browser (mobile 2-up).
- **Denser, smaller shop gallery cards (EN + ES).** Reworked the `.shop-product-grid`
  responsive columns so the gallery shows **2 cards per row on mobile** (was 1),
  **3 on tablet (≥768px)**, and **4 on wide desktop (≥1280px)** (was 3) — overall
  smaller cards. Added a `max-width:767px` block that tightens card internals on
  mobile (smaller body padding, title/category type, cart button, and status badge).
  CSS-only, applied identically to the `<style>` blocks in `shop.html` and
  `es/shop.html`. Verified in-browser at 390px (2-up) and 1440px (4-up); integrity
  check passes.
- **New "invest in gold" shop tagline + homepage echo (EN + ES).** Changed the
  shop's main tagline from "Transparent pricing, live while you browse." to
  **"Don't just buy gold. Invest in it."** (eyebrow "A smarter way to own gold")
  with investment-framed copy emphasizing buying real, verifiable gold value.
  Mirrored the same headline/copy on the homepage "transparent buying" card and
  changed its CTA from "Shop Now" → **"Invest in Gold"** ("Invertir en Oro") to
  drive shop traffic. Applied to `shop.html`, `es/shop.html`, `index.html`,
  `es/index.html`. Copy-only; integrity check passes.
- **Reworded the product-page trade-in offer (EN + ES).** Reframed from a
  buy-your-gold message to a store-credit price on the item: "Have gold to sell?
  Trade-in special: get this for $X with store credit." / "¿Tienes oro para
  vender? Oferta de intercambio: llévatelo por $X con crédito de tienda." Same
  value (`scrapValue × 1.1`); copy-only change in `shop-pricing.js`. Bumped
  cache token to `?v=tradein-copy-20260602` on all 8 pages. Verified EN + ES.
- **Fixed mobile menu submenu placement (EN + ES).** In the flattened mobile
  nav the four "Sell To Us" subcategories (Estate Jewelry, Gold Services, Silver
  Services, Bullion) were rendered after the **About Us** link, so they appeared
  to belong under About Us. Moved the About Us link to *after* the four
  `mobile-subitem` links so they sit directly under **Sell To Us** (matching the
  desktop dropdown). Applied via a scoped regex across all 28 affected pages
  (14 EN + 14 ES); `contact.html`/`es/contact.html` already had the correct order
  and were left untouched. Verified in-browser at mobile width. (The desktop nav
  was already correct.)
- **Reworked shop pricing display into three tiers (EN + ES).** Gallery listing
  cards now drop the spot-multiplier text and instead show the **exact gold scrap
  value** beneath the sale price ("Gold scrap value: $X" / "Valor de fundición
  del oro: $X") so shoppers see scrap vs. your price at a glance. Product detail
  pages keep the spot-multiplier context **and** gain a third price: a **special
  trade-in offer** for a customer's own gold = `scrapValue × 1.1`, rendered in a
  gold-tinted callout ("Have gold to sell? Special trade-in offer: we pay you $Z
  for gold like this." / Spanish equivalent). Implemented centrally in
  `shop-pricing.js` (new `TRADE_IN_MULTIPLIER` constant, `tradeInValue`/Label on
  each product, `buildScrapContext` for cards, `#product-trade-in-offer` render);
  added the callout element to `product.html` + `es/product.html`; replaced the
  static multiplier placeholder text on all 19 gallery cards (EN + ES) with a
  neutral scrap fallback; and updated the shop "transparency" intro copy to point
  the multiplier/trade-in mentions at the product pages. Bumped `shop-pricing.js`
  cache token to `?v=scrap-tradein-20260602` across all 8 pages that load it.
  Verified in-browser: gallery (no multiplier, scrap shown) and detail page
  (scrap + your price + multiplier + trade-in, math 1.1×$1,684.30 = $1,852.73),
  EN and ES. Display contract documented in `features/online-shop.md`.
- **Added permanent build-structure / integrity guardrails.** New persistent
  Markdown detail files: `project-docs/STRUCTURE.md` (canonical repo map +
  single-sources-of-truth + structural invariants), `project-docs/INTEGRITY.md`
  (integrity rules + pre-publish checklist), and
  `project-docs/features/shop-listings.md` (product schema + add-a-listing
  runbook). Added a **dependency-free** guardrail script `tools/check-integrity.mjs`
  (plain Node, no npm install) that validates the product catalog schema, unique
  ids, on-disk image existence, EN↔ES shop-card parity, EN↔ES page parity, and
  root-absolute Spanish paths — exits non-zero on failure so it can gate
  publishes. Verified: passes against the live repo (19 products, 0 errors).
  Cross-linked from `AGENTS.md` and `project-docs/README.md`.
- **Wired the integrity guardrail into the Netlify deploy.** Set
  `netlify.toml` `[build] command = "node tools/check-integrity.mjs"` so a
  malformed listing or broken EN↔ES parity **fails the build instead of
  shipping**. `publish = "."` unchanged (no output transform; the command only
  gates the deploy).
- **Shop listing cards now show cart membership** (EN + ES). The image "Add to Cart"
  button reflects whether each piece is already in the cart: items in the cart render
  a dark gold-outlined **"✓ In Cart" / "✓ En el Carrito"** pill (with `aria-pressed`
  and a "Remove item from cart" label), and clicking toggles add/remove instead of the
  old flash-and-revert. State is computed on load from the saved cart and stays in sync
  via the `shopcart:updated` event (so changes from the product page, cart page, or
  account sync are reflected). Added a `has(id)` helper to `ShopCart` (`cart.js`),
  reworked the button render/toggle in `shop-filters.js`, and added `.is-in-cart`
  styling to both `shop.html` + `es/shop.html`. Bumped `cart.js` + `shop-filters.js`
  cache tokens to `?v=incart-state-20260602`. Verified in-browser: load-time state,
  add→persist, and remove round-trip (cart count tracked correctly).
- **Added 2 more photos to the 14K semi-solid Cuban link necklace** (`new-listing-06`):
  copied `IMG_4939`/`IMG_4946` → `shop-new-listing-06-04.jpg`/`-05.jpg` and appended
  them to the product's `images` array (gallery now 5 photos, both languages). Bumped
  `shop-products.js` token to `?v=listing06-photos-20260602`. Emptied the re-added
  `pictures/` folder afterward (kept the folder).
- **Filled in real details for the 6 placeholder listings** (EN + ES). Converted
  "New Listing 1–6" from manual placeholders into real spot-priced gold products in
  `shop-products.js` (`priceMode: "spot-multiplier"`, `category: "Gold"`, full
  `*_es` copy/specs/tags) and rebuilt the cards in `shop.html` + `es/shop.html` with
  live `data-shop-price` hooks, filter attributes, and Shopify embed divs:
  1) Italian 14K two-tone Cuban link & ring-station necklace — 44.72g, 30", 5.5/13mm,
     14K Italy — 1.25x → $5,766.10; 2) 14K round box/rolo link chain — 14.34g, 24",
     3mm, LXG 14K — 1.5x → $2,218.76; 3) 10K Monaco Cuban link w/ pavé diamond box
     clasp — 12.45g, 20.5", 5mm — 1.25x → $1,146.63; 4) 14K rope chain — 12.48g, 25",
     2.5mm, 14K — 1.25x → $1,609.14; 5) 10K rope chain — 15.19g, 25", 2.6mm, ALI 417 —
     1.25x → $1,398.98; 6) 14K semi-solid Cuban link chain — 9g, 24", 3.7mm, 14K —
     1.4x → $1,299.69. Added a **"Box link" / "Eslabón box"** chain-type filter option
     for #2. Prices verified against the live calculator at the $5,500 fallback spot.
- **Reordered the shop grid** so the non-necklace pieces sit last: moved the
  **18K heraldic cross ring** and **14K men's Cuban/curb link bracelet** below all
  necklaces in `shop.html`, `es/shop.html`, and the `shop-products.js` array (now ends
  necklaces → ring → bracelet). Shop still lists 19 pieces.
- Bumped `shop-products.js` cache token to `?v=listings-detail-20260602` across all 10
  pages that load it. Verified the full EN + ES grids in-browser (order, titles,
  descriptions, live prices) and deleted the now-empty `pictures/` source folder (29 files).

## 2026-06-01

- **Added 6 placeholder shop listings** ("New Listing 1–6" / "Artículo Nuevo 1–6")
  as photo-first place markers while details are gathered. Copied/renamed 29 photos
  from the `pictures/` folder into `assets/images/shop/`
  (`shop-new-listing-01..06-NN.png`; counts 5/5/7/4/5/3), appended 6 products to
  `shop-products.js` (`priceMode: "manual"`, "Price on request"/"Precio a consultar",
  generic `Jewelry` category, EN+ES placeholder copy), and added cards to `shop.html`
  + `es/shop.html`. Shop now lists 19 pieces. Cards use static localized price text
  (no `data-shop-price` hook). Bumped `shop-products.js` cache token to
  `?v=placeholders-20260601`. Verified grid + a placeholder detail page (full gallery)
  in both languages. NOTE: detail pages still show the shared gold-spot meta line
  ("Manual price" + spot) on these manual-priced placeholders — harmless, will resolve
  once real specs/pricing are added.
- **Added two new shop listings** (EN + ES): a **10K semi-solid Cuban link chain**
  (26g, 24.5", 6.3mm, box clasp w/ double safety, marked 10K — $2,394.56 @ 1.25x) and
  a **14K Byzantine (fancy) link chain** (31.28g, 21.5", 4.3mm, barrel clasp marked
  14K — $4,033.18 @ 1.25x). Copied/renamed their photos (7 + 6) into
  `assets/images/shop/`, appended both products (with `*_es` fields) to
  `shop-products.js`, and added the static cards to `shop.html` + `es/shop.html`.
  Added a new **"Byzantine link" / "Eslabón bizantino"** chain-type filter option in
  both languages. Shop now lists 13 pieces. Bumped `shop-products.js` cache token to
  `?v=add-listings-20260601`. Verified both detail pages (EN + ES) in-browser.
- **Streamlined the shop search bar + filter selects** (EN + ES `shop.html`): reduced
  the search input height/font and narrowed it (max-width 28rem→24rem), tightened the
  4-up filter grid (gap, max-width 56rem→48rem, smaller labels + select padding) so
  the controls are shorter and less blocky. Kept the centered 4-column lineup and
  label alignment; verified both languages in-browser.

- Recorded the GitHub repo (`DarkMatter-WebDev/NaplesAntiquesLLC.com`) in
  `CLIENTS.md` / `PROJECT_OVERVIEW.md`; made `CLIENTS.md` a reusable client roster
  with a copy-paste template.
- Approved and documented the **Spanish translation plan** (separate `/es/` pages
  + hreflang + header toggle) in `features/spanish-translation.md` + `DECISIONS.md`.
- Built the **Spanish home-page POC**: added `/es/index.html` (full Spanish copy,
  `lang="es"`, translated title/meta/OG/JSON-LD, root-absolute asset paths),
  hreflang alternates on `/` and `/es/`, and an EN/ES language toggle in
  `scripts/shared/site-header.js`. Tested in-browser both directions.
- **Completed the full Spanish rollout** (after POC): created `/es/` twins for all
  remaining pages — `about`, `what-we-buy`, `estate-jewelry`, `gold-services`,
  `silver-services`, `bullion`, `process`, `estate-services`, `faq`, `contact`,
  `privacy`, `shop`, `product`, `cart`, `account`, `account-dashboard`,
  `member-access` (18 total). Added reciprocal hreflang to every English page and
  to `sitemap.xml`.
- **Localized the shop single-source**: added `title_es`/`description_es`/
  `details_es`/`tags_es` to all 11 products in `shop-products.js`, and made product
  image paths root-absolute (`/assets/...`) so they load on `/es/` pages.
- **Made shared JS language-aware** (branches on `<html lang="es">`):
  `shop-pricing.js`, `product-page.js`, `shop-filters.js`, `cart-page.js`,
  `account-portal.js`, `account-dashboard.js`, `registered-only.js`. Bumped all
  changed scripts to cache-bust `?v=es-i18n-20260601`.
- QA'd `/es/` shop, product, and cart in-browser (Spanish strings + working images);
  confirmed English pages unaffected.
- **Fixed two Spanish-header bugs** (in `editorial-theme.css`): (1) the "Tienda" /
  "Véndanos" nav underline was hardcoded to the English hrefs
  (`a[href="shop.html"]` / `a[href="what-we-buy.html"]`), so `/es/` links never
  matched — switched to suffix selectors (`a[href$="shop.html"]`,
  `a[href$="what-we-buy.html"]`) so both EN and ES underline. (2) On wide screens
  (≥1536px) the longer Spanish nav labels widened the desktop nav and crushed the
  brand name into ~6 stacked lines (header ballooned to ~200px); added a
  `@media (min-width:1536px) html[lang="es"]` block that tightens the nav
  (gap/font/padding) and keeps `.site-brand-text` on one line (header back to
  ~81px). Verified at 1536/1680px; English header unchanged (94px). Bumped the
  `editorial-theme.css` cache token to `?v=es-nav-fix-20260601` across all pages.
- **Header polish (EN + ES):** (1) localized the JS-injected nav links — "My
  Account"/"Cart" now render "Mi Cuenta"/"Carrito" on `/es/` pages
  (`site-header.js` reads `<html lang>`); (2) rebuilt the language toggle as a
  visible **EN / ES** switcher (both shown, current one highlighted gold +
  bold, other muted) instead of a single target code; (3) aligned the
  "Véndanos"/"Sell To Us" dropdown trigger with its sibling nav links via
  `.nav-buy-group { display:flex; align-items:center }` (was sitting a couple px
  high). Bumped cache tokens to `?v=lang-switcher-20260601`
  (`site-header.js` + `editorial-theme.css`). Verified both languages in-browser.
- **Main-menu cleanup (EN + ES):** renamed the header "Contact Us" → "Contact"
  ("Contáctenos" → "Contacto" on `/es/`) in both the desktop nav and mobile menu,
  and removed "FAQ"/"Preguntas Frecuentes" from the header entirely. Added a
  "Have Questions About the Process?" / "¿Preguntas Sobre el Proceso?" section
  with a Read the FAQ / Ver Preguntas Frecuentes link near the bottom of
  `process.html` + `es/process.html`. The **footer FAQ link is kept** on every
  page (footer uses a different class, so it was untouched). Applied across all
  32 affected pages via a UTF-8-safe, class-scoped script; verified in-browser.
- **Fixed the language switcher showing the word "LANGUAGE"** on the account
  area: the 6 app pages (`account`, `account-dashboard`, `member-access` × EN/ES)
  never loaded the Material Symbols **webfont** (only the inline
  `font-variation-settings`), so the injected switcher's globe ligature fell back
  to its literal text ("language" → uppercased "LANGUAGE"). Added the standard
  `fonts.googleapis.com/...Material+Symbols+Outlined` `<link>` (same as the other
  30 pages) to all 6. Verified the globe renders as a glyph and the font loads.
- **Shortened the brand name to "Naples Estate Jewelry" everywhere it appears as the
  official name** (removed "& Antiques"), across all 36 EN + ES pages: header
  spans, footer headings/copyright, page `<title>`s, meta `author`/`description`,
  OG/Twitter tags, JSON-LD `name`/`founder`, logo `alt` text, and the privacy-policy
  legal references. Also updated the JS-built product-page `<title>`
  (`product-page.js`, cache-bumped to `?v=brand-short-20260601` on both
  `product.html`s). Descriptive phrases (e.g. "Watches & Antiques",
  "Oro y Antigüedades") were intentionally left unchanged. Legacy
  `submit-item-form.partial.html` (unused, slated for removal) left as-is.
- Confirmed the "Submit Your Item" lead form is handled by an embedded **Jotform**
  (id `261379265677068`) on `contact.html`; marked the old custom form files as
  legacy.
- Added `project-docs/` persistent memory system (overview, current status,
  architecture, decisions, tasks, changelog, features, meeting notes).
- Added `CLIENTS.md` for Dark Matter Web Services client/maintenance tracking.
- Added Dark Matter Web Services footer credit badge to all pages; bumped theme
  cache version to `darkmatter-credit-20260601`.

## Earlier (pre-memory-system, approximate)

- Reorganized images under `assets/images/{branding,pages,shop}/` and grouped
  scripts under `scripts/{shared,shop,account,forms}/`; added 301 redirects for
  all legacy root URLs in `netlify.toml`.
- Implemented live gold-spot pricing: `netlify/functions/metal-prices.js` +
  `scripts/shop/shop-pricing.js` (spot-multiplier price model, caching, fallback,
  market-closed handling).
- Implemented Supabase customer accounts: `supabase/schema.sql` (profiles,
  customer_carts, favorites, triggers, RLS), `naples-auth.js`, account pages, and
  saved-cart merge on sign-in.
- Built the marketing site (home, about, what-we-buy + category pages, process,
  estate-services, faq, contact, privacy) with SEO meta, canonical tags, JSON-LD
  `JewelryStore` schema, `sitemap.xml`, and `robots.txt`.
- Added the online shop (`shop.html` / `product.html`) with filters and a static
  `SHOP_PRODUCTS` catalog.
- Added the reusable "Submit Your Item" lead-form fragment (backend endpoint not
  yet configured).
