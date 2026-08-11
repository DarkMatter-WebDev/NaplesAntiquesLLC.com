# Decisions

> Current durable decisions only. Superseded experiments and session-by-session
> reasoning remain in `CHANGELOG.md`. Older runbooks that cite a dated
> `DECISIONS.md` "session" or "addendum" should follow the same date/label in
> `CHANGELOG.md`; those historical entries moved there during the 2026-07-23
> compaction. Last reconciled: **2026-08-09**.

## Repository And Memory

### Source-of-truth folder has no git workflow

This folder is the user's repo-ready source of truth. Do not run git commands
here. The user copies it into a separate GitHub working folder manually.

Keep runtime code in `next-app/`, SQL in `supabase/`, and durable project memory
in `project-docs/`. Do not leave temporary reports, archives, logs, or generated
caches in the root.

### Startup memory is a snapshot, not a second changelog

`CURRENT_STATUS.md` describes the present system, `TASKS.md` contains open work,
and this file contains decisions still governing the project. Detailed
chronology belongs only in `CHANGELOG.md`; feature-specific implementation
detail belongs in `features/`.

Completed build prompts, proposed schemas/routes, rollout plans, kickoff notes,
and handoff reports are removed after their durable operating rules are merged
into the current feature documents. Historical names and chronology may remain
in `CHANGELOG.md`, but stale planning folders must never compete with current
code, applied SQL, `TASKS.md`, or feature runbooks as a source of truth.

## Application Architecture

### Next.js under `next-app/` remains the only runtime

The old static root site is retired. Root `netlify.toml` builds with
`base = "next-app"` and publishes `.next`. Do not recreate root HTML, scripts,
assets, or Netlify Functions as an alternate runtime.

### All legacy/retired redirects live in lib/legacy-redirects.ts, served by proxy.ts

On Netlify the next-intl proxy (`src/proxy.ts`) is deployed as an **edge
function that runs before both the Netlify redirect engine and the Next.js
server**. It rewrites every locale-less path to `/en/...`, so a request for a
route that no longer exists 404s before any redirect layer is consulted.

This silently broke **all 22 English-side redirects** — the 12 legacy
static-site `.html` URLs, `/cart`, `/wishlist`, `/saved`, `/account/saved`,
and the 6 re-slugged product URLs — for as long as the proxy has existed.
Every `/es/*` twin worked, which is exactly what made it invisible. Found
2026-08-02 while verifying the retired `/auctions` page (three attempts to
fix that one taught the same lesson three times).

- `netlify.toml` redirects — including `force = true` — never fire for bare
  English URLs. They DO fire for `/es/*`, so a broken fix looks half-working.
- `next.config.ts` `redirects()` never fire either, **but they do work under
  `next dev`** — a local test passes while production still 404s. The
  `redirects()` block was removed entirely for this reason.
- The only reliable layer is `proxy.ts`, ahead of the locale rewrite.

Rules:
1. Every path the app no longer serves goes in `src/lib/legacy-redirects.ts`
   (locale-less keys; `resolveLegacyRedirect` normalises `/x`, `/en/x`, and
   `/es/x` to one rule and re-prefixes Spanish destinations).
1a. **A deleted listing gets its redirect line DELETED, never re-pointed.**
   This is a one-of-a-kind estate inventory, so products are removed
   routinely and a 404 is the honest, correct answer for a piece that is
   genuinely gone — search engines drop it naturally, and the 404 page
   already offers Browse Shop / Go Home. Re-pointing an old product URL at a
   *different* product misleads the visitor, and redirecting to a page that
   itself 404s is strictly worse than the plain 404 (search engines read the
   hop as a soft 404). The sitemap is generated from the database, so
   deleted products drop out of it automatically — no sitemap action needed.
2. Use `permanent: true` (308) when the URL carries link equity — legacy
   pages, retired pages, re-slugged products — and `false` (307) for
   convenience URLs that were never real pages (drawers like `/cart`).
3. Never re-add `redirects()` to `next.config.ts`.
4. Verify redirects **against the deployed site**, never only locally.

### The primary domain is naplesestatejewelry.com; all app-facing email is .com

Owner decision 2026-08-01, after buying the `.com`: the canonical web domain
is `https://naplesestatejewelry.com`. The legacy `.co` remains owned as a
Netlify alias that 301s path-preservingly to `.com` (rules in root
`netlify.toml`), and `naplesantiquesllc.com` redirects straight to `.com` so
old links never hop twice. New site-URL code must build from
`NEXT_PUBLIC_SITE_URL`/`SITE_URL` (falling back to the `.com`), never hardcode
either domain.

**Email: separate the mailbox from the sender.** The original 2026-08-01
decision kept everything on `.co`. Amended 2026-08-05 (senders), then again
2026-08-08 (the `info@` mailbox). Current rule:

- **`info@` is on `.com`.** Moved 2026-08-08 on owner instruction so the address
  customers see matches the domain they are on — footer, account dashboard, both
  LocalBusiness JSON-LD blocks, and the order-notification default.
  **Owner-confirmed 2026-08-09 that the mailbox actually receives mail**, which
  is the condition this decision depends on: the `.com` root MX points at
  Workspace, but the mailbox/alias existing there is config no code can verify.
  It remains a live dependency rather than a settled one — if that mailbox is
  ever deleted or renamed, customer inquiries AND new-order notifications bounce
  silently, with nothing in the app to signal it.
- **The marketing Reply-To is `info@naplesestatejewelry.com`** (owner,
  2026-08-08). Campaign replies land with every other customer inquiry rather
  than in a personal inbox. Reply-To is NOT constrained by the sending domain,
  so any monitored mailbox is valid here.
- **Marketing campaigns send FROM
  `Chris at Naples Estate Jewelry <info@naplesestatejewelry.com>`** (owner,
  2026-08-08). The display name stays personal — that is what distinguishes this
  sender profile from `no_reply`; only the address is shared. Legal because the
  address sits on Resend's verified sending domain.
- **From is constrained; Reply-To is not.** A From address MUST be on the
  verified sending domain or the send fails outright. Reply-To can be any
  mailbox, including one on an unverified domain. When changing either, check
  which of the two you are touching — they are not interchangeable.
- **No `chris@` and no `@naplesestatejewelry.co` address remains in shipped
  code** as of 2026-08-08 — both verified zero in a clean production build.
- **Never touch the `.co` MX records** regardless. The domain still carries live
  mailboxes even though the app no longer points anyone at them.
- **Senders must be `.com`.** A From address must sit on Resend's verified
  sending domain, which is `naplesestatejewelry.com`. A `.co` From address will
  not send at all.

Superseded: this entry previously read "mailboxes stay on `.co`" and forbade
rewriting any `.co` *contact* address. That held from 2026-08-01 to 2026-08-08
and is why the old code comments said so; it no longer applies to `info@`.

### Resend's sending domain moved to .com because the Free plan allows only one

Owner decision 2026-08-05, amending the email half of the entry above. The
`.com` had become the brand domain everywhere else, and Resend's **Free plan
permits exactly one sending domain** — adding `.com` alongside `.co` was
rejected outright, and running both would have meant Pro at $20/mo. The owner
chose to swap rather than pay, accepting an outage window on the reasoning that
no meaningful email traffic was expected.

The swap is destructive by construction: `.co` had to be *deleted* before `.com`
could be added, so there is no overlap and no rollback that does not repeat the
outage. Two things make that tolerable and should be remembered before touching
email again: a failed send never breaks checkout (`order-finalize.ts` catches;
`order-owner-notification.ts` never throws), and missed receipts re-send from
Admin → Orders.

**The `.com` zone is shared with live Google Workspace mail, so email DNS work
there is not routine.** It already carries five Workspace MX records, a root
`v=spf1` behind GoDaddy's `_spfm` merge indirection, and DMARC at
`p=quarantine`. Consequences that outlive this migration:

- **Never add a second root `v=spf1`** — two SPF records is a permanent
  `permerror` that breaks the Workspace mail. Keep provider SPF on a subdomain
  (Resend's is on `send`, via its default Custom Return-Path).
- **Never add a root MX for a sending provider.** Resend displays an
  `inbound-smtp…` MX at `@` priority 0 under "Enable Receiving"; at priority 0 it
  would outrank all five Google MX and hijack the domain's inbound mail.
- **`p=quarantine` means DKIM mistakes fail silently** — mail is accepted and
  spam-foldered rather than erroring. Any change to email DNS needs a test send
  *and an inbox check*, not just a green "Verified" badge.
- **Prefer manual DNS entry over Resend's "Auto configure"**, which takes an
  OAuth grant to write DNS and can rewrite the root SPF.

### proxy.ts runs BEFORE netlify.toml redirects — host redirects belong in the proxy

Established 2026-08-05 by probing production. Only paths *inside* the proxy
matcher picked up a `/en` prefix in their redirect target (`/shop` →
`.com/en/shop`) while excluded paths did not (`/robots.txt` → `.com/robots.txt`).
That proves ordering: **the proxy rewrites the path first, and netlify.toml
redirect rules then splat the already-rewritten path.**

Consequences to preserve:

- **Host-level redirects must live in `proxy.ts`, above the locale rewrite.** Put
  them only in `netlify.toml` and every legacy link costs two hops — the rule
  splats `/en/...`, then next-intl 307s the `/en` off again.
- **The netlify.toml host rules must stay anyway.** Paths excluded from the proxy
  matcher (`/api/*`, `robots.txt`, `sitemap`) never reach the proxy and rely on
  them.
- **Never let `/api/*` on a legacy host become a 301.** The `.co/api/*` carve-out
  must remain a **200 rewrite**: webhook POSTs from Resend, PayPal, and eBay do
  not follow redirects. The proxy matcher already excludes `api/`; keep it that
  way. Regression test: `POST https://naplesestatejewelry.co/api/webhooks/resend`
  must return 401 (signature rejection), never 301.

### Development and production builds never run concurrently

Stop the Next development server before running `npm run build`, then restart
development afterward. Both modes use the same `.next` output tree; allowing a
production build to overwrite it while `next dev` is serving can mix old
server HTML with new client chunks and produce recoverable hydration errors.

### Supabase is the system of record

Products, accounts, orders, inquiries, settings, marketing data, and
marketplace state live in Supabase. Product IDs are durable URL/saved-state
keys. Product schema changes must update SQL, TypeScript contracts, read/write
queries, UI, and docs together.

### Localized behavior remains paired

English and Spanish routes use `next-intl`. Shared strings belong in paired
message files or explicitly paired localized page data. Route metadata, legal
copy, filters, errors, and transactional/customer content must be checked in
both locales.

### UI icons are inline SVG, never ligature fonts

All application icons render through
`next-app/src/components/AppIcon.tsx`, which maps stable semantic names to
direct Lucide React SVG imports. Do not add icon fonts, ligature text,
font-glyph subsetting, or independently cached icon-font assets.

Decorative graphics may be omitted. Functional icons must remain accessible
through surrounding text or control labels. An unknown data-driven icon renders
nothing rather than exposing its identifier, and the icon-integrity regression
test must continue rejecting legacy font infrastructure and unmapped static
`AppIcon` names.

**Icons are OUTLINE by default, and a solid one asks explicitly.** `AppIcon`
renders `fill={fill ?? 'none'}`; anything that should be solid — a saved heart,
a rating star — passes `fill="currentColor"` at the call site.

⚠️ **Never reintroduce `fontVariationSettings`.** Those are Material Symbols
variable-font axes and mean nothing to an SVG. Until 2026-08-09 `AppIcon`
translated a `'FILL' 1` value into `fill="currentColor"`, which is right for an
icon FONT (the axis swaps to a solid-with-knockout glyph) and badly wrong for a
Lucide OUTLINE icon: it floods the shape, and since every interior mark is a
same-coloured STROKE, the detail vanishes. A filled `circle-check` is a plain
disc; a filled `gem`, `watch` or `badge-check` is a blob. It went unnoticed for
a long time because each icon still *rendered* — 14 of 24 icons on
`/free-evaluation` were affected before the owner reported them as "primitive".
The test now fails the build if the property reappears anywhere outside
`AppIcon.tsx`.

### /free-evaluation is a sendable landing page, not a form page

Owner framing 2026-08-09: this URL gets TEXTED to someone who does not know what
they own. It has to explain the service before it asks for anything — the form
in the hero read as being asked to hand over details before anything had been
explained.

- **The form lives in the SECOND block, never the hero**, under a lead-in that
  says photos are optional. The hero ends in a `#request` anchor and the phone
  number instead.
- **The hero carries the explanation and Chris's photograph**, in his own voice.
  Two columns, photo shown large — the previous full-bleed-behind-a-gradient
  treatment hid the one image that builds trust.
- **The sorting detail is the substance of the page**, not filler: precious
  metal separated from plated/filled/costume, then split by purity (10k-22k, 9k,
  sterling .925, 800/900, coin silver) with each purity weighed separately,
  priced against live spot with the arithmetic visible, and priced piece by
  piece for anyone unsure what to keep. Keep that specificity if the copy is
  ever revised — vagueness is what the page exists to counter.

- **Buttons use the site classes, never one-off inline styles.** `.gold-button`
  for a primary CTA; `.outline-button` for a secondary, plus the
  `.outline-button-on-dark` modifier on dark bands — the base variant fills
  near-white with `--color-primary` text and is unreadable there.
  ⚠️ **Do not paint a button with `var(--color-primary)` as a background.** It is
  **#735c00**, a deep gold meant for text and accents; used as a fill with dark
  text on top it reads as a disabled control. That is exactly how the
  free-evaluation CTA ended up looking greyed out.
- **The metal list is grouped, ascending, and open-ended** — Gold 9k→22k and up,
  Silver .925/800/900/coin, then everything else — and closes by saying anything
  not listed gets identified too. It exists to show the DETAIL a seller gets
  back, so it must never read as an exhaustive list of what is accepted. The
  purity list in the sorting section mirrors it; change them together.

⚠️ **The hero image is a PLACEHOLDER with the face out of shot, and the framing
is load-bearing.** The copy beside it is first person ("I'm Chris…"), so a
recognisable stranger there would assert something false about who Chris is —
misrepresentation to the customer, not just a stylistic choice. The alt text
therefore describes the desk and the work, never a person. **When a real
photograph of Chris replaces it, update the file and the alt text together.**
The same rule governs any future generated imagery of people on this page.

### Illustrated clay marks are IMAGES; functional UI icons stay Lucide SVG

Owner direction 2026-08-09: the flat gold line icons read as generic ("so many
websites that are vibe coded have these icons"). The `/free-evaluation` trust
pillars and the six category tiles now use **matte-clay illustrated marks** —
raster WebP in `public/assets/images/icons/clay-*.webp` — rendered through
`next/image`, not `AppIcon`.

Rolled out sitewide the same day: the homepage services strip and `/sell`,
`/sell/[city]`, `/trade-in`, `/bullion`, `/gold-services`, `/silver-services`.
**20 marks** live in `public/assets/images/icons/`.

**Render them through `components/ClayMark.tsx`, never a bare `<Image>`.** It
owns the sizing, the float shadow, the `onDark` opt-out, and the `ClayMarkName`
union — that union is the point: a typo becomes a build error instead of a
silently missing image, which is exactly how the old `icon: 'string'` fields
failed. Data arrays holding a `mark` field need `as const` or the value widens
to `string` and the union check is lost.

**The boundary is what matters, not the style.** This is a carve-out for
DECORATIVE marks only. Cart, heart, chevrons, close, form and admin icons stay
Lucide inline SVG under the entry above, permanently: they are functional UI
where a stock icon is correct and `currentColor` recolouring is load-bearing. Do
not migrate them. The same applies to small glyphs sitting inline beside text —
the `star`/`arrow_outward` link decorations, `trending_flat`, `verified`,
`info`: those stayed Lucide in the sitewide pass on purpose.

**Delete what a mark replaces.** The homepage's three service icons were drawn
on a `<canvas>` by `ServiceIconCanvas`; that component was removed, not left
orphaned, along with the vestigial emoji `icon` fields it had stopped reading.
Where a mark landed inside a gold disc (`#d4af37` / `#735c00`), the disc went
too — gold clay on a gold circle is gold on gold, and the mark's own shadow does
what the disc was doing.

Rules that must hold:

1. **Generate in the proven style, then RECOLOUR — never prompt for the final
   colour.** Asking the model directly for "gold and charcoal clay" produced a
   conventional gold-body/grey-shackle split and lost the diagonal two-tone and
   the hand-formed dents. The pipeline is: generate every mark from one shared
   coral-clay prompt template → `remove_background` → apply ONE recolour to the
   whole set. That is what makes a set look like a set; per-mark prompting
   drifts.
2. **The recolour is a hue rotation gated on saturation** (`hue 40, sat x0.78,
   light x0.78, threshold 0.18` — tuning "D", chosen from a four-way ladder).
   Pixels below the threshold are untouched, which is precisely what preserves
   the charcoal second tone, every dent, and the soft shading. It operates on
   the rendered pixels, so form is byte-identical to the approved sample.
   Script: `scratchpad/build-clay.js` shape — re-derive rather than hand-edit.
3. **Background removal takes the ambient shadow with it.** The cutout alone
   looks pasted-on; the float comes back as a CSS `drop-shadow`, which follows
   the alpha channel. **Only on light surfaces** — a black shadow is invisible
   on the `#262928` tiles, so the tile marks carry no shadow at all.
4. **Size them at 72px (pillars) / 136px (category marks), never at icon size.**
   At the old 35-56px the clay modelling and the float both vanish and the file
   weight buys nothing. If a future surface can only afford ~40px, use a Lucide
   icon there instead.
4a. **The category marks have no card behind them** (owner, 2026-08-09 — the
   dark rectangles were removed after the marks were enlarged). They sit
   directly on the section background, so the drop-shadow is what separates
   them; the label colour had to move from near-white to the surface token at
   the same time. Whitespace is now the only thing grouping a mark with its own
   label, which is why the grid uses a much larger ROW gap than column gap.
4b. **`.fe-icon-tile` must stay `justify-content: flex-start`.** Grid rows
   stretch every cell to the tallest, so with centering a one-line label gains
   slack and recentres — the marks then sit at different heights across a row.
   Measured while the cards still existed: a negative margin intended to break
   the top edge was silently absorbed to -6px (no overflow at all) at 390px.
   Top-anchoring keeps all six marks on one baseline whatever the labels do.
5. **A partial upgrade inside one grid is worse than none.** One clay mark
   beside five flat line icons read as broken rather than better, which is why
   all six tiles were done together. Upgrade a set wholly or not at all.
6. Sources are 1024px cutouts; delivery is 216px WebP with alpha (5-10KB each),
   matching the project's downscale/WebP rules.
7a. **A hollow mark needs an optical SCALE on top of a corrected asset, and that
   scale is a TRANSFORM.** Trimming the ring's canvas fixed its extents and it
   still read small, because the shortfall is ink coverage: a ring is mostly
   hole, so it carries far less visual weight than a solid goldbar or phone at
   the same box. It settles at **1.12x** (1.05x inside the six-mark grid),
   reached by walking 2.2 → 1.6 → 1.25 → 1.12 on review.

   ⚠️ **Do not read that number as the whole correction — two separate fixes are
   easy to conflate.** The ASSET was also re-padded from 51% to 80% canvas fill,
   which is a 1.57x optical increase by itself. So scale 1.0 today is already
   far larger than the state originally reported as too small, and there is real
   headroom below 1.12 if it ever still reads big. An earlier version of this
   entry claimed "1.0 reads as undersized"; that described the pre-trim asset and
   is no longer true.

   **Keep the grid's value at or below the global one**; if it ever exceeds it,
   the most size-sensitive surface becomes the most boosted, which is backwards.

   Three things make that safe, and each was learned by breaking it:

   - **Scale with `transform`, never width/height.** Growing the box pushed the
     mark's own heading down and broke alignment with its siblings — a 2.2x ring
     left "We Sell Jewelry" sitting well below the other two card titles.
   - **`transform-origin: bottom center`**, so the mark grows UPWARD into
     whitespace and its baseline never moves. Card and grid labels stay aligned.
   - **Any rule that restates `transform` must carry `--clay-scale` forward.**
     `transform` is one property, so the hover tilt and the reduced-motion reset
     would each snap a scaled mark back to 1x.

   The scale lives in CSS keyed on `[data-mark]`, never inline on the component:
   inline beats every class, and a surface must be able to dial it back. A
   MATCHED SET cannot take what a lone mark can — at 2.2x in the category grid
   the ring was double its neighbours and dominated the row.
7. **Optical size is set by the ASSET's fill ratio, not by the `size` prop.**
   Each generated mark lands with a different amount of transparent margin, so
   equal boxes give visibly unequal marks. Measured across the set: fill ranged
   from **51% (ring) to 89% (pricing)** of the canvas — the ring rendered ~1.6x
   smaller than its homepage neighbours at the identical 88px box, and looked
   undersized on all six pages it appears on.
   **Fix the asset, never the per-page size.** Trim to the alpha bounding box,
   rescale so the longest content edge is ~80% of the canvas, re-pad centred and
   transparent. One edit corrects every page at once; per-page size bumps would
   have to be repeated and would drift. Re-measure with a trim pass before
   adding any new mark. (On Windows, read the file into a Buffer first — sharp
   reading and writing the same path fails with an UNKNOWN open error.)

**Fix the rendering before reaching for new artwork.** The reflex when icons
look crude is to regenerate them or drop in images; here the icons were already
correct and a one-line shim was destroying them. Generated or raster icons would
also break this entry's first rule and cost the site a crisp vector set. Genuine
icon problems that remain after rendering is correct are usually SEMANTIC — the
wrong glyph for the label — and the fix is a different Lucide import, not a
different medium.

## Product Data And Media

### Outbound partner sync sends an allow-list, fails closed on price, and never
### crosses the credential boundary

Applies to the Deep Field Gallery sync and to any future partner push.

1. **Allow-list, never a deny-list.** The outbound field set is enumerated
   explicitly (`DEEPFIELD_PRODUCT_FIELDS`), so a column added to `products`
   later is excluded by default instead of silently shipped to another company's
   database. A second, independent assert against a forbidden list **throws**
   rather than dropping the field — the caller treats a throw as "skip this
   product", which fails in the safe direction. Two mechanisms, because one
   careless edit to the allow-list should not be enough to leak.

2. **Neither side's database credential crosses the boundary.** NEJ POSTs to an
   HTTP receiver with a shared bearer token and never connects to the partner
   database; the partner never receives an NEJ Supabase key. Tokens are
   server-only env vars — a `NEXT_PUBLIC_` variant would publish the token in
   the browser bundle and must never be created.

3. **Never ship a fabricated price.** ~60 of 128 products are spot-multiplier
   with no stored price of any kind; the price is a render-time computation from
   live metal spot. When spot is unavailable, those ship a **null** price with a
   reason rather than a fallback-rate guess. A wrong price rendered on a partner
   storefront is worse than a missing one. This is the same rule
   `getMarketplaceSpotPriceError` enforces for Etsy/eBay writes. Manual and
   sold-locked prices need no spot data, so an outage degrades rather than blocks.

4. **Import `src/lib/pricing.ts`; never reimplement the formula.** Two
   independent copies of the melt/multiplier math will drift, and the drift is
   invisible until a partner's prices are wrong. One-off export scripts that
   cannot import it must be parity-tested against the app module before use.

5. **Partner pushes are fire-and-forget and non-throwing.** Call sites include
   order captures. A partner outage must never fail a customer's payment or
   block an admin save. Same contract as `handleProductStatusChange`.

6. **Hook every path that changes product state, not just the admin one.** The
   checkout sold flip happens inside the `capture_paypal_order` Postgres
   function, so no application code observes it and `adminRevalidateProduct(s)`
   is never called there. A sync wired only to the admin chokepoint leaves the
   partner advertising sold items as available. Under the no-reservation
   checkout only that function writes product `status`/`quantity` — denials,
   cancels, and refunds do not — so the complete set is the two admin
   revalidate helpers plus `paypal/capture-order` and `paypal/webhook`.

### Product rows store references, not media bytes

Images and videos never belong in Postgres as blobs/base64. New product images
go to Supabase Storage, are downscaled and encoded to WebP, and use immutable
cache headers. Public/list queries select only the columns they need.

Image cleanup is always reference-aware and dry-run-first. A remove/replace/
delete path must clean owned objects, and any new upload destination must be
added to Storage GC reference scanning.

### Product videos use staged direct Cloudflare Stream uploads

The browser uploads bytes directly to a server-provisioned TUS URL. One saved
video is allowed per product. Replacement remains a candidate until Save;
cancel deletes the candidate; permanent remove/delete is provider-first.
Only ready videos are projected publicly, and list queries do not join/poll
video state.

Marketplace video sync stays disabled until a real generated MP4 succeeds in a
controlled Etsy and eBay test.

### Product measurement contracts are explicit

`products.width_mm numeric(8,2)` is nullable and meaningful only for Necklace
and Bracelet. It stores millimeters, must be positive and no more than 1000,
and is never estimated from photos.

Every buyer-facing surface that shows a width renders it through
`productWidthDisplay` (`types/product.ts`) — shop cards, shop list rows, the
related-products strip, and the product page's Specifications row (**Width** /
**Ancho**, added 2026-08-04 between Link Type and Length). That function owns
both the Necklace/Bracelet restriction and the formatting, so a new surface must
call it rather than read `width_mm` and format its own string; otherwise the
surfaces can disagree about which pieces have a width. `width_mm` arrived in a
later migration, so any query that adds it must treat it as an OPTIONAL column
with a null-backfilling retry.

The other at-a-glance chips — purity (with its karat-graded gold gradient),
weight, and length — live once in `src/lib/product-spec-chips.ts`, together with
the neutral and measurement chip treatments. It is a plain directive-free module
precisely so client components (`ProductCard`, `ProductListRow`) and server
components (`RelatedProductsStrip`) can share it. Those four functions had
already been duplicated byte-for-byte across two components before the strip
became a third consumer on 2026-08-04; do not copy them into a fourth surface.

### Related-strip pills never wrap, and wrap uniformly when they must

Owner rules, 2026-08-04. The "You might also like" pills must never break onto a
second line; they should sit beside the price whenever they fit and drop below it
only when they cannot; they should shrink to keep sharing that line as long as
possible; and when they do drop, **every card in the strip drops together** — a
row where some cards shared the price line and others did not read as a bug.
Enforced by four things in `.related-product-*` (`globals.css`):

1. `flex-wrap: nowrap` on the pill row — the hard one-line guarantee.
2. Price and pills share one `flex-wrap: wrap` row with the pill group as a
   SINGLE flex item, so it either fits beside the price or moves down whole.
3. The CARD is a `container-type: inline-size` query container and the pill type
   is a `cqi`-based `clamp()`, with every length inside a pill in `em` so one
   clamp scales padding and gaps with it. The title uses the same container.
4. Uniformity comes from ONE card-width threshold rather than per-card flex
   fitting: `@container (max-width: 180px)` gives the pill group
   `flex-basis: 100%`. Cards in a strip are always the same width, so the
   decision is identical for all of them. The threshold must stay just under the
   narrowest card at which the worst case (widest pill row + a long price) still
   fits — too high and cards stack while they would have fitted; too low and a
   long-priced card splits from its neighbours. Re-measure if pills, prices, or
   card padding change.

The container must be the card, never the viewport: the strip is 4-up on desktop
and 2-up on phones, so a 640px viewport gives WIDER cards (262px content) than a
900px one (156px). Pill size is non-monotonic in viewport width and monotonic in
card width — a viewport media query would size them for the wrong box.

`cqi` resolves against the container's CONTENT box, not its border box; fitting
the slope against the card's outer width silently makes desktop pills ~6% small.
The bounds are fitted to real measurements. Re-measure both if the pill set,
padding, or card padding changes.

**Revised 2026-08-05** when sub-11px text was lifted off the product page: the
clamp is now `clamp(0.38rem, 0.21rem + 3.13cqi, 0.6875rem)`. Two things are worth
remembering from that change:

- **Raising the CAP alone did nothing.** At the ~244px content width these cards
  get, the preferred value already resolved to ~0.62rem — it sat *below* the old
  cap rather than being clamped by it, so the cap was not the binding constraint.
  The SLOPE is the lever that moves the common case; 2.69cqi → 3.13cqi puts a
  244px card at ~11px.
- **The lower bound stays 0.38rem.** It is the entire no-wrap guarantee: it is
  what lets a pill row shrink instead of breaking, at the ~102px cards a thin
  phone produces. Raising the floor would trade a readability win for the exact
  failure this whole entry exists to prevent. The slope change lifts wide cards
  far more than narrow ones, so the floor's behaviour is preserved — verified at
  320/375/768/desktop in both locales, one pill row everywhere.

The strip's column counts live together in `.related-product-grid`, not in
Tailwind utilities on the element: **1 column up to 360px, 2 from 361px, 4 from
768px**. The single-column band exists because a 2-up card on a thin phone is
only ~122px of content (owner: "very thin and not good looking"); below the
threshold a card gets the full measure back, so the title and pills return to
full size. Note the counts are not monotonic in viewport width — a 640px
viewport gives wider cards (262px) than a 900px one (156px) — which is exactly
why every size inside a card is driven by the container, never a media query.

New Length writes normalize inch-bearing input to a bare numeric string.
Public matching continues accepting unitless, `in`, `inches`, quoted, and
decimal-equivalent legacy forms.

The AI assistant may extract width/length only from explicit, reliable evidence
and must honor the same storage contracts as manual forms.

## Storefront

### The fixed header's height is one token, and the header obeys it

`--site-header-height` (`globals.css`) is the single source of truth for the
space the fixed `SiteHeader` occupies: `3.5rem` on phones, `4.5rem` from md up.
Crucially the header takes its `height` FROM the token rather than growing to
fit its padding, so the value is authoritative by construction instead of being
a number someone has to keep in sync with the rendered header.

That inversion is the whole point. Previously the height was implicit (padding +
logo, 57px/73px) while ~16 pages each hardcoded a `pt-16` (64px) offset and the
hero pinned at a hardcoded `4rem`. The numbers had silently diverged, so the
first 9px of every page's content sat behind the header — obvious on the
homepage announcement bar, invisible elsewhere only because those pages open
with generous section padding.

Anything that must sit exactly below the header derives from the token:
`.site-header-offset` for page tops, sticky `top`, and `calc(100svh - var(...))`
for full-height panes. Surfaces wanting extra breathing room use their own
larger padding rather than inflating the token. Because the header centers its
row inside a fixed height, the token must stay at least as tall as the tallest
row content (32px phones, 40px logo from md up). A source guard test
(`site-header-height.test.ts`) fails the build if a hardcoded `pt-16` main,
`top: 4rem`, or `calc(100svh - 4rem)` reappears.

### The purchase panel sizes against itself, and its rows stay flush

Owner request 2026-08-04: nothing in the buy panel may sit on two lines when it
could compact onto one, and the action buttons must read as a deliberate group
rather than a wrapped row.

The panel is a `container-type: inline-size` query container
(`.product-buy-panel`), and every size inside it is a `cqi` clamp. **Never size
this panel's contents with a viewport media query.** The panel is 576px wide on
a 1440 desktop, 325px at 768, and full-width on a phone, so viewport breakpoints
invert: the old `sm:grid-cols-2` stacked the value tiles on a roomy 343px phone
column while cramming them into a tighter 325px tablet column.

- The scrap-value and live-spot tiles are ALWAYS two across; their type and
  padding shrink with the panel instead of wrapping.
- The buy actions are a grid, flush edge-to-edge in both modes: one row of four
  with Add to Cart at `1.5fr` when the panel is >= 470px, otherwise Add to Cart
  full width above three equal columns. Labels are `nowrap` with fluid
  horizontal padding, so a tight cell compacts the frame rather than breaking
  the label.
- The sold-item variant is a separate case, not the same grid with two children:
  its "Inquire about a similar piece" label is a sentence, so it stays one
  full-width column until the panel reaches 500px.

Thresholds are fitted to measurements — 470px because a 1180px iPad Pro gives a
519px panel, and 500px because that sentence label needs ~255px of cell. Re-
measure before changing either, and re-check Spanish, which is the long-label
case (`Agregar al carrito`).

### The product page fills the space under the photo, and DOM order stays semantic

Owner request 2026-08-04: on every two-column viewport the info column ran far
past the gallery, leaving the lower half of the photo column empty (677px of
dead whitespace at 1440). The Specifications table therefore renders under the
gallery, and the trust badges became a full-width band beneath both columns.

Rules that must hold:

Column contents (owner's arrangement, 2026-08-04):

- **column 1** — gallery, then notes + the Shipping/Condition/Payment accordions
- **column 2** — purchase panel, description, specifications

Rules that must hold:

1. **DOM order is the semantic order and the phone order at once** — gallery,
   purchase panel, description, specifications, sold note, notes, policies. The
   h1 and price are never pushed behind a spec table for screen readers or
   crawlers, and flattening the wrappers on a phone reproduces the original
   single-column sequence with no `order` overrides at all. Visual placement is
   done entirely in CSS (`.product-detail-layout`, `globals.css`); do not
   reorder the JSX to "fix" a layout problem, and do not reintroduce `order`
   values — if a block needs one, the DOM order is wrong.
2. Below md both wrappers are `display: contents`, so every block becomes a
   sibling in ONE flat stack that reads in plain DOM order.
3. From md up the info wrapper is a real column in grid column 2 spanning both
   rows, with the gallery in row 1 of column 1 and the aside in row 2.
   `grid-template-rows: auto 1fr` is load-bearing: an item spanning tracks grows
   only the FLEXIBLE ones, so the info column's surplus height lands in row 2 and
   row 1 stays exactly as tall as the gallery. Two auto rows split the surplus
   and reopen a gap under the photo.
   The aside is ONE wrapper, not two grid items: a product with no Notes would
   otherwise leave an empty track whose gutter still prints under the gallery.
4. **At 2000px+ the rule is mirrored, because the roles invert.** The
   `ultrawide-page-wide` tier doubles the columns, so the square gallery becomes
   the TALLER column (~1120px) while the info column shrinks as its text stops
   wrapping (~790px). Keeping the aside under the gallery there stacks it onto
   the already-tallest column and makes the band ~260px taller than doing
   nothing. The aside moves into the short column under the info stack and the
   gallery spans both rows.
5. Which blocks move is a balance calculation, not a preference. The two column
   heads are fixed (gallery, purchase panel); the movable blocks are description,
   notes, policies and specs. The current split lands both columns within ~46px
   at 1200px+. If blocks are added or resized, re-measure before changing it —
   moving more content left closes the residual gap at 768-1023px but unbalances
   every width above it.
6. The trust strip keeps deliberate blank space above it (`mt-12` + `pt-8`):
   both columns end just there, so it must not butt against the accordions or
   the spec table.
7. **Stacked means centred.** Below 640px the three trust badges stack into a
   column, and both they and the policy accordions centre their content; from
   640px up the badges are 3-up and the accordions return to a left-aligned
   title with the chevron pushed right. One breakpoint drives both bands, so
   moving the badge grid's breakpoint means moving the accordions' media query
   with it or the two stop agreeing. In the centred state the accordion title
   and chevron centre together as a pair — a centred title with a
   right-pinned chevron reads as a mistake, not a layout.

### Only on-screen slideshows animate, and the STACK decides which

Established 2026-08-06 after the owner reported stutter on slideshows 2 and 3.
All three carousels were running permanently — 3 concurrent rAF loops plus 3 CSS
ring animations at every scroll position, including at rest when only one is
visible.

**`IntersectionObserver` alone cannot solve this inside the pinned frame**, and
the two reasons are both easy to reintroduce:

- **`isIntersecting` is `true` for a zero-area intersection.** Every pane's box
  grazes the viewport inside the sticky `overflow:hidden` frame. Measured: it
  returned `true` for all three panes at every scroll position — never once
  `false`. Gate on `intersectionRect` **area**, never the boolean.
- **`threshold: 0` only fires when `isIntersecting` flips.** Since it never
  flipped, the callback ran once per mount and never again. Any geometry-based
  guard here needs a threshold ladder, dense near zero.

Even with both fixed, geometry gets to ~2 loops but not 1 — a pane sliding from
ratio 0.004 to 0 crosses no rung. So `HomeHeroStack` drives a `paused` prop into
each pane, derived from the same `t1`/`t2` conditions that set `inert`. It is the
thing applying the transforms, so it is the only place that knows exactly.

Rules to keep:

1. `Carousel`'s `paused` prop wins outright — when set it stops and does not even
   observe, so no late geometry callback can restart an offscreen ring.
2. The stack writes the live-pane state **only on a transition**, never per
   frame. Per-frame `setState` here would cost far more than the loops saved.
3. Two loops during a crossing is CORRECT, not a regression — both panes are
   genuinely on screen and must both animate.
4. When measuring this, clip each ring against the FRAME's band, not just the
   viewport. A naive `rect.bottom > 0` test reproduces the very false positive
   that caused the bug and will report phantom "frozen while visible" panes.
5. The per-frame path is write-on-change: card `dataset`/`zIndex`, the cached
   ring `Animation` + duration, and the stack's scroll `travel`. Any new
   per-frame work belongs behind the same discipline — compare first, write only
   on a real change, and never call a layout-forcing reader (`offsetHeight`,
   `getBoundingClientRect` on static geometry) or an allocating API
   (`getAnimations()`) once per frame when the value changes only on resize.
   **Every one of those caches must be cleared with the window key**, since the
   cards are re-created for a new key and a stale cache silently skips a write a
   fresh card needs.

### Product-page label type has an 11px floor

Set 2026-08-05 after an audit found **46 distinct text elements below 11px** on
product pages at a 1271px desktop viewport — not only chrome, but "Scrap gold
value" and "Based on spot" at 9.3px and "This is your price" at 9.6px. The buyer
audience for estate jewelry skews older, and this was concentrated on the page
that has to close the sale.

The floor is **0.6875rem / 11px**: readable, while still small enough that these
uppercase letterspaced labels read as labels rather than body copy. Applied to
`shop/[id]/page.tsx`, `.product-value-tile-label`, `ProductTrustSections`, and
the related-strip pills. Footer headings and `text-xs` buttons at 10.4–10.88px
were deliberately left alone — they are standard sizes and site-wide.

**Two elements are exempt, for structural reasons, not oversight:**

- **`price-update-ticker` keeps a 0.5rem floor.** It is `white-space: nowrap` so
  the countdown does not reflow every second, and at a 320px viewport the Spanish
  string only fits at 8px. Raising its floor to 10px pushed the entire document
  into horizontal scroll. Its ceiling still carries the raise, so wider viewports
  gain.
- **Related-strip pills keep their 0.38rem floor**, for the no-wrap reason
  documented above.

When raising type inside the buy panel, check `white-space` first: the value
tiles sit in `minmax(0, 1fr)` grid tracks, so an unbreakable label does not
compress — it punches straight out of its track. That is why the spot pill's
LABEL is allowed to wrap while its PRICE is not.

### The reviews band is never one column, and the card compacts to allow it

Owner rule 2026-08-09: the client review blocks are a **minimum of 2-up** at
every width. The ladder is `.testimonial-grid` = **2 / 4 columns** (4 from
1160px); the pre-existing "never 3" rule stands, because the shared auto-fit
chose 3 in the ~850-1150px band and stranded the fourth review alone on a second
row. Both rules together still assume an EVEN review count — a fifth brings the
orphan back, and the answer is a sixth or a layout that centres a partial row.

Removing the one-column band moves the tight case to the narrow phone: a 320px
viewport gives a **137px card**. At the shipped 24px padding and 14px quote that
left 89px of text, about six characters per line. So `.testimonial-card` ramps
padding, quote size, caption size, and the card's internal gap down at narrow
widths rather than the grid falling back to one column. **Do not "fix" a cramped
phone card by reintroducing a single-column band** — that is the thing the owner
asked to remove.

**This is a deliberate exception to the container-query rule, and the reasoning
is what matters if the ladder ever changes.** Card width is NOT monotonic in
viewport width — the 1160px jump to four columns halves the card, 508px → 243px
— which is exactly the trap the purchase-panel and related-strip entries above
use container queries to avoid. A viewport clamp is nevertheless correct here
because the tight case sits at the BOTTOM of the range and every ramp reaches
its desktop maximum by ~590px, roughly 570px below the jump. Verified by
measuring both sides of it: at 1159px and at 1160px the padding is 24px and the
quote 14px, identical to what shipped. The moment the column ladder changes, that
argument has to be re-made — and if a future ladder puts a narrow card at a WIDE
viewport, switch to a container query rather than refitting the clamp.

The band renders on product pages as well as the homepage (one shared
`TestimonialsSection`), so it must keep satisfying the product page's 11px label
floor: the caption's ramp bottoms out at exactly 0.6875rem, and the quote's at
0.75rem.

**Quotes are truncated in CSS, never in JS.** `-webkit-line-clamp: 8` on the
blockquote, so the full verbatim review stays in the DOM for screen readers and
crawlers and the "never edit a customer's words" rule in `lib/testimonials.ts`
stays structurally true instead of merely observed. A LINE clamp is also the
right unit where a character count is not: it self-adjusts to the column, so a
508px card at 1159px truncates nothing while a 137px phone column trims exactly
what it must. Truncation is honest only because the card links out — if the
link is ever removed, revisit the clamp rather than leaving a quote that stops
mid-sentence with nowhere to finish it.

**Each card is a link to the Google Business Profile** (`GOOGLE_REVIEWS_URL`,
one constant in `lib/testimonials.ts` — a second copy would eventually point
somewhere else). The whole card is clickable via a stretched `::after` on a
small "Read on Google" link, NOT an `<a>` wrapping the figure: wrapping would
make a 480-character quote the link's accessible name and would flatten the
figure/figcaption semantics. Consequences to keep: the hover lift is
`@media (hover: hover)` so it cannot latch on after a tap, and the focus ring is
drawn on the CARD through `:has()` because the thing being activated is the
whole block, not the one line of link text.

⚠️ **The link's class must not contain the substring "card", and the reason
generalizes.** `CustomerReveal`'s `REVEAL_SELECTOR` includes
`main [class*="card"]`, so a class like `testimonial-card-link` gets stamped
`data-customer-reveal="visible"`, which applies `will-change: opacity,
transform, filter`. **`will-change: transform` makes an element a containing
block**, so the overlay resolved `inset: 0` against the link's own 130x17 text
box rather than the card — the card looked perfect and was simply not
clickable. Any stretched-link overlay added inside `main` needs either a name
that dodges that substring selector or a `data-customer-reveal-skip` attribute,
and any "why is my absolutely positioned overlay the wrong size" question in
this codebase should check `will-change` on the ancestor chain first.

### Always-mounted off-canvas panels must cap their width at the viewport

Established 2026-08-05 from a real bug. `WishlistDrawer` used `w-full max-w-sm`
(384px) with no viewport cap, while `CartDrawer` correctly used
`max-w-[min(28rem,100vw)]`.

These panels are **always mounted** and hidden with `translateX(100%)` rather
than unmounted. A panel wider than the screen therefore parks that much past the
right edge and drags the document into horizontal scroll — and because it is also
`w-full`, it then measures against the document it just widened, so the overflow
feeds itself (it settled at 343px on a 320px viewport).

Any new off-canvas panel following this pattern must cap at `min(<design>,100vw)`.
The failure is invisible on a desktop viewport and only shows on a narrow phone,
which is exactly why it survived until an audit measured for it.

### The homepage announcement bar never wraps

Owner rule 2026-08-04: the strip holds ONE line at every width. It is `nowrap`
with a fluid `clamp()` type size, so the text compacts rather than breaking and
doubling the bar's height (55px → 31px on a 375px phone). Letter-spacing stays
in `em` so the 0.22em tracking — roughly a third of the strip's width at full
size — shrinks with the type instead of forcing the break.

Fit the clamp to the SPANISH strings, which are the long ones; a ramp fitted to
English overflowed Spanish by 14px at 320px. **Re-measure both locales at 320 if
the copy ever changes** — that is the combination that overflows.

**It is a promotion, and it is a link (2026-08-11).** The strip advertises the
free-evaluation offer as this-month-only and is an `<a>` to `/free-evaluation`
(`/es/free-evaluation` in Spanish, via the usual
`${locale === 'es' ? '/es' : ''}${path}` convention).

Two rules for whoever edits the copy next:

1. **Do not name the month.** "This month only" stays correct forever; "August"
   is wrong on 1 September. Naming it would also have to be computed at render,
   and the homepage is statically generated — the month would freeze at whatever
   the last deploy was, which is worse than either option.
2. **The trailing arrow lives outside the mapped list**, so it shows at every
   width. It is the only cue the strip is tappable, and phones are where it is
   most likely to be tapped.

The old 780px third-item reveal is **gone** — the promo is two fragments and both
fit everywhere. Measured at 320px, the tightest case: English 183.4px of 304px
available (**120.6px slack**), Spanish 203.9px (**100.1px slack**), one line, no
overflow. Reinstate the `display: none` + `@media (min-width: 780px)` pair only
if a third fragment comes back.

⚠️ **This is time-limited copy.** When the promotion ends, the strip needs new
wording — nothing expires it automatically, by design.

**The bar rides inside the pinned hero frame (2026-08-11).** Owner: it "doesn't
scroll away until the hero txt does". It is passed to `HomeHeroStack` as a
`banner` prop and rendered as the frame's first child, above
`.home-hero-stack-viewport`, which now wraps the panes and the overlay.

Why inside the frame rather than a second sticky element: the frame IS the
pinned thing, so the bar and the hero text share one release point by
construction. Any design with the bar sticky in page flow would need its own
release offset kept permanently in sync with the hero's — two numbers that drift.

The frame's own height is deliberately unchanged at `100svh - header`. That
matters more than it looks: both the scroll progress and the touch snap step are
`runway.offsetHeight - frame.offsetHeight`, so leaving the frame alone leaves the
entire choreography and the one-slideshow-per-flick snap untouched. The panes
absorb the bar's height instead — they are `inset: 0` against the new viewport
box and their transforms are PERCENTAGES of pane height, so a shorter pane scales
the crossing proportionally rather than desynchronising it. Do not "fix" this by
shrinking the frame or hardcoding the bar's height; the bar's height is fluid
with the clamp above (34.9px at 1286px, 31.2px at 375px).

Measured at both widths and both locales: bar top pins at exactly the header
height through 0/25/50/90% of the runway, then bar, frame and overlay move
together — `barTop === frameTop` at every sample.

### `/shop` is the only storefront entry

Search, filters, view, sorting, per-page, and pagination remain URL-backed.
Categories are explicit merchandising scopes; item types remain navigable
catalog values and may include admin-created custom types.

Public browse shows Available and optionally Sold products. Draft,
Pending Payment, and Archived remain private. Sold-price masking is a display/
structured-data policy and never erases product/order price history.

The public status filter always selects exactly one state. Available is the
default for bare, cleared, or invalid shop URLs; Sold inventory is shown only
after the shopper explicitly selects Sold. Available is the baseline rather
than an extra active-filter count.

### The homepage hero is a scroll-pinned THREE-slideshow parallax stack

`HomeHeroStack` pins the hero in a sticky, overflow-hidden frame while a scroll
runway (hero height + **240svh**) drives the choreography. Only the SLIDESHOWS
move: each pane exits upward while the next RISES FROM BELOW, the two crossings
overlap so motion never stops, and the frame un-sticks as the third locks. The
headline, sign-up form, CTA buttons, and legibility halo live in a pinned
overlay layer that never moves until the frame itself releases.

**The runway is only the scroll BUDGET.** Each pane always travels exactly one
frame height, so changing it changes the SPEED of the handover, never its
extent: a crossing spans 0.61 of the runway, so scroll-per-full-pane-travel is
`0.61 × runway`. At 240svh that is ~146svh of scroll per 100svh of pane
movement (~0.7×, calmer than 1:1). The `PHASE_*` fractions divide whatever
budget is set, so they do not need re-tuning alongside it. Lower it for a
snappier, more parallax-y hero; raise it toward and past 1:1 for a calmer one.
Whenever it changes, re-check frame coverage across the runway — the overlap in
5b is what keeps it hole-free, and a different budget changes nothing about
that geometry but is cheap to confirm.

**On touch the runway is only HALF the speed story.** Once the snap is driving
(see *"On touch, the hero snaps exactly one slideshow per gesture"*), the panes
move one frame height over `SNAP_STEP_MS`, which the runway does not affect at
all. Changing one without the other slows only half the experience.

Runway history — 290svh → 110svh (2026-08-06, "fit the handover into roughly
one screen") → 240svh (2026-08-09, "way too fast"); the 110svh figure cost less
than it looks because the touch snap now scrolls the runway for the visitor.
Detail in CHANGELOG under those dates.

**This is the longest entry in this file. Rule index** — the labels are
historical and out of sequence, so use this to find the one you need. Do not
renumber them; the labels are referenced from other rules:

| | Covers |
|---|---|
| 1 | Pane vs overlay split — exactly one h1/form/CTA set |
| 2 | `inert` only when fully offscreen; imperative transforms |
| 3 | Overlay light/dark theme follows the dominant pane |
| 4 | Frame mirrors the dominant pane's background |
| 4a | Departing-pane fade + frame backdrop are a PAIR — **mask, not opacity** |
| 5 | Three slideshows, everything rises upward; `PANE_A_TRAVEL` = 85 |
| 5a | Crossings are eased; the phase logic is not |
| 5b | `PANE_A_TRAVEL` as the seam control; re-measure coverage if changed |
| 5c | No slideshow may MOUNT during the scroll |
| 5e | The two crossings OVERLAP; the 0.36 ratio and equal lengths |
| 5f | Pane overlap ≠ ring separation; `RING_PULL_PCT` |
| 6 | Seam feathers — both edges at once, widths unclamped |
| 7 | `prefers-reduced-motion` collapses the runway in CSS alone |
| 8 / 8a / 8b | Twin lineup tables; picker hides selected; sold pieces allowed |
| 9 | Random draws are a FILL action, never a live source |
| 10 | Ring direction alternates down the stack |
| 11 | Deferred mounting (continues 5c) |

Related entries elsewhere in this file: *"Only on-screen slideshows animate"*
(the pause/liveness rule these refer to), *"One solid background per
slideshow"*, *"On touch, the hero snaps exactly one slideshow per gesture"*,
and *"Every carousel card paints the backdrop its own photo was shot against"*.

Rules that must hold:

1. `HomeHero` is the slideshow pane only (carousel + its solid background +
   spinner); `HomeHeroOverlay` owns the headline/form/CTAs/halo. The stack
   composes two panes plus ONE overlay, so the page always has exactly one h1,
   one subscribe form, and one set of CTAs — never duplicate the overlay.
2. A slideshow pane is `inert` only while fully offscreen; during the crossing
   both stay interactive. Transforms are imperative per scroll frame, never
   React state.
3. The overlay's light/dark text theme follows the DOMINANT slideshow, each
   crossing handing over at its own midpoint. Since 2026-08-09 it is derived by
   relative luminance from each pane's SOLID background color (static per pane),
   not reported per-photo via an `onThemeChange` callback — that callback no
   longer exists.
4a. **A departing pane FADES over the tail of its exit, and the frame paints the
   DOMINANT pane's backdrop.** These two are a pair — either alone fails.

   Because `PANE_A_TRAVEL` is below 100, the departing pane never clears the
   frame; the strip still in view late in a crossing is bare backdrop, since its
   ring left the top long before. At full opacity that reads as a hard bar
   (measured at p=0.50: an 8% band of opaque black above the arriving white
   slideshow). Fading it dissolves the band instead of sliding it out — but
   fading only reveals the FRAME, so the frame must already show the incoming
   backdrop or the same bar comes straight back.

   **The durable rule, and the reason it cost three attempts to find: reach for
   a MASK, not opacity, whenever the fading layer is a large solid area whose
   color differs from what is behind it.** `opacity` applies to the whole pane,
   so a black pane fading over a white frame does not read as "leaving" — it
   reads as a flat GRAY RECTANGLE (measured: 27% of the frame at opacity 0.36,
   compositing to a uniform `rgb(163,163,163)`). Black fading over white passes
   through every gray on the way, so NO value of `FADE_TAIL` avoids it — the
   fade was being applied to an AREA when the problem was an EDGE.

   So the dissolve is spatial (`A_EXIT_DISSOLVE_PCT`, a bottom-anchored mask
   sized to reach past the arriving pane's top edge into the band above it), and
   `FADE_TAIL` = **0.45** does only what opacity is good at: removing the last of
   the pane at the very end, where the area is small. (It was tuned up to 0.75
   chasing the gray before the diagnosis landed; CHANGELOG 2026-08-07/08.)

   Switching the frame on dominance rather than blending is safe ONLY while the
   panes fully cover the frame at that instant — verified 100% opaque coverage at
   both flips. If pane travel, timing, or the fade ever change, re-check that
   before trusting the switch, or a black→white jump becomes visible.

4. The frame mirrors the DOMINANT pane's background, because anything the panes
   do not fully cover — a feathered edge, a fading one — shows the frame
   through it. That mirroring is what makes those edges read as continuous
   canvas rather than a hole. It followed the dominant pane's live SWEPT
   background from 2026-08-07 (mirroring hero A alone before that caused the
   black bar in 4a); since 2026-08-09 the sweep is gone and it paints the
   dominant pane's SOLID color — same dominance midpoint switch, same
   full-coverage safety argument.
5. There are THREE slideshows handing over in sequence (A→B, then B→C), with the
   crossings overlapping and no hold anywhere (see 5e).
   **Everything travels UPWARD: a pane exits up and the next RISES FROM BELOW**
   (owner request 2026-08-06), so the hero reads as one continuous upward scroll.
   This direction has been chosen deliberately TWICE — do not "restore" the
   descending arrangement from any older note. B is the only pane that
   both arrives and departs, so its transform carries both crossing terms and its
   feather takes whichever crossing is currently moving it. Timing lives in
   `PHASE_1_END` / `PHASE_2_START` / `PHASE_2_END`; adding or removing a slideshow
   means re-splitting those and resizing the runway to match. Pane travel is fixed
   at one frame height (offscreen at rest, flush when locked), so `PANE_A_TRAVEL`
   is the only depth/seam control — **currently 85** (see 5b; it was lowered
   100 → 95 → 85 across 2026-08-06 as the owner asked the join to keep
   tightening, and a >100 differential was trialled and reverted).

   The panes' resting transforms in CSS (`--b` / `--c` at `translate3d(0,100%,0)`)
   must match the value the scroll handler computes at t=0, or a pane jumps on the
   first frame after hydration.

5c. **No slideshow may MOUNT during the scroll.** B and C both arm off the
   critical path — B on first scroll-intent or idle, C one idle callback after B
   — and never from inside the scroll handler. C previously armed at `p > 0.12`,
   and profiling on 2026-08-06 found that mount was the single worst frame in the
   entire hero scroll: 41.4ms against a 16.7ms median, on the exact frame it
   mounted. A carousel mount is a React render plus ring construction plus image
   decode; anywhere on the scroll path it is a visible hitch. Staggering the two
   arms keeps them out of the same frame. Mounting early is cheap because a pane
   mounts already `paused` (see the separate entry *"Only on-screen slideshows
   animate, and the STACK decides which"*) — it is in the DOM but not animating.

5f. **Pane overlap and RING separation are different axes — do not confuse them.**
   Each pane is full-frame with its carousel centred, so consecutive rings sit
   ~one frame apart however much the PANES overlap. `PANE_A_TRAVEL` tightens the
   seam between panes; it does nothing about how far apart the PHOTOGRAPHS are.
   `RING_PULL_PCT` is the control for that (owner, 2026-08-06: "tighten the three
   carousels closer vertically").

   The pull must peak mid-crossing and be zero at both ends (`4e(1 - e)`), not be
   a constant. A ring box spans ~14.9%-85.1% of the frame — ~70% tall with ~15%
   headroom — and a constant lift is capped by that headroom, because any more
   makes an arriving pane's ring poke into frame while its pane is still parked
   below at rest. That ceiling bottoms out near 75% separation, short of the ~70%
   needed for the rings to overlay at all. Peaking mid-crossing sidesteps it
   entirely: at rest and when locked the pull is 0, so the designed composition
   is untouched and nothing peeks, while mid-crossing it reaches ~62%.

   When measuring any of this, use the RING box, never the cards: the cards are
   3D-transformed and project to ±3600% of the frame. Expect a few percent of
   noise even on the ring box, since its projection breathes as the ring rotates.

5e. **The two crossings OVERLAP, and the overlap size is load-bearing.**
   `PHASE_2_START` is deliberately BEFORE `PHASE_1_END` (owner, 2026-08-06:
   "overlap the crossings so it never stops"). There is no hold between them —
   B sweeps through flush rather than resting there.

   **There is no hold at the END either.** `PHASE_2_END` is exactly 1 (owner,
   2026-08-07), so C reaches flush on the same frame the runway ends and the
   sticky frame unpins; its ease-out and the page starting to scroll away
   coincide, leaving no stationary stretch anywhere in the hero. Measured: the
   runway tail no longer flatlines, still moving at 26% of peak at release.

   Pinning the end point makes the other two values DETERMINED, not free — with
   equal crossing lengths L and the 0.36 ratio, `(2L - 1)/L = 0.36` gives
   L = 1/1.64 = 0.61, hence `PHASE_1_END = 0.61` and `PHASE_2_START = 0.39`.
   Re-solve the same way rather than nudging them independently, or one of the
   invariants silently breaks.

   **Touch uses a different curve, and the 0.36 overlap still holds.** Since
   2026-08-08, `pointer: coarse` drives the crossings with smootherstep
   (`t³(6t²−15t+10)`) so each slideshow snaps into place under a finger drag;
   wheel/trackpad keeps smoothstep, where the same curve reads as sticky. The
   overlap ratio is expressed in units of the crossing clocks, not the curve, so
   it is unaffected — but note the touch curve's peak slope is **1.875**, not
   1.50, so any future "fraction of peak speed" figure quoted below must be read
   against whichever curve is active.

   Both curves share EXACT endpoints. That is a hard requirement, not a nicety:
   the resting/flush/locked positions, the inert-live thresholds and the CSS
   resting transforms all assume t=0 and t=1 land precisely. Any replacement
   curve must too — `src/lib/__tests__/hero-easing.test.ts` enforces it.

   **Butting them is not enough.** Smoothstep's derivative is zero at BOTH ends,
   so `PHASE_2_START == PHASE_1_END` hands over from a term decelerating to zero
   to one accelerating from zero: the velocity still touches nothing and still
   reads as a pause. What matters is how far into its curve the incoming crossing
   is when the outgoing one finishes — keep
   `(PHASE_1_END - PHASE_2_START) / (PHASE_2_END - PHASE_2_START)` near **0.36**.
   At 0.20 the incoming crossing is still on the flat part of its curve (slope
   0.97 of a possible 1.50) and the dip was perceptible; at 0.36 it is 1.38/1.50
   and the handover holds ~72-90% of peak speed.

   **Both crossings must also be the SAME LENGTH.** They were 0.47 and 0.54 —
   crossing two ran 15% longer, so the handovers moved at different speeds and
   the spacing between slideshows visibly changed from one to the next (owner,
   2026-08-06: "dynamic distance between the first, second and third"). Equal
   lengths brought the two crossings' minimum ring separation to within 1.6
   points of each other.

   Cost, accepted knowingly: within the overlap band all three crossing clocks
   are active, so the phase-based liveness (see *"Only on-screen slideshows
   animate"*) marks all three panes live and
   3 rAF loops run for ~11% of the runway even though only 1-2 panes are on
   screen. At rest it is still 1. Fixing that would need a coverage-aware
   liveness test instead of a phase-based one.

5a. **Crossings are EASED; the phase logic is not.** Scroll progress is linear, so
   a pane driven by raw `t` moves at constant speed and then stops dead at its
   clamp — a velocity discontinuity that reads as a jolt into the hold no matter
   how short the hold is. That was most of what the owner reported as "pausing"
   on 2026-08-06. `ease(t) = t²(3−2t)` drives the transforms and feathers; the
   RAW `t` still drives the inert/live thresholds and the dominant-pane handover,
   which test which phase we are in and would only be blurred by easing. The ease
   must keep exact endpoints (0→0, 1→1) — the resting/locked positions, those
   thresholds, and the CSS resting transforms all assume t=0 and t=1 land
   precisely. (There are no holds left to jolt into — they were shortened, then
   removed entirely when the crossings were overlapped; see 5e. The easing is
   what makes that safe.)

5b. **`PANE_A_TRAVEL` is the seam control, and below 100 it is load-bearing.**
   The seam is `t × (PANE_A_TRAVEL − 100)`: above 100 leaves a real gap of open
   frame, 100 butts exactly, below 100 the arriving pane overlaps the departing
   one. It is **85**, giving a ~15%-of-frame overlap, so the
   arriving pane's feathered top blends over the outgoing photograph instead of
   fading to backdrop — that fade-to-backdrop is what made the join read as a
   band of empty space. **At any value below 100 the departing pane never fully
   clears the frame**; that is only safe because the arriving pane is flush and
   higher in the stack by then. If the stacking order or the arrival geometry
   ever changes, re-measure frame coverage across the whole runway before
   trusting it — it was verified at 100% with no holes, not assumed.
6. The two sides of a crossing feather DIFFERENT edges, because they are the two
   halves of ONE seam: the departing pane's BOTTOM edge leads it up and out, and
   the arriving pane's TOP edge is what climbs into the frame. Each is a
   scroll-driven `mask-image` that reaches zero where the edge is offscreen or
   flush — A unmasked at rest, B unmasked while locked, C unmasked once locked.
   Those endpoints must stay full-bleed; a feather on a resting or locked edge
   visibly fades the hero.

   **THE PHASES DO OVERLAP, and a pane can be arriving and departing at the same
   time.** `PHASE_2_START` is **0.39**; `PHASE_1_END` is **0.61**. For p in that
   window pane B needs BOTH masks at once. An earlier `if (t2 > 0) … else …`
   picked one, on a comment asserting the phases could not overlap — false ever
   since the crossings were deliberately overlapped so motion never stops. The
   effect was B's top feather snapping to zero the instant phase 2 opened,
   measured as an instant 12.56% → 0 jump mid-crossing (2026-08-08). One
   `setPaneMask(pane, topPct, bottomPct)` emitting a single gradient with both
   ramps is the fix; never reintroduce a one-edge-at-a-time branch.

   **Feather widths are NOT clamped to the overlap, and the old clamp was
   actively harmful.** `EDGE_FEATHER_PCT` / `FEATHER_OVERLAP_SHARE` /
   `featherFor()` existed for the era when arriving panes DESCENDED and opposed
   panes could expose real uncovered frame. With panes RISING, the departing pane
   covers everything above the arriving pane's top edge for the whole crossing,
   so a wide feather always lands on a photograph, never on backdrop. Capping at
   70% of a 15% overlap held the join to a 2–5% ramp — narrow enough to read as a
   line, which is precisely the complaint it was supposed to prevent. Sizes are
   now independent: `A_EXIT_DISSOLVE_PCT` (departing, scaled by `e`, must exceed
   the `15 * e` gap to the arriving pane's top edge) and `B_ARRIVE_FEATHER_PCT`
   (arriving, `4e(1-e)` so it PEAKS mid-crossing where the seam is most exposed —
   the old `(1 - e)` profile was backwards and collapsed to ~2% exactly when it
   mattered most).

   Widths are a PERCENT of pane height, not rem, so they share units with the
   overlap and do not drift with root font size.

   **What the feather cannot fix:** if neighbouring lineups have different
   backdrop colours (a black-backed slideshow handing to a white-backed one), the
   join is a genuine change of content and stays visible however wide the overlap
   or soft the ramp. That lever is curatorial — group lineups so neighbours share
   a backdrop — not mechanical.

   The hero's bottom separator border lives on the frame, never on the slideshow
   sections, so no border sweeps mid-frame.
7. `prefers-reduced-motion` collapses the runway to the frame height via CSS
   alone (no travel, panes B and C hidden), so there is no hydration
   divergence.
8. Slideshows B and C each have their own curated lineup in a twin table
   (`carousel_selection_alt`, `carousel_selection_third` — twins, not slot
   columns, so each keeps its own product_id primary key and one product may
   appear in any or all lineups). An empty or unmigrated later lineup makes
   that slideshow mirror A — reads return [] and never fail the payload. All
   lineups ride the one cached home payload and the `home-carousel` tag. Each
   lineup is an explicit saved list; `carousel_settings.selection_mode` /
   `selection_mode_alt` / `selection_mode_third` are always written `manual`.
8a. The available-products picker hides anything already in the active
   lineup (owner request 2026-08-04). It is derived from `products` minus the
   current selection, never a second stored list, so removing a piece from the
   order list returns it immediately and each lineup tab computes its own.
   Duplicates were already impossible — the picker is a toggle guarded by an
   `includes` check — so this is a clarity rule, not the duplicate guard.
8b. Slideshow lineups may contain SOLD pieces (owner decision 2026-08-04).
   The admin picker and random fills work from one of three lists — All,
   Available (default), Sold — where "All" spans exactly the two public
   statuses; draft/pending-payment/archived never enter a slideshow. The
   storefront curated fetch admits available OR sold, but a sold item's
   `priceLabel` is nulled at fetch so the hero can never caption a sold price
   (sold-price masking policy); a sold card simply links to its product page,
   which shows it is sold. Sold pieces wear a SOLD chip throughout the panel.
   Keep the panel's initial catalog load on 'all' — it is what resolves
   thumbnails for saved sold pieces while a narrower list is active.
9. Random draws are a FILL ACTION in the admin panel, not a live source
   (owner direction 2026-08-04). Each of the three buttons — gold jewelry,
   silver jewelry, non-jewelry — replaces the active lineup with a fresh draw
   that then behaves exactly like a hand-picked one: reorder it, recolor it,
   remove or add pieces, and save. This is deliberate and the two models are
   mutually exclusive: a mode that re-drew server-side on every cache rebuild
   would discard the admin's arrangement, so if a live rotating source is ever
   wanted again it must NOT also be editable. Non-jewelry spans both metals on
   purpose: it is the catalog's "everything else" (coins, bullion, flatware),
   not a metal-first choice. The metal constraint is pushed to the database;
   the jewelry test is applied in code because it is inferred from type/tags
   (`isProductJewelryItem`), the same rule behind the shop's Jewelry & Watches
   filter — `carousel-lineup-modes.test.ts` asserts the two sets stay in step.
   The server-side random resolution and the mode columns remain in place and
   still honour a stored random value (legacy `random_gold` / `random_silver`
   map forward to their `_jewelry` equivalents), but nothing in the UI sets
   one, so any stored mode converts to `manual` on the next save.
10. Ring direction ALTERNATES down the stack: A right-to-left, B reversed
   (left-to-right), C right-to-left again — B is the only pane passing the
   Carousel `reverse` prop. Reversing is not just
   `animation-direction: reverse`: the per-frame sample must mirror its
   clock-derived angle and flip its hidden-back crossing test, or the photo
   windowing silently tracks a mirror image (pre-2026-08-09 the sweep and
   theme depended on this too). Change spin direction only through that prop.
11. Deferred mounting, continued from 5c: neither later pane mounts under
   reduced motion, and server HTML always carries exactly one carousel.
   Combined with the pause rule, at most the panes in a visible crossing
   animate. Do not mount later panes eagerly, and do not unmount panes on
   direction changes — remount re-decodes images and shows as pop-in.

### Every carousel card paints the backdrop its own photo was shot against

A card is a fixed square with `border-radius: 1.5em`, but its photo is
`object-fit: contain` — the radius rounds the element box while the photo is
letterboxed inside it. So a photo whose bars are wider than 24px shows its own
square corners, and a near-square photo gets clipped round. That inconsistency
is only *visible* when the padding colour differs from the photo's backdrop, so
the rule is: **match the padding to the photo and the seam disappears** — do not
try to round the photo itself. `object-fit: cover` would crop clasps and
hallmarks, and dropping the radius changes the whole hero's look.

The colour comes from `paddingBgForProductRow` (`carousel/lib/carouselConfig.ts`),
which reads the product's own `image_padding` / `image_padding_by_image` — the
same stored field that paints the product page background. **Every path uses it**:
the random draws (`fetchRandomLineupItems`, and the admin Random fill
`fetchRandomSampleItems`) from 2026-08-04, and the CURATED path from 2026-08-07.
Never reintroduce a hardcoded white default on any of them; that is what put white
bars around black-backdrop photos. An unset padding still returns null and
inherits the global carousel colour.

**A curated selection row's White/Black group WINS when set — but must not be
assumed set.** The curated path originally skipped the padding columns entirely
on the reasoning that "a curated entry stores its group on the selection row".
That is only true if whoever added the row set the swatch: three rows in
`carousel_selection` stored NULL and painted white bars behind black chain
photos, with no fallback on that path to catch it. The curated query now requests
the padding columns too and falls back when `bg_color` is NULL.

Keep the two readers in step — `src/lib/home-carousel-server.ts` feeds the live
hero and `carousel/lib/carouselData.ts` feeds the admin preview. If only one gets
the fallback, the preview and the storefront disagree about the same lineup.

(A former consequence noted here — the hero's swept background following the
same per-photo colour — is gone as of 2026-08-09: the section background is now
one solid color per slideshow, and the per-photo colour paints ONLY the card's
own padding. See "One solid background per slideshow".)

### One solid background per slideshow — the per-photo sweep is removed

Owner decision 2026-08-09, removing a feature rather than tuning it. The hero
background used to follow each photo's backdrop to the front (a per-frame
gradient whose seam swept as the white/black arcs rotated). With a lineup
mixing white- and black-backdrop pieces the whole hero flipped between black
and white as the ring turned, and a same-day regression had it rendering gray.
The owner chose to delete the mechanism: each of the three slideshows now shows
ONE admin-chosen solid color for its whole time on screen.

Rules that must hold:

1. **The color belongs to the slideshow slot, not the lineup.** `bg_color`
   (Slideshow 1, pre-existing), `bg_color_alt`, `bg_color_third` on
   `carousel_settings` (`add-slideshow-bg-colors.sql`, run + verified
   2026-08-09). A missing/NULL later column INHERITS Slideshow 1's color — the
   pre-migration inherit rule, pinned by `slideshow-bg.test.ts`. A lineup that
   mirrors A still uses its own slot's color.
2. **Per-photo White/Black groups stay** — they paint each CARD's padding
   (the "match the padding to the photo" rule above). They no longer influence
   the section background, and `groupByBackground` (white-arc/black-arc
   ordering, which existed only so the sweep had exactly two seams) is deleted;
   lineups render in curated order everywhere.
3. **The overlay text theme derives from the dominant pane's color by relative
   luminance** (`isDarkHex` in `HomeHeroStack`), not a black-only string match
   — the admin picker accepts any hex. Static per pane; flips only at crossing
   midpoints with the dominance handover.
4. **A crossing between two slideshows with different colors shows the color
   change at the handover midpoint.** Inherent and accepted — the lever is
   curatorial (give neighbours the same color), the same stance the feather
   rules above already take for photo content.
5. **`normalizeSlideshowBg` lives in `carouselConfig.ts`** (pure) and is the
   single normalizer for the admin panel, `carouselData`, and
   `home-carousel-server` — the two readers must not disagree about settings.
   It cannot move into `carouselData`: that module instantiates the Supabase
   browser client at import time, which breaks any test importing it.
6. Do not resurrect the sweep from older notes: `computeSweepBackground`, the
   `onFrontItemChange`/`onBackgroundChange` callbacks, and per-photo theme
   reporting are gone deliberately, and their removal is also a large chunk of
   the hero's per-frame cost reduction (the carousel's rAF loop now does only
   windowing + facing/z hit-testing).

### On touch, the hero snaps exactly one slideshow per gesture

Owner request 2026-08-09 ("each carousel should snap more strongly; one scroll
can propel the user straight past a carousel"), plus a follow-up ("way too
fast, slow it down a lot"). Both live in `src/lib/home-hero-snap.ts` + a touch
handler in `HomeHeroStack`. Rules:

1. **The step is measured from where the gesture BEGAN, not where it ended.**
   That is the entire overshoot fix: a hard fling can cross most of the runway
   before the finger lifts, and stepping from the release position would land
   on the slideshow after next. Verified: a fling that dragged the page nearly
   to C still settles on B.
2. **B's snap point is SOLVED, never declared.** B never rests — the crossings
   deliberately overlap, so B only passes through flush. Its snap point is the
   bisected zero of its transform under the ACTIVE easing curve (touch uses
   smootherstep, so the flush point differs from the pointer curve's). Derived
   from the same PHASE_*/PANE_A_TRAVEL constants the scroll handler uses, so a
   retune moves the snap point automatically; `home-hero-snap.test.ts` pins
   flushness, monotonicity, and the one-step cap.
3. **Two speed dials, and they are different things.** `SNAP_STEP_MS` (1000)
   is what a phone visitor actually watches — the snap moves the panes one
   frame height over that duration regardless of runway. The runway (240svh)
   governs only the MANUAL drag. Changing one without the other slows half the
   experience. The snap duration is progress-based, never pixel-based — a
   pixel formula silently retunes itself with viewport height and runway edits
   (the original 400ms was exactly that accident).
4. **Touch only** (`pointer: coarse`), same signal as the snappier easing
   curve and for the same reason: a wheel arrives in notches and hijacking it
   fights the visitor. No snap at either runway end (leaving the hero stays
   free), never under reduced motion, and a wheel/keydown cancels an in-flight
   snap. The snap reasserts `scrollTo` every frame — a one-shot loses to
   platform momentum. The momentum override is the one piece synthetic touch
   cannot prove; it is owner-verified on a real phone.

### A crowded shop-card date drops its "Ca." prefix — it never moves or reformats

Owner rule, 2026-08-09, stated generally: **whenever the date field gets too
crowded, remove the "Ca." to fit rather than using another format method.** It
governs future changes to this label, not just the one that prompted it.

The card's price row carries three things — the date (absolute, left), the price
(centred, in flow) and the width chip (absolute, right). `Ca. 1960` is 55px, the
catalog's widest price is 67px (`$2,394.56` — `$34,999` is only 55px, decimals
are what cost width), and the chip is 41px, so keeping the prefix needs about
187px of row. Real rows are often narrower than that, so the prefix goes.

- **The prefix is its own `.modern-card-date-prefix` span** so CSS can drop it
  without touching the year. Do not merge it back into the text node.
- **The threshold is keyed to the WORST-CASE price, not the typical one** —
  `2 x (55 - 7.2 + 4) + 67 ≈ 173px`, so the rule fires below 185px of content
  width. One colliding card is the bug; CSS cannot know a given card's price
  width, so the widest is the only safe basis. Re-derive if the label size, the
  row padding, or the catalog's widest price changes.
- **The query container is the ROW, never the viewport.** Row width is not
  monotonic in viewport width — 273px at 320px (grid 1-up), 161px at 390px
  (2-up), 201px at 472px, 177px at 1280px (4-up, a filter sidebar takes the
  rest). A media query would size for the wrong box, and checking only the
  extremes proves nothing about the middle. This is the same trap as the
  purchase panel and the related-strip.
- **Rejected: moving the date to its own line.** It was built and it collided
  nowhere, but it added ~14px of height to every card at every width, desktop
  included. The owner's rule is explicitly that the field shrinks in place.

Two mechanical notes for anyone editing these rules: the date carries its
positioning in a JSX inline `style` attribute, so any override needs
`!important` **and** must reset `transform` alongside `position`; and this
stylesheet is a template literal, so a single backtick anywhere inside it —
including in a comment — terminates the string and 500s the route.

### Shop-card photos: swipe + windowed dots on touch; hover affordances are mouse-only

Owner requests 2026-08-09 (dots replacing the progress bar, swipe, floating
dots, arrows removed on touch, keep-until-another-card-is-swiped). The rules
that must survive refactors:

1. **The swipe runs on NATIVE non-passive `touchmove` listeners, not React
   pointer events.** By spec, preventDefault on pointermove cannot stop
   scrolling; the only levers are `touch-action` (and `pan-y` deliberately
   permits vertical panning) and a cancelable touchmove. With pointer events
   the browser claimed the gesture and fired pointercancel before any
   threshold was reached. Direction locks at a 5px slop — it must beat the
   browser's own commit — with the horizontal cone widened to ~51°
   (`atan(1.25)`) because a thumb crossing a ~166px card always drifts.
   Vertical gestures are never claimed; the photos are most of the grid's
   scrollable surface.
2. **A swipe suppresses the trailing click one-shot, and the flag is cleared
   on the next touchstart.** A preventDefault'd swipe produces NO trailing
   click, so nothing consumes the flag — left standing, one swipe silently
   swallows the visitor's next genuine tap on the product.
3. **At most one card in the grid is off its cover photo**
   (`src/lib/shop-card-photo-focus.ts`, plain subscribe/notify — not context,
   which would re-render the grid per swipe). The last-swiped card holds its
   photo indefinitely; a DIFFERENT card being swiped snaps it back. A swipe
   that cannot advance (already at an end) must not claim focus — it would
   blank another card while visibly doing nothing. This replaced a revert
   timer, built and discarded the same session.
4. **Dot indicators are windowed at 7** (`src/lib/shop-card-dots.ts`): cards
   carry up to 20 photos against a ~166px frame. The window centres on the
   active photo; the outermost dot on a truncated side tapers, and that taper
   is the only "more photos" signal — never drop it as decorative. Dots are
   indicators only (`pointer-events: none`). Pointer devices: scrim pill,
   hover-revealed. Touch: permanent and FLOATING — no pill, so each dot
   carries its own contrast (fill + hairline ring + halo; on the lightest
   frame the fill alone is 1.04:1, so the ring is load-bearing on white and
   the fill on black). Position note: dot position ≠ photo index past photo 4
   — read `data-current-image` when verifying.
5. **Bottom chrome geometry is a matched set.** Dots sit on the photo's bottom
   edge; the brand/link flag is lifted just above the dot row; the arrows are
   BOTTOM-ALIGNED to the flag (the two flag variants are 18/24.9px tall and
   share only their bottom edge, so centre-alignment is wrong for one of
   them); arrows are `display:none` under `hover: none` — swipe + dots replace
   them, mirroring the product page below 768px. Re-measure the set together.
6. **Hover affordances are gated to `pointerType === 'mouse'`**, and the
   touch/mouse mode follows the MOST RECENT input rather than latching — on a
   hybrid device (touchscreen laptop) one early swipe would otherwise disable
   that card's mouse-leave reset for the session. Touch fires pointerenter
   too; ungated, a tap would start the hover auto-cycle and walk away from the
   photo the visitor just swiped to.

### Homepage carousel uses one server-authoritative initial payload

The localized homepage reads `carousel_selection` and `carousel_settings` on
the server and renders that result into the initial HTML. `HomeHero` must not
perform a second client-side selection/settings fetch after hydration. The
read is cached for five minutes under the `home-carousel` tag; successful
Admin carousel saves invalidate that tag immediately. Bundled carousel products
remain a resilience fallback only when the server read fails or returns no
selected products.

### Optimize cards before introducing virtualization

Gallery cards mount one cover initially, lazy-load offscreen content, and mount
carousel neighbors on interaction. Offscreen containment, database pagination,
accurate `sizes`, and targeted priority are preferred before full row/card
virtualization, because virtualization would complicate accessibility, focus,
history, and responsive layout.

### Responsive failures are tested by width and height

The desktop filter sidebar keeps its sticky layout but receives a viewport-
relative maximum height and internal scrolling. Narrow pagination uses a
localized page status; omitted desktop page ranges use ellipses. Customer
controls must remain reachable and free of page-level overflow from 320px
mobile through wide desktop, including short landscape viewports.

## Checkout, Tax, And Payments

### Server pricing is authoritative

The browser sends product IDs/quantities and selections, never trusted amounts.
`checkout-pricing.ts` reloads products and spot data, checks purchasability/
quantity, snapshots item prices, and computes tax, shipping, and total.

`checkout-shipping.ts` is the sole shipping catalog. Fees are value-based
tiers keyed to the order's merchandise subtotal (2026-07-30 owner-approved
contract, `features/shipping-tiers.md`): Local Pickup $0; Standard Insured
$19/$25/$29/$35/$59/$99/$99/$165 across eight bands with USPS Registered Mail
at $5,000+; Express Overnight $55/$79/$119 and not offered at $5,000+ because
USPS insurance caps there. Unknown methods and unavailable methods are
rejected rather than falling back to free shipping or a substituted service.
Every tier must charge above its worst-case postage + USPS carrier insurance
cost — the store never pays shipping out of pocket. The same standard tier
table drives Etsy/eBay shipping through
`getMarketplaceStandardShippingFee`; all seven policies/profiles per channel
are provisioned, with missing mappings retaining a safe legacy fallback.

### Shipping is U.S.-only and structurally validated

Shipped checkout requires street, city, a canonical U.S. state/D.C., and a
five-digit ZIP or ZIP+4. Country is United States. The server repeats
normalization/validation and rejects tampered or international input.

### Current tax policy is Florida-only

Local Pickup and validated Florida destinations use a 6% rate on discounted
taxable merchandise plus charged shipping. Non-Florida destinations receive
$0 Florida tax. There is no California-specific branch.

Florida county discretionary surtax and other-state nexus collection remain
deferred until accountant review and registration. Existing orders are
historical snapshots and are not retroactively recalculated.

### Checkout is a single-page two-column layout

Owner decision 2026-08-04, replacing the earlier four-step wizard (Summary →
Delivery → Contact → Review & Pay) after the owner supplied a mainstream
retail checkout as the model. `/checkout` now shows everything at once:

- **Left column** — one *Shipping* card, ordered **delivery method → contact
  details → address**. The delivery radio cards come first deliberately: the
  method decides whether a shipping address is required at all, so asking it
  last let a Local Pickup buyer fill in an address they never needed. Do not
  reorder them back. There is no separate Payment card — PayPal is the only
  method, so a card that just announced it was noise; the buyer picks
  PayPal-vs-card inside PayPal's own buttons. There is no order-notes field;
  `customer.notes` remains in the payload as an empty string so the server
  contract is unchanged.
- **Right rail** — one *Order summary* card: **items first**, then totals,
  policy links, the confirmation checkbox, and the PayPal buttons. Items lead
  because that is the near-universal checkout order (Shopify, Stripe
  Checkout): confirm what you're buying, then what it costs, then pay. Below
  1024px the columns stack with the summary last, so a phone reads the form
  first and lands on the pay controls at the end.

The summary card is sticky from 1024px, and three details make that work —
change any one and it silently breaks. The grid uses `align-items: stretch`
so the rail spans the row height (a content-sized rail gives sticky zero
travel); the sticky element is the card *inside* the rail, not the rail
itself; and the card carries `max-height: calc(100svh - 7rem)` with
`overflow-y: auto`, because a sticky box taller than the viewport pins its top
and leaves its bottom — the pay button — permanently unreachable. Keep the
card the single scroll region; a second nested scroller on the item list
fights it for wheel events.

The page header's back link is **Back to cart** and reopens the cart drawer
over the page — the cart is a drawer, not a route, so navigating to `/shop`
would have discarded entered details.

This remains a presentation layer only: payReady gating, effective-method
derivation, capture recovery, and order reuse are unchanged, the confirmation
checkbox is still a hard gate on payReady, and buyers still see the final
total before paying because the PayPal buttons sit beneath it. With
capture-on-approve, "Place order" remains PayPal's own Pay Now review; do not
add a post-PayPal confirm step.

Display money is derived once, by `computeOrderTotals` in `OrderSummary.tsx`,
and shared by the item-list summary and the standalone `OrderTotals` card so
the two surfaces cannot disagree. The server still recomputes every amount
authoritatively (`checkout-pricing.ts`).

Financial summaries list tax AFTER the shipping cost (Subtotal → Shipping →
Shipping Cost → FL Sales Tax → Total) so the merchandise-plus-shipping
taxable base is visually obvious.

Server checkout rejections carry machine-readable codes
(`OrderDraftErrorCode`); the client maps codes to precise bilingual guidance
and falls back to message-pattern matching only for uncoded/legacy
responses. New rejection reasons must add a code, not rely on wording.

### PayPal captures on approval with no reservation

PayPal Orders API v2 is the storefront processor. PayPal credentials and
`PAYPAL_ENV` must be one consistent set; the client ID may reach the browser,
while the secret remains server-only.

There is no checkout inventory hold. The first successful capture wins under a
database row lock. Capture evidence is preserved before local fulfillment.
Ambiguous capture is reconciled against PayPal, and buyers are warned not to pay
again when provider success is known or unresolved.

Refunds require deterministic request IDs and the `paypal_refunds` ledger.
Webhook and route retries must be idempotent. A refund does not automatically
restore inventory; restoration is an explicit admin action.

The validated checkout address is authoritative for shipped PayPal orders.
Local Pickup does not request a shipping address.

## Admin And Orders

### Lifecycle changes are explicit

Draft and Archived are non-public. Permanent product deletion is a second,
confirmed step after archive and must clean owned media. Sold price is locked
until deliberate relisting. Manual order lifecycle and explicit inventory
restore must not silently rewrite payment history.

Orders and Messages use recycle bins where supported. Invoices are created
idempotently at order creation and updated to paid after capture. Email history
records the actual From identity separately from the initiating admin/system.

### Admin tables favor working visibility

Admin Products defaults to Available inventory, preserves sticky product
identity and totals inside the scroll viewport, and keeps row quick actions in
page-sized dialogs that are isolated from table layout styles.

On mobile, the compact inline table remains the dashboard preview, but an
explicit **Open Product Table** control must promote that same table into a
full-screen dynamic-viewport dialog. The dialog owns two-axis scrolling, keeps
Close and Escape available, locks background scrolling, and closes if the
viewport reaches desktop size. In the full-screen mobile mode, pin only the
selection edge, product image, and row actions. Inventory number and title must
pan with the statistics, while the image stays visible as the compact visual
identifier for every row. Do not pin the full identity group: it would consume
almost the entire phone. The ordinary tablet/desktop inline table and its
sticky identity columns remain unchanged.

The mobile toolbar pairs **Add Product** with a compact **Open Product Table**
launcher. The launcher may use tighter type, icon, spacing, and horizontal
padding to fit narrow phones, but must preserve its complete label and must not
alter the desktop toolbar. Search belongs at the top of the expanded mobile
Filters panel, not in a permanently visible toolbar row; a non-empty search is
included in the mobile Filters badge. The visible/total count belongs at the
right edge of the table utility row beside Reset/status. Desktop retains its
always-visible toolbar search and count.

The explanatory drag-reorder sentence is desktop-only. Mobile table space is
reserved for inventory and actionable state: retain **Reset view to drag
reorder** when sorting/filtering prevents reordering and retain the saving
status during a reorder, but hide the entire strip when neither is present.

## AI And Bilingual Listing Copy

### Buyer-facing copy excludes seller guesses

Seller opinions, suggestions, unsupported identifications, and uncertainty may
not be presented as fact in title, description, or public notes. Objective
facts and visible markings may be used; unresolved uncertainty remains an
admin-facing warning.

### AI listing refinement is conversational but remains a draft

The open product editor owns the AI conversation. Every turn sends the current
form as the baseline plus a bounded set of prior turns, returns a complete
revised field set, explains changes, and asks only relevant clarification
questions. Current supported values are preserved unless the admin requests a
change or stronger evidence contradicts them.

Conversation state resets when a different Add/Edit editor opens and is not
stored in product rows. AI revisions update only the unsaved form; the normal
Save action remains the sole persistence boundary. The buyer-copy firewall and
explicit-only measurement rules apply on every refinement turn.

### AI review safety is application-enforced

The model prompt is guidance, not the confirmation boundary. After coercion,
the server compares every returned field with the current form. Only a
high-confidence, non-sensitive value added to a blank field may auto-apply.
Every replacement of an existing value, low/medium/missing-confidence value,
and chain, measurement, purity, or pricing fact stays pending until the admin
accepts it. Warnings, uncertainties, and unchanged values without high
confidence generate explicit clarification questions.

Read-aloud is admin-only. The server may use OpenAI's speech endpoint with the
server-held key; the browser falls back to its device voice when unavailable.
The UI identifies playback as an AI-generated voice, and speech is never stored
with the product or conversation.

### Spanish regeneration is explicit and fill-only

The Edit Listing action generates Spanish values only for blank Spanish fields.
It never overwrites retained copy, rejects stale results if source fields change
during the request, and does not persist until the admin saves normally.

## Marketplace Integrations

### Etsy and eBay remain independent channels

Each integration owns its client, mapping, state machine, SQL, routes, settings,
and error handling. Admin bulk entry points are consolidated in the Products
Actions modal, but status checks and Publish All Ready actions are separate per
marketplace.

### Review-first is the default

Selected/bulk work reuses bounded single-item state machines. Preflight and
review occur before publish where supported. Targeted repair/update is preferred
to blanket re-sync.

### Remote lifecycle and local freshness are separate

An active remote listing may still be locally `out_of_date`. Status checks
reconcile remote lifecycle without clearing content drift. Only a successful
content sync refreshes the pushed hash and clears local freshness state.

Price-only drift does not mark content out of date; dedicated price-push actions
handle price changes. Marketplace failures never block storefront cache
revalidation or successful buyer checkout.

### Marketplace writes require a live relevant-metal quote

The storefront may display its explicitly labeled fallback estimate during a
metal-provider outage, but Etsy/eBay writes are durable financial actions and
must fail closed. A spot-priced item can be written only when the spot payload
comes from the live API and contains a positive quote for that item's metal.
Manual-priced items and an already-locked sold price do not depend on live spot.

### Daily marketplace price runs are bounded and observable

**GitHub Actions owns the daily trigger** — one staggered job per marketplace in
`.github/workflows/scheduled-jobs.yml` (Etsy 11:15 UTC, eBay 11:45 UTC). It
replaced the Netlify scheduled functions on 2026-08-11 because those never
executed even once; the `.mts` files remain only so the change is reversible.
The trigger is deliberately interchangeable: the routes are secret-header-guarded
and trigger-agnostic, so any external cron can drive them. **Never assume a
scheduler works because its dashboard says it is registered** — a Netlify
"Scheduled" badge with a correct "Next execution" time sat over a completely dead
scheduler for weeks.

The secret-guarded Next routes do the actual work with a fixed time budget,
price-only writes, oldest-row-first rotation, and summary log records. eBay
uses verified batches of at most 25 and isolates a failed mixed batch so one
offer cannot starve later listings. Admin Settings exposes secret readiness and
the latest scheduled result; no new database table is required.

A rotated cron secret must be updated in **three** places or the job 401s:
Netlify (**and then redeploy** — env changes do not reach the running site until
a new deploy), the GitHub Actions repository secret, and `.env.local`.

**Three rules added 2026-08-08 after the price push turned out to be generating
~33 guaranteed API rejections per run:**

1. **Eligibility is decided by CURRENT PRODUCT STATUS, not by listing sync
   state alone.** A sold product's listing legitimately stays `out_of_date`
   forever while its marketplace offer is already withdrawn, so a sync-state
   filter re-selects it every run and the marketplace rejects every write. Check
   `normalizeProductStatus(product.status) !== 'available'` and skip. Key it on
   live status, never on a "dead" flag written to the listing — relisting must
   revive it with no manual repair.

   Note eBay and Etsy differ here by accident, not design: Etsy's auto-delist
   moves sold listings to `delisted` (outside its selection) while eBay's leaves
   them `out_of_date` (inside it). Do not rely on that; both planners now check
   status explicitly.

2. **A failure path must actually record the failure.** Both providers called
   `upsertListing(service, id, {})` — a no-op patch — so `error_count` never
   left 0 and the retry ceiling could never engage. The manual button polls to
   completion and a failed listing stays a candidate, so 33 broken listings
   produced 139 error rows in a single run. Increment on failure, **reset to 0
   on success** (that is what makes the ceiling self-healing), and skip at the
   ceiling.

3. **Persist `err.detail`, not just the operator sentence.** Both
   `EbayApiError` and `EtsyApiError` carry a pre-redacted `detail` documented as
   safe for a sync-log row, and both failure paths were dropping it — leaving
   140 rows reading `eBay API error (HTTP 400).` with no recoverable cause,
   because that string is only the FALLBACK for an envelope with no top-level
   message. A generic operator message is a signal the real reason is in
   `detail`.

### An absent record is a fault, not a clean slate

Added 2026-08-10, after discovering that **no Netlify scheduled function on this
site has ever executed** — the two price pushes and all three social workers —
while Admin Settings showed a green check and *"Ready for Daily at 11:45 UTC. No
completed run has been recorded yet."* Nothing was broken in our code; the
reassurance was.

Two rules, both general:

1. **Never render "has never happened" as healthy.** For anything expected on a
   schedule, absence past its due time is the strongest possible fault signal
   and must be shown as one. `resolvePricePushHealth`
   (`src/lib/marketplace-price-push-health.ts`) distinguishes `disabled` (the
   owner's choice, not a fault) from `never_run` and `overdue` (both faults), and
   the copy names the place to look — the Netlify function log. Allow a grace
   window (60 minutes here) so a merely late run is not flagged, but never let
   the grace become an indefinite excuse.

2. **Never derive a rare event's last occurrence from a page of recent rows.**
   Both status routes read 25 log rows and searched them for the scheduled push.
   One manual "Push prices now" writes ~130 `price_push` rows on Etsy and ~300 on
   eBay, and the eBay account-deletion webhook alone has written 56k rows — so
   the scheduled run was buried within minutes of any real activity and the card
   silently degraded to the same "no run recorded" it shows for a dead cron. Query
   the specific action directly (`getLastScheduledPricePush`), ordered and
   `limit(1)`. A high-volume neighbouring action must never be able to hide a
   low-volume one.

The corollary for diagnosis: when a log that records even skips contains zero
rows for an action, suspect the caller, not the logger. Here three independent
code paths across two providers were all silent, which located the fault above
the application entirely.

### Etsy queue progress is durable

Bounded image requests retain queue ownership after intermediate states. Normal
and repair drains use separate atomic claims. Progress is cumulative against a
fixed total, and a one-click repair action resumes linked interrupted rows.

### eBay verification follows relists without mutating them

Read-only verification may follow an ended listing to a live relist, but must
not silently attach, end, or republish that external relist. App-side writes
remain blocked until the stored offer/listing relationship is deliberately
reattached.

### eBay write blocks are pinned by id, and bulk runs are capped

A write block inferred from mutable row data is not a block. Inventory #82's
quarantine originally read `last_error === RELISTED_LISTING_WARNING`, which any
later error, manual clear, or partial sync would erase — silently re-arming a
write to a listing that is live through an unattached external relist. Blocked
products are therefore pinned by id in `EBAY_WRITE_BLOCKED_PRODUCT_IDS`, and
every write path asks one question, `isEbayWriteBlocked()`. Lifting a block is
an explicit code change, reviewed with the migration that justifies it.

Bulk enqueue is capped at `EBAY_BULK_ENQUEUE_LIMIT` (25) and drops
non-`available` products before queueing. "Never blanket re-sync" is a real
hazard — a shipping-policy or template change re-hashes the entire catalog at
once — so it is enforced mechanically rather than left to whoever is clicking.
The admin states the cap before a run and the withheld count after it, so a
capped batch is never mistaken for a finished job.

### An Instagram post is effectively permanent once published

Two hard limits, both confirmed live on 2026-08-01, make publishing a one-way
door and are the reason this integration is review-first:

1. **Captions cannot be edited.** Instagram's API has no update endpoint.
2. **Posts cannot be deleted through the API either.** The Instagram API with
   Instagram Login exposes no media-deletion endpoint; `DELETE /{media-id}`
   returns "does not support this operation". The `instagram_manage_contents`
   permission that can delete posts belongs to the Facebook-Login variant,
   which requires a linked Facebook Page — an architecture we deliberately
   avoid. **Removing a post is a manual action in the Instagram app.**

So the app can create a post but can never take it back. Therefore: nothing
auto-posts (review-first by default, the owner approves each item), a quoted
price is always written as an explicit "≈ $X at time of posting" alongside a
pointer to live site pricing, and a post whose price would come from a fallback
spot estimate is blocked outright — the same fail-closed rule as Etsy/eBay
writes.

`deletePost()` attempts the API delete, detects the unsupported-operation
response, and returns the permalink with instructions rather than pretending to
have succeeded; it deliberately leaves the local record intact so the operator
can still find the post. A separate `forgetPost()` clears local state and
renditions after the operator has deleted it by hand. Any future "out of date"
handling must follow this same two-step shape — the app cannot repost over
something it cannot remove.

Anything that ends up in a caption must be correct the first time. Notably, an
inventory number is written as "Inventory 21", never "Inventory #21":
Instagram auto-links "#21" into a hashtag pointing at an unrelated tag page
(seen on the very first live post, permanently).

Since 2026-08-01, the inventory number stays out of PUBLIC post copy entirely,
on both channels (caption and alt text — `buildPublicSpecLine`, one shared
strip so the rule cannot drift). The piece is identified by the `/p/<inv#>`
short link instead: clickable full URL on Facebook, and a two-line Instagram
block: `Store link in bio` immediately followed by the **typeable** brand-case
`Item: NaplesEstateJewelry.com/p/N`. There is no blank line inside that pair,
but the normal caption blank line remains above and below it. Instagram caption
URLs are never linkified — a dead `https://` URL there is noise, but a short
brand-case path is something a viewer can retype. Both channels share one
caption structure (opening sentence that combines availability with the item
→ specs → price sentence, uniform one-blank-line rhythm,
no description body); channel differences are limited to what the platforms
force (link form, CTA wording). AI is optional and manual-only: ordinary
preview loads and direct Prepare calls never invoke a model. The operator must
click Generate/Regenerate, may first add up to 400 characters of optional style
direction (typed or selected from the shared six-option suggestion menu), may
edit the result directly, and must Prepare again before
publishing; unsaved wording hides the publish controls. Leaving direction blank
and skipping Generate preserves the deterministic opening exactly. AI output is
bounded by a schema, must clearly identify the product, and must contribute a
genuine conversational thought rather than only rewriting the title plus
availability. It deliberately varies sentence structure and prefers natural
“This…” phrasing over “The {full catalog title}…”. It may shorten the
catalog title naturally, as admin edits already can. Both paths reject “our,” links,
hashtags, inventory numbers, quotes, extra sentences, and stale availability
claims. Failure or no manual generation uses `Available now: {title}.`
Existing prepared captions stay immutable until explicitly re-prepared.

Facebook and Instagram do not use the same hashtag volume. Both may reuse the
same relevance ordering, but Facebook is capped at the first three tags so the
Page copy reads naturally; Instagram retains its larger discovery-oriented set.
This limit is enforced by the Facebook mapper, so preview, Prepare, queue, and
publish cannot drift.

Tiffany has one public social hashtag: **`#tiffanyandco`**. The shared hashtag
normalizer maps direct Tiffany brand/company variants, including legacy
`#tiffanyco` and bare `#tiffany`, to that spelling before deduplication. This is
shared mapping policy, not a per-product tag edit, so Instagram and Facebook
cannot drift.

In the combined **Publish to both** review, a channel already in prepared
`review` state is authoritative for the reviewed opening sentence. Preparing
the missing side copies its complete stored caption body instead of rebuilding
different wording on the target. The target mapper replaces only the
platform-specific link block and trailing hashtag line: Facebook retains its
clickable `Shop:` URL and three tags; Instagram receives `Store link in bio` +
`Item:` and its larger tag set. The same operation copies the source channel's
complete saved photo curation - ordered lineup, exclusions, crops, card source,
and card background - then rebuilds the target channel's own rendition files.
The copy is revalidated against current product images and invalidates staged
platform uploads before Prepare. If neither side is ready, each
target keeps its own preview caption.
If both sides are already ready with different openers, publishing both is
fail-closed. The page that opened the modal is the source of truth, and the
operator must explicitly re-prepare the other channel with **Sync wording** or
**Sync wording & photos**.
The cross-channel endpoint reads the source caption from the server-side stored
review row; browser-supplied caption bodies are never trusted.

When both reviews are ready, the combined modal always names the direction and
offers three separate operations: **Sync wording**, **Sync photos**, and **Sync
wording & photos**. These are semantic modes, not alternate labels for one
operation. Wording-only must not mutate destination curation. Photo-only must
copy curation and rebuild renditions while preserving the destination's stored
reviewed caption. Combined sync copies both. The manager page that opened the
modal remains the source, so direction is never inferred from which caption or
slide count happens to differ.

The same combined review may queue both channels, but only when both prepared
reviews are current and their opening sentences match. Queueing is a distinct,
non-public action beside Publish, reuses the existing per-channel queue
contracts, and reports each channel independently rather than implying an
all-or-nothing database transaction. A queued post remains a prepared review:
preview copy is selected from the stored caption and renditions, not from the
temporary `pending` sync state, so queueing cannot make reviewed wording appear
stale or hide the unqueue path. Unqueue restores `review` whenever that prepared
caption and rendition set still exist; only an unprepared record returns to
`pending`.

The Instagram content hash deliberately EXCLUDES price. Spot moves daily; if
price were hashed, every live post would flag itself out of date and invite a
delete-and-repost that costs real engagement. Only caption copy and the image
set mark a post stale.

Instagram-specific limits that the mapper must keep enforcing: 10 images per
carousel, JPEG only (the catalog is WebP, so renditions are mandatory), 2,200
caption characters, 30 hashtags, and 100 published posts per rolling 24 hours.

### Instagram renditions are padded squares, and the GC must know about them

Every image in an Instagram carousel is cropped to the FIRST image's aspect
ratio. Rather than let Instagram crop jewelry — clasps, hallmarks and gemstones
sit at the edges — each source image is padded onto a 1080x1080 canvas, which
makes the crop rule a no-op. Renditions are JPEG (Instagram rejects WebP),
content-addressed, and written to the existing product-images bucket under
`instagram-renditions/`.

"Publish to both channels" publishes **Instagram first, always**: Instagram is
the permanent channel (no API delete or edit) with the most failure modes
(publishing quota, async container processing), so an Instagram failure means
nothing has gone out anywhere; Facebook — synchronous, deletable, trivially
retried — publishes second and is skipped with an explicit "not attempted"
result when Instagram failed. Cross-channel curation copying
(`/api/admin/social/copy-curation`) is verbatim-including-nulls ("make the
other channel match this one"), re-validated against current product images,
refused when the target post is live, and invalidates the target's prepared
renditions exactly like a lineup save. The combined
`/api/admin/social/prepare-from-channel` path calls that same copy operation
before it prepares the missing side; it never maintains a caption-only shadow
implementation. Channel curation STORAGE stays separate
(the copy is an explicit operator action, not a sync) — shared storage would
let one channel's re-prepare delete files the other still references.

The card's AUTO-proposed crop **never upscales** (2026-08-01): if the proposed
region cannot fill the card's photo well at native resolution, the full frame
is used instead — composition never justifies blur (`guardProposedCrop`).
Operator-set crops are exempt; they are chosen against a live preview.

The generated card **replaces its source photo** in the prepared slides
(2026-08-01): the card composites that photo full-bleed, so also posting the
standalone copy showed the same image twice in one carousel. The replacement
happens only when the card actually rendered — a card failure keeps every
photo, preserving the photos-are-the-substance degradation rule. A
single-photo product therefore prepares as one card-only slide, which both
publish paths handle via their existing single-image branches.

The pad colour is **sampled from the photo, not assumed** (2026-08-01). It was
hard-coded white, which is invisible on the cream-sweep majority but framed
every black-backdrop photo in white bars — the chains are portrait, so a
pure-black shot got ~92px of white down each side. Corner samples are
composited over white before being averaged, so a background-removed photo
(transparent corners) reports white and therefore agrees with whatever
`flatten()` paints behind it; reading raw RGB there would call it "black" and
pad a white-flattened image in black. White stays the fallback for a
non-uniform frame, where there is no single backdrop colour to match.

### Match the backdrop instead of cutting the product out

The generated ad card paints its background in the source photo's own backdrop
colour, and the crop-proposal and card share that measurement.

The alternative — chroma-keying the product and compositing it onto a fixed
dark card — was built and rejected. It forced a distinction that does not
reliably exist: the studio drop shadow is near-neutral and only ~10-35
luminance below the sweep, so separating it from genuine dark detail (the
crevices between links) needed per-image threshold tuning, punched holes
through polished metal, and failed outright on sterling against cream, where
7-12% of the piece sits within 25 luminance of the backdrop.

Matching the backdrop removes the problem rather than solving it. The shadow
lands on the surface it was cast on, so no matte is needed, and one code path
serves both sweeps. Product pixels are only ever cropped, scaled and placed —
never redrawn — so the piece cannot drift, which is the same guarantee that
keeps generative approaches off the table for listing imagery.

Two consequences worth keeping:

- **Feather any crop that is tighter than the backdrop.** A crop sitting on
  bare backdrop joins the card invisibly, but a tighter one necessarily cuts
  through whatever the piece rests on. The black velvet bust reads rgb(3,3,3)
  against a rgb(0,0,0) card, and three levels along a long straight edge shows
  as a rectangle. The alpha ramp is a no-op in the first case, so it is always
  applied.
- **Saturation-based cropping is for dark backdrops only.** It frames the metal
  and ignores the neutral prop, which is what a chain on a velvet bust needs
  (Byzantine: 57% of frame → 21%). It is not a general default — sterling on
  cream is barely more saturated than the sweep and would vanish under it.

### The lead card is pipeline, not preference

Every Instagram carousel leads with the generated card. There is no toggle and
no `card_enabled` column: it defines what a post looks like rather than being a
per-run choice, and a setting only invites the two paths (preview and prepare)
to disagree about how many slots are free. The photo cap therefore lives in
`buildInstagramPost` as `INSTAGRAM_MAX_PHOTO_ITEMS` (9 of Meta's 10), so the
count an operator reviews is the count that publishes by construction.

The small **NOW AVAILABLE** eyebrow immediately above the item title is also
system-owned card presentation, not editable post content. It belongs in the
shared renderer so Instagram and Facebook cannot drift and so the operator does
not have to manage another field for a consistent visual hierarchy.

A card render failure is **not** fatal. The photos and caption are the substance
of a post; the card is presentation, so a failure degrades to a card-less
carousel with a warning rather than blocking. This is deliberately the opposite
of the fail-closed rule on price: a published caption is a durable public claim
and must never quote an estimate, whereas a missing decorative slide claims
nothing. Review-first means the operator sees the prepared slides either way.

Because of that fallback, position is not proof — the card's Storage object is
named `card-<hash>.jpg` rather than `0-<hash>.jpg` so the review UI can label
slide 0 honestly instead of assuming.

### Instagram card type renders through Satori, not sharp

sharp draws SVG text through fontconfig, which finds nothing on Netlify's
Lambda image. Satori (via `next/og`, already bundled with Next) takes font
buffers directly and needs no system fonts, so the card splits by strength:
sharp does the pixel work, Satori does the type.

The brand faces are vendored as OFL **static** TTFs under
`next-app/src/assets/fonts` with their licenses. Static specifically — Satori's
bundled opentype parser throws on a variable font's `fvar` table, so Google's
single-file `Family[wght].ttf` builds cannot be used. Nothing imports the files,
so `outputFileTracingIncludes` in `next.config.ts` is what puts them in the
serverless bundle; drop it and every card fails at render with ENOENT.

Because they live in that bucket but are referenced only by
`instagram_posts.rendition_paths`, the Storage GC reference scan MUST include
that column. Without it the sweep reads them as orphans and deletes them,
which breaks any prepared-but-unpublished post by making its image URLs 404
exactly when Instagram tries to fetch them.

### Instagram connects by pasted token, not redirect OAuth

Instagram rejects `http://localhost` redirect URIs, which would make the
owner's LAN/dev testing impossible, and this is a single owner-operated
professional account on a development-mode Meta app where Meta's own documented
path is dashboard token generation. The owner pastes a long-lived token once;
it is stored AES-256-GCM encrypted and refreshed weekly by a scheduled
function, so it never expires in practice. An expired token cannot be
refreshed — only re-pasted — which is why the refresh runs weekly rather than
at the last minute. Redirect OAuth can be added later without schema changes.

### Facebook mirrors Instagram as an independent channel

The Facebook Page integration copies the Instagram integration's shape
file-for-file (schema, lib modules, routes, panels, drip) rather than
abstracting a generic "social channel": an operator or agent who knows one
immediately knows the other, and a change to one can never destabilise the
other. Where the Graph API differs, the build leans into the difference instead
of forcing parity — Facebook has no refresh cron in this owner flow, so Page
tokens are lifetime-inspected before storage and later re-pasted when finite or
invalidated,
deletion genuinely works (so there is no manual-delete detour), publishing is
synchronous (no container polling), and links are clickable (so every post
carries a `Shop:` product URL, which Instagram cannot have).

Sharing boundaries: API clients are NEVER shared between channels. Pure caption
and lineup helpers ARE shared (imported from `lib/instagram/mapping`) so copy
fixes land on both channels at once. The rendition/card engine is shared code
but writes per-channel Storage prefixes (`instagram-renditions/` vs
`facebook-renditions/`) with per-channel GC reference columns — shared objects
would let one channel's re-prepare delete files the other still references.
Lineups and crops are stored per channel for the same reason: curating one
never changes the other.

### Social preparation is one owner action, not two internal pipeline actions

The Instagram and Facebook manager screens treat saving a lineup and creating
the prepared upload as one owner-level intent: **Save & prepare**. The server
still receives the two ordered operations, but surfacing an independent card
preview made it easy to click Done and mistakenly believe a prepared upload
existed. There is now no manual card-generation step: preparation creates the
real card, which first appears in review. The panels instead expose the stage derived
by `lib/social-workflow.ts`: curate → prepare → review → publish. Unsaved
lineup changes always win over a previous preparation, and caption edits make
that review stale too. Queueing, combined publishing, publishing, and discard
are unavailable until the review is current. This is deliberately UI-state
only: no schema or API contract changed. Preserving the local caption opening
across a lineup reload prevents the convenience save from silently discarding
an operator's wording. Conversely, an explicit outlined **Reset changes**
action resets every local setup value (lineup, crops, card source/background,
AI direction, and opener) to the loaded baseline without a write. It is absent
when there is nothing local to discard; a generic Cancel label hid that scope
and looked inert when only a prepared-state flag remained.

The action row belongs **after** the full photo/card setup, not beside the
Photos heading. It is a completion action, not a prerequisite for choosing,
reordering, cropping, or selecting the card image; placing it beside the
heading falsely implied the reverse order.

For social opener copy, **Tiffany & Co.** is a canonical house name rather
than a stylistic choice. The AI is told to use it, and the shared server-side
normalizer converts Tiffany variants in a Tiffany product's generated,
fallback, or edited opener before the caption preview is built. Its abbreviation
period is explicitly not treated as a second sentence. The same shared opener
normalizer enforces the house punctuation rule for typographic dashes: em and
en dashes have exactly one space on each side in AI, fallback, extracted, and
admin-edited copy. Hyphens within compound words are not treated as dashes.

### Social square framing lives in the editable lineup

Prepared social images use contain-to-square framing so no jewelry is lost by
an implicit crop; that can visibly add canvas around landscape or portrait
photos. The editable lineup therefore uses the same server-side post-crop
framing calculation and sampled canvas color that `renderSquareJpeg` uses; its
thumbnail is the sole pre-prepare preview, with **Canvas**/**Crop** labels for
quick scanning. This replaced the separate hardcoded-white toolbar preview,
which could disagree with black or cream source backdrops. Canvas color is
resolved from the median border ring, not four corners: a tight crop can put a
bracelet or shadow in one corner while the dominant sweep remains uniform. A
genuinely mixed border still falls back to white. The crop dialog deliberately
shows the editable source and a separate live square **Prepared post preview**
side by side. **Fill square** provides a centered, square crop *starting point*
and visibly removes canvas in that output preview. It is not an automatic write
or re-prepare, and the owner must inspect and apply it, preserving control over
clasps and other edge details. The same shared crop UI and lineup rendering
apply to Instagram and Facebook.

### Remote social status is reconciled conservatively, never inferred

A local `published` flag is not permanent truth: an owner can delete a post in
Facebook or Instagram itself. Each published manager therefore performs one
remote read on open and exposes an explicit refresh action. A Meta missing-id
response is still ambiguous because its text can also describe permissions, so
local state changes to `deleted` only after a second `/me` call proves the same
Page/account token remains healthy and, for Facebook, a fresh one-item Page feed
read proves the read permission still works. Facebook's New Page Experience can
return a stored post id prefixed by the Page id while the public permalink uses
a different Page actor id. The permalink-derived composite id is a permitted
read-only fallback, but only for numeric `facebook.com/{actor}/posts/{post}`
URLs and never as proof by itself. Authentication, permission, rate-limit,
network, and other ambiguous errors must preserve `published` and surface an
actionable message. Manual **Already removed on…** is the deliberate fallback
when the owner knows the remote post is gone. Facebook Page-token connection
must also prove `pages_read_engagement` by reading one feed id; a publish-only
token is insufficient for reconciliation. A status check is a local, contained
interaction: unchanged success or inability to check belongs beside the refresh
button in neutral/success text, not in the panel's page-wide error banner.

Facebook token rotation is validate-then-swap, never disconnect-first. A
connected admin can paste a replacement token, but the stored token remains
active unless the candidate passes Page profile, post-read access, exact
same-Page-id, and Meta token-metadata checks. Same-Page protection still applies
when the stored connection is `needs_reauth`; expiry must never make it possible
to silently redirect future posts to another managed Page. The metadata must be
valid for the Naples Estate Jewelry Social app. Tokens with a finite lifetime
under 30 days are rejected; longer finite lifetimes are persisted and displayed,
while a null expiry means only that Meta reported no finite expiration. The
server-only `/debug_token` call requires `FACEBOOK_APP_SECRET`; when it is not
configured, connection and rotation fail closed rather than accepting an
uninspected credential.

### Facebook publish completion is receipt-first and exactly recoverable

A successful Meta feed response is the irreversible boundary. Persist its post
id as Published immediately; permalink enrichment and audit logging are
secondary and must never move that row back to error. If the process ends after
Meta creates the post but before the receipt is stored, checkpointed unpublished
photo ids authorize a read-only recovery attempt before any retry write. Recovery
requires exactly one recent Page-feed entry whose full message equals the saved
prepared caption and whose creation time is after the checkpoint began. Zero or
multiple matches fail closed. A consumed-photo response is evidence to attempt
that proof, never proof by itself and never permission to prepare fresh photos
or create another public post.

### Do not publish off-eBay contact information

eBay description artwork must not display phone numbers, email addresses, or
off-eBay website URLs. Product-photo galleries must contain product imagery,
not a marketing banner.

## Security And Privacy

### A query parameter is never an authorization signal

Established 2026-08-08 after a live disclosure bug: `?returnTo=/admin` on a
soft-deleted product URL returned the full page to an anonymous visitor. The
gate was `!visible && !returnHref`, where `returnHref` came from a helper whose
only job is validating that a back-link points somewhere sensible. **A
validator that answers "is this string a plausible internal path" was standing
in for "may this viewer see this".** Passing it required knowing that `/admin`
exists.

Rules that follow:

1. **Visibility is decided by session/role. Parameters decide presentation.**
   A `returnTo` may choose a back-link's label and destination and nothing else.
   If a parameter's presence changes what data is disclosed, that is the bug.
2. **Gate on the WEAKEST sufficient identity, not the strongest.** This one is
   any signed-in user, not admin — `returnTo=/account` is a customer returning
   from order history to a product they bought that has since been archived.
   Requiring admin would have broken a legitimate path and invited someone to
   loosen it again later.
3. **A streaming route needs the check in BOTH `generateMetadata` and the page
   body.** Metadata alone gives the correct 404 for a bare URL, but once a query
   string makes the route stream, the 200 shell commits before metadata
   resolves; only the body check stops content reaching the wire. Fixing the
   obvious half looks complete and is not.
4. **Do not read the parameter where it is not needed.** `generateMetadata` no
   longer destructures `searchParams` at all, so the disclosure decision cannot
   accidentally depend on one again.

When this class is found, sweep for siblings rather than fixing the instance:
every route reading a query parameter without a session/cron guard, OAuth
callbacks that read `code`/`state` before authenticating, and list endpoints
where a status filter from the query could widen rather than narrow a visibility
allowlist (AND it with the allowlist, never replace it).

### Abuse controls are layered

Netlify Edge provides broad per-IP `/api/*` limiting before Next runs.
Sensitive public routes also use distributed Supabase counters and tighter
route-specific windows. The shared limiter fails closed if its backend is
unavailable, and stale counter rows are cleaned probabilistically.

Public mutations stay behind validated app routes. Direct public execution of
subscriber RPCs is revoked by the security migration. Admin/service-role
operations remain server-only.

### Headers are defense in depth

CSP, frame blocking, HSTS, referrer, permissions, nosniff, and cross-domain
policy are defined in Next and Netlify. Development-only CSP allowances must
not enter production.

No secret values are documented or committed. Netlify owns current operating
environment values; local `.env.local` is not authoritative.

### Security remediation must preserve a working supported toolchain

Production dependency safety is measured with the deployed tree and
`npm audit --omit=dev`, then verified by tests, lint, and a complete production
build. A full-audit finding in development-only lint tooling is still tracked,
but an audit tool's forced major downgrade/upgrade must not replace a supported
toolchain with one that fails at startup.

As of 2026-07-27, production uses patched Next.js, PostCSS, and Sharp versions
and audits cleanly. Stable `eslint-config-next` still bundles React lint plugins
that reject ESLint 10, so the working ESLint 9 line remains until upstream
stable compatibility lands.

## Testing

### A test must be able to fail; check that it can

The recurring defect in this codebase is not a wrong assertion — it is a
**missing** one, and the missing one is almost always the check that felt
redundant. Three instances found on 2026-08-08 alone, none of which any passing
run would ever have revealed.

**Upper bounds pin nothing on their own.** Nine assertions of the form
`expect(imagesIn(batch)).toBeLessThanOrEqual(30)` were satisfied perfectly by a
chunker emitting one product per batch. The cap was pinned; the packing was not.
Where a function is supposed to *fill* something, assert the fill: for every
batch but the last, pulling in the next item must have overflowed a limit. See
`expectSaturated()` in `src/lib/__tests__/deepfield-batching.test.ts`.

**Split mechanism from policy.** Tests that verify a *rule* derive their
boundaries from the constants (`MIN - 0.1`), so retuning re-baselines them.
Exactly one test — the policy test — states the bare numbers, because that is
the product contract rather than our tuning. When a limit changes, one test
should object and the rest should stay quiet. If a retune breaks five tests,
four of them were asserting the wrong thing.

**Green is not correct.** Deep Field ran 75 passing test files over a build that
did not compile. A suite that can only confirm is not evidence.

### A duplicated-constant defect can only be caught by reading the source

When a constant's value is also written as a literal somewhere else — most often
in the user-facing message beside the check — **no behavioural assertion can
detect it**, because while the two agree the interpolated and hardcoded strings
are byte-identical. Asserting the returned message equals
`` `Video must be at least ${MIN} seconds long.` `` passes on the buggy code.
Verified: reverting the source to a literal with `MIN` untouched left all 8
tests green.

Reading the source is the only thing that distinguishes *derived* from
*coincidentally equal*. See the commented test in
`src/lib/__tests__/product-video.test.ts`, which greps the three limit messages
and requires each to interpolate its constant.

Two rules for writing that kind of guard:

1. **Match the constant anywhere inside the interpolation**, not adjacent to
   `${`. The size message wraps its constant in `Math.round(... / (1024*1024))`,
   and a stricter pattern fails on correct code. A guard that false-alarms gets
   deleted by whoever hits it next, so false-alarm-proofing is a durability
   property, not politeness. (Deep Field hit this on all three of theirs.)
2. **Mutate one thing at a time.** This hole hid for a full review cycle because
   the mutation used to "prove" the test changed the constant *and* the message
   together — which does fail, so it looked verified. One mutation testing two
   things at once proves neither independently. Generalises to any check whose
   setup moves more than one variable.

A related class is worth naming but not auto-fixing: **UI that asserts a rule
nothing enforces** (Deep Field found `{n}/20 photos` displayed with no 20 cap in
code). It presents identically to a drifted constant — the number shown is not
the number that binds — but the fix is a product decision about whether the cap
should exist, not a code change. File it; do not invent a limit to make a label
true.

## Compliance And Marketing

Account registration records policy acceptance. Newsletter subscribers are
explicit opt-in; account holders are an opt-out marketing audience. Campaign
sends require an admin check, configured physical address, unsubscribe
handling, and Resend event recording.

The legal pages provide an operational baseline, not legal advice. Owner/counsel
review remains required. New non-essential tracking requires a real consent
preference update before deployment.

## UI Conventions

### --color-primary is the light-surface gold; #f2ca50 is its on-dark counterpart

`--color-primary` is **#735c00**. On light surfaces it passes comfortably
(5.26–6.44:1 across `/free-evaluation`). On a dark hero it does **not** — the
"100% Free — No Obligation" eyebrow measured **2.96:1** on #0e0f0f, below AA at
any size, and read as a dimmed control rather than an accent.

Use **#f2ca50** for gold text, borders and accents on dark surfaces (12:1 on
#0e0f0f). That is what the `/free-evaluation` hero kicker, metal terms and trust
chips already use, so it is a consistency win as well as a contrast one. The
same trap produced the earlier `.gold-button` primary-CTA fix on this page.

When adding gold to a dark section, check the computed contrast rather than
assuming the token is safe — the token is correct, it is just scoped to light.

### Centre wrap groups of repeated small items; leave prose-anchored rows alone

A row of **pills / chips** — three or more small repeated items that wrap — gets
`justify-center` at the widths where it actually wraps, and returns to
`justify-start` at the breakpoint where its container becomes a left-aligned
column (`lg` on `/free-evaluation`). A ragged tail (2 / 1 / 1) reads as a bug;
a centred stack reads as deliberate.

This does **not** extend to:

- **Hero CTA rows of one or two buttons** that sit under left-aligned prose.
  They fit on one line at 375px, so there is nothing ragged to fix, and
  centring detaches them from the copy they belong to.
- **Chips inside cards or prose columns** (shop cards, product detail,
  related products). Those inherit the card's left edge on purpose.
- **Footer link grids.** A short last column is correct list behaviour.

⚠️ **Do not audit this with a `display: flex` scan.** The homepage hero's
Buy / Sell / Trade group carries flex classes in the markup but `.home-hero-actions`
overrides it to `display: grid` at `144px 144px`; a flex-only sweep reports the
page clean while missing it entirely. Measure per-row left/right padding against
the container and flag rows where the two differ.

There is exactly one password input in the customer-facing app
(`components/account/PasswordInput.tsx`, over the `.password-field` utility
in `globals.css`). Never hand-roll another — a source guard in
`password-input.test.ts` fails the suite if any file outside that component
declares `type="password"`.

This rule exists because the account area had drifted into three different
treatments across seven fields before 2026-08-02: an eye toggle on sign-in, a
text "Show/Hide" button in a bordered segment on sign-up and reset-password
(which also rendered a differently sized input than the email field beside
it), and no toggle whatsoever on the dashboard's Change Password panel.

The component owns the details that are easy to get wrong: right padding so
long values never slide under the button, `::-ms-reveal` suppression so Edge
does not render a second eye, a 36px tap target centred in the field, a
focus-visible ring, `aria-pressed` for state (never a static label claiming
the password is shown), `aria-controls` paired with a `useId()` fallback so
it is never dangling, and a distinct `confirm` label so two adjacent toggles
do not both announce "Show password". Pass `isEs` for Spanish.

Exception: admin token fields (Instagram/Facebook settings) keep plain
`type="password"` and are allow-listed in the guard — those are pasted API
secrets, not user passwords, and intentionally offer no reveal control.

### Admin editing surfaces open in pop-up windows, never inline

Owner rule (2026-08-01): when an admin action needs its own working area — a
crop editor, a generated preview, any focused edit flow — it opens in a modal
dialog OVER the page (`components/admin/AdminModal.tsx`: dimmed backdrop,
title bar, ✕, Escape, click-outside). It must never expand new space inline
under the trigger, which shoves the rest of the page around. Companion pattern
for collections: thumbnails are selection targets carrying badges only, and a
single toolbar acts on the selected item — per-item button clusters do not
scale visually (a 3×2 pad under 96px thumbnails shattered into text fragments
at moderate widths and was scrapped the same day it shipped).

Prepared social-post thumbnails are the one collection exception that opens a
focused viewer: `PreparedSlideViewer` presents their final, ordered upload
one-at-a-time in the same AdminModal frame. It has visible previous/next
controls plus left/right keyboard support, and disables the unavailable end
instead of wrapping because final slide order is a review detail. Both social
panels use this one component so the review behavior cannot drift. Destructive
social actions use the shared outlined-button geometry and motion with a red
hover/focus treatment; bare red text looked unrelated to the rest of the action
row and provided no hover affordance.

### Mobile admin accounts prioritize the Admin Panel entry

For authenticated administrators only, the account dashboard's Admin Panel
access card appears immediately after the account tabs and before Account
Overview at 700px and below. From 701px upward, it stays in the established
right side rail. Both placements render the same localized card component and
must be mutually exclusive so there is exactly one visible admin entry. Regular
customer accounts do not render either placement.

### Admin Products consumes surplus width only on wide desktops

The inventory table keeps its established fixed 1680/1960px minimums and
horizontal-scrolling behavior below 2100px. At 2100px and above, when the
scroll viewport can exceed the table's normal width, the inline table fills
the available space instead of leaving a white strip after the action column.
Brand gets first claim on that surplus through a fluid 150-220px target; the
browser's automatic table layout distributes the remainder across the other
flexible columns. Do not broaden this rule to laptop, tablet, mobile-fullscreen,
or narrower desktop layouts.

### Ultra-wide expansion is opt-in by canvas, not a global max-width override

At 2000px and above, large application and grid canvases may expand through
one of three shared tiers: 1600px (medium), 1800px (standard), or 2200px (wide),
always retaining 3rem outer gutters. This covers the storefront, product
detail, account dashboard, admin data surfaces, marketplace managers, public
service/sell grids, and footer without making every centered element wider.

Do not globally override Tailwind `max-w-*` classes. Long-form legal/FAQ prose,
auth forms, checkout steps, modals, and focused sequential content depend on
their narrower measure for readability and task clarity. New large canvases
must explicitly choose a tier; the source guard enforces this for the standard
large-width tokens.

### Product-summary specifications wrap as one group

In the product-detail eyebrow, availability is a status badge while
metal/purity and length are product specifications. The specifications remain
in one no-wrap group. If the full row lacks room, that complete group moves
beneath the badge; never allow length alone to become an orphaned second line.
This content-aware flex grouping is preferred over a viewport breakpoint
because Spanish labels and the tablet two-column layout need different amounts
of space.

### A dark product page themes the PAGE, and light cards opt back out

A product whose first photo is shot on black renders a dark variant: `<main>`
gets `.product-page-dark` plus inline overrides of `--color-on-surface`,
`--color-on-surface-variant`, `--color-primary` and `--color-outline-variant`.
Every product page therefore exists in two versions, and both must be checked.

The rule that keeps them correct: **the dark palette applies to content sitting
on the dark page, never to a surface that paints its own light background.**
Anything with a light background of its own carries `product-light-surface`,
which restores the four tokens from the `--color-*-light` aliases captured on
`:root`. Today that is the related-product cards and the review cards; both were
rendering near-white text on a white card at 1.12:1 before 2026-08-04.

Two supporting rules:

- The light aliases are declared as `var()` of the real tokens on `:root`, not
  as repeated hexes, so `@theme` stays the single source. They resolve against
  `:root`, so a descendant override of the real token cannot reach them.
- Fix theme contrast in CSS via the token layer, not by hardcoding colours in a
  component — those components are shared with the light-theme page and the
  homepage, where they were already correct.

Verify by measurement, not by eye: audit computed contrast for every text node
under `<main>` on BOTH a light-backdrop and a black-backdrop product, in both
locales. Two traps when writing that audit — `color(srgb …)` values are 0-1
floats rather than 0-255, and text over a CSS gradient cannot be judged from
`backgroundColor` and must be skipped instead of reported.

### The product gallery has no magnifier, and its arrows only navigate

Owner decision 2026-08-04: the hover/touch magnifier is removed at every
viewport. Full-size viewing is the lightbox, opened by clicking the main photo.
Do not reintroduce a magnifier without also restoring what it required — an edge
dead-zone so the prev/next buttons stay usable, and `touch-action: none` on the
frame, which is what stopped a vertical swipe starting on the photo from
scrolling the page.

An edge arrow must navigate and do nothing else. The arrow sits on top of the
frame that opens the lightbox, so the button stops propagation itself
(`handleEdgeNavigation`) AND `openLightbox` ignores any click inside
`.product-gallery-edge-button`. That guard must test `instanceof Element`, never
`instanceof HTMLElement`: the visible chevron is an inline SVG and an SVGElement
fails the HTMLElement test, which is exactly how clicking the arrow used to open
the lightbox. Stopping propagation on `pointerdown` alone does not help either —
`click` is a separate event that still bubbles.

**The arrow is drawn as a full-height bar, and the bar IS the hit area** (owner
request 2026-08-04). It previously drew a 44px circle inside a much larger
invisible hit area, so the control looked far smaller than it was. Keep visual
and hit area identical — that is the whole point.

Four rules for the bar, all from owner feedback (2026-08-04/05):

1. **Flat scrim, hairline inner edge — never a fade.** A gradient dissolving
   toward the centre leaves the strip with no visible end, so nothing says where
   the clickable area stops.
2. **Narrow and against the edge**: `clamp(2.75rem, 11%, 4.25rem)`, i.e. 63px on
   a 576px frame and 44px (the tap-target floor) on a phone. At the original 28%
   a click aimed at the piece, expecting the lightbox, landed on the bar. The
   centre 15%–85% of the frame must stay the lightbox's.
3. **The scrim must not depend on knowing what is behind it** (2026-08-05). It
   is ONE treatment that moves the backdrop both ways at once —
   `backdrop-filter: brightness(0.82)` darkens light content while
   `rgba(255,255,255,0.16)` lifts dark content — with a white, dark-haloed
   chevron for the same reason.

   Do NOT reintroduce a light/dark scrim pair chosen from the frame's padding
   colour. That was the first design and it failed from the second photo on: the
   bar sits over the PHOTO, and the padding and the photo routinely disagree. A
   black-padded frame carrying a cream photo picked a white scrim, which vanished
   over the photo and survived only in the padding bands — indistinguishable from
   the photo being painted on top of the panel.

   The blur is load-bearing too: softening what is behind the strip is what makes
   it read as an overlay rather than part of the photo.
4. **The bars are the top layer inside the frame** (`z-index: 30`), above both
   gallery images, the cross-fade layer, and the video iframe.
5. **The bars exist from 768px only** (owner decision 2026-08-05). Below that a
   swipe replaces them: a phone frame is ~344px wide and two 44px bars claim a
   quarter of it permanently, while a swipe costs no space. Tablet and desktop
   keep both. This is a WIDTH query, not `(hover: none)`, so a desktop window
   narrowed past 768px behaves like the mobile layout it is displaying.

Swiping the main image changes photo on touch pointers only — a mouse drag stays
a plain click, leaving the lightbox, text selection and the proximity reveal
alone. Rules that keep the gesture honest:

- `touch-action: pan-y pinch-zoom` on the frame. `none` would also take vertical
  scrolling and pinch-zoom; `auto` would let the browser consume the horizontal
  drag before the handler sees it.
- Commit to "this is a swipe" only when the drag is both >10px sideways and more
  sideways than vertical, so a page scroll that starts on the photo still
  scrolls.
- ANY drag over ~10px suppresses the click that follows, not just a committed
  horizontal one. Browsers usually swallow that click once a touch becomes a
  scroll, but testing showed a vertical drag opening the lightbox when the code
  depended on it.

Each bar reveals independently, and the reveal is PROXIMITY-based, not a plain
hover (owner request 2026-08-04): the gallery tracks the pointer across the
frame and writes `--edge-prev-reveal` / `--edge-next-reveal`, which each bar
reads. The ramp runs 28% of the frame width inward from the bar's inner edge on
a smoothstep curve, reaching 1 when the pointer is over the bar.

**The reveal ramp and the clickable area are separate on purpose.** Widening the
button to match the ramp would bring back the mis-click the narrow bar was
introduced to fix; the bar advertises itself from a distance without growing.

The tracking is mouse-only — an inline reveal value would permanently override
the `(hover: none)` treatment after a single tap — and the `:hover` rule stays as
the pre-hydration/no-JS fallback.

Because the reveal is hover-based, `(hover: none)` shows the bars permanently —
otherwise the affordance is invisible on touch, where it matters most.

### Product-detail thumbnail rails keep the active-next pair visible

The page gallery and full-screen lightbox share one circular thumbnail-track
behavior. Selecting or advancing media centers the active thumbnail together
with its logical next thumbnail, so controls never advance into an offscreen
selection. Two accessibility-hidden edge clones on each side provide a visible
last-to-first/first-to-last transition; after the transition, the rail resets
without animation to the matching original. Real thumbnails remain the only
focusable/announced choices. Preserve keyboard arrows, touch scrolling,
reduced-motion behavior, resize correction, localized labels, and no
document-level overflow from 320px upward. Rail widths and scroll offsets snap
to complete card-and-gap increments: partial thumbnail cards must not appear at
either viewport edge when motion settles. Navigation uses a controlled eased
requestAnimationFrame flow instead of relying on browser-native smooth scroll,
which was being interrupted by resize normalization and appeared as an instant
swap. Resize correction must not run during active motion; rapid navigation
continues from the live offset. Circular edge-clone normalization happens only
after animation completion, while reduced-motion preference keeps immediate
positioning.

### Shop is a direct nav link with no submenu

Owner decision 2026-08-01: the header's Shop control links straight to
`/shop` at every viewport — no dropdown on desktop, no accordion in the
mobile menu. The auctions page that used to live in that submenu is retired
(`/auctions` 301s to `/shop`), and both aspirational legal pages were
retired with it the same evening: `/auction-terms` and `/vendor-terms`
(each 301s to `/terms`). The legal set is now the six real policies only.
Do not reintroduce a Shop submenu or any retired page without an owner
request; Sell and About keep their dropdown/accordion pattern.

### Thin-mobile headers preserve the brand and primary actions

From 320px upward, the public header must keep the full
`Naples Estate Jewelry` label (owner dropped the domain suffix from the
header wordmark 2026-08-01) plus the language, call, cart, and menu
controls visible without horizontal overflow. Below 400px, compact
micro-spacing and fluid brand typography are preferred over truncating the
brand or hiding a primary action. Below 350px, proportionally reduce the visible
call/cart controls, glyph/count badge, and outlined menu while keeping every
action present and usable; regular mobile/tablet sizes remain unchanged.

### iOS format detection stays off; tappable numbers are explicit anchors

Root-layout metadata disables telephone/date/address/email format detection
site-wide: iOS Safari's auto-linking rewrites server-rendered text before
hydration and caused real iPad hydration failures (confirmed live
2026-07-31). Consequently, any visible phone number that should be tappable
must be written as an explicit `<a href="tel:...">` — never rely on browser
auto-detection. Do not remove the `formatDetection` metadata.

### Live-spot surfaces are tap-to-refresh via SpotRefreshPill

Spot-price displays (shop badges, mobile spot row, product "Based on spot"
box) share `SpotRefreshPill`: tapping runs `router.refresh()` so the pill
and every server-rendered price update together, confirmed by a portaled,
timestamped note (portal to document.body is required — sidebar reveal
animations create stacking contexts that clip in-place tooltips). The pill
root must remain a DIV with an inner stretched button because shop CSS
targets `.shop-search-spot-row > div:nth-child(...)` for layout. Product
pages' ticker shows "Last updated <time> · Updates in <m:ss> · <time>" in
pinned America/New_York time. That complete sequence is a single no-wrap unit:
use fluid 8-9.92px label type and compact tracking so English and Spanish both
remain intact from 320px upward and in the narrow tablet product column; do not
truncate or hide any timestamp. The Weight spec shows only the written-out
localized total ("N grams total" / "N gramos en total").

Customer text actions use one left-to-right underline reveal for hover and
keyboard focus, with reduced-motion support. Persistent content underlines and
selected indicators remain unchanged.

Customer page-reveal animations must never gate the visibility of a product
page on offscreen or lazy-loaded gallery thumbnails. The shared reveal ignores
lazy images and has a short fallback, so primary content remains visible even
if a non-lazy media resource stalls; deferred media may load afterward. The
pending→visible commit must also never depend solely on
`requestAnimationFrame`: hidden documents (background tabs, prerendering,
non-compositing webviews) suspend frames indefinitely while pending content
blocks pointer events, so the reveal commits immediately when
`document.visibilityState` is `hidden` and keeps a bounded timeout backstop
while visible.

When a buyer opens a product from the shop, preserve the exact localized shop
URL and vertical position in tab-scoped session storage. Back to Shop restores
that recorded context only for the same product and shop URL; direct product
entries retain the ordinary `/shop` fallback. This avoids polluting shareable
product URLs with transient navigation state.

Desktop interactive controls should expose a small, consistent hover lift or
color/background reaction plus press feedback. Mobile-only controls are not
part of the desktop affordance audit unless a future mobile pass is requested.

Admin Products does not display separate Total, Available, or Sold summary
cards. Keep the page focused on the inventory table, filters, and row actions;
this applies consistently across desktop, tablet, and mobile layouts.

The Admin Products shell is a fixed dynamic-viewport flex layout. Page-level
scroll is suppressed so the product table wrapper owns the inventory scroll;
this keeps the header and controls static across viewport sizes.

Async actions show immediate press feedback plus a durable loading/success/error
state. Financial summaries always show cents. Empty or inapplicable customer
fields are omitted rather than rendered as blank labels.

### Social queues stay channel-specific inside one owner dashboard

Instagram and Facebook retain separate persisted queues and independent
scheduled order; a combined sort would imply ordering guarantees that do not
exist across channels. The Admin **Social Queues** dashboard presents both
sections on one route, selects only the row/product fields needed for display,
and provides the narrow queue mutations the owner needs: edit the prepared post,
publish it immediately, change its time, or remove it while retaining prepared
copy. **Post now** is available only for a ready post on a connected channel and
always crosses a confirmation boundary that names the channel, says the
reservation will be bypassed, and repeats Instagram's irreversible edit/delete
limitation. It must use the same receipt-safe publish state machine as the
manager page; the dashboard never implements a second publishing path. Once
confirmed, this work belongs to a provider mounted at the locale layout so it
survives ordinary client-side navigation instead of trapping the owner in a
modal. Only one social publish may run in the tab at a time. Success auto-clears
after a short notification; failure stays visible and retry is allowed because
the underlying Instagram/Facebook state machines are receipt/checkpoint safe.
Hard reloads or closing the tab are not presented as durable job persistence.

Bulk immediate publishing is channel-specific. The owner manually selects ready
rows inside either Instagram or Facebook and crosses one confirmation boundary
that lists the selected posts. The provider then calls the existing receipt-safe
single-post state machine sequentially in the dashboard's visible queue order;
there is no bulk provider endpoint or parallel public write. The first failure
stops the batch. Retry resumes at that failed item, using the completed count so
already published entries are never intentionally repeated. A running individual
post or batch retains the one-task-per-tab lock.

Recent published-post management stays receipt-led and channel-honest. The
dashboard reads only the 12 newest rows still marked `published` per channel and
opens them in one **Latest Posts** modal. View links and local manager links are
non-mutating. Refresh delegates to the existing conservative remote check.
Owner-written comments require a second compose-and-submit step, use each
channel's existing authenticated comment client, store no comment body locally,
and write only an audit outcome. Facebook Remove delegates to its existing
remote-delete path behind a permanent-action confirmation. Instagram must never
pretend API deletion exists: it opens the live post for manual removal and asks
the owner to return and refresh status. No latest-post action gets a parallel
provider implementation inside the dashboard.

The two channel histories are independent disclosures inside that modal. Both
load expanded so the first opening reveals the available posts, but clicking an
Instagram or Facebook header collapses that channel's complete body to a compact
header with its current visible count. The header itself is the accessible
button (`aria-expanded` plus `aria-controls`); no separate small toggle target
is used. Disclosure state belongs to the mounted modal and survives its internal
comment/removal confirmation views, but intentionally resets when the modal is
closed and reopened.

That jump carries only the fixed `returnTo=social-queues` sentinel, never an
arbitrary return URL. The shared manager derives the destination and label from
that allowlisted value, preserves it across marketplace tabs, and otherwise
falls back to Products. This gives the owner a reliable round trip without
introducing an open-redirect surface or changing direct manager navigation.

### Social posting uses seven explicit Eastern reservations

The only schedulable times are **noon, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM, and
midnight** in `America/New_York`. The UI exposes a date plus that seven-value select rather
than a free-form datetime control, and the queue API independently enforces the
same allowlist. Midnight means the end of the selected calendar date. The next
valid slot is the default, so the common path requires no time calculation.

`scheduled_for` is the intended posting time and `queued_at` remains the audit
timestamp for the owner's original approval. Rescheduling changes only
`scheduled_for`. Queue dashboards and workers order by `scheduled_for`, then
`queued_at` for deterministic ties. Removing a reservation clears both queue
timestamps but preserves the prepared caption and renditions.

Netlify cron expressions use the union of UTC hours needed to cover all seven
Eastern slots in both EDT and EST. This deliberately creates harmless extra
invocations around daylight-saving changes; the database due-row predicate
(`scheduled_for <= now()`) is the authority and prevents early publication.
There is no owner-configured daily post cap. Each worker invocation processes a
bounded batch of at most 25 due rows to protect its runtime, and a later
invocation continues any remainder. A transient failure, disconnected channel,
or Instagram's provider-enforced 100-per-rolling-24-hour quota can delay a post,
but nothing may publish before its reservation. Existing queued rows are
backfilled to future allowed slots rather than becoming due immediately.

A non-null `queued_at` plus a valid `scheduled_for` is the admin approval
boundary. Because `queueProduct`
uses `pending` to mark that queued prepared state while ordinary preparation
uses `review`, scheduled drips must select both states and still rely on
`runPublishStep` to fail closed when caption/renditions are absent. Selecting
only `review` leaves valid queued posts permanently stranded.

### Social card instructions name slide 1 explicitly

The CARD badge selects the source photo for the generated advertising card; it
does not mark a photo that will appear later in the carousel. Owner-facing setup
copy must say that Save & prepare creates the final card **as slide 1** and that
this finished first slide is reviewed before publishing. Avoid relative wording
such as “review it next,” which can be read as carousel order.
