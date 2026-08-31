# Tasks

> Actionable open work plus a short recent-completions summary. Full history is
> in `CHANGELOG.md`. Last reconciled: **2026-08-30**.

## ◻ OPEN — needs a human

### 🔴 DEPLOY the hero reveal-gate fix (2 files, no SQL, no env vars)

The backfill below fixed cache lifetimes but the owner STILL reproduced the
blank second card (regular Chrome, incognito, Edge). Second root-cause layer:
**both hero reveal gates waited on ALL 8 ring images with an 1800 ms cap** —
the inline `nej-hero-go` script in `(home)/page.tsx` and the React gate in
`HomeHero.tsx`. On any cold or stale-revalidating load the slowest of eight
always lost to the cap, so the hero unveiled with unready cards blank; slot 1
(the men's diamond ring, second-most-visible) is the one the owner catches.
The cap itself is LCP-load-bearing (PSI bimodal warning, 08-23) and was NOT
touched.

**Fix (gated, awaiting the owner's usual copy + push):** both gates now wait
on the **first two** card images only — the cards actually facing the visitor
at reveal, both `<link rel=preload>`ed at high/auto — and await
**`img.decode()`**, not just `load`, so a loaded-but-undecoded frame can't
paint blank. Two small preloaded images can beat the cap where eight never
could; reveal gets EARLIER on warm loads. Files:
`src/app/[locale]/(home)/page.tsx` (inline script) +
`src/components/home/HomeHero.tsx` (React gate — comments on both demand they
stay in step). Gate: `tsc` clean · lint clean · **1186/1186 (113 files)** ·
build **66 = 30 EN + 30 ES + 6** · dev-server verified (`nej-hero-go` +
`.is-ready` both flip, 0 console errors).

**After deploy, the owner's cold-load test is the acceptance test** (their
browsers still hold stale 1h-header copies until first revisit, so the FIRST
load may still revalidate — judge from the second cold-ish load onward).
If a slow connection still misses the cap for slot 1, the held-in-reserve
lever is `fetchPriority: 'high'` on slot 1 (contradicts the documented
one-high rule — would need PSI re-measurement across multiple runs).

### ✅ DONE 2026-08-31 (owner-approved) — cache-metadata backfill for pre-08-30 Storage objects

**Executed and verified same day.** Dry-run inventory: 942 objects in
`product-images`, **197 at `max-age=3600`** (all June-era; both hero rings in
the list), 745 already year-long. Backfill: **197/197 re-uploaded with the
same bytes** (sha256-verified identical before/after, 10.8 MB round-tripped,
0 failures, `update()` so URLs unchanged). Post-state: inventory reads
**942/942 at `max-age=31536000`**; fresh `/_next/image` variants of BOTH hero
rings now serve `public,max-age=31536000` and store at the edge for a year;
28 homepage-srcset variants (w=384–1080, Chrome Accept header) pre-warmed.
Old 1-hour edge entries expire within the hour and re-derive year-long.
**Cold-load blank-second-card should now be structurally gone** — owner
should confirm on a genuinely cold load (e.g. tomorrow morning).

**Symptom (owner-reported 2026-08-31):** the hero's second card (men's 10K
diamond ring) is blank again on COLD loads until it nearly rotates away; warm
loads are fine. The 08-30 `fetchPriority` fix is live and working (verified:
HTML emits high/auto/low + preloads; the ring is fetched 2nd; 10.6 KB WebP) —
the 08-30 "fixed" confirmation was simply a warm load.

**Root cause (proven 6/6):** Netlify's image CDN sets the transformed
response's TTL from the SOURCE object's stored `cacheControl` metadata.
Objects re-uploaded by the 08-30 re-encode carry `31536000` → transforms
cache **1 year**. The ~223 objects that were already valid WebP and were
therefore SKIPPED by the re-encode — including BOTH hero ring images (slot 0
`jsltovk1sr`, slot 1 `rqs5cw4bp89`, both June-17 uploads) — still carry the
old 1-hour metadata → transforms cache **max-age=3600**. On a low-traffic
site that means nearly every real visitor hits an expired edge entry, the
cold transform takes longer than the hero reveal's 1800 ms fallback
(`HomeHero.tsx`), and the second card unveils blank. ⚠️ The public Supabase
endpoint reports `Cache-Control: no-cache` for BOTH groups — do not probe
origin headers to tell them apart; correlate `Last-Modified` (< Aug 30 =
short group) with a fresh `/_next/image` variant's `max-age`.
ℹ️ `images.minimumCacheTTL` in next.config.ts is a no-op on Netlify — the
image CDN derives TTL from source metadata, not from Next config. New
uploads are already fine (`AdminShell.tsx:2925` sets `31536000`).

**Proposed fix (production Storage mutation — dry-run first, then approval):**
re-upload every `product-images` object with `Last-Modified` before the
08-30 re-encode window using the SAME bytes and `cacheControl: '31536000'`
(supabase `update()`), then verify a fresh ring variant serves
`max-age=31536000` and bytes hash-match. Backups from 08-30 still exist at
`C:\Users\rcman\NEJ-image-backup-2026-08-30`. No code change needed.

### ✅ DEPLOYED 2026-08-31 — the 2026-08-30 SEO growth batch (no SQL, no env vars)

**Production verified 2026-08-31 after the owner's push:** all 7 new/changed
routes return 200 in both locales; `/sell/naples` renders the buyer-noun H1 +
showroom band; `robots.txt` shows `Allow: /api/merchant-feed`; the feed
returns 200 with **76 items / 0 skipped / 0 sold** (sold rope chain absent,
Gorham knife present), headers `Content-Type: application/xml` +
`X-Robots-Tag: noindex`. Merchant Center swap + GSC follow-ups below.

Everything is gated (`tsc` · lint · **1186/1186 (113 files)** · build exit 0 ·
**66 prerendered = 30 EN + 30 ES + 6 non-locale**) and dev-server-verified in
both locales.

✅ **STAGING SYNCED 2026-08-31 — ready to copy to the repo and push.**
15 files copied (11 app + 4 project-docs), 4 new dirs, 0 failed; follow-up dry
run **0 to copy**. **894 files / 20.38 MB** on disk (robocopy total 897 = the
documented 3 `/XF`-excluded). The 3 new pages + `api/merchant-feed/route.ts`
literal-path-verified in staging (⚠️ `Test-Path` needs `-LiteralPath` for
`[locale]` paths — brackets are wildcards otherwise); `.git` absent.
(ℹ️ Doc-recording + docs-only re-sync done — the standing 2nd-sync step.)

**Files:**

- `src/lib/service-areas.ts` — per-city override fields + Naples entry
  (buyer-noun title/H1/meta, `hasShowroom`)
- `src/app/[locale]/sell/[city]/page.tsx` — metadata/H1 overrides, showroom
  band, walk-in FAQ, card-heading links
- `src/app/[locale]/jewelry-appraisal/page.tsx` — NEW
- `src/app/[locale]/silver-services/flatware-value/page.tsx` — NEW
- `src/app/[locale]/diamond-buyers/page.tsx` — NEW
- `src/app/[locale]/silver-services/page.tsx` — flatware band closing line now
  links the guide
- `src/app/[locale]/shop/[id]/page.tsx` — buy-side crossover band
- `src/components/layout/SiteFooter.tsx` — +"Sell Diamonds", +"Free Appraisals"
- `src/app/sitemap.ts` — +3 paths
- `src/app/api/merchant-feed/route.ts` — NEW (2026-08-31, Google Merchant
  product feed; see the Merchant Center block below)
- `src/app/robots.ts` — `/api/merchant-feed` carved out of the `/api` disallow

**After deploying:** spot-check `/sell/naples` + `/es/sell/naples` (new H1 +
showroom band with live hours), the three new pages in both locales, and one
gold + one silver product page (crossover band). Then request indexing for the
6 new URLs in GSC (quota permitting — it reset today). ⚠️ The footer-scoped ES
production check now expects **24/25** links (was 22/23) — the two new footer
links are the delta, not a regression.

🟡 **GSC indexing 2026-08-31: 1 of 6 done, then QUOTA EXCEEDED.**
`/jewelry-appraisal` (EN) requested successfully. Two blind Enter keypresses
then re-fired "REQUEST AGAIN" on that same URL (duplicates don't change queue
position but DO burn quota) and the 4th submission returned "Quota Exceeded —
try again tomorrow". ⚠️ **GSC UI trap to add to the list: after a request,
keyboard focus stays on the REQUEST AGAIN button — Enter re-submits it, and
typing goes nowhere until the inspect box is re-focused via its element ref
(coordinate clicks + type were silently swallowed).** Compensations done:
sitemap.xml **resubmitted** ("Sitemap submitted successfully") so the 6 new
URLs enter normal discovery.
◻ **OWED next session (2026-09-01+, quota resets daily):** request indexing
for the remaining 5 — `/es/jewelry-appraisal`,
`/silver-services/flatware-value` + `/es/…`, `/diamond-buyers` + `/es/…`
(and optionally re-inspect `/sell/naples` for the retitle).

**◻ Owner follow-ups from the SEO session:**

1. **GBP photo batch** (audit item 4, owner-held): exterior with the Sharon
   Lynch entrance, interior, testing bench/XRF in use, Chris at work, a
   flatware lot on the scale — then set a real photo as cover.
2. ✅ **Merchant Center setup COMPLETED 2026-08-30 (5/5 tasks, "You're all
   set")** — done in-session at the owner's request. Shipping = price-based
   table mirroring `checkout-shipping.ts` Standard tiers exactly
   ($0.01–99.99→$19 · 100–249.99→$25 · 250–599.99→$29 · 600–999.99→$35 ·
   1,000–2,499.99→$59 · 2,500–14,999.99→$99 (the two $99 bands merged) ·
   15,000+→$165), max handling 2 business days (owner-set). Returns =
   "defective products only" (maps to the site's 5-day misrepresentation
   guarantee), no exchanges, policy URL /returns-refunds, match-my-website
   attestation confirmed (Google may review, up to 10 days).
   ◻ **Watch:** products list read "No products added yet" right after setup —
   the "products found by Google" crawl source needs hours-to-days to ingest
   the site's Product schema. If still empty after ~a week, set up a real feed.
   ℹ️ A "Link to Business Profile" dialog offered ONLY the Surette profile
   (NEJ's likely already associated) — deliberately cancelled; never link the
   wrong business there.
   ⚠️ If the site's shipping tiers in `checkout-shipping.ts` are ever
   re-priced, update this Merchant Center table in the same change — nothing
   syncs them automatically.
   🆕 **2026-08-31 — the crawl source ingested 106 entries including all sold
   pages (correctly Out of stock, nothing mislisted — every entry was still
   "Under review") and BOTH locales of each product.** Owner flagged it. Fix
   BUILT: `/api/merchant-feed` (Google Shopping RSS; available products only;
   one entry per product keyed `nej-<inventory#>` — g:id caps at 50 chars so
   slugs can't be the key; canonical `getProductPriceValue` prices; fails
   closed with 503 when live spot is down, exactly like eBay/Etsy pushes, so
   Google keeps its last good copy; skip counts in an XML comment, never
   silent). `robots.ts` carves `/api/merchant-feed` out of the `/api`
   disallow (specific rule wins) and the route sends `X-Robots-Tag: noindex`.
   Verified on dev: 200, 76 items, 76/76 ids unique (max 7 chars), 0 sold
   items, 0 unescaped entities, headers correct.
   ✅ **MERCHANT CENTER SWAP DONE 2026-08-31** (on the owner's tab, at their
   request): (1) feed added as a data source — named **"Website Feed
   (naplesestatejewelry.com)"**, File (URL) scheduled fetch daily at 12:00 AM,
   countries **United States only** (defaults offered all ~246 — changed),
   language English, feed label `US`, marketing methods Free listings + Free
   local listings; first manual fetch 7:51 AM ET = **76 total updated
   products, "All recognized" attributes, "No issues found"** in the file;
   (2) "Found by Google" crawl source **stopped** ("Stop managing products"
   confirmed — its 106 entries incl. the sold/dual-locale clutter will drain);
   (3) automatic item updates left ON.
   ◻ **Watch (re-check in a few days):**
   - Source header showed **59** products vs 76 in the file right after the
     swap — attribution lag while the stopped crawl source drains; the 12 AM
     scheduled fetch should reconcile it to 76. Chase only if it persists.
   - **`nej-108` (William Suckling salt cellar) "Not approved": "Dangerous
     knives"** — an automated false positive (it is a salt cellar); MC notes
     "other products may have the same issue," so expect the same flag on the
     Gorham carving knife / Whiting grape shears.
     ✅ **Dispute submitted 2026-08-31 at the owner's request** — reason "My
     product meets the policy requirements", banner now reads "Review
     requested on Aug 31, 2026. It can take a few days to complete."
     ⚠️ If NOT approved, MC enforces a multi-day cooldown before the next
     request. If the knife/shears get the same flag, THEIR truthful dispute
     reason is "designed as a utility and household purposes" (they are real
     cutlery), not "meets the policy requirements".
   - **ℹ️ "Unsupported image type [additional_image_link]"** (info-level, on
     nej-108 and likely catalog-wide): MC accepts only **JPEG/PNG/GIF** for
     additional images and the whole catalog is WebP by design — so listings
     keep the main image but lose the extra gallery shots. Main `image_link`
     drew no format complaint (watch whether one appears after full
     processing — that would be a real problem). Optional fix later: a
     transcode route (sharp WebP→JPEG) or Supabase image transformations for
     the feed's `additional_image_link` URLs only — do NOT convert the site's
     stored images (the WebP pipeline is a deliberate site-wide rule).
   - Product images showed "In progress" (Google still crawling them) and
     everything sits "Under review" until the ≤10-day store review finishes —
     both normal, no action.
3. ✅ **DONE 2026-08-31 — "Recently Through Our Doors" proof strip BUILT on
   /silver-services** (owner approved the mockup). Owner had suggested mock
   set specs + internet photos; DECLINED — fabricated purchase records and
   unowned photos. The strip is 100% real instead: three catalog pieces
   (Tiffany Acanthus punch ladle 53, Whiting grape shears 127, Ball Tompkins &
   Black coffee pot 55 — own product photos via next/image + supabase remote,
   accurate `sizes`, cards link to live product pages which persist after
   sale) + Linda Cusumano's quote rendered FROM `testimonials.ts` (already
   there verbatim — no duplication, single-source rule holds). Both locales
   verified on dev; gate green (1186/1186 · 66 routes = 30/30); zero console
   errors. ⛔ Never swap in mock sets/stock photos — provability is the point.
   ℹ️ Curated by hand: swap the three entries in `silver-services/page.tsx`
   whenever the owner wants new features. Deploys with the batch above.
4. ✅ **DONE 2026-08-31 — /silver-services maker card aligned** with the
   top-tier-only rule (owner chose "light align"): list → "patterns such as
   Tiffany Chrysanthemum, Georg Jensen"; price-both-ways promise and the
   we-stock-Chantilly/Francis-I line KEPT. Both locales, gate green
   (1186/1186, 66 routes), verified on dev. Deploys with the batch above.
5. ✅ **DECIDED 2026-08-31 — Facebook stays, grow lightly.** Auto-posting
   already feeds it; it's linked on GBP + in SAME_AS. Growth = invite
   customers/friends, link it from receipts/email footer. Never retire it
   silently — it's a citation now.
6. ✅ **DECIDED 2026-08-31 — the gov-ID checklist line on /sell/naples
   STAYS** (owner call): practical what-to-bring prep is a different surface
   than a GBP Q&A headline. The GBP-Q&A veto still stands (module is retired
   anyway).
7. **Weekly GBP post cadence** (rotation: new arrival → what we're buying →
   review spotlight → showroom note; reuse admin social-queue cards; convert
   WebP→JPG before upload).
8. **Review replies**: keep the 48-hour SLA — reply to each new review from
   Read Reviews (all 23 are answered as of 2026-08-30).

### ✅ DONE 2026-08-30 — ALL 7 owed Request Indexing calls submitted successfully

Quota was open; all seven product URLs (amethyst earrings 93, cufflinks 80,
Whiting teaspoon 101, grape shears 127, William Henry 90, salt cellar 108,
Zina brooch 78) show "Indexing requested". The salt cellar had already been
crawled Aug 29 on Google's own — the sitemap is working. This closes the item
open since 2026-08-28.

### ✅ DONE 2026-08-30 — blank carousel card DEPLOYED + owner-confirmed fixed

Two separate problems, found together. **Both shipped. Nothing outstanding.**
Production emits `high / auto / low…`; owner confirmed the second card now
appears with the rest.

**1. The reported symptom — the second card stayed blank.** Cause was
`fetchPriority`, not payload: slot 0 was `high` and *every* other slot `low`, so
slot 1 (adjacent to the front card, among the first seen) shared a bandwidth
lane with slot 7. Fixed in `src/lib/storefront-image-loading.ts` — slot 1 is now
**`auto`** (never `high`; that lane is the front card's). +2 regression tests.

🔴 **An earlier note here said NOT to touch that file in the same pass, on the
theory that image payload was the dominant cause. That theory was WRONG** — see
the correction in `CHANGELOG.md`. At the width browsers actually request
(`w=640`, resolved from `sizes`) the heavy images deliver 36–38 KB, and
re-encoding did not move that number at all.

**2. 659 of 882 bucket objects were PNG under `.webp` names** (75%, 1,116.9 MB).
Re-encoded to real WebP: **1,116.9 MB → 99.4 MB (91.1% smaller)**, 659 uploaded,
**0 failed, 0 skipped**. Origin objects now return `image/webp`.

- Backups: `C:\Users\rcman\NEJ-image-backup-2026-08-30` — 659 files under their
  TRUE extension plus `_manifest.json`; counts matched before any write, and the
  re-encode read from that archive rather than re-downloading.
- Uploaded to the SAME object paths (`upsert`), so `products.image_urls` and any
  eBay/Etsy listing pointing at those URLs still resolve.
- ⚠️ **Transparency guard ran on every one of the 659**, not a sample: 0 had
  real transparency, so dropping the (fully opaque) alpha channel was lossless.

✅ **STAGING SYNCED 2026-08-30 (2nd sync) — ready to copy to the repo and push.**
Dry run queued exactly **12 files** — the 5 source/test files, `package.json` +
`package-lock.json`, `AGENTS.md`, and 4 memory docs. Real run **12 copied /
0 Extras / 0 Mismatch / 0 FAILED**; follow-up dry run **0, exit 0**.
**890 files / 20.27 MB** (robocopy total 893 = the documented 3 `/XF`-excluded).

Leak check clean — 0 `.git` (dir *or* file), 0 `worktrees`, 0 `node_modules`,
0 `.next`, 0 `.env*`, 0 `*.log`, 0 `*.tsbuildinfo`, 0 `next-env.d.ts`, 0
`*.pem` — against a **positive control of 181 `.tsx` matching source exactly**.

Staged-content checks (bytes, not just filenames): `image-encode.ts` present and
compares `blob.type === type` with a JPEG fallback; `storefront-image-loading.ts`
carries the slot-1 `auto` branch; `AdminShell.tsx` imports the helper and has
**no** hardcoded `.webp` filename or `contentType`; `package.json` carries the
nanoid override; `AGENTS.md` carries the verify-the-encode rule. Hidden paths
present; CSP hazard reads 1 hit each.

◻ **Owner glance:** the admin now **warns** when a browser cannot save WebP. If
that appears while uploading, that browser is the source — add photos from
Chrome or Edge instead.

✅ **VERIFIED AFTER DEPLOY.** Production carousel emits `high` (slot 0) /
`auto` (slot 1) / `low` (2–7), and **the owner confirmed the symptom is gone**.

⚠️ Worth remembering how this was closed: **no automated check could prove it.**
The gate proved the markup correct; only a real cold load could prove the card
appears. When a symptom is timing/bandwidth-shaped, plan for an owner check
rather than treating a green gate as confirmation.

ℹ️ No cache purge was needed. The `w=640` transforms were verified with
`cached == fresh`, so nothing stale is being served at the delivered width.

### ✅ DEPLOYED AND PRODUCTION-VERIFIED 2026-08-30 — the Spanish footer fix

Five pages passed no `locale` to `SiteFooter`, so their `/es` versions served
an English footer whose 23 links all dropped the `/es` prefix — every footer
click ejected a Spanish visitor into the English site. **Fixed, deployed, and
confirmed live.** No SQL, no env vars. Nothing outstanding.

**Production, footer-scoped, all five at 22/23 Spanish links + ES chrome**
(they were **0/23 with an English footer**), matching the `/es/sell` control
exactly:

| Page | Footer `/es/` | Footer total | Chrome |
| --- | --- | --- | --- |
| `/es/faq`, `/es/bullion`, `/es/gold-services`, `/es/silver-services`, `/es/estate-services` | **22** | 23 | Spanish |
| `/es/sell` (control, untouched) | 22 | 23 | Spanish |
| `/faq`, `/bullion`, `/shipping` (negative control) | **0** | 23 | English |

The negative control is the one that mattered — a fix that over-applied would
have looked identical on the positive check alone.

Files (one token each, `locale={locale}` added):
`src/app/[locale]/{silver-services,gold-services,faq,estate-services,bullion}/page.tsx`,
plus `components/layout/SiteFooter.tsx` — the prop is now **required**
(`locale: string`, no default), so this cannot silently recur.

Gate: `tsc` clean · lint clean · **1176/1176 (112 files)** · build exits 0 with
**60 prerendered routes = 27 EN + 27 ES** (⛔ do not read the `(N/N)` progress
line as a page count — see `STRUCTURE.md`).

✅ **STAGING SYNCED 2026-08-30 — ready to copy to the repo folder and push.**
Dry run queued exactly **11 files** (the 6 app files above + 5 memory docs),
real run **11 copied / 0 Extras / 0 Mismatch / 0 FAILED**, follow-up dry run
**0 to copy, exit 0**. **888 files / 20.24 MB** on disk (robocopy total 891 =
the documented 3 `/XF`-excluded files — not a missing-file bug).

Leak check clean — 0 `.git` (dir *or* file), 0 `worktrees`, 0 `node_modules`,
0 `.next`, 0 `.env*`, 0 `*.log`, 0 `*.tsbuildinfo`, 0 `next-env.d.ts`, 0
`*.pem` — against a **positive control of 181 `.tsx`, matching in source and
staging**, so the zeros are real rather than a broken scan.

Staged-content checks: `SiteFooter.tsx` has `locale: string` with **no** `?:`
and **no** `= 'en'`; all six pages (the five fixed + `sell` as control) carry
`locale={locale}`; **0** bare `<SiteFooter />` anywhere under staged
`next-app/src`. Hidden paths present: `.github/workflows/scheduled-jobs.yml`,
`.gitignore`, `.claude/launch.json`, `next-app/.npmrc`, `netlify.toml`. The
standing CSP hazard reads **1 hit each** for `maps.google.com` in root
`netlify.toml` and `next-app/next.config.ts`.

ℹ️ Recording this result drifts staging by memory docs only — the owner's
accepted standing preference.

🔴 **The re-check command MUST be footer-scoped.** A whole-page grep for
`href="/es/` is the obvious version and it is WRONG — it counts header nav and
the language switcher too. Run this instead (expect **22 / ES** on `/es/*`,
**0 / EN** on the English twins):

```bash
for u in es/faq es/bullion es/gold-services es/silver-services es/estate-services faq bullion; do h=$(curl -s "https://naplesestatejewelry.com/$u"); f=$(printf '%s' "$h" | sed -n 's/.*<footer/<footer/p' | sed 's#</footer>.*#</footer>#'); printf "%-24s es=%-4s total=%-4s %s\n" "/$u" "$(printf '%s' "$f" | grep -o 'href="/es/[^"]*"' | wc -l)" "$(printf '%s' "$f" | grep -o 'href="/[^"]*"' | wc -l)" "$(printf '%s' "$f" | grep -qo 'Vender Oro' && echo ES || echo EN)"; done
```

⚠️ **The trap, measured 2026-08-30 — an unscoped grep reports two false
signals at once**, and both look like the deploy failed:

- `/es/*` reads **24**, not 22. The 3 extra unique hits are header-nav links
  (`/es/sell`, `/es/bullion`, `/es/services`), which were always correct.
- An English page reads **1**, not 0. That hit is `href="/es/faq"` — the
  **language switcher**, which every English page correctly has.

⛔ So "0 `/es/` links on an English page" is only true of the FOOTER. State the
scope in any future check, or the negative control invents a regression.

✅ **DONE in the same session — the prop is now required**, so a missing
`locale` is `TS2741` at the call site instead of a silent English footer.
Mutation-tested (removed it from `bullion`, confirmed the error, reverted).
⚠️ It needed **no** call-site changes: all 21 already passed `locale={locale}`.
The earlier "touches LegalPolicyPage / not-found / shop / checkout / account"
sizing was wrong — `LegalPolicyPage` already required `locale`, and root
`not-found.tsx` never renders a footer. ⛔ Never reintroduce a default.

✅ **DONE 2026-08-30 — the 456/457/458 disagreement is resolved, and the answer
is that it was never an invariant.** The `(N/N) static pages` build line is a
progress counter that scales with the CATALOG (`shop/[id]` enumerates every
available/sold product during generation, then renders dynamically anyway — 0
product pages are prerendered). ⛔ Do not pin it to a number or treat a delta as
a defect. The stable figures are in `STRUCTURE.md`: **60 prerendered routes =
27 EN + 27 ES + 6 non-locale**, with **`en === es`** as the check worth making.

### ✅ DONE — the 2026-08-27/28 SEO batches are DEPLOYED and verified live

Both changes sit in the working folder only; production is unchanged. No SQL,
no env vars, nothing to run in Supabase.

1. `next-app/src/app/robots.ts` — removed `/account`, `/checkout` and their
   `/en/` + `/es/` variants (they emit their own `noindex`, which the crawl
   block was making unreachable). `/admin`, `/api`, `/shop-modern`,
   `/en/admin`, `/es/admin` stay.
2. `next-app/src/app/[locale]/shop/[id]/page.tsx` lines 758 + 767 — the two
   `/contact?item=` inquire links gained `rel="nofollow"`.
3. `next-app/src/lib/business-location.ts` — `HOURS.days` gains `'Monday'`
   (owner opened Mondays; the live site was already correct, the constant was
   the stale part). 8 test expectations updated with it.
4. `next-app/src/app/sitemap.ts` — emits BOTH locales, 99 → **200 URLs**
   (100 EN + 100 ES, paired), each with `en`/`es`/`x-default` alternates.
   ⚠️ After deploying, resubmit `/sitemap.xml` in Search Console and expect the
   "not indexed" count to rise as ~100 new URLs await crawl — that is expected.

Gate, run after each change independently: `tsc` clean · lint clean ·
**1176/1176 across 112 files** · build **456/456**. Built `robots.txt` body
verified; `rel:"nofollow"` confirmed exactly twice in the built SSR chunk.

**After deploying,** confirm `https://naplesestatejewelry.com/robots.txt` no
longer lists `/account` or `/checkout` and still lists `/admin`, `/api`,
`/shop-modern`. Then expect the two `/account` rows in Page indexing to migrate
from "Blocked by robots.txt" to "Excluded by `noindex`" over some weeks — both
are non-indexed states, so nothing that currently ranks changes.

### ✅ DONE 2026-08-29 — content batch DEPLOYED and production-verified (probes in `CHANGELOG.md`)

One file of app code (`next-app/src/app/[locale]/sell/page.tsx`) plus the
`CONTENT_LAST_MODIFIED` bump in `sitemap.ts`. No SQL, no env vars. After
deploying: spot-check `/sell` and `/es/sell` render the table and the three
links; city pages must be unchanged.

### ✅ DONE 2026-08-29 — /silver-services flatware band built (mockup approved,
price-both-ways claim owner-confirmed). In the deploy batch above. After deploy,
watch this page's position for "flatware" queries over the coming weeks — it is
the likeliest first non-brand click on the site.

### ✅ DONE 2026-08-29 — per-city local grounding added (data-only, owner-authorized)

12 intro strings extended in `service-areas.ts` with verifiable local detail;
template untouched. ◻ Standing invitation: if the owner ever supplies REAL
customer-pattern detail per city ("Marco sellers bring X"), it upgrades these —
researched geography is the floor, owner knowledge is the ceiling.

### ✅ DONE 2026-08-29 — Saturday hours corrected; site and Google now agree

Owner set it in **Admin → Settings → Store Hours**. Verified on production:
the JSON-LD emits **two** specs — `['Monday'…'Friday'] 11:00–15:00` and
`['Saturday'] 11:00–16:00` — and the visible table reads
`Saturday 11:00 AM – 4:00 PM`. Matches the Google Business Profile exactly.

🟢 This is the first production proof that the **split-week grouping works in
the wild**: `openingHoursSchema()` correctly split one uniform block into two
when a single day diverged, rather than flattening it.

ℹ️ The `HOURS` fallback in `business-location.ts` still cannot express per-day
times and remains one hour short on Saturday by design. It renders only if
`shop_settings.store_hours` is null or unreachable; its docblock says so.

### ◻ 2026-08-28 — owner follow-ups on the `/review` work

- **Print/QR:** the string to encode is `https://naplesestatejewelry.com/review`.
  No QR asset is in the repo — it needs either a QR dependency or an externally
  generated image. Ask before adding a dependency.
- **Post-purchase thank-you page** was deliberately NOT built; it touches the
  checkout flow and needs a decision on where in the order flow it belongs.
- **Site shows 18 testimonials** (`TESTIMONIALS.length`) against 21 on the live
  Google profile — three real reviews are not yet on the site.
- ⚠️ **Never add `aggregateRating`** for the business's own reviews. Google
  disallows self-serving review markup on LocalBusiness and it risks a
  structured-data manual action.

### ◻ 2026-08-28 — 7 Request Indexing calls still owed (quota is a ROLLING window)

⚠️ **Still quota-blocked at the 2026-08-29 later-day retry too** — confirmed
property-wide with two different URLs. The window is harsher than a simple
rolling 24 h from the 08-28 burst; failed attempts may extend it, or the real
daily allowance is smaller than the ~10 assumed. ⛔ Do not burn retries probing:
tomorrow, submit ONE url — continue only if it succeeds.

**11 of the 18 are now requested.** The daily quota ran out on the 12th attempt
("Quota Exceeded — try submitting this again tomorrow"), same as 2026-08-27.
⚠️ The quota is **per SITE, shared across properties** — the Domain property
returns the same error, so it is not a workaround. Budget ~10–11/day.

🟢 **Two of the 18 turned out to be ALREADY INDEXED** — `…teaspoon-73` and
`…monogrammed-mad-104` both now report **"URL is on Google"**. Neither was
indexed as of the 8/20 report, so Google crawled them in between: evidence the
Aug 27 sitemap resubmission is landing.

**Still owed — paste each into URL Inspection → REQUEST INDEXING:**

```
https://naplesestatejewelry.com/shop/vintage-sterling-silver-amethyst-cabochon-earrings-convertible-pendants-93
https://naplesestatejewelry.com/shop/vintage-sterling-silver-men-s-cufflinks-with-carved-figural-scene-80
https://naplesestatejewelry.com/shop/whiting-lily-pattern-sterling-silver-teaspoon-monogrammed-art-nouveau-101
https://naplesestatejewelry.com/shop/whiting-sterling-silver-handled-grape-shears-with-german-steel-blades-127
https://naplesestatejewelry.com/shop/william-henry-juno-sterling-silver-cable-link-necklace-men-s-90
https://naplesestatejewelry.com/shop/william-suckling-sterling-silver-footed-salt-cellar-with-cobalt-glass-liner-birmingham-1955-108
https://naplesestatejewelry.com/shop/zina-sterling-silver-dragonfly-brooch-78
```

✅ Requested 2026-08-28 (all show "✓ Indexing requested"): koma-garment-hook-66,
art-nouveau-whiting-fork-94, gorham-chantilly-81, joseph-mayer-124,
english-salt-cellars-74, iced-tea-spoon-116, teaspoon-73, japanese-tazza-54,
monogram-brooch-79, tiffany-punch-ladle-53, victorian-napkin-ring-104.
✅ Requested 2026-08-27: bill-tompkins-coffee-pot-55.

⚠️ **UI trap for whoever finishes these:** the green "Indexing requested" toast
AUTO-DISMISSES after ~20s, so a screenshot taken late looks like nothing
happened. The reliable signal is the button row itself changing to
**"✓ Indexing requested · REQUEST AGAIN"**. Re-clicking is harmless — Google
states resubmitting does not change queue position.

⚠️ The inspection search box needs a click in one round trip and the typing in
the NEXT one; typing immediately after the click silently goes nowhere.

ℹ️ Still an accelerator, not a repair — the sitemap is submitted and Google is
reaching these on its own, as the two already-indexed pages show.

### 🟡 2026-08-27 — the real ranking problem is CTR, not indexing

Average position **36.7** (page four). The site is being *seen and skipped*:

| Query | Clicks | Impressions |
| --- | --- | --- |
| estate jewelry buyers | **0** | 60 |
| custom jewelry design marco island, fl | **0** | 36 |
| antique jewelry naples fl | **0** | 35 |
| estate jewelry buyers near me | **0** | 28 |

By page: `/sell/naples` **220 impressions → 1 click**, `/sell/marco-island`
103 → 1, `/sell/fort-myers` 62 → 1. The homepage carries 38 of the 44 clicks,
and "naples estate jewelry" (brand) is 16 of them. Nothing in the two fixes
above touches this — it is title/meta/content work and deserves its own session.

### ◻ 2026-08-27 — recheck in a day or two

- The new Domain property's Settings showed **"No robots.txt file"** and "No
  data available yet" — expected for a property hours old (the URL-prefix
  property reports it **Valid**, fetched 8/9/26). Confirm it flips to Valid.
- The Domain property renders the **old gold palm-tree favicon** in the picker
  while the URL-prefix property shows the octopus. Google's favicon cache lags;
  ⛔ do not re-cut the artwork over it.


✅ **DONE 2026-08-25 — store hours + homepage banner are DEPLOYED and both were
exercised in production the same evening.** Nothing outstanding. Full evidence
in `CHANGELOG.md` 2026-08-25.

- Post-deploy smoke: 10 routes **200**, one `<h1>`, zero `Tue–Sat` left in any
  meta description.
- **Owner used both panels** (DB `updated_at` 2026-08-26T03:43Z): Wednesday
  closed (JSON-LD correctly groups the non-contiguous `["Tuesday","Thursday",
  "Friday","Saturday"]`), and a link-OFF banner announcing the closure —
  production renders a `<div>` with 0 anchors and 0 arrows in both locales.
- ✅ **`revalidatePath('/', 'layout')` is CONFIRMED working on Netlify's durable
  cache.** The saves propagated to the statically prerendered homepage in both
  locales. ⛔ The documented `export const revalidate = 3600` fallback is **not
  needed** — do not add per-page revalidate windows for this.

◻ **Only soft follow-up:** the live banner copy is 51 (EN) / 52 (ES) chars —
inside the 49–53 amber band the panel flags. It should fit (a single fragment
has no `·` separator and link-off has no `→`, leaving ~23–28px slack at 320px),
but it is worth an eyeball on a real phone while that copy is up.

⚠️ **NAP, now live and real:** the showroom hours on the site now say Wednesday
closed. Update the Google Business Profile, eBay merchant location, and Etsy
shop location to match — the panel warns about this, and Google compares.



✅ **DEPLOYED 2026-08-25 — the weak-GPU hero-freeze batch is LIVE.** Owner
pushed and deployed (published ~9:42 AM); owner confirmed the live site looks
normal on a normal machine. Post-deploy scare resolved the same morning: the
~24% "Errors" in Netlify Observability are the PRE-EXISTING eBay-webhook 499s,
not this deploy — see the ℹ️ note under the eBay `account_deletion` item below
before ever re-diagnosing that panel.

◻ **The one remaining check — the owner's weak desktop** (owner said they will
check later): load the homepage there; expect a few choppy seconds (watchdog
warm-up + measurement window), then the ring freezes and stays quiet; reload
should freeze immediately (session latch). `?heroFreeze=0` there = old
always-spinning behavior for A/B; `?heroFreeze=1` anywhere previews the frozen
look without latching.

📜 What the batch is (2026-08-24; no SQL): owner-reported choppy carousel on a
weak-GPU desktop, persisting after load. Built with the owner's explicit
choices (freeze-the-ring + housekeeping): an FPS watchdog freezes the hero
rings on machines that sustain a median frame time > 40ms (~25fps),
prefers-reduced-motion now fully stops the ring instead of slowing it, the
customer reveal releases its `will-change` ~800ms after revealing, and the
testimonial marquee pauses while offscreen. Zero change on machines that keep
up — verified: default local state is identical (pane A running, B/C paused,
no latch). Detail: `CHANGELOG.md` 2026-08-24 (weak-GPU entry); durable rules:
`DECISIONS.md` *"A machine that cannot hold the spin gets a FROZEN ring"*.

Files: `src/lib/hero-frame-guard.ts` (new) + its test (new, 11 tests),
`carousel/components/Carousel.tsx`, `carousel/components/Carousel.module.css`,
`src/components/layout/CustomerReveal.tsx`,
`src/components/home/TestimonialMarqueeBand.tsx` (new),
`src/components/home/TestimonialsSection.tsx`, `src/app/globals.css`.

Gate (final tree, deleted `.next`): `tsc` clean · lint clean · **1136/1136
across 110 files** · build **456/456**.

👀 **The check that matters after deploying — the owner's weak desktop itself:**

1. Load the homepage cold. Expect a few seconds of choppy spin (the watchdog's
   warm-up + measurement window), then the ring freezes and the page goes
   quiet. Reload: it should now freeze immediately (session latch).
2. `?heroFreeze=0` on the same machine = the old always-spinning behavior, for
   an A/B. `?heroFreeze=1` on ANY machine previews the frozen look without
   latching.
3. On a normal machine: the hero must look exactly as before — spinning ring,
   handover on scroll, marquee moving when visible.

✅ **Staging re-synced for this batch, 2026-08-25** — ready to copy to the repo
folder and push. Dry run queued exactly **12 files** (the 8 app files + 4
memory docs above), real run **12 copied / 0 Extras / 0 Mismatch / 0 FAILED**,
follow-up dry run **0 to copy**. **876 files / ~20.05 MB** on disk (robocopy
total 879 = the documented 3 `/XF`-excluded files). Leak check clean — 0
`.git` (dir or file), 0 `worktrees`, 0 `node_modules`, 0 `.next`, 0 `.env*`,
0 `*.log`, 0 `*.tsbuildinfo`, 0 `next-env.d.ts`, 0 `*.pem` — against a
**positive control of 179 `.tsx`** (= 177 at the 08-24 morning rebuild
+ `TurnstileWidget.tsx` + `TestimonialMarqueeBand.tsx`; source and staging
both count 179). Hidden paths present: `.github/workflows/scheduled-jobs.yml`,
`.gitignore`, `.claude/launch.json`, `next-app/.npmrc`. Staged-content spot
checks: `maps.google.com` **1 hit each** in root `netlify.toml` and
`next-app/next.config.ts` (the standing CSP hazard); `hero-frame-guard.ts` +
its test + `TestimonialMarqueeBand.tsx` present; staged `Carousel.tsx` imports
the guard (8 guard-symbol hits); staged `Carousel.module.css` has
`animation-play-state: paused` and its only `128s` hit is the comment
explaining the removal; staged `CustomerReveal.tsx` has 4 `'done'` refs;
staged `globals.css` has `data-marquee-paused`; all four staged memory docs
carry this session's entries. (Post-sync doc edits recording this very result
drift staging by memory docs only — the owner's accepted standing preference.)

✅ **ACTIVE IN PRODUCTION 2026-08-24 (later session) — the Turnstile bot gate
is LIVE and verified.** All five activation steps completed: code deployed
(`main@94fe20c` "turnstile update" — the first push shipped a stale staging
folder without this batch; re-synced and re-pushed), Netlify
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` set (site key `0x4AAAAAAEa0eMDYdUm0JTws`),
widget code + site key + CSP verified in the LIVE bundle by static curl
inspection, then the owner saved the secret in Supabase. Negative controls all
pass: tokenless POSTs to `/auth/v1/signup`, `/auth/v1/token?grant_type=password`
and `/auth/v1/recover` each return 400 `captcha_failed`. Rollback if ever
needed: turn the Supabase CAPTCHA toggle off — the code side needs no revert.

◻ Remaining human check: one real sign-in on the live site (owner, any
browser). ⛔ NEVER verify those pages via the in-app Browser pane or any
automated browser — loading the live Turnstile challenge in the embedded
pane hard-crashed the Claude app twice on 2026-08-24 (Cloudflare analytics:
2 "Electron" challenges, both unsolved) and forced a reinstall. Verify with
curl (bundle grep + CSP header) or the owner's own eyes only.

📜 Historical runbook (completed; kept for the reasoning):

🔴 ~~DEPLOY the Turnstile bot gate, then ACTIVATE it — order is load-bearing~~
(2026-08-24; no SQL). Five bot accounts were created via direct calls to
Supabase's `/auth/v1/signup` (the anon key is public; no route of ours is in
that path). The five were deleted from admin the same day. The code is built,
tested (1125/1125, build 456/456) and **inert** until activated.

Activation, in this exact order:

1. Deploy this batch (widget + CSP for `challenges.cloudflare.com` in both
   `next.config.ts` and root `netlify.toml`).
2. Cloudflare dashboard → Turnstile → create a widget for
   `naplesestatejewelry.com` (+ `localhost` for dev), **Managed** mode. Free.
3. Netlify → set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (the SITE key — public by
   design) → redeploy so it inlines.
4. Supabase dashboard → Authentication → Attack Protection → enable CAPTCHA,
   provider Turnstile, paste the SECRET key (lives ONLY there — never in the
   repo or Netlify).
5. Verify: sign-in works with your real account on `.com` (EN + ES); a raw
   `curl` POST to `/auth/v1/signup` without a token is rejected; bot cadence
   was ~every 3h, so 24 quiet hours on `/admin/users` confirms.

⛔ **Never flip step 4 before steps 1–3 are live** — GoTrue then demands a
token no deployed form is sending, and sign-in breaks for everyone. Roll back
by turning the Supabase toggle OFF (tokens sent to a toggle-off project are
ignored, so the code side never needs reverting).

◻ **Phase 2 hardening (after activation):**

- Exclude never-confirmed accounts from `buildMarketingAudience()`
  (`lib/marketing.ts` selects all `profiles` with `marketing_opt_out = false`;
  bot leftovers read as "Reachable" until confirmed-email is checked).
- Tighten Supabase Auth rate limits (dashboard).
- Optional: "unconfirmed" badge on the admin Users table.
- ✅ SMTP check DONE and FIXED 2026-08-24: auth emails HAD been on Supabase's
  built-in mailer the whole time; now on Resend SMTP (sender
  `noreply@naplesestatejewelry.com`, new sending-only key
  `supabase-auth-smtp`, 30/hr cap). Verified delivered with the branded From.
  Safe only BECAUSE the Turnstile gate now fronts every email-triggering
  endpoint — never disable the gate while custom SMTP is on. Detail:
  `CHANGELOG.md` 2026-08-24 (SMTP entry).

✅ **DEPLOYED 2026-08-24 — the invoice heading fix** (`SUBJECT_HEADING_PX` 28 →
20). Email-only, so the real check is the next invoice/receipt that goes out.
Post-deploy smoke check passed: 7 routes 200, CSP intact, one `<h1>`.

✅ **DEPLOYED AND VERIFIED ON PRODUCTION 2026-08-24.** All five batches are live.
The reported cookie/language bug was re-exercised as a user on the live site in
both directions, with the negative control passing. Full evidence table in
`CURRENT_STATUS.md`. No SQL was outstanding.

⚠️ **Sitemap 105 vs the old 107 is normal** — 85 product + 20 static, static
unchanged, two products sold. Not a regression; do not chase it.

◻ **Still not exercised — none blocking, all "first real use" items:**

1. **No order email has actually been SENT** through the new templates. They
   were rendered and unit-tested, not delivered. The first real receipt is the
   first live exercise.
2. 📧 **The pickup block has never been seen in a real mail client.** Outlook
   desktop is the one worth checking — the panel is a `<table>` specifically
   because Word-rendered Outlook drops padding and background on a `<div>`.
3. 📱 **The Visit Us / contact layouts have not been seen on real phone
   hardware.** Measured at 375px and at 320px in Spanish with 0px overflow, but
   measurement is not the same as looking.
4. 📊 **PSI has not been re-run since the homepage section changed.** The block
   is below the fold and the map was already there, so no LCP change is
   expected. ⛔ Per the standing rule, do not react to a single run — the mobile
   number is a distribution.
5. ◻ **The landmark still appears in 8 other places** (footer, About, both FAQ
   surfaces, `/shipping`, checkout pickup, product trust copy, Spanish legal
   copy, order-email pickup block). Deliberately not swept — owner decision.

🔴 **DEPLOY the script-tag console-warning fix** (2026-08-24; no SQL). One line:
`ScriptTagWarningGuard` is now mounted in `[locale]/layout.tsx` instead of only
on the shop list page, so React 19's dev-only "Encountered a script tag while
rendering React component" no longer clutters the overlay on every page.

✅ **Nothing user-facing changes** — the warning is dev-only and was verified
absent from a real production build. The inline `<head>` scripts are untouched.

⛔ **Do not "properly fix" the scripts later.** Both alternatives were built and
measured this session and are worse: `next/script` `beforeInteractive` defers
execution past first paint (reintroducing the layout jump and banner flash), and
raw-HTML emission forces the scripts and JSON-LD out of `<head>`. Full reasoning
in `DECISIONS.md`, *"The inline `<head>` scripts stay…"*.

🔴 **DEPLOY the contact-page match + landmark removal** (2026-08-24; no SQL).
"inside Sharon Lynch Collections" is gone from the homepage Visit Us block, and
`components/contact/VisitUsPanel.tsx` is rebuilt in the same two-column format.
Detail: `CHANGELOG.md` 2026-08-24.

◻ **Owner decision — how far does the landmark removal go?** It is now off three
surfaces (order-email footer, homepage, contact) but still appears in **eight**
places, listed by name in `DECISIONS.md` under *"A display address is laid
out…"*. The notable ones: the **sitewide footer**, **About**, and the **FAQ
answers on `/faq` and the homepage**. Several are prose where it still earns its
place, so this was NOT swept — say the word if you want the rest gone.

🔴 **DEPLOY the homepage "Visit Us" rebuild** (2026-08-23; no SQL). Two-column
layout from an owner-supplied reference — mocked up and approved first, four
design calls answered explicitly. Detail: `CHANGELOG.md` 2026-08-23 (Visit Us).

Files: `app/[locale]/(home)/page.tsx`, `components/ShowroomHours.tsx`,
`components/ShowroomTodayBadge.tsx` (new), `lib/business-location.ts`,
`app/globals.css`, `lib/__tests__/showroom-today.test.ts` (new).

⛔ **The address now leads and the phone is a button — that REVERSES an older
recorded rule** ("must not out-weigh the phone number this section exists to
show"). It is an owner decision, not drift. Do not restore the old hierarchy.

👀 **Worth a look on a real phone after deploying**, since it is a layout
change: the section stacks to one column with no sideways scroll (measured 0px
at 375px and at 320px in Spanish), and the **Today** badge should sit on the
current day — it appears a frame after load, by design, and is pinned to Naples
time, so it is correct even for a visitor in another timezone.

🔴 **DEPLOY the order-email fixes** (2026-08-23; no SQL). Three owner reports
from a real receipt — footer named the shared suite, the phone number broke
across two lines, and the summary read "Shipping method: Shipping". Detail:
`CHANGELOG.md` 2026-08-23 (order-email entry).

Files: `lib/order-email-branding.ts`, `lib/order-invoice-email.ts`,
`lib/order-fulfillment-email.ts`, `lib/checkout-shipping.ts`, and
`lib/__tests__/order-invoice-email.test.ts`.

✅ **Settled:** the landmark is gone from the FOOTER and kept in the PICKUP
block, where it is directions to a door whose sign reads someone else's name.
It now renders as its own muted line rather than joined onto the address.

**Also in this batch — the pickup details are a laid-out block, not a run-on
sentence** (owner request, design mocked up and approved first). Payment
sentence → *Pickup Location* panel (address on its own lines, hours below a
hairline) → contact line. ❌ The business name is deliberately NOT a line in it.
Adds `InvoicePickupBlock`/`contactNote` to `InvoiceEmailContent` and updates the
admin email preview, which rendered `note` directly and would otherwise have
stopped showing the address. Detail: `CHANGELOG.md` 2026-08-23 (pickup block).

📱 **Worth one glance after deploying:** send yourself a pickup receipt and open
it on a phone. The panel was measured at a 340px column and stacks correctly,
but no human has looked at it in a real mail client. Outlook desktop is the one
worth checking if you have it — the panel is a `<table>` specifically for it.

⛔ The shipping tier is INFERRED from `subtotal` + `shipping_fee`, not stored.
That is deliberate (storing it means altering `orders` and rewriting the
`create_paypal_order` RPC — the live payment path). It only names a tier on an
exact, unique fee match and falls back to generic wording otherwise, so
re-pricing the tiers can never mislabel an old order. **If the tier table is
ever re-priced, historical invoices quietly become generic — that is the
intended trade, not a bug.**

🔴 **DEPLOY the cookie-banner language-switch fix** (2026-08-23, later session;
no SQL). Owner-reported: accepting cookies did not stick when switching EN↔ES.
Reproduced, root-caused, fixed and verified locally — see `CHANGELOG.md`
2026-08-23 (cookie banner entry).

Files: `lib/cookie-consent.ts` (new), `components/legal/CookieNotice.tsx`,
`components/legal/CookiePreferencesClient.tsx`, `app/[locale]/layout.tsx`
(comment only), `app/globals.css` (comment only), and
`lib/__tests__/cookie-consent-gate.test.ts` (new, 15 tests, mutation-tested).

Gate from a deleted `.next`: `tsc` clean · `lint` clean · **1101/1101 across
108 files** · build **456/456 static pages** (unchanged — no new routes).

⚠️ **Staging has NOT been re-synced for this change.** Do that before the copy.

**After deploying, one 20-second check on the live site** (this is the whole
bug, and it is trivial to confirm): accept the banner, click **ES**, confirm it
does not come back; click **EN**, same. Then in a private window, DON'T accept,
switch language, and confirm the banner IS still there — that negative control
is the one that matters, because a fix that over-hides would look identical on
the first check.

⛔ Do not "simplify" the new re-stamp as a duplicate of the inline `<head>`
script. They cover different events: the script covers page loads, the effect
covers soft navigation. The guard test fails if the layout effect is downgraded
to `useEffect` or its `[locale]` key is dropped.

0. ✅ **FINAL STATE DEPLOYED 2026-08-23 (owner's choice): a11y/BP sweep +
   hero-reveal batch, nothing else.** Front-card pin reverted after its one
   PSI run read 72. Post-deploy PSI mobile: **98** (LCP 1.7s green — best run
   of the day) and **80** (4.3s, banner mode); desktop that session: 86 (a
   TBT-noise draw; 96–98 earlier). A11y/BP/SEO held 100/100/100 in every run
   all day. The lab perf number remains a distribution, not a constant —
   treat single runs accordingly; CrUX field data (currently No Data) is the
   number that will matter. No further lab-score work planned unless the
   owner asks; untested levers remain listed in the CHANGELOG front-card
   revert entry. The owner chose
   the state that loads fastest in practice over further lab-score chasing.
   After deploy the site is: a11y/BP sweep + hero-reveal batch, nothing else.
   Lab expectation: ~79–81 typical with a known ~71–73 tail that NO tested
   configuration removes (see `CHANGELOG.md` front-card-revert entry for the
   full analysis and the untested levers). Prior item:

   ~~**Front-card LCP pin BUILT — deploy pending, then PSI 2–3x.**~~ Owner
   chose the deterministic fix: pane A's slot-0 card is `priority`-preloaded
   and exempt from the reveal fade, so the page's largest element gets an
   early paint record (verified locally: LCP element = front card, observed
   LCP 497ms, load delay 0). Expectation: the 71–73 image-mode tail
   disappears; the score should sit stably ~79–81, upside uncertain (lantern
   still charges the JS graph). Files: `Carousel.tsx`, `HomeHero.tsx`.
   Staging synced. Detail: `CHANGELOG.md` front-card entry. Prior analysis:

   ◻ ~~**Hero-reveal batch restored + deployed; PSI bimodality is INTRINSIC —
   next-step decision pending.**~~ Post-restore PSI mobile: **73** (LCP 9.2s,
   hero-image mode) and **80** (4.3s, banner mode). ⚠️ CORRECTION to the
   earlier analysis: the image mode fires in BOTH states — full dataset across
   the day: sweep-only 81/79, +batch 79, reverted 71/80/80, restored 73/80.
   Every configuration is ~79–81 when the banner text wins LCP and 71–73 when
   the hero card image's paint registers instead (lantern balloons any
   post-FCP image LCP to ~9s sim). The batch did NOT eliminate the tail; it
   remains live because it measurably improves real paint (observed FCP==LCP)
   and does not hurt the distribution.

   **The only deterministic fix for the 71–73 tail**: let the FRONT card
   paint at first paint — `priority` on the front-slot `<Image>` (preload)
   and exclude it from the opacity fade, so the LCP image has an early paint
   record (~2.7s sim, likely green) instead of a late one. Visible design
   change (front card appears instantly, rest still fade in) — owner call.
   Alternative: accept ~80-with-tail; field data (CrUX) will reflect the
   good real-world paint once traffic accrues.

   The measurement that decided it:

   ◻ ~~**Hero-reveal batch: reverted, redeployed, and PSI measured 3x — owner
   decision pending on whether to restore it.**~~ Post-revert PSI mobile runs:
   **71** (LCP 9.2s — the hero image at its hydration-gated paint), **80**
   (4.4s, banner), **80** (4.4s, banner). The reverted site is BIMODAL: usually
   80, but when the late hero paint lands inside the Lighthouse trace the
   score drops to ~71. The hero batch eliminated that failure mode entirely
   (its runs anchored at 79–81 with the banner font-swap as LCP) AND made real
   paint first-paint. Net: the revert did not raise the score — it restored an
   intermittent ~71 mode. The batch is preserved in `CHANGELOG.md` (hero-reveal
   entry) and can be re-applied verbatim if the owner wants the stable floor.

   Prior record:

   🔴 ~~**REVERTED, REDEPLOY PENDING (2026-08-23)**~~ — after the PSI re-run below
   came back 79 (vs 81 pre-batch, within variance), the owner chose to revert
   the hero-reveal batch entirely. All three files are back to their pre-batch
   state (`grep nej-hero-go` = 0 hits); staging re-synced. **The production
   site still runs the batch until the owner deploys the revert.** History and
   the still-valid lab-score analysis: `CHANGELOG.md` 2026-08-23 (revert
   entry). The record of the deployed run follows:

   ✅ ~~**DONE 2026-08-23 — hero-reveal batch deployed, PSI re-run.**~~ Mobile
   **79 / 100 / 100 / 100**, desktop **96 / 100 / 100 / 100** (79 and 96 are
   within PSI's ±2–3 run variance of the prior 81/98 — the sim perf number is
   flat, as predicted). The reveal itself is live and working: deploy verified
   by curl (nej-hero-go in production HTML). **The LCP element is the cookie
   banner paragraph again, for a NEW reason**: it paints at first paint now,
   but Chrome re-emits the LCP entry when the web font swaps in (~2.5s on
   slow-4G), and lantern maps that to 4.5s sim. The lab number is therefore
   bounded by (a) the font-swap re-emission and (b) the JS dependency graph.
   Next levers, in rising invasiveness: font-display `optional` on the body/
   label font (kills the swap re-emission; trade: slow connections may keep
   the fallback font for a pageview), `experimental.inlineCss`, and the
   ~85KB unused/legacy JS. All are owner-decision design trades — none
   attempted without a call. Real-user loading DID improve: content paints at
   first paint (observed FCP == LCP locally), hero appears ~2s in on a
   throttled phone instead of after a hydration-length splash hold.

   Original item follows for the record:

   🔴 ~~**Deploy the hero-reveal batch, then re-run PSI mobile.**~~ (2026-08-23,
   third batch of the day; no SQL.) Three files: `HomeHero.tsx`,
   `[locale]/(home)/page.tsx`, `globals.css` — pane A's carousel and the boot
   splash no longer wait for React hydration (inline `nej-hero-go` stamp; see
   `CHANGELOG.md` 2026-08-23 hero-reveal entry). Locally verified: 1086/1086 ·
   lint/tsc clean · build 456/456 · observed FCP == LCP on the prod build.
   ⚠️ Expectation-setting: real paint moved to first paint, but the SIM number
   is lantern-bound by the JS graph — PSI perf may move only a few points.
   Post-deploy glance: splash still shows briefly then fades into the hero
   (fast machines), and on a throttled phone the hero appears ~2s in with no
   long branded-splash hold.

1. ✅ **DONE 2026-08-23 — deployed and PSI re-tested on production.**
   PSI mobile: **81 / 100 / 100 / 100** (was 80 / 93 / 96 / 100); desktop
   **98 / 100 / 100 / 100** (was 97 / 96 / 100 / 100). The LCP element is no
   longer the cookie banner — it is now a hero carousel product image (real
   content), confirmed by a local Lighthouse run against production naming
   `a.Carousel… > img` ("Kurt Goldschmidt 14K…") with a11y 1.0 / BP 1.0.
   Deploy presence proven by curl: the SSR banner and the pre-paint gate
   script are in the production HTML. `/_next/image` now serves
   `Cache-Control: public,max-age=31536000` on cache miss (the six 1h entries
   Lighthouse still saw were pre-deploy edge caches; they age out within the
   hour — do not chase).

   ⚠️ **Mobile perf is now bounded by the hero reveal, not the banner.** The
   LCP image's sim breakdown is render-delay-dominated: it paints when the
   hero fade-in runs (fonts + card images + hydration — `HomeHero`'s
   `heroReady` gate and the boot splash), which on throttled mobile lands
   near where the banner used to. Moving 81 → 90+ means loosening that
   reveal for the front card, `experimental.inlineCss`, or a JS diet — a
   deliberate design trade, listed under "Deliberately NOT done" in
   `CHANGELOG.md` 2026-08-23. Owner's call whether to pursue.

   Remaining manual glances (phone-in-hand, no tooling): banner Accept sticks
   across reload; no banner flash for a long-ago-accepted visitor; ES
   announcement strip still fits at 320px.

   <details><summary>Pre-deploy record (what shipped and how it was verified)</summary>

   (original task text follows)

   🔴 **Deploy the PageSpeed/a11y batch, then re-test PSI** (2026-08-23, later
   session; no SQL). Files: `CookieNotice.tsx`, `[locale]/layout.tsx`,
   `globals.css`, `CookiePreferencesClient.tsx`, `carousel/components/
   Carousel.tsx`, `SiteFooter.tsx`, `ShowroomHours.tsx`,
   `TestimonialsSection.tsx`, `[locale]/(home)/page.tsx`, `next.config.ts`.
   Locally verified: 1086/1086 · lint/tsc clean · build **456/456** ·
   Lighthouse a11y **1.0** + best-practices **1.0** on the local prod build.
   After deploy: PSI mobile on `https://naplesestatejewelry.com/` — the LCP
   element must NOT be the cookie banner anymore (was
   `body > div.fixed > div.min-w-0 > p`, render delay 2,360ms, the whole
   reason mobile perf was 80). Expected: a11y 100, BP 100, SEO 100, perf
   up from 80. Detail: `CHANGELOG.md` 2026-08-23 (PageSpeed sweep).

   ⚠️ Regression tripwires for this batch, worth one manual glance after
   deploy: (a) fresh visitor still gets the cookie banner and Accept sticks
   across a reload; (b) a visitor who accepted long ago does NOT see a flash
   of banner on load; (c) the homepage announcement strip still fits at 320px
   in Spanish (an sr-only span was added inside it — position:absolute, so it
   should be layout-inert, verified locally at desktop width only).

   </details>


2. **Delete two junk rows?** Created 2026-08-23 by a verification probe that used
   a *passing* payload and so ran the whole success path (inquiry row, admin
   notification, owner email, and a confirmation to a non-existent address that
   bounced). They are junk — unlike the 10 spam rows deliberately kept as the
   heuristic's labelled sample — so deleting loses nothing, but nothing was
   removed without the owner's say-so.

   ```sql
   delete from inquiries where id = 'a317891f-4509-4c95-ac09-e5074c1fd1c0';
   delete from admin_notifications where id = '5e46cc7d-7bc3-400f-856e-7763bd485a9f';
   ```

   ⛔ **Never probe `/api/inquire` or `/api/contact-message` with a payload that
   passes validation.** Test the rejection paths; they return before any insert
   or email.

3. **The hard-bounce path has never run for real.** Every live exercise used the
   *soft* path deliberately, because it writes nothing. The first genuine
   permanent bounce is the first real test — expect an `[email-bounce]` line in
   the Netlify function log and a red **Bounced** chip in the admin message
   center. Nothing to do but watch.

## ✅ DEPLOYED AND CONFIRMED — transactional email bounce handler (2026-08-23)

**Live on production.** No SQL.

`/api/webhooks/resend` returned early on any event without a `campaign_id`, so
every **transactional** bounce was discarded — a mistyped checkout email meant the
receipt hard-bounced, Resend reported it, and the report was thrown away. Now the
campaign-id gate applies only to campaign analytics, and a failure is processed
either way: new `lib/email-bounce.ts` classifies the bounce, matches the address
to the most recent order and inquiry, and writes an `email_bounce` admin
notification naming who to call and their phone number.

Gate: `tsc`/`lint` clean · **1086/1086** · build **456/456**. Detail:
`CHANGELOG.md` 2026-08-22 (6).

### ✅ CHECKED IN THE RESEND DASHBOARD 2026-08-23 — both preconditions hold

1. ✅ The webhook is **Enabled** with a signing secret set (the route fails
   CLOSED, so a missing secret would 401 everything — it does not).
2. ✅ It listens for all 5 events, including **`email.bounced`** and
   **`email.complained`**.

✅ **Confirmed live by replaying a real bounce**: ATTEMPTS 1 → 2, response body
`{"success":true,"ignored":true}` → `{"success":true}`. That difference IS the
deploy.

✅ **Endpoint re-pointed to `.com` 2026-08-23** (owner-requested):
`https://naplesestatejewelry.com/api/webhooks/resend`. The old `.co` form worked
via the `netlify.toml` `/api/*` 200-rewrite, but that quietly made the rewrite
load-bearing — a plain 301 there would have killed bounce handling, because a
redirect does not replay a POST body. No longer a dependency.

⛔ **Always use "Edit endpoint" for this — never "Duplicate webhook" or delete +
recreate.** Those mint a NEW signing secret and every event 401s until Netlify's
`PROVIDER_WEBHOOK_SECRET` is updated to match. The 2026-08-23 change was verified
in-place: same webhook id `16c348b8-4075-4d71-a61b-540ec88d456b`, CREATED still
"2mo ago", still Enabled, still 5 events.

✅ Re-verified after the move: replay → **200 `{"success":true}`** (a rotated
secret would 401, so this proves the secret still matches), and still 0
`email_bounce` rows written by the soft bounce.

### ⛔ Two rules not to "simplify" later

1. **Only a CONFIRMED transient bounce is spared from suppression** — `unknown`
   still suppresses. The route used to suppress on any bounce; weakening that
   leaves dead addresses on the list, which costs sending reputation on the ONE
   verified domain that also carries order receipts. **Behaviour change:** a
   `MailboxFull` bounce no longer unsubscribes someone permanently.
2. **Notifications are transactional-only.** Campaign bounces are handled by
   suppression; notifying per bounce would bury the message center on a big send.

### ◻ Not exercised in production

The hard-bounce path has unit tests but was **deliberately not fired** against
the live database, because it writes an admin notification — the accidental-write
mistake recorded above. Its first real run will be a genuine bounce. The
side-effect-free paths (401 on bad signature, soft bounce writes nothing,
`delivered` still ignored) were verified against a live server.

### ℹ️ `ymail.com` is NOT a typo

Confirmed by MX lookup: `ymail.com` → `mta5.am0.yahoodns.net`, Yahoo's own mail
servers, same infrastructure as `yahoo.com`. It is a real Yahoo domain from 2008.

⛔ **Do not add an edit-distance "did you mean?" check without `ymail.com` on the
known-good list** — it is ONE character from `gmail.com`, so the naive version
flags a real customer's correct address.

## ✅ DEPLOYED — name + phone validation, checkout AND the lead forms (2026-08-23)

**Live on production.** No SQL.

A real paid order arrived with **name "Sara", phone "Catlett"** — the buyer typed
her first name, tabbed, and typed her surname into the next box. Checkout only
ever checked that name and phone were **non-empty**, on both the client and the
server, so it went through. The owner was left with a paid order carrying a
first name and no phone number.

**Fixed, in two parts:**

1. **Validation** — new `lib/phone.ts` and `lib/person-name.ts`, enforced in
   `create-order/route.ts` with a 400 **before any order row, PayPal order, or
   money**, and stored in canonical form on **both** write paths. The PayPal
   shipping label now uses the validated name too.
2. **The cause** — checkout collects **First Name + Last Name** as two fields,
   and Phone moved out of the position right after the name.

⚠️ **Field ORDER is load-bearing, not cosmetic.** Contact fields run
**First → Last → Email → Phone** in two grid rows. Phone used to sit next to the
name (side by side on desktop, stacked directly below on mobile), which is what
made a surname feel like the right thing to type there. Do not move it back.

The two fields join into the single `customer_name` the `orders` table already
stores, so **no migration**. Prefill prefers `profiles.first_name`/`last_name`,
which already existed.

Gate: `tsc`/`lint` clean · **1075/1075** · build **456/456**. Server matrix
replayed against a live server; the original failing payload now 400s on the name
and, once fixed, on the phone. Detail: `CHANGELOG.md` 2026-08-22 (4).

⛔ **`normalizePersonName` is deliberately the most lenient rule that works: two
tokens.** No length floor, no character classes, no shape heuristics. Likewise
`normalizePhoneNumber` rejects only on structural NANP/E.164 facts, and accepts
extensions and explicit `+` international numbers on purpose. **A false positive
in either is a lost sale.** If you ever revisit them, keep that property: every
assignable number and every real name must still pass.

ℹ️ Considered and rejected: one Full Name field requiring a space in it. Same
outcome, one fewer field (it is Amazon's pattern), but it rejects mononyms and
only states the requirement after the buyer has already tripped on it.

### ✅ Done — the other forms now share the same rule

`InquiryForm`, `MessageUsForm` and `EvalForm` all validate through
`lib/phone.ts` (as did `ContactForm`, deleted later the same day as dead code), and so do `/api/contact-message` and **both** `/api/inquire`
paths, which store the normalized number. One rule, one message
(`phoneErrorMessage`), shown inline under the field. Detail: `CHANGELOG.md`
2026-08-22 (5).

⛔ **The phone rejection is a VISIBLE 400 in `/api/inquire`, deliberately NOT
folded into the silent spam drop directly above it.** A bot should vanish; a real
person who mistyped their number must be told so they can fix it. Keep those two
paths distinct.

⚠️ `MessageUsForm` and `/api/contact-message` each had their own "10–15 digits"
copy, which accepted `0000000000` and `1234567890`. Both now defer to the shared
rule. An international number typed **without** a `+` used to pass and now fails.

### 🔴 Owner decision needed — a test submission reached production data

While verifying, a probe of the `/api/inquire` JSON path with a **valid** phone
ran the entire success path against the live database. The rejection probes are
side-effect-free; the success case is not, and that was a mistake.

It created:

- inquiry row **`a317891f-4509-4c95-ac09-e5074c1fd1c0`** — "Test Chain" /
  "Sara Catlett" / `a@b.com` / `(239) 404-8505` / "hello there"
- admin notification **`5e46cc7d-7bc3-400f-856e-7763bd485a9f`**
- an owner notification email, and a **confirmation email to `a@b.com`**, which
  does not exist and will have bounced from the verified `.com` sender

◻ **Decide whether to delete the two rows.** They are junk, unlike the 10 spam
rows deliberately kept as the heuristic's labelled sample, so deleting them loses
nothing — but nothing was removed without the owner's say-so.

```sql
delete from inquiries where id = 'a317891f-4509-4c95-ac09-e5074c1fd1c0';
delete from admin_notifications where id = '5e46cc7d-7bc3-400f-856e-7763bd485a9f';
```

⚠️ **Never probe an inquiry/contact endpoint with a passing payload again.** Test
the rejection paths, which return before any insert or email.

### ✅ `ContactForm.tsx` was dead code — DELETED 2026-08-22

Nothing imported it — a grep for the symbol across `src/`, `netlify/` and
`messages/` returned only its own definition, there were no barrel files and no
variable-path dynamic imports that could reach it. `/contact` renders
`MessageUsForm`, or `InquiryForm` when `?item=` is present. It was kept in sync
with the phone change rather than left inconsistent, then removed. `/api/inquire`
— the route it posted to — stays live for `InquiryForm` and `EvalForm`. Build
after deletion: **456/456 pages**, unchanged. Detail: `CHANGELOG.md` 2026-08-22
(7).

## ✅ DEPLOYED — inquiry-form bot filter (2026-08-23)

**Live on production.** No SQL.

A bot used the product-inquiry form as an **email relay** — 10 submissions in 18
hours from `2026-08-22T00:25Z`, each making Resend send a confirmation to a
stranger's address from `noreply@naplesestatejewelry.com`. One victim was hit
twice. `.com` is the only verified Resend sender, so this threatened order
receipts and marketing, not just the admin inbox.

**Root cause:** the `bot-field` honeypot was checked server-side on both paths
but `InquiryForm.tsx` never rendered it — and that is the only one of the three
forms that got spammed.

**Fixed:** honeypot added to `InquiryForm.tsx`; new `lib/spam-heuristics.ts`
catches generated-looking names even when a bot POSTs JSON directly and never
sees the form; drops are now logged as `[inquiry-spam]` instead of vanishing.

Gate: `tsc`/`lint` clean · **1061/1061** · **456/456**. Threshold mutation-tested
both ways. Real spam payloads replayed against a live server: all dropped, 13
rows before and after. Detail: `CHANGELOG.md` 2026-08-22 (3).

### ✅ OWNER DECISIONS — both settled 2026-08-22

1. ✅ **The 10 spam rows STAY.** Owner's call: leave them, react if abuse
   recurs. Do not "tidy" them away in a later session — they are the labelled
   sample the heuristic was derived from, and `spam-heuristics.test.ts` encodes
   those exact names.

2. ✅ **The confirmation-to-submitter email STAYS as-is, as an accepted risk.**
   Owner's call: wait and see rather than change customer-facing behaviour now.

   ⚠️ Record the residual exposure honestly so nobody re-discovers it in a
   panic: `sendEmails` still does `to: email` with an address nobody verified.
   The filters stop *this* bot. A next bot using plausible two-word names walks
   past the name heuristic and the relay works again.

### ◻ Watch after deploying

- **`[inquiry-spam]` lines in the Netlify function log = the filter working.**
- **No lines and no new junk rows** = the bot moved on. Nothing to do.
- 🔴 **No lines but NEW junk rows = the heuristic is being evaded.** That is the
  case that needs work, and the playbook is below.

### ◻ If abuse recurs — the playbook

⛔ **Re-measure before changing any constant.** The threshold in
`lib/spam-heuristics.ts` was first set to 4 by eye and would have silently
discarded a real customer named `VanDerBeek`. The value that shipped (**6**) came
from measuring human-max 5 against spam-min 7. Do the same again rather than
nudging it.

```sql
-- the new sample to look at
select created_at, name, email, phone from inquiries
where created_at > '2026-08-22' order by created_at desc;
```

Then pick by **what shape the new names take**:

- **Still single-token random strings** → re-derive the threshold against the new
  sample plus the human list already in the test file. Lower the length gate only
  if the measurement supports it.
- **Plausible two-word names** → the name heuristic cannot help and widening it
  will start eating real customers. Escalate instead, cheapest first:
  1. a submit-timing check (reject sub-second submissions),
  2. a tighter per-IP limit on the JSON path specifically — the current
     `inquire:${ip}` cap is **5/hour**, which the hourly bot slipped straight
     under,
  3. stop sending the confirmation email, which removes the motive entirely,
  4. Turnstile/CAPTCHA — real friction, so last.
- **High volume from one IP** → the rate limit is the right lever, not the
  heuristic.

## ✅ Inventory #82 reattached — DONE ON PRODUCTION 2026-08-21

The mug is back under normal management: detached relist `800354878200` ended,
offer `204558136011` published as **[`800547117368`](https://www.ebay.com/itm/800547117368)**
at **$1,068.35**, and `EBAY_WRITE_BLOCKED_PRODUCT_IDS` is now **empty**. The
daily push owns it like every other listing — the planner reports **0 blocked**.

⚠️ **Shipping moved $15.00 → $59.00 and that is correct** — $1,068.35 sits in
the `$1,000–2,500 → $59` band. The old $15 was a pre-tier leftover on an
unmanaged listing, so it had been under-charging shipping by $44. Say so if the
owner asks why the listing looks different.

ℹ️ The new listing starts at zero views/watchers. The old one had 16 views and
one buyer with it in the cart; that was the accepted cost of the repair
(owner-approved) and is the only way an unmanaged listing can be brought back
under the Inventory API.

Full detail and the reasoning: `CHANGELOG.md` 2026-08-21 (2).

## ✅ Auto-delist hook FIXED, DEPLOYED and CONFIRMED on production 2026-08-21

The hook was a **floating promise** at six call sites; Netlify froze the
container before it finished. It dropped **~1 sale in 20** (39/41 delisted
correctly). Now scheduled with `after()` via new
`lib/product-status-hooks.ts`, with `allSettled` and real error logging. A
second hole — `adminRevalidateProduct` sitting after the video-commit early
return in `AdminShell.tsx` — is closed too. `queueDeepFieldSync` deleted as dead
broken-shape code.

Gate: `tsc`/`lint` clean · **1037/1037** · **454/454**. Tests mutation-tested per
property. Detail: `CHANGELOG.md` 2026-08-21 (3).

### ✅ Confirmed end-to-end on production

Deployed `main@e81f9f9`. Both previously-stale products were run through a
no-change edit-modal save and are now **`hidden_oos` qty 0 on eBay** and
**`delisted`/`inactive` on Etsy**, with `etsy delist ok` and `ebay hide_oos ok`
rows. `after()` proven live: the Netlify log shows `[deepfield] synced 1
product(s)` emitted from inside the callback. Sale prices preserved (1146.63,
1116.66). Detail: `CHANGELOG.md` 2026-08-21 (4).

⛔ **Never use the "mark sold" quick action to re-fire hooks on an
already-sold item.** `adminUpdateProductsStatus` recomputes `sold_price` from
current spot and overwrites the recorded sale price. Use a no-change save in the
edit modal, which fires the same hooks and writes nothing.

### ◻ Still worth doing

1. ✅ **BUILT 2026-08-21 — the reconcile sweep (needs deploying).** Diagnosed:
   the "missing" `hide_oos` row was not missing, it landed **127.6s late**, when
   the frozen Lambda thawed on the next request.
   Two sequential awaits cannot be 128s apart unless the process stops between
   them. The Next docs list `after()` as requiring **graceful shutdown support**
   (`deploying-to-platforms.md`), which Netlify's freeze-on-response model does
   not provide.

   Work finishing inside the response window now lands reliably (Etsy, Deep
   Field). Slower work (eBay, which adds a token round-trip) still freezes and
   completes only if the container is reused before being reclaimed. **That is
   the residual ~5% risk, unchanged in kind, reduced in size.**

   **Built:** `reconcile{Ebay,Etsy}StatusDrift()` + `/api/admin/{ebay,etsy}/
   reconcile-status`, on the existing GitHub Actions workflow **every 30 minutes**
   (`*/30 * * * *`), each guarded by that channel's existing cron secret so no
   new repository secret is needed. Verified against production read-only
   (0 drift on 124 + 128 listings) and then for real (1131ms / 781ms, audit rows
   written). Detail: `CHANGELOG.md` 2026-08-21 (5).

   ⚠️ **The static page count is now 456, not 454** — the two new API routes.
   STRUCTURE.md treats the count as an invariant; this is the new baseline.

   ### ✅ DEPLOYED AND CONFIRMED 2026-08-22

   Run **#153** (`workflow_dispatch`, job `reconcile-status`): both jobs green in
   **6s**, all five other jobs **skipped**, and both audit rows written 8s later
   — `124 scanned, 0 drifted` (eBay) and `128 scanned, 0 drifted` (Etsy). Nothing
   else in the database moved. Routes 401 unauthenticated on production.

   ⛔ **If you ever dispatch this by hand again, change the job dropdown.** It
   defaults to `all`, which fires both price pushes and both drips off-schedule.

   ### ✅ Firing unattended, confirmed 2026-08-22

   **18 runs per channel** overnight, every one `ok` with `0 drifted`
   (124 eBay / 128 Etsy scanned). Gaps **18–56 min, mean ~33** — that spread is
   GitHub's best-effort scheduling, not a fault, and a backstop does not care
   about a dropped run.

   **Now leave it alone.** A `reconcile_status` row every 30 min with
   `0 drifted` is the net working. A row with `drifted > 0` means something
   upstream missed a delist — worth reading, not worth panicking about, since the
   sweep just fixed it.

   ⛔ **DECIDED 2026-08-21 — do NOT await the hook in the PayPal capture path.**
   The payment is already captured before that line runs, so a hang there turns a
   successful payment into an error page for the buyer. Neither marketplace
   client has a request timeout (verified) and both retry with 1s/2s/4s backoff,
   so the tail is unbounded against a ~26–30s gateway ceiling. The 30-minute
   sweep bounds the exposure from outside with no buyer-facing risk. If near-zero
   exposure is ever wanted, the safe shape is: start the work, await it with a
   ~3s cap, and hand the SAME promise to `after()` regardless — never a plain
   `await`.

   ℹ️ **If you do want it awaited somewhere**, the PayPal **webhook** is the free
   one — no buyer is waiting on that response.

## 🟡 Marketplace clients have no request timeout (latent, not urgent)

`lib/ebay/client.ts` and `lib/etsy/client.ts` both call `fetch()` with **no
`AbortSignal`**, so a hung connection blocks indefinitely, and both retry 3×
with 1s/2s/4s backoff on top. Today that only strands background work, which is
why it is not urgent — but it is the specific reason awaiting a marketplace call
in a buyer-facing route is unsafe.

⚠️ **Not a drive-by fix.** It changes every eBay/Etsy call site, including
legitimately slow ones (Etsy image upload, publish). Pick per-operation timeouts
deliberately rather than one global number, and gate it properly.
2. **A real website sale still has not exercised this path.** The confirmation
   above went through the admin route. The PayPal capture route shares the same
   helper, but has not run in production since the fix.
3. **Watch for `[product-status-hooks]` lines** in the Netlify function log.
   Before this change such failures were silent; if any appear, that is the new
   logging working, not a new problem.

## ✅ RESOLVED 2026-08-21 — the two sold listings are reconciled

Both `10k-gold-monaco-cuban-link-necklace` and `10k-gold-rope-chain-necklace` are
now **`hidden_oos` qty 0 on eBay** and **`delisted`/`inactive` on Etsy**, fixed as
a side effect of confirming the auto-delist fix. Kept below for the reasoning
about why they were never a live risk.

## 🟡 (historical) Two sold listings carried stale local state

`10k-gold-monaco-cuban-link-necklace` and `10k-gold-rope-chain-necklace` are
`status: sold` in the app, and:

- **eBay** — offers PUBLISHED but listings `OUT_OF_STOCK`. Both sold on eBay
  itself (Monaco: "You sold this item on Aug 9"; rope chain: "out of stock").
  Not purchasable. Local `last_pushed_qty` is still `1` because eBay decremented
  the quantity itself — we never pushed a zero.
- **Etsy** — local rows still say `sync_state: active` / `listing_state: active`,
  while Etsy itself serves *"Sorry, this item is unavailable."* Not purchasable.

✅ **Verified on both marketplaces — there is NO double-sale exposure.** This is
stale local state only.

⚠️ **But the auto-delist hook did not log anything after either sale.** The
product went `sold` on 2026-08-09 / 2026-08-10 and there is no
`status_change_hook`, `delist`, `withdraw` or `hide_oos` row on either channel
after those dates. Earlier hook runs DID log (`delist ok` 2026-07-20), so the
mechanism works — it just did not fire this time. Worth finding out why before a
future sale leaves something genuinely purchasable.

Side effect while it stands: both rows are re-selected and skipped by every
price-push run, forever. Same class as the 33-item residue from 2026-08-08.

## ✅ VERIFIED 2026-08-22 — marketplace price-push timeout fix works

**Shipped in `main@e81f9f9`. No SQL.** Confirmed by the first unattended morning
run:

- **eBay: success in 2s** — `0 pushed, 85 unchanged, 0 blocked, 0 failed,
  0 deferred`. Run **#142 was 38s and a 504**; this one is green.
- **Etsy: success in 14s** — `32 pushed, 55 unchanged, 0 blocked, 0 failed,
  0 deferred`, with the 32 item writes taking **2.14s** against 20.9s for 41
  items before. **Per item 522ms → 67ms.**
- **`0 deferred` on both channels.** Etsy's silent 15–18/day backlog is gone.
- **`0 blocked` on eBay** (was 1) — the Inventory #82 reattachment confirmed
  through the cron, so the empty write-block list is proven in production.
- **0 failed workflow runs since #143.**

Detail: `CHANGELOG.md` 2026-08-22 (2).

`ebay-price-push` failed (run #142, 504 after 32s) **after successfully pushing
all 50 prices** — the gateway hung up just before the handler returned. Etsy had
the same defect and was silently deferring **15–18 listings a day** since
2026-08-20 without ever going red.

**What changed** — `lib/{ebay,etsy}/sync.ts` + `lib/{ebay,etsy}/store.ts`:

1. Bookkeeping batched — `bulkPatchListings` + `insertSyncLogs` replace two
   awaited round-trips per listing. That was 15.7s of a 22.2s run.
2. Budget is now an absolute `deadlineAt` stamped on entry (20s, was a 22s
   loop-relative budget that could not bound the request).

**Gate, from a deleted `.next`:** `tsc` clean · `lint` clean · **1033/1033
across 101 files** · build **454/454 pages**. New tests were **mutation-tested**
— reintroducing either bug fails them.

### ◻ After deploying

1. **Watch the 7:15 and 7:45 a.m. EDT runs tomorrow.** Both should be green and
   noticeably faster. Success looks like `0 deferred` in the summary row:

   ```bash
   curl -s -o /dev/null -w "%{http_code} %{time_total}s
" -X POST https://naplesestatejewelry.com/api/admin/ebay/price-push
   ```

   (401 unauthenticated — that is the point; it times the route, not the work.)

2. **Confirm the Etsy backlog clears.** It should push all ~56 candidates in one
   run instead of 41. Check the newest `scheduled_price_push` row in
   `etsy_sync_log` for `0 deferred`.

3. ⚠️ **If `deferred` is still non-zero**, the catalog has outgrown a single
   synchronous request. Move the push to a Netlify **background** function
   (15-minute ceiling) — do NOT raise the 20s constant toward 26.

## 🟡 eBay `account_deletion` webhook rows are 97% of the sync log

Found while investigating the above; **not** its cause, and not urgent.

ℹ️ **This same webhook is also what makes Netlify Observability's error rate
look scary** (checked 2026-08-25 after the owner asked about ~24% errors
post-deploy). The "errors" are `499 Client Disconnected` on
`POST /api/webhooks/ebay-account-deletion` — eBay's sender hangs up when our
response takes >~1s (slow ones run 0.9–2.9s; fast ones 200). ~794/day, a
perfectly even drumbeat across the last 24h, predating that day's deploy —
**status-code breakdown showed zero server errors in the same window** (the
only 5xx were 6/day-scale bot POSTs to `/contact`, a sitemap-variant probe,
and one `/_next/image` 502 blip, all pre-deploy). Netlify counts 499 in its
error rollup and the cadence is constant, so quiet hours show a HIGHER
percentage. Do not re-diagnose this from the Observability panel; filter by
status code first. An ack-immediately-process-later webhook handler would
clear the 499s cosmetically — same latent-priority bucket as the log noise.

`ebay_sync_log` holds **77,617 rows, 75,459 of them `account_deletion`**
receipts from eBay's marketplace-account-deletion webhook, arriving at
**~126/hour** (~3,000/day). `pruneOldSyncLogs` keeps 90 days, and the oldest row
is only 42 days old, so nothing has ever been deleted.

These are compliance pings about eBay users unrelated to this shop. Options, in
order of preference: stop logging them at all, log only a daily count, or prune
that one action on a much shorter retention. Anything that keeps the real
sync history readable — right now `price_push` rows are 563 of 77,617 and the
table is unusable for eyeballing.

⚠️ Do not "fix" this by shortening the global 90-day prune; the genuine sync
history is the part worth keeping.

## ✅ DEPLOYED 2026-08-19 — the checkout sign-in/guest gate

Shipped and **owner-confirmed good on production**. No SQL.

**Verified by fetching production, not assumed** — all 15 JS chunks behind
`/checkout` scanned: **0** `checkout-auth-overlay`, **0** `checkout-auth-card`,
**0** of the old two-option heading, against controls of **1** `checkout-page`,
**1** `How would you like to continue`, and **3** chunks carrying `--app-vh`.
`/`, `/es`, `/checkout`, `/es/checkout` all 200.

⚠️ **A zero is not evidence without a positive control in the same scan.** Two
false passes were hit producing that table: the downloaded chunks saved with a
**double** leading underscore (URL path starts with `/`), so the glob matched
nothing and every grep returned 0; and the static `.css` files returned 0 for
the deleted classes **and** for the control, because styled-jsx rules compile
into the JS bundle and never appear in a stylesheet.

The double sign-in/guest prompt is gone (the drawer now records the buyer's
answer before routing), the two-option screen is deleted in favour of the
owner's four-option one, and the survivor no longer renders inside
`.checkout-page` — which had been anchoring it 1114px down a 812px phone screen.
Full detail and measurements in `CHANGELOG.md` 2026-08-19 (4); the rule is in
`DECISIONS.md`, *"There is exactly ONE sign-in/guest gate…"*.

**Gate passed from a deleted `.next`:** `tsc` clean · `lint` clean ·
**1024/1024** · build **454/454 pages**.

📱 **Still worth ten seconds on a real phone** — the whole bug was reported from
one, and none of this has been looked at on real hardware:

- Proceed to checkout signed out. You should see the four-option screen
  **once**, centred, and land on checkout with **no** second prompt.
- Open `/checkout` directly in a fresh tab with something in the cart (this is
  the bookmark / Back-out-of-PayPal path). The gate should appear **centred in
  the viewport**, with no Cancel button, and must not require scrolling.
- Both locales — ES reads `¿Cómo desea continuar?` /
  `Iniciar sesión · Crear cuenta · Continuar como invitado`.

✅ **Staging was rebuilt for this batch and re-synced after the deploy** — see
*Copying to the repo folder*. It mirrors the source, so the next batch starts
from a clean baseline.

## ✅ Hydration warning on `<html>` — FIXED 2026-08-19, deployed with the gate batch

Found while investigating the gate bug and fixed the same day, at owner request.
It had fired on **every page** in dev since the 2026-08-18 `--app-vh` work.

`<html style={{ backgroundColor: '#f9f9f7' }}>` in `[locale]/layout.tsx` had no
`suppressHydrationWarning`, while the inline script below it writes `--app-vh`
onto `document.documentElement.style` before React hydrates — deliberately,
since the token must land before first paint. React compared its prop against
the real attribute (`background-color: rgb(249, 249, 247); --app-vh: 812px`),
found the extra property, and logged "A tree hydrated but some attributes …
didn't match".

**Fix:** `suppressHydrationWarning` on that `<html>`, the pattern already used
at `shop/(list)/shop-page-renderer.tsx:754`.

⚠️ It is the correct resolution, not a silencer — React already said it "won't
be patched up", so the DOM was never touched and the token always survived. And
it applies to **that element only**, not descendants, so a genuine mismatch
anywhere inside the app is still reported.

**Verified in a clean tab** (the console buffer is cumulative across
navigations, so a stale buffer will lie to you here): `/` and `/es/shop` both
load with **zero** console errors, and `--app-vh` still lands —
`htmlStyleAttr: "background-color: rgb(249, 249, 247); --app-vh: 1278px"`,
`body class="min-h-[var(--app-vh)] flex flex-col"`.

**Re-gated after the change**, because this file is the root layout and the
prerender count is a structural invariant: `tsc` clean · `lint` clean ·
**1024/1024** · build **454/454 pages**.

## 🟡 SCHEDULED-JOBS: `facebook-drip` failed once; cause NOT established

Run #124 (2026-08-19, 03:00 UTC) failed with `curl (56)` after 25s — Netlify
cutting a synchronous function at its 26s ceiling. **123 of the 124 runs before
it passed.**

✅ **Established:** the 25s was startup or platform, NOT handler work. With the
queue empty (owner-confirmed) `runScheduledDrip` does three Supabase calls;
warm, the endpoint answers in **0.2s**, and that 0.2s is the route itself
(`proxy.ts:21` — `/api/*` is outside the middleware matcher).

🔴 **NOT established:** what consumed the 25s. Two theories were formed and
neither survived as proven — first "it published more than fit in 26s"
(impossible: empty queue), then "the `sharp` + `next/og` import graph makes cold
starts expensive" (chain is real, causation unproven; three measurement attempts
failed, see `CHANGELOG.md` 2026-08-20). **A transient Netlify/Supabase stall is
not excluded.**

### ◻ What to do

1. ✅ **DEPLOYED 2026-08-20** — a 20s wall-clock budget on both drip loops, and a
   lazy `./images` import so a no-op drip cannot load the image stack. Both are
   correct on their own terms and **neither is claimed as a fix**. Gate:
   `tsc`/`lint` clean, **1029/1029**, **454/454**. Endpoints verified live and
   still secret-guarded after the deploy (401, 0.29–0.40s) — which confirms they
   serve, not that either change did anything.
2. ✅ **Run #125 passed and proves the new code is live.** Its `facebook-drip`
   log returned `HTTP 200` with
   `{"published":0,"skipped":0,"deferred":0,...}` — `deferred` exists only in
   the new code — and the step took **1s** against #124's 25s.

   ⚠️ **That is not proof the budget fixed anything.** With zero rows the loop
   never iterates, so 1s is just the trivial handler on a healthy platform —
   which supports the transient-stall reading. The lazy `./images` import
   shipped later and has **not** yet had a scheduled run.

3. 🟡 **OWNER: keep half an eye on the next few runs.** One failure in 125 does
   not justify more surgery. Run list:
   `github.com/DarkMatter-WebDev/NaplesAntiquesLLC.com/actions/workflows/scheduled-jobs.yml`
4. **If it recurs, run the one measurement that settles it:** leave the site
   idle ~15 minutes, then time a single unauthenticated POST to
   `/api/admin/facebook/drip`. Seconds ⇒ cold-start cost is real. Fast ⇒ the 25s
   was transient and the import theory is dead.

⚠️ **Do not re-run the three failed measurements** (grepping the built route
chunk, timing a local `next start`, or a `Module._load` probe) — all three are
recorded in `CHANGELOG.md` 2026-08-20 with why they proved nothing.

## ✅ ALL `svh` SURFACES CONVERTED — DONE, DEPLOYED, OWNER-VERIFIED 2026-08-19

The five listed after the hero fix are converted, plus `.site-loading-screen` as
a sixth. Shipped, and the owner confirmed the hero-text drift is gone in the
Instagram browser. Verified on production: `.responsive-hero`,
`.site-loading-screen` and `.checkout-page` all carry `var(--app-vh)`, the
homepage hero carries 16 `--app-vh` occurrences with zero bare `Nsvh` in its
clamps, and the deployed checkout JS has **0** `min-height:100svh`. Detail and
per-surface measurements in `CHANGELOG.md` 2026-08-19 (3).

**Nothing is left to convert.** The rule is now enforced by
`lib/__tests__/viewport-units.test.ts`, which rejects `svh` sizing or
positioning anywhere under `src/app` + `src/components`, with two encoded
exemptions: `max-height` on a transient overlay, and the `--app-vh` declaration
itself. ⛔ Do not add a third exemption without reading DECISIONS first.

⚠️ **`tsc` and `lint` pass on a broken styled-jsx template literal.** The
compile check for a `<style jsx>` change is a **real build**. A stray backtick
in a comment inside one of those literals ends the string and 500s every route;
this bit twice on 2026-08-19.

## ✅ IN-APP-BROWSER VIEWPORT JUMP — FIXED AND OWNER-CONFIRMED 2026-08-18

Deployed and confirmed by the owner from inside Instagram: **the jump is gone.**
Closed. Full detail in `CHANGELOG.md` 2026-08-18 (11)–(13) and `DECISIONS.md`,
*"`svh` is NOT stable in an in-app browser"*.

**Root cause, measured rather than inferred.** `vh`, `svh` and `dvh` all resolve
to the SAME value in Instagram's iOS webview, and all three track the chrome
(`innerHeight` 729 ↔ 853, 124px). Instagram resizes the WKWebView natively, so
WebKit sees a plain window resize with no small-vs-large viewport to
distinguish. The 2026-08-11 batch adopted `svh` *because* it is "stable across
exactly this event" — true per spec, false there, which is why two rounds of
fixes changed nothing.

The homepage hero amplified it: runway `(100svh - header) + 240svh` = **3.4 × the
unit**, so 124px of chrome became 3.4 × 124 = **421.6px** against **423px**
measured. A page whose height moves under a scroll is the jump.

**Fix:** `--app-vh`, written before first paint and refreshed only through
`onLayoutAffectingResize`. ⚠️ Do not "simplify" a `var(--app-vh)` back to
`100svh` — it looks like a pointless indirection and is the whole fix. Guarded
by `lib/__tests__/viewport-units.test.ts`.

**The temporary diagnostic is REMOVED** (2026-08-18): `ViewportDebugOverlay`,
its mount, the DEBUG button, the `?vpdebug=1` handling, and its `dvh` allowlist
entry. Verified: **0** occurrences of `vpdebug` in the built JS.

✅ Two things this closed that had been left open as suspects: the **hero touch
snap is cleared** (homepage `auto-scroll` maxed at 134px ≈ the 124px toolbar
travel — scroll clamping, not the 1s animated snap), and the `*-screen` → `svh`
conversion was a **real defect but not the cause**, kept because it is correct
everywhere `svh` behaves per spec.

## 🔴 TOP OF THE LIST (2026-08-18)

0. ✅ **DEPLOYED 2026-08-18 — this batch is LIVE.** It passed the gate from a
   deleted `.next` (`tsc` clean, `lint` clean, **1016/1016**, **454/454 pages**)
   and shipped the same day. No SQL was outstanding. Contents are listed in
   `CURRENT_STATUS.md` and detailed in `CHANGELOG.md` 2026-08-18 (1)–(9).

   ✅ **The CSP hazard cleared.** The risk was that `frame-src`'s new
   `https://www.google.com https://maps.google.com` lived in
   **`next-app/next.config.ts` AND root `netlify.toml`** — the root file is what
   serves production — and that a copy missing the root file would blank every
   map with nothing but a console error. It travelled; the live header carries
   both origins. Re-check any time with:

   ```bash
   curl -s -D - -o /dev/null https://naplesestatejewelry.com/ | grep -i "content-security-policy"
   ```

   ✅ **Confirmed serving**, fetched from production: homepage 200 with the
   correct title; `Call or Visit Us Today`, the `#visit-us` hero anchor, the
   `6240 Shirley` / `Sharon Lynch` address block, the copy-address control and
   the review marquee all present; and **both maps render** — homepage and
   `/contact` each carry the lazy
   `maps.google.com/maps?q=26.222053,-81.781429&z=17&output=embed` frame.

   👀 **Three things still have not been LOOKED at by a human** — the Browser
   pane was hidden for the session that built them. The smooth scroll, the
   clipboard copy and the marquee loop are listed with their measured reasons in
   the phone-check items below. All three are now exercisable on the live site
   and are worth ten seconds each.

   ⚠️ **Rebuild staging before the next batch** — recording this deploy makes
   it stale by definition. Command under *Copying to the repo folder*.

1. ✅ **DEPLOYED 2026-08-17 — that batch is live.** The batch that had
   been queued since 2026-08-09 is live, owner-confirmed, and verified by
   fetching production: homepage title/h1/eyebrow correct with exactly one
   `<h1>`; six pages across both locales all 200 with `og:image` present and
   `og:title` == `<title>`; sitemap 107 URLs with 20 on `2026-08-17`, none left
   on `2026-07-11`, and no `noindex` leaks; brand assets byte-identical to
   source. Evidence in `CHANGELOG.md` (2026-08-17) and `CURRENT_STATUS.md`.

   ✅ It passed a pre-deploy audit first, from a deleted `.next`: `tsc` clean,
   `lint` clean, **998/998 tests** across 98 files, **454/454 static pages**. A
   runtime sweep of **30 indexable pages across both locales found zero
   problems**, and the money invariant was proven through the live quote API —
   a `$5,558` card produced a `5558` charge.

   ✅ **Staging re-synced after the deploy** — `C:\Users\rcman\NEJ-repo-staging`,
   **843 files, ~19.3 MB**, dry run **Copied 0 / Extras 0 / Mismatch 0 /
   FAILED 0**. It now mirrors what is live, so the next batch starts clean.

   ℹ️ Recording a rebuild in this file necessarily makes staging stale by this
   file, so the sequence is always: edit docs LAST, then sync, then confirm a
   0-copy dry run. The figures above are measured a moment before that final
   sync; the file COUNT is the stable number to check, not the megabytes.
   Leak check clean — 0 `.git`, 0 `node_modules`, 0 `.next`, 0 `.env*`,
   0 `.pem`, 0 `*.tsbuildinfo`, 0 `next-env.d.ts`, 0 `*.log` — against a
   **positive control of 170 `.tsx`**, so the zeros are real rather than a
   broken scan. Hidden paths confirmed present: `.github/workflows/
   scheduled-jobs.yml`, `.gitignore`, `.claude/launch.json`, `next-app/.npmrc`,
   `next-app/.gitignore`. Content spot-checks in the staged copy: the
   `RouteProgressBar` mount, `data-site-header`, the
   `body:has([data-site-header])` offset, `roundToWholeDollar`, `pageMetadata`,
   the settled hero copy, and the ABSENCE of the removed un-layered
   `font: inherit`. The three regenerated binaries are present at their source
   sizes — `nav-logo.webp` 16KB, `src/app/icon.png` 23KB, `favicon.ico` 11KB.
   No SQL outstanding; all three migrations are applied, and the 2026-08-15/16
   work adds none.

   ℹ️ **Robocopy reports 846 total files against 843 on disk, and that is
   correct** — it counts `/XF`-excluded files in its total. The three are
   `.env.local`, `tsconfig.tsbuildinfo`, and `next-env.d.ts`, all verified
   absent from staging. Do not chase this gap as a missing-file bug.

   ⚠️ Still a point-in-time snapshot — rebuild again after any further edit.

   ✅ **Those four changes shipped too**, in the 2026-08-18 deploy — see item 2.
   ⚠️ Staging is stale again as of this doc update; rebuild it (command under
   *Copying to the repo folder*) before the next batch.
2. ✅ **DEPLOYED 2026-08-18 — the showroom map and the "visit us" copy.**
   Gate passed: `tsc` clean, `lint` clean, **1016/1016**, **454/454 pages**.
   Detail: CHANGELOG 2026-08-18 (1); DECISIONS, *"The showroom map is a keyless
   embed, pinned to GEO, and always lazy"* and *"The homepage invites a visit,
   and the invitation is hours-conditional"*.

   🔴 **Deploy hazard — the CSP change must travel with the code.** `frame-src`
   gained `https://www.google.com https://maps.google.com` in **two** files:
   `next-app/next.config.ts` and **root `netlify.toml`**. The root file is the
   one that serves production. If the copy to the repo folder misses it, every
   map on the live site renders as an empty rounded box with only a console
   error — the page still looks finished, so this failure will not announce
   itself. **Check the live CSP header after deploying:**

   ```bash
   curl -s -D - -o /dev/null https://naplesestatejewelry.com/ | grep -i "content-security-policy"
   ```

   👀 **Nobody has actually looked at these maps.** The Browser pane was hidden
   for the whole session, so every check was a DOM/network measurement — the
   frame is confirmed to hold a cross-origin document, but no human or
   screenshot has seen a tile render. This is the first thing to eyeball.

   📱 **Phone checks after deploy:**
   - **Homepage** — the map is deliberately small (`clamp(190px, 42vw, 260px)`,
     341×190 measured at 375px). Confirm it reads as orientation and does not
     out-weigh the phone number above it. If it feels like an afterthought,
     grow the clamp; if it steals the section, shrink it.
   - **Contact** — the taller map (`clamp(240px, 52vw, 380px)`) sits directly
     above *Get directions*. Confirm the two read as one unit and that the pin
     lands on the right building, not the plaza next door.
   - **Scroll past both on a slow connection** and confirm the lazy frame does
     not cause a visible layout jump when it swaps in.
   - **Both locales.** ES strings: `Llámenos o Visítenos Hoy`, `Visítenos hoy:
     pase por nuestro salón…`, `Ahora Tenemos Salón en Naples`.

   ⚠️ **The homepage copy is hours-conditional on purpose** — "walk in during
   opening hours", never "no appointment needed". The showroom is closed Sunday
   and Monday and the page is cached, so an unconditional invitation is false
   two days in seven. Strengthening it means making the page time-aware.

   📱 **Also check, from 2026-08-18 (2):**
   - **The zoom buttons.** Each press *reloads* the Google frame (a cross-origin
     iframe cannot be scripted), so expect a brief redraw per step rather than a
     smooth native zoom. Confirm that reads as acceptable on a phone on
     cellular, where the reload is slowest. If it feels broken rather than
     merely slow, the honest options are to widen the debounce, drop to a single
     "View larger map" link, or pay for a Maps API key — not to pretend it is
     instant.
   - **Press Back after zooming.** It must leave the page, not rewind through
     zoom levels. Measured `history.length` growth of 0, but this is the exact
     thing a future `src`-instead-of-`key` "simplification" would silently
     break.
   - **Zoom 17 is the new default.** Confirm it opens close enough to read the
     plaza without losing the surrounding roads someone navigates by.
   - **Control size is 36px.** Above the WCAG 2.2 AA minimum, but it is a
     judgement call against the homepage map's 190px minimum height — say if
     they read as cramped or as too dominant.
   - **The address block, in BOTH locales**, in the footer, the homepage CTA and
     About: "Sharon Lynch Collections" must never split across lines. Verified
     at 320px in Spanish (the worst case), but this is a font-rendering question
     and real devices have their own fonts.

   📱 **And from 2026-08-18 (3) — the hours list:**
   - **Seven rows in the footer** is the biggest layout change: the footer's
     brand column grew by roughly five lines on every page. Check it does not
     unbalance the footer on desktop or add awkward scroll on a phone. If it is
     too heavy there, switch the footer to `variant="grouped"` — same
     component, one prop.
   - **The homepage CTA is the ONE surface using the 2-row grouped form.**
     Confirm it does not read as evasive next to the seven-row lists elsewhere.
     Switching it to `full` is also one prop.
   - **Column alignment on a real screen**, both locales — times should form a
     single right edge. Measured clean at 320px in Spanish (no row wraps,
     nothing overflows), but this is a font-metrics question.
   - ⚠️ **If the open days ever change**, re-read the warning on
     `hoursRowsGrouped()`: it hardcodes "Sunday – Monday" as the closed pair and
     will silently lie if the closed days stop being contiguous.

   📱 **And from 2026-08-18 (4) — the hierarchy pass:**
   - **The homepage CTA ladder on a real screen.** Ten steps from a 10.4px gold
     eyebrow to a 12.6px footnote. ✅ The two judgement calls here were already
     put to the owner and answered on 2026-08-18: the deck is **colour-only, not
     bold** (600 read as shouting) and the block carries **one rule on top, not
     a bracket** (closed both ends read as a stray box). Confirm the pulled-back
     version on a real screen, and see DECISIONS before touching either.
   - **The footer, contact and About got the shared half of this** (bolder
     street line, bolder days/times, dimmer closed rows). Confirm the footer
     hours do not now out-shout the address above them at 12px.
   - ⚠️ **Do not "simplify" the emphasis into a colour.** Both components
     render on four surfaces with four inherited palettes; weight and opacity
     are what survive that. See DECISIONS.

   ✅ **OWNER ACTIONS from 2026-08-18 (5) — both CLOSED 2026-08-19:**

   - ✅ **Google Business Profile hours FIXED.** Were `Mon–Sat 10:00 AM–5:00 PM`,
     matching neither the site nor the schema. Now **Sun + Mon closed, Tue–Sat
     11:00 AM–3:00 PM**, byte-identical to `HOURS` in `business-location.ts`.
     ✅ **Applied and live** — re-checked in the profile editor after review.
   - ✅ **The profile Description no longer claims to be mobile-only.** It still
     read "We're private, mobile, and appointment-only…", the last place
     contradicting the store-first rewrite. Now leads on the showroom, the
     Sharon Lynch Collections landmark and Tue–Sat 11am–3pm, with home visits
     framed as on request. ✅ **Also applied and live.**
   - ✅ **Linda Cusumano's review is published**, without the stray "Hi baby"
     line. She had not edited it; the owner chose to trim rather than wait. That
     is a deliberate, recorded override of the verbatim rule — see DECISIONS and
     the inline note in `testimonials.ts`. ⛔ One exception, not a new policy.
   - ✅ **DONE AND DEPLOYED 2026-08-19 — all five missing reviews are in**, and
     confirmed on production (`/`, `/es`, a product page and the legacy `.co`
     all serve the new list; `Nolan Olivier` and `Onur` return 0 on every one).
     With the reconciliation below, `TESTIMONIALS` is **13 → 16**. Five were
     missing, not four: the earlier count came from a Maps feed that stopped
     paginating after ten, so the tail was never seen.
     Added: **Ruthe Lloyd, Ariel Babastro, Ryan Smith, Edna Cavazos, Mayelin
     Pérez**.

     ⚠️ **Mayelin Pérez is the Spanish one, and her entry inverts the pair** —
     `quoteEs` is her verbatim original, `quote` is our translation. Google's
     card shows a machine translation by default; the original is only behind
     its *"See original (Spanish)"* control. Publishing the visible text would
     have shipped a machine translation as a customer's words.

     **How to read the full list** (the pagination trap that caused the
     undercount): the Reviews pane must be scrolled by its own scroll container
     — `div.m6QErb.DxyBCb.kA9KIf.dS8AEf` — until the card count stops growing,
     then every *"More"* expander clicked. Scrolling the window does nothing.
     ⚠️ Google appends a trailing `" …"` to `textContent` on emoji-ending cards
     (Cristian's, Douglas's) even when the text is complete — strip it; it is a
     UI marker, not the reviewer's words.

   - ✅ **RESOLVED — the list is reconciled against the profile, 16 matching
     1:1.** Three entries did not reconcile, and the owner supplied the reason:
     **he accidentally deleted his original Google Business Profile and rebuilt
     it from scratch.** Those reviews were real and his; they did not survive.

     | Entry | Action |
     | --- | --- |
     | **Nolan Olivier** | removed — gone with the old profile |
     | **Onur** | removed — gone with the old profile |
     | **Yisel Perez** | **quote replaced** — she re-reviewed on the new profile |

     Yisel was refreshed rather than dropped: she is still a live reviewer, only
     her text is new. Leaving the old words under her name was the worst option —
     a reader clicking "Read on Google" would find her saying something else.

     ⛔ **Standing rule, now in `testimonials.ts`: every entry must still exist
     on the live profile.** Each card links to it, so an absent quote sends the
     reader to look for something they will not find. Reconcile the list against
     the profile — drop what vanished, refresh what changed — don't only append.

     ⚠️ ***Naples Jewelry Buyers* (5.0/33) is NOT the owner's business** — the
     name is coincidence. A guess made during this session said it was the
     likely source of those entries; that was wrong. Do not repeat the
     inference.

   🔴 **NEXT, owner: Google address verification** — owner is going 2026-08-20.
   Until the address is verified, the showroom's NAP is not fully trusted by
   Google. The hours and description edits above should have cleared review by
   then; check both before going.

   📱 **And check the marquee itself:**
   - **Speed.** Measured ~49px/s (84s per cycle at 12 reviews). Duration is
     derived from the card count, so it stays at that speed as reviews are
     added — confirm it is readable rather than hypnotic on a real screen.
   - **The seam.** It should loop with no visible jump. Measured exact (track
     8115px, half 4057px), but a jerk once per 84s is the symptom if the
     `margin-inline-end` rule is ever "tidied" into `gap`.
   - **On a phone**, confirm the band does not fight vertical page scrolling.
   - **Product pages still show the GRID**, deliberately — confirm that still
     looks right next to the new homepage treatment.

   📱 **And from 2026-08-18 (6) — the footer:**
   - The address and hours are now a **centred band under all four link
     columns**, not inside the brand column. Column heights measured
     222/222/222/222 (spread zero) after the move, against a roughly 2:1
     imbalance before. Confirm the centred band reads as deliberate on a wide
     desktop, where it sits alone under four left-aligned columns.
   - On a phone the two halves **stack, still centred**. Confirm the footer has
     not become tediously long — it is the seven-row hours list that drives the
     height, and `variant="grouped"` on that one instance is the lever.
   - ◻️ **The phone number stayed in the brand column** (it is a bordered tap
     target on mobile). That splits N-A-P across the footer. Say if it should
     move down beside the address for a contiguous NAP signal instead.

   📱 **And from 2026-08-18 (7):**
   - 🔴 **Watch the "Visit Us" button scroll, once.** The smooth animation
     is the one thing this session could NOT verify: the hidden Browser pane
     freezes `requestAnimationFrame`, measured directly (no rAF callback in
     1500ms; a smooth scroll sat at scrollY 0 for six seconds). The instant
     path was proven correct — scrolled to 5871 and landed the block exactly at
     the header's bottom edge — so the anchor, id and offset are right and only
     the animation is unseen.
   - Check it lands cleanly on a **phone**, where the header token is 3.5rem
     rather than 4.5rem. Both were verified by measurement.
   - ◻️ **`/trade-in` has lost its only prominent entry point.** It is now
     only in the footer under *Sell to Us*. Decide whether the trade-in program
     needs a new home — taking the hero slot back would cost the showroom its
     link.

   📱 **And from 2026-08-18 (8) — the copy-address button:**
   - 🔴 **Press it once on each of the three surfaces.** The copy could not
     be exercised here: the hidden Browser pane leaves `document.hasFocus()`
     **false**, and the browser blocks both paths on an unfocused document
     (Clipboard API threw `NotAllowedError`, `execCommand` returned `false`).
     `isSecureContext` is true and the API exists, so a real focused page has
     both. Paste the result somewhere and confirm it is
     `6240 Shirley St, Ste 104, Naples, FL 34109` — street and city only, with
     **no** landmark and **no** business name.
   - **On a phone**, confirm 24px is a comfortable tap target beside the
     address. It is small by request; if it is fiddly in practice the box can
     grow without touching the icon.
   - ✅ **The footer address got one too** (2026-08-18 (9)), so all four
     address surfaces now carry it.

   📱 **And from 2026-08-18 (9) — the square map:**
   - The frame is now **1:1**: 448px on the homepage, 512px on contact, 288px at
     a 320px viewport. Confirm the extra height earns its space on the homepage,
     where it sits under the CTA — it is roughly 190px taller than the strip it
     replaced.
   - ⚠️ `maxWidth` caps the WIDTH but binds the height too. If a surface wants
     a wider map it also gets a taller one; re-check both.

   ◻️ **Owner call:** the About page has **no map** by design (text + directions
   link only), on the reasoning that its job is to say the store exists and the
   contact page one click away does wayfinding properly. Say so if you want one
   there — it is a one-line change.

3. ✅ **DEPLOYED 2026-08-18 — four owner-requested changes.** Gate passed: `tsc` clean,
   `lint` clean, **1016/1016**, **454/454 pages** from a deleted `.next`.
   Detail: CHANGELOG 2026-08-17 (3) through (6), and DECISIONS,
   *"The header brand row is full on a phone"*, *"The route bar is immediate,
   and that is the whole point"*, and *"An undecided swipe is not a scroll"*.

   All four are 📱 **phone-first checks** — every one of them turns on a
   judgement the measurements could not make. Taken in order:

   (a) **The octopus mark now shows at every viewport width** — it was
   `hidden md:block`, so phones and sub-768px tablets showed the wordmark alone.
   (b) **The ES/EN chip is md-and-up only**, collapsed into the mobile menu's
   existing language item, which is what paid for (a).
   (c) **The route progress bar is now immediate on every navigation.**
   (d) **The photo swipe triggers on a slight sideways move**, and is now one
   shared gesture.

   Detail follows **most recent first**, so (d), then (c), then (a)+(b).

   (d) 📱 **Photo swipe — the change that most needs a real thumb.** The product
   gallery had never received the 2026-08-09 fix and was structurally unable to
   swipe (React `pointermove` cannot cancel a scroll). Synthetic touch proves the
   thresholds fire, not how it feels:
   - On a phone, swipe the main photo on a product page and a shop card. It
     should catch on a **slight** sideways move now, including when your thumb
     arcs downward as it travels.
   - Then deliberately **scroll the page with a drag that starts on a photo**,
     both surfaces. This is the risk side of the change: if scrolling now feels
     sticky or steals into a photo change, the cone (1.6) is too greedy — lower
     it in `lib/photo-swipe.ts`, do not raise the vertical trigger.
   - Confirm a swipe still does not open the product/lightbox, and that a plain
     tap still does.

   (c) **The route progress bar is now immediate on every navigation** — the
   120ms delay is gone, query-only navigations (shop filter/sort/view/
   pagination) arm it, and navigations started from a `<button>` arm it via
   `startRouteProgress()`. It was never gated by page or viewport; the delay
   plus uneven prefetch coverage is what made it look that way.

   📱 **Check after deploy:**
   - **The flash is deliberate.** On a fast connection most navigations commit
     in tens of milliseconds, so the bar will blink rather than travel. A
     minimum display time was offered and declined — if it now reads as
     glitchy, that decision is the thing to revisit, not the delay.
   - **`/shop` lost its centred spinner** (duplicate of the bar once filters
     started arming it). Run a filter, a sort, a view toggle and a pagination
     click and confirm the top bar is enough acknowledgement on a long catalog
     page, including scrolled to the bottom — the bar is at the fixed header, so
     it should always be in view. Restoring the spinner is a markup revert in
     `ShopNavigationProgress.tsx`.
   - Confirm the **cart drawer's Checkout button** and **Sign out** show the bar
     — those navigate from a button and are newly covered.
   - ⚠️ **Do not remove the `<Suspense>` wrapper** around `RouteProgressBar` in
     `[locale]/layout.tsx`. It is what keeps `useSearchParams` from deopting all
     454 prerendered pages.

   (a) + (b) 📱 **Header mark and language chip — check on a real phone and a
   real tablet, in BOTH locales:**
   - The mark renders at **28px tall on a phone**, below the 40px it gets on
     desktop. It is a small, detailed illustration; whether it still reads as
     the octopus at that size on a real screen is exactly the open question
     TASKS already raised for the 40px header case. **If it reads as mud, the
     fix is a tighter crop on the body, not a bigger box** — the box is the
     header's content budget and growing it moves `--site-header-height`.
     ℹ️ There IS spare room now (11.7–25.9px across the phone band), so a
     modestly larger mark is affordable if the owner wants one — but it must be
     re-measured, not assumed.
   - **Open the mobile menu on a narrow phone in Spanish** (`Cerrar` is the
     longest toggle label — the widest this row ever gets) and confirm the
     wordmark still ends in a clean "y", not a clipped "Jewelr".
   - **Confirm switching language still feels findable on a phone**: it is now
     the last item in the hamburger menu (`Español` / `English`) and no longer a
     chip in the header. This is the one behaviour change a returning visitor
     could notice. The link itself was exercised at 390px — `/es` → `/`, menu
     closes.
   - Confirm the chip is back to normal at tablet/desktop widths (it returns at
     768px), and that the wordmark reads well: it is fluid now and is at or
     above its old size at every width.
4. ✅ **DONE 2026-08-27 (sitemap half) — resubmitted, read Success, 99 pages.**
   The Request-Indexing half is superseded by the 2026-08-27 item at the top of
   this file. Original text kept for context:

   ◻️ **Resubmit the sitemap in Search Console, and Request Indexing on the
   four pages whose titles changed** — `/`, `/sell`, `/services`,
   `/silver-services`. Owner action; nobody has done it yet.

   Search Console → **Sitemaps** → resubmit `https://naplesestatejewelry.com/sitemap.xml`,
   then **URL Inspection** → *Request Indexing* on each of the four.

   ℹ️ **There is no sitemap file to edit** — `src/app/sitemap.ts` generates it at
   build time, and the deploy already published the new one (verified live
   2026-08-17: 107 URLs, 20 carrying `2026-08-17`, zero `noindex` leaks).
   Resubmitting only asks Google to re-fetch sooner; it changes nothing about
   what is served. `CONTENT_LAST_MODIFIED` was bumped `2026-07-11` → `2026-08-17`
   for the same reason.

   This is a **nudge, not a repair.** Nothing in the deploy can hurt search — no
   URL, route, or robots directive changed. Left undone, Google finds everything
   anyway on its own cadence; done, the new titles land sooner. Expect titles to
   swap in over days-to-weeks and the favicon to lag longer still.

   While there, check that the **"Submitted URL marked noindex"** errors for the
   six legal pages clear — they were being submitted and refused simultaneously
   until this batch removed them from the sitemap (113 → 107 URLs).
5. **Re-measure first paint on production** (snippet below, under *After the
   next deploy*). Baseline to beat: 533KB across 30 requests before FCP.
6. **Confirm the first real refund records itself.** The fix is proven locally
   against real PayPal refunds but its automatic path has never run in
   production.

7. **Now live — check the two 2026-08-15 changes on a real screen:**
   - 📱 **Shop-card photo arrows** are the one customer-facing visual change from
     the button font fix — now **14px/700** where they were 16px/400 (bolder,
     slightly smaller). Confirm they still read well on a phone and a desktop,
     on both a light- and a dark-backdrop card. The drawer `✕` and the header
     Menu button changed the same way.
   - **Whole-dollar prices**: confirm no shop card, product page, cart drawer or
     checkout line item shows cents, and that a checkout line item equals its
     shop-card price exactly. Tax, and therefore a Florida total, **should**
     still show cents — that is correct, not a miss. The gold/silver spot
     tickers (`$4,377.60/oz`) keep their cents deliberately.
   - Spot-check one eBay and one Etsy listing after their next price push: both
     should now carry whole-dollar prices.
   - 📱 **Tap feedback, on a real phone AND a real tablet** — this is the change
     that cannot be judged from measurements. Tap a shop-card cart/wishlist
     button, a gold CTA, and a nav link: each should visibly acknowledge the
     touch. Confirm the gold tap highlight reads as deliberate rather than
     grubby on both a light and a dark product page. Then **swipe a shop card
     photo and confirm the swipe still works and does not flash a press state**
     — cards are deliberately excluded from press feedback for this reason.
   - 🔎 **Homepage title + site name in Google — check WEEKS later, not days.**
     Both are re-crawl-gated. Search `naplesestatejewelry.com` and confirm the
     result reads *"Naples Estate Jewelry - Sell Gold…"* and that the line above
     it shows **Naples Estate Jewelry** rather than the bare domain. Fastest
     nudge: request indexing for the homepage in Search Console. The title is
     now **65 characters**, inside Google's display limit, so the whole line
     including `in Naples, FL` should be visible. Note Google may still rewrite
     a title regardless of what we set; that is its prerogative, not a bug.
   - 🔎 **Spanish share card.** Paste `https://naplesestatejewelry.com/es` into
     Facebook's Sharing Debugger and X's Card Validator and confirm a **Spanish**
     title and description, the og-preview **image present**, and the URL
     resolving to `/es` rather than the English homepage. Do the English
     homepage too — the same edit rewrote its block. ⚠️ Facebook caches
     scrapes; use "Scrape Again" rather than assuming it did not work.
     ✅ Interior pages now emit their own cards via `pageMetadata()`. **Check
     `/sell` and one `/sell/[city]` specifically** — those were posting BLANK
     cards (hand-rolled `openGraph` with no `images`), so they are the pages
     most worth confirming, and Facebook will be holding the old blank scrape
     until you press "Scrape Again". Also check one product page shows the
     PRODUCT photo, not the site card.
   - 📱 **Homepage hero on a real PHONE, both locales.** Eyebrow **"One Piece or
     an Entire Estate"** over h1 **"Naples Premier Gold, Sterling & Jewelry
     Buyers"** (46 chars). **Desktop is confirmed good** — the headline block was
     widened to `72rem` and it renders two clean lines, screenshotted. **Phone
     still renders THREE lines** at 30.4px and was deliberately left alone; that
     is the one view nobody has seen on real hardware. Measured clean (no
     overflow, no horizontal scroll, 124px EN / 105px ES clearance to the sign-up
     block), but three lines is the largest hero block this page has carried.
     ⚠️ If it reads heavy, the fix is **fewer characters, not smaller type** —
     shrinking the font keeps three lines until 20px, which is body-text size.
     `Naples Premier Gold & Jewelry Buyers` (36) is the natural trim.
     ℹ️ The old tagline *"Rare. Authentic. Timeless."* is gone from the page
     entirely; say so if you want it kept somewhere (footer or `/about`).
   - 🔎 **Confirm the homepage H2s read naturally.** *"We Buy Gold in Naples"*
     and *"We Sell Estate Jewelry in Naples"* were lengthened for local signal
     (headings mentioning Naples: 0 → 3). Card titles re-measured at 320px in
     Spanish and wrap to at most 2 lines, but check the three-card strip still
     looks balanced on a real screen in both locales.
   - 🔎 **Spanish search results (2026-08-16 audit fixes).** After re-crawl,
     search a Spanish query (e.g. *vender oro naples*) and confirm the `/es`
     pages now show SPANISH titles. Eight of them served English titles over
     Spanish bodies until this batch. In Search Console, the **"Submitted URL
     marked noindex"** errors for the six legal pages should also clear — they
     were being submitted and refused at the same time.
   - 📱 **New octopus mark — check the HEADER on a real screen.** The framed
     emblem was replaced by the floating octopus in both the header and the
     favicon. At the header's 40px it is a small, detailed illustration on cream
     `#f9f9f7`; it renders cleanly in a synthetic preview, but whether it reads
     well beside the wordmark at real device pixel ratios is a judgement call.
     Check a retina laptop and a phone. If it looks weak, the fix is a tighter
     crop on the body, not a bigger file — the asset is deliberately capped at
     120px tall / 16KB because it loads on every page.
   - 🔎 **Favicon — check the browser tab immediately, Google much later.** The
     tab icon should be the octopus the moment the deploy lands (hard-refresh;
     browsers cache favicons hard). In Google results it is re-crawl-gated and
     Google caches favicons **aggressively — expect weeks**. Do not re-cut the
     artwork because the palm tree is still showing a few days after deploy.
     If it never updates, confirm `https://naplesestatejewelry.com/favicon.ico`
     and `/icon.png` both return 200 to Googlebot.
   - 🔎 **Also check `/silver-services` after re-crawl.** Its title now reads
     *"Sell Sterling Silver in Naples, FL"* (58 chars) — it is the page that
     should rank for "sell sterling silver naples", and it previously had that
     phrase everywhere except its title. Worth watching whether it starts
     outranking the homepage for that query. ℹ️ Note its title and description
     are **not localized** (same string in EN and ES) — pre-existing, unrelated
     to this change, and worth a separate decision.
   - 📱 **Route progress bar, in production specifically.** Most routes are
     prefetched there, so it should appear **rarely** — mainly on product-card
     taps (`prefetch={false}`) and on a slow connection. If it flashes on
     ordinary fast navigations, raise `SHOW_DELAY_MS` in
     `components/layout/RouteProgressBar.tsx`; the owner rule is that it appears
     only when genuinely needed. Also confirm it never lingers after a page has
     rendered, including on browser Back. Check it sits flush against the
     header's bottom edge at both a phone width and a desktop width — the header
     changes height at md — and that it does not appear to overlap or detach
     from the header while scrolling.

8. ✅ **Showroom copy rollout DONE 2026-08-17, deployed 2026-08-18.**
   Owner gave the address, hours and shared-space arrangement on 2026-08-17:
   **6240 Shirley St, Ste 104, Naples, FL 34109**, **Tue–Sat 11:00–15:00 or by
   appointment**, inside **Sharon Lynch Collections**. Decision recorded:
   **store-first, home visits by request** — so the 6 city pages are reframed,
   not deleted. Scoped by grep: **15 files, 61 strings, both locales**, plus 8
   surfaces that need the address added. Two strings are outright FALSE today
   (schema hours claim Mon–Sat 10:00–17:00; the homepage strip says Mon–Sat).
   All 15 files rewritten in both locales and both false strings fixed. Gate
   passed from a deleted `.next`: `tsc` clean, lint clean, **1016/1016**,
   **454/454 pages**. Verified by fetching the running app: address + landmark
   + hours present on `/`, `/es`, `/contact`, `/es/contact`, `/shipping`,
   `/es/shipping`, `/checkout`, `/faq`, `/sell/naples` and `/shop`, and no
   stale mobile-only claim served on any of 8 pages checked.
   🔴 **Two owner actions still outstanding — see *PHYSICAL LOCATION* below:
   the real `geo` coordinates, and the CAN-SPAM marketing mailing address.**

Nothing else in this file blocks a deploy.

## ✅ Stray nested git repo inside `next-app/` — DELETED 2026-08-14

`next-app/.git` was a **second, orphaned git repository**. Removed on owner
instruction; nothing referenced it and the root repo at
`https://github.com/DarkMatter-WebDev/NaplesAntiquesLLC.com.git` is the real one.

**What it actually contained** (read off disk before deleting, not assumed): 47
files / 101 KB, created **2026-06-12**, HEAD on its own `main`, **no remote**, no
packed-refs, no stash, and exactly **one commit — "Initial commit from Create
Next App"**. It was the leftover `git init` from scaffolding the app. Note the
earlier entry here said "176K, created 2026-08-08"; both figures were wrong.

**Why it mattered:** had it reached the repo folder, git would have treated
`next-app/` as an embedded repository and stopped tracking its contents normally,
silently dropping the entire application from commits. It never broke anything
because the files under `next-app/` were already tracked individually, and the
staging robocopy excludes `.git` at every level.

**Backup, if it is ever wanted:**
`C:\Users\rcman\NEJ-next-app-git-backup-2026-08-14.zip` (92.8 KB, all 47 files
including `refs/heads/main` and both reflogs). Delete it once you are satisfied.

Verified after removal: exactly one `.git` remains (the root), root repo
unchanged at 535 files with its remote intact, and `tsc` / `npm test` 963/963 /
`npm run build` all still clean.

⚠️ Still worth a glance, unchanged: the root `.git/config` carries
`[submodule] active = .`, a leftover from some earlier submodule wrangling. There
is no `.gitmodules`, so it is inert — but it is why the nested repo was worth
removing rather than ignoring.

## Copying to the repo folder — use the staging folder

**A ready-made, verified staging copy lives at `C:\Users\rcman\NEJ-repo-staging`**
(rebuilt **2026-08-21**, deliberately OUTSIDE this folder and outside OneDrive so
it neither pollutes the source of truth nor triggers a sync storm). Its contents
are exactly what belongs in the repo — copy *everything* in it into the repo
folder with no exclusions to think about.

✅ **Rebuilt 2026-08-22 and READY TO DEPLOY.** It carries the inquiry-form bot
filter, checkout name+phone validation, phone validation on all remaining
contact/lead forms, the transactional email bounce handler, and the
`ContactForm.tsx` dead-code deletion.

**868 files / 19.84 MB**, **21 copied, 1 Extra DELETED, 0 FAILED / 0 Mismatch**,
and a follow-up dry run reported **0 to copy / 0 extras**. The single Extra was
the staged `ContactForm.tsx`, correctly removed by `/MIR` because the source
deleted it — verified to be that file and nothing else BEFORE the real run.

🔴 **This rebuild caught the `.claude/worktrees` leak** — see the robocopy block
below. The dry run wanted **1,122 files** under `.claude` against **20** real
ones, including a worktree `.git` **file** that `/XD .git` cannot exclude. The
command has been fixed; do not use an older copy of it.

Leak check clean — 0 `.git`, 0 `worktrees`, 0 `node_modules`, 0 `.next`,
0 `.env*`, 0 `.pem`, 0 `*.tsbuildinfo`, 0 `next-env.d.ts`, 0 `*.log` — against a
**positive control of 176 `.tsx`**. ℹ️ That 176 is itself a check: it was 177
before `ContactForm.tsx` was deleted. Hidden paths confirmed present:
`.github/workflows/scheduled-jobs.yml`, `.gitignore`, `.claude/launch.json`,
`next-app/.npmrc`.

Content spot-checks run against the STAGED copy, not the source:

- 🔴 **`maps.google.com` present in BOTH root `netlify.toml` and
  `next-app/next.config.ts`** — the standing item that fails silently if it does
  not travel. Confirmed **1 hit each** after this sync.
- `lib/phone.ts`, `lib/person-name.ts`, `lib/email-bounce.ts` and their three
  test files all present; `components/contact/ContactForm.tsx` **absent**.
- Staged `CheckoutClient.tsx`: **2** `checkout-first-name`, **0**
  `id="checkout-name"` (paired zero — the old single field is gone).
- Staged `create-order/route.ts`: **5** `normalizedName`, **4** `normalizedPhone`.
- Staged `webhooks/resend/route.ts`: **2** `classifyBounceEvent`.
- All three remaining forms import `isValidPhoneNumber` (**2** each); staged
  `MessageUsForm.tsx` has **0** `digits.length` — its old private rule is gone.
- Staged `.gitignore` carries `.claude/worktrees` (**1**).
- Docs carry this session: `CHANGELOG.md` has `2026-08-22 (4)`, `(5)` and `(6)`;
  `CURRENT_STATUS.md` leads with the three-undeployed handoff.

<details><summary>Previous rebuild, 2026-08-21 (marketplace fixes + reconcile sweep) — now superseded</summary>

It carried the marketplace price-push timeout fix, the auto-delist `after()`
fix, the empty write-block list, and the status-drift reconcile sweep.

**861 files / 19.79 MB**, **25 copied, 0 FAILED / 0 Extras / 0 Mismatch**, and a
follow-up dry run reported **0 to copy**. The +6 files over the previous 855 are
exactly the new ones: `product-status-hooks.ts`, the two `reconcile-status`
routes, and three test files.

</details>

⚠️ **The staging folder was NOT the source of the 2026-08-21 19:55 deploy**
(`main@e81f9f9`). It was still on the 2026-08-19 snapshot at that point, so that
deploy came from somewhere else. Worth knowing if the repo folder and staging
ever look out of step. `/MIR` deleted nothing — the
dry run showed 0 Extras *before* it ran, which is the check that makes `/MIR`
safe. Leak check clean — 0 `.git`, 0 `node_modules`, 0 `.next`, 0 `.env*`,
0 `.pem`, 0 `*.tsbuildinfo`, 0 `next-env.d.ts`, 0 `*.log` — against a
**positive control of 177 `.tsx`** (re-confirmed 2026-08-21), so the zeros are a real result rather than a
broken scan. Hidden paths confirmed present: `.github/workflows/
scheduled-jobs.yml`, `.gitignore`, `.claude/launch.json`, `next-app/.npmrc`.

Content spot-checks run against the STAGED copy, not the source:

- 🔴 **`maps.google.com` present in BOTH root `netlify.toml` and
  `next-app/next.config.ts`** — the standing item that fails silently if it does
  not travel. Confirmed **1 hit each** after this sync.
- Workflow: **3** `*/30 * * * *` hits and **2** `reconcile-status:` jobs.
- `lib/product-status-hooks.ts` present and importing `after` from
  `next/server`; both `reconcile-status/route.ts` files present.
- Staged `lib/ebay/sync.ts` has the write-block list as `new Set([])` (**1** hit)
  and **8** `deadlineAt` references; `lib/etsy/sync.ts` has **6**.
- `bulkPatchListings` present in both stores (**3** / **2**), and
  `export function queueDeepFieldSync` is **0** — it was deliberately deleted.
- Docs carry this session: `CHANGELOG.md` has `2026-08-21 (3)`, `(4)` and `(5)`;
  `STRUCTURE.md` says **456 pages**; `DECISIONS.md` carries the never-await rule.

⚠️ **A wrapped phrase produces a false negative.** Searching staged
`CURRENT_STATUS.md` for "reconcile sweep" returns 0 because the phrase breaks
across a line; single-line tokens return 13. Same trap as any zero-without-a-
positive-control.

<details><summary>Previous rebuild, 2026-08-19 (checkout gate + reviews) — now superseded</summary>

**855 files / ~19.65 MB**, 8 files copied — 4 sources and the 4 memory files:
`CheckoutGate.tsx` (new), `CartDrawer.tsx`, `CheckoutClient.tsx`, and
`[locale]/layout.tsx`. Its spot-checks were the staged `CheckoutGate.tsx`,
`rememberGuestCheckout` in `CartDrawer.tsx`, **0** `checkout-auth-overlay` in
`CheckoutClient.tsx`, and `suppressHydrationWarning` in `[locale]/layout.tsx`.

</details>

Older spot-checks, retained because the CSP one is a standing hazard:

- 🔴 **`maps.google.com` present in BOTH root `netlify.toml` and
  `next-app/next.config.ts`** — the standing item that fails silently if it does
  not travel. Confirmed 1 hit each after this sync.
- Staged `CheckoutGate.tsx` present; staged `CartDrawer.tsx` carries
  `rememberGuestCheckout`; staged `CheckoutClient.tsx` has **0** occurrences of
  `checkout-auth-overlay` (the deleted second prompt) and 2 of `CheckoutGate`.
- Staged `[locale]/layout.tsx` carries `suppressHydrationWarning` and still has
  its 8 `--app-vh` references.
- Docs carry this session: `CHANGELOG.md` has `2026-08-19 (4)`,
  `CURRENT_STATUS.md` leads with the undeployed-gate handoff, `DECISIONS.md`
  carries the one-gate rule, and this file has both the deploy item and the
  hydration fix.

<details><summary>Previous rebuild, 2026-08-18 (viewport-jump batch) — now superseded</summary>

**854 files / 19.59 MB**, 13 files copied, 0 FAILED / 0 Extras / 0 Mismatch,
follow-up dry run 0 to copy, positive control 176 `.tsx`. The 13 files were the
7 sources carrying the eight `*-screen` → `min-h-svh` conversions, the 2 new
files (`ViewportDebugOverlay.tsx`, `viewport-units.test.ts`), and the 4 memory
files. Its spot-checks were the `min-h-svh` body class, the
`<ViewportDebugOverlay />` mount, and zero CODE occurrences of `*-screen` under
staged `next-app/src` (the six remaining lines are COMMENTS explaining the ban,
which is also why the compiled CSS still emits the dead rule).

</details>

⚠️ **Verifying a staged path containing `[locale]` needs `-LiteralPath`.**
PowerShell reads `[...]` as a wildcard character class, so a plain `Test-Path`
reports `next-app/src/app/[locale]/...` as MISSING when the file is there. That
false alarm is easy to act on by mistake.

ℹ️ **Robocopy reports 858 total against 855 on disk, and that is correct** — it
counts `/XF`-excluded files in its total. The three are `.env.local`,
`tsconfig.tsbuildinfo` and `next-env.d.ts`, all verified absent from staging.
Do not chase this gap as a missing-file bug.

⚠️ **It is a point-in-time snapshot.** Rebuild it after any further edits:

```powershell
$src="C:\Users\rcman\OneDrive\Documents\NaplesEstateJewelry.co"; $dst="C:\Users\rcman\NEJ-repo-staging"
robocopy $src $dst /MIR /XD .git node_modules .next .turbo .cache .vercel coverage out build "$src\.claude\worktrees" /XF *.log *.tmp *.bak *.orig *.tsbuildinfo next-env.d.ts .env .env.*
```

🔴 **`"$src\.claude\worktrees"` was ADDED 2026-08-22 and is not optional.**
Background agent sessions create git worktrees under `.claude/worktrees/`, and a
single one adds **~860 files**. Worse, a worktree's `.git` is a **FILE** (a
pointer to the parent repo's metadata), not a directory — so **`/XD .git` does
not exclude it** and a `.git` entry would be copied into the repo folder.

Caught by a dry run on 2026-08-22: **1,122 files** under `.claude` were queued
for copy, versus **20** real ones. `.claude/worktrees/` is now gitignored too,
but robocopy does not read `.gitignore`, so the `/XD` entry is what actually
protects the copy.

⚠️ Note the exclusion must be the **full path**, not the bare folder name —
`/XD worktrees` would exclude any directory of that name anywhere in the tree.

⚠️ **`.claude/launch.json` must still travel.** Never exclude `.claude` wholesale.

⛔ **The dry run is not optional, and "0 Extras" is not the only thing to check.**
Read the file COUNT as well: this procedure expects a number close to what the
session actually changed. A count in the hundreds means something is leaking in,
not that you did more work than you thought.

(`/MIR` is safe against `$dst` here because that folder exists only for this
purpose. Never point `/MIR` at the real repo folder without `/XD .git`.)

### Why a wholesale copy of the project root is wrong

Two directories must be excluded, which is the whole reason the staging folder
exists:

1. **`.git` at the root** (345 MB). It points at `origin =
   DarkMatter-WebDev/NaplesAntiquesLLC.com` — the same repo you push to — so
   copying it over the destination's `.git` replaces that folder's HEAD, index,
   refs, and stash with this folder's. Same remote, so it is recoverable, but it
   can silently rewind the destination's working state.
2. **`next-app/.git`** — the stray above.

Optional but strongly advised: exclude `node_modules/` and `.next/`. Both are
gitignored so they would never be committed, and skipping them turns a multi-
minute copy into a few seconds.

Dry-run first (robocopy `/L` lists without writing anything). `/XD .git` matches
that directory name at every level, so it protects the destination's own `.git`
from `/MIR` as well:

```
robocopy "C:\Users\rcman\OneDrive\Documents\NaplesEstateJewelry.co" "<repo folder>" /MIR /XD .git node_modules .next /L
```

Then re-run without `/L`. **After the copy, confirm `.github/workflows/` landed** —
it is a hidden directory and some copy methods skip dotfiles. `.env.local` will
be copied onto disk but stays gitignored and uncommitted, same as today.

## ✅ PHYSICAL LOCATION — copy rollout DONE 2026-08-17 (deployed 2026-08-18)

Owner confirmed **2026-08-17**: the showroom is **open**, in a shared space,
and the site still tells every visitor the opposite on every page. The earlier
"copy pass across 10 files" estimate here was low. Re-scoped by grep against
the tree on 2026-08-17: **15 files, 61 strings, both locales.**

### ✅ What shipped into the working tree 2026-08-17

All 15 files rewritten, both locales. New single source of truth:
**`next-app/src/lib/business-location.ts`** — address, hours, wayfinding copy,
`PostalAddress` and `OpeningHoursSpecification` builders. Every surface imports
from it; nothing retypes the address. New component
`components/contact/VisitUsPanel.tsx` (server component) gives `/contact` the
address, hours and a directions link it never had.

`service-areas.ts` and the six city pages were **reframed, not stripped** —
"visit the Naples showroom, or ask us to come to you" — so the travel-intent
ranking survives the change.

⚠️ **Still open, both owner-side:**

1. ✅ **`geo` DONE 2026-08-17** — owner supplied **26.222053, -81.781429**;
   verified live in the JSON-LD. The old pin (26.142, -81.795) measured
   **5.59 miles** from the real door.
2. ✅ **CAN-SPAM mailing address DONE 2026-08-17 — in code, no data entry.**
   `getMarketingSettings()` now falls back to `addressOneLine()`, so marketing
   email can never send without a physical address and the Admin field became
   an OVERRIDE rather than the only source. The dead "add an address before
   sending" warning was removed from the composer, and the Settings panel now
   states which address is used when the box is blank. Deliberately the plain
   postal address, NOT the "inside Sharon Lynch Collections" form — the
   landmark is wayfinding and does not belong in a legal footer.
3. ❌ **eBay item-location ZIP — WON'T FIX (owner decision, 2026-08-17).**
   The inventory location is created from a hand-typed postal code and nothing
   in this codebase records what was entered, so eBay's "Item location" may not
   read 34109. **Owner has accepted this: anywhere in Southwest Florida is
   fine.** Do not re-raise it as a NAP defect, do not implement
   `POST /location/{key}/update_location_details`, and do not spend a future
   session auditing it. The admin field is now prefilled from
   `business-location.ts`, which is enough for any future setup.
4. ❌ **Etsy shop location — WON'T FIX (owner decision, 2026-08-17).** There is
   no address anywhere in `src/lib/etsy/` and none is needed; the shop location
   is an Etsy account setting. Owner is not changing it. Do not re-raise.
5. ❌ **`naplesjewelrybuyers.com` — WON'T FIX (owner decision, 2026-08-17).**
   Listed in `sameAs`. Owner is not updating it for the showroom. Do not
   re-raise.
6. 🔴 **Google Business Profile — the ONLY external item still open.** Name,
   address and hours byte-identical to the site; hours must match
   `openingHoursSpecification` (Tue–Sat 11:00–15:00) or Google compares them
   and the mismatch costs ranking.

### Copy rewrite — 15 files, 61 strings, both locales

Under the store-first decision, `travelEn`/`travelEs` and the city pages are
REFRAMED (serving <city> from the Naples showroom, visits on request), not
deleted — the 6 city pages keep their local-SEO value.

| File | Hits | What is there |
| --- | --- | --- |
| `src/lib/service-areas.ts` | **18** | ⚠️ **Missed by the old 10-file list, and it is the biggest one.** `travelEn`/`travelEs` for all 6 cities + blurbs ("crosses the bridge to you") |
| `[locale]/sell/[city]/page.tsx` | 10 | `:107` "We come to you" heading, `:141` "Do I have to come to you?", `:143` "so you never have to carry valuables into a store" |
| `[locale]/(home)/page.tsx` | 7 | `:263` "No storefront, no middlemen", `:441` hours strip, `:350`/`:356` the "see a piece in person" FAQ |
| `[locale]/about/page.tsx` | 5 | `:117` "no storefront pressure", `:131` a stat tile reading literally **"Mobile / We Come to You"** |
| `[locale]/sell/page.tsx` | 4 | `:75` "Private, mobile buyer … we come to you" |
| `[locale]/faq/page.tsx` | 4 | ⚠️ Missed by the old list. `:74` "Most clients prefer this approach **over a public storefront**" |
| `[locale]/free-evaluation/page.tsx` | 3 | `:490` "Mobile and appointment-only" |
| ~~`components/contact/ContactForm.tsx`~~ | 2 | `:428` "Mobile, appointment-only evaluations in…" — **file deleted 2026-08-22 as dead code** |
| `[locale]/trade-in/page.tsx` | 2 | `:167` "we come to you" |
| `components/layout/SiteFooter.tsx` | 1 | `:56` "we come to you" — sitewide, every page |
| `app/layout.tsx` | 1 | `:26` root meta description |
| `[locale]/services/page.tsx` | 1 | ⚠️ Missed by the old list. Meta description "appointment-only" |
| `[locale]/silver-services/page.tsx` | 1 | ⚠️ Missed by the old list. `:320` "evaluación móvil privada" |
| `[locale]/contact/page.tsx` | 1 | ⚠️ Missed by the old list. Meta "Mobile, private evaluations" |

Also stale: the code comment at `components/home/HomeHeroOverlay.tsx:105`
explaining why the hero deliberately omits the service model.

### Add address / hours — where, and why it matters

| Where | Why |
| --- | --- |
| `[locale]/layout.tsx:39-48` | Add `streetAddress` + `postalCode`; add `hasMap`. ⚠️ **`geo` is 26.142, -81.795 — downtown Naples, miles from Shirley St.** Pull the real lat/long from Google Maps; do NOT estimate it, a wrong pin is worse than none |
| `components/checkout/CheckoutClient.tsx:651` | Local Pickup says "in the Naples area" and never says where. A buyer committing $5k should see the address first |
| `lib/order-invoice-email.ts:116` | 🔴 **Sharpest gap found.** The pickup receipt tells the buyer to *call to find out where to go* |
| `[locale]/shipping/page.tsx:30` | "Local pickup by appointment in the Naples / Southwest Florida area" |
| `components/layout/SiteFooter.tsx:51-75` | Contact column has phone + email, no address. Sitewide NAP signal |
| `[locale]/contact/page.tsx` | Call button + form only — no address block, no hours, no map. Best home for the full wayfinding sentence |
| `[locale]/(home)/page.tsx:356` | FAQ "Can I see a piece in person?" — the answer changes completely |
| `lib/order-email-branding.ts:30` | Every order email footer says just "Naples, FL" |

### Owner-side, not code

1. 🔴 **Verified Google Business Profile at 6240 Shirley St.** Still the single
   biggest lever — a storefront competes in the local pack where a service-area
   business cannot. Hours there MUST match `openingHoursSpecification`.
2. 🔴 **Marketing email mailing address** — `lib/marketing-email-html.ts:10`
   injects `mailingAddress` from the `marketing_settings` DB row (Admin →
   Marketing Settings). CAN-SPAM requires a real physical address on marketing
   mail; update it to Shirley St. Sending is already blocked when it is empty.
3. **NAP consistency** across GBP, eBay `merchant_location_key`, Etsy shop
   location, and `naplesjewelrybuyers.com`. Mismatches are a common
   local-ranking own goal.

### Order of work

1. Fix the two FALSE strings (schema hours + homepage strip) — smallest edit,
   removes the active liability.
2. Add address/hours to the 8 surfaces above, starting with the pickup receipt
   and checkout, which are transactional rather than marketing.
3. Reframe the 61 marketing strings, both locales, `service-areas.ts` first
   since it feeds all 6 city pages.
4. Owner: GBP, marketing mailing address, marketplace NAP.
5. Then re-check `PROJECT_OVERVIEW.md`'s "Service model" line, which still
   reads "mobile, appointment-only, no physical storefront".

## ◻️ OWNER: delete four pre-go-live test orders

Audited 2026-08-13, all confirmed against PayPal. **No customer money involved;
nothing is owed to anyone.** Owner is deleting these manually.

| Order | Amount | Environment | Why it should go |
| --- | --- | --- | --- |
| `NEJ-20260703-XBFR0` | $5,646.90 | SANDBOX | fictional money inflating the live orders table |
| `NEJ-20260709-6EZ4X` | $37.10 | SANDBOX | same |
| `NEJ-20260705-SPWIC` | $1.06 | LIVE | DB says refunded; PayPal never refunded it |
| `NEJ-20260709-DLNY0` | $1.06 | LIVE | same |

The two sandbox rows are why the live `orders` table shows revenue that never
existed. The two live rows are the opposite error — the record claims a refund
PayPal never performed ($2.12 total, both owner test addresses). Owner confirmed
2026-08-13 that the live pair is fine to simply delete rather than refund.

⚠️ Deleting an order also removes its `order_items`. That is correct here — the
products involved were test data or have long since been re-listed — but do not
generalize it to a real order.

## ◻️ After the next deploy: re-measure first paint on production

The 2026-08-14 first-paint work must be confirmed against production —
**localhost reports `transferSize: 0` and cannot measure it.**

Baseline before the fix: **533KB across 30 requests before FCP**, FCP 488ms on
a fast desktop connection. Run this in the console on
`https://naplesestatejewelry.com/` and compare:

```js
const fcp = performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint').startTime;
const before = performance.getEntriesByType('resource').filter(r => r.startTime < fcp);
({ FCP: Math.round(fcp), requests: before.length,
   KB: Math.round(before.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024) });
```

Expect the carousel images (157KB) to fall out of the pre-FCP window and the
stylesheet to start much earlier than 336ms.

◻️ **Then test on a real phone on cellular, not office wifi.** This bug was
invisible on a fast connection with a warm cache, which is why it went
unreported for so long. Watch specifically for how long the screen is blank
before the branded splash appears.

◻️ **Remaining lever if it is still slow: 258KB of scripts before FCP.** Not
touched in this pass — deferring or splitting them is a larger change than
priority hints and needs its own measurement.

## 🔴 BEFORE THE NEXT DEPLOY — this batch specifically (2026-08-17)

Everything in code is gated green: `tsc`, lint, **1016/1016**, **454/454 pages**
from a deleted `.next`. No SQL outstanding. No new env vars. What is left is
judgement and procedure, not code.

1. ✅ **Amethyst CONFIRMED by the owner, 2026-08-17.** The product attribute
   colors (CHANGELOG 2026-08-17 (7)) are signed off as shipped: emerald status /
   metal-true / sapphire karat / amethyst length. No further review needed —
   do not re-open the palette.
2. ✅ **Test email DELIVERED and owner-verified, 2026-08-17.** Sent to
   `info@naplesestatejewelry.com` (Resend id `e1a0a905-d546-4f39-9d98-c93fda214ce8`),
   **arrived in the inbox — not Spam — and the owner confirmed the address,
   hours and landmark all read correctly** on the receipt note, the order footer
   (HTML and text) and the marketing footer. The only complaint was the wrapping
   of the test harness's own layout, which is scaffold from the one-off send and
   is not part of any production template.
   ⚠️ Sent from LOCAL using the production Resend key and `EMAIL_FROM`, so it
   proves Resend + DNS + DKIM/DMARC + inbox placement. It does **not** prove
   Netlify's env vars, which have silently differed before (`EBAY_CRON_SECRET`,
   `EMAIL_FROM`). Original note: **this deploy TOUCHES EMAIL, so deploy-day
   item 3 applies: test send and OPEN THE INBOX.** Three email paths changed — the pickup line in
   `order-invoice-email.ts`, the address in BOTH `order-email-branding.ts`
   footers (HTML *and* plain text), and the marketing footer's mailing address,
   which now falls back to the showroom address in code. DMARC is
   `p=quarantine`: a DKIM or alignment fault lands in spam **without erroring**,
   so a green "sent" in Resend's log proves nothing.
3. ✅ **Hours CONFIRMED TRUE by the owner, 2026-08-17.** The showroom really is
   open Tue–Sat 11:00–15:00, so publishing them in the present tense is honest
   and this no longer blocks the deploy. (Signage is not up yet, which is why
   the Google Business Profile is still pending — but the copy already names
   Sharon Lynch Collections as the landmark, so wayfinding does not depend on
   our own sign existing.)
4. ✅ **Staging rebuilt 2026-08-17** — see *Copying to the repo folder* for the
   verified figures. Docs were written BEFORE the sync, then a dry run confirmed
   0 copies outstanding.
5. 📱 **The four changes from 2026-08-17 still want a real thumb** — octopus
   mark at 28px, the route bar's deliberate flash, the photo-swipe cone, the
   ES/EN chip. See item 2 at the top of this file. They have now been sitting
   unverified across several sessions.
6. ℹ️ **Local builds run Node v24.16.0; Netlify pins NODE_VERSION 20** and
   `package.json` declares no `engines`. Production has always built on 20, so
   the risk is low — but watch the Netlify log rather than trusting the local
   pass.

**After it publishes:** resubmit the sitemap and Request Indexing on the pages
whose descriptions changed (`/`, `/sell`, `/about`, `/faq`, `/services`,
`/contact`, and all six city pages). Then re-measure first paint on production —
still open from the last batch, and localhost cannot measure it.

**Deliberately NOT blocking this deploy:** the Google Business Profile. It needs
the store signage up and a verification video, and the owner is doing it soon.
Publishing the address first is the right order anyway — the site becomes a
citation that already matches when the profile is verified.

## Deploy-day checklist (reusable)

Standing procedure for every deploy from this folder — the last run of it was
2026-08-08, and the 2026-08-06 sign-off evidence behind it is in CHANGELOG.

1. **Copy this folder to the repo folder and deploy.**
2. **Watch the Netlify build log.** Local builds run on **Node v24**; Netlify
   pins **NODE_VERSION = 20** and `package.json` declares no `engines`.
   Production has built on 20 all along, so risk is low — but a local green
   build is not literally proof of theirs.
3. **If the deploy touches email, test send and OPEN THE INBOX.** DMARC is
   `p=quarantine`, so a DKIM or alignment fault delivers to spam **without
   erroring** — a green "sent" in Resend's log is not the check that matters.
4. **Check for outstanding manual SQL** before deploying. (None is outstanding
   as of 2026-08-09.)
5. ⚠️ **"The change didn't land" is usually BROWSER CACHE, not the deploy.**
   Prove it from outside the browser before re-deploying or re-syncing staging —
   neither of those fixes a client-side cache, and both are wasted work. Hit the
   live URL with `curl` and grep for a marker the change removed or added:

   ```bash
   curl -s "https://naplesestatejewelry.com/" | grep -c "SOME_REMOVED_STRING"
   ```

   If that returns what you expect, the deploy is fine and the fix is a hard
   refresh (Ctrl+F5 / Cmd+Shift+R, or a private window; on iOS Safari close the
   tab entirely — it has no hard-refresh). This cost a round trip on 2026-08-19.
   Context that makes it near-certain: the origin sends
   `Cache-Control: public, max-age=0, must-revalidate`, and the site has **no
   service worker**, so nothing is deliberately serving an offline copy.

Closed and moved to CHANGELOG — do not re-litigate:

- **2026-08-06 pre-deploy sign-off** (clean-build gate, 38-route production
  smoke, legacy-host single-hop, webhook carve-out 401, email end-state, DNS
  record counts). CHANGELOG 2026-08-06.
- **2026-08-05 `EMAIL_FROM` Netlify blocker** — the marketing sender precedence
  chain read the env var *before* the corrected code default; corrected in all
  five deploy contexts and in `.env.local`. The durable rule (env precedence
  can silently defeat a code-level fix) is in DECISIONS under the email
  entries. CHANGELOG 2026-08-05.

## Standing Local-Environment Warnings

⚠️ **Local checkout loads a LIVE PayPal client ID** from `.env.local`
(`AamwcjQe…`). Do not click PayPal buttons on localhost — it can create real
orders. This matters most when testing on a phone over LAN, where checkout is
two taps from any product page.

⚠️ **Local dev shares PRODUCTION Supabase**, and the Deep Field sync fires for
real from dev (no `DEEPFIELD_SYNC_DRY_RUN` set). Any admin save from a dev
session is a real product change.

⚠️ **Node here is v24; Netlify pins NODE_VERSION 20** with no `engines` in
`package.json`. Local green builds are strong evidence, not proof of theirs.

⚠️ **`npm run build` and `npm run dev` share `.next`, and the dev server does
not survive it.** Running a production build (correctly, with the dev server
stopped) leaves production artifacts in `.next`; restarting dev on top of them
throws `SyntaxError: Unexpected non-whitespace character after JSON` and serves
**500s on every route**. Seen twice — position 746 and 763. It looks exactly
like corrupted `messages/*.json`, and it is not: validate the JSON to rule that
out (it has always passed), then **stop dev, `rm -rf .next`, restart**. The
fix is reliable. The same wipe also clears the separate Turbopack **per-rule
CSS staleness** bug, where one rule in a file updates while another in the same
file keeps serving old declarations — a reload does not fix that one either.

## Verified Healthy — Do Not Re-Audit

Recorded so these are not re-checked every session. All confirmed 2026-08-05
against the **production build** (`next start`), and the deploy that followed
was verified on 2026-08-06/08:

- Server-authoritative checkout pricing with `$0`/negative rejection and a
  stale-spot guard; no `cost_basis`/keys/JWTs in public HTML; rate limits on
  every public endpoint plus honeypots on all three public forms; security
  headers live with CSP **enforcing** (every browser-loaded origin allowlisted,
  which resolved the old "verify after deploy" note at `netlify.toml:168`).
- 46 route/locale combos with no 4xx/5xx; all 23 legacy redirects resolve to
  200 with no soft-404 dead ends; `/p/` shortlinks resolve; the proxy host
  redirect is single-hop on every legacy host and does not loop; `/api/*` never
  redirects; `.co/api/webhooks/resend` returns **401, not 301** (a 301 there
  would break the live webhooks); zero horizontal overflow at 320px; robots and
  sitemap contain zero `.co` URLs; 404s return a real 404.
- Five customer-facing findings from that audit were all fixed and shipped
  (legacy two-hop redirects, homepage heading skip, Spanish chip units,
  product-page 11px floor, wishlist drawer viewport cap). Detail in CHANGELOG
  2026-08-05; the drawer's durable rule is in DECISIONS under *"Always-mounted
  off-canvas panels must cap their width at the viewport"*.
- **`?returnTo=` hidden-product disclosure** — shipped alone 2026-08-08 and
  verified against production (28/28 anonymous probes 404). Durable rule in
  DECISIONS under *"A query parameter is never an authorization signal"*.

## ✅ Contact Address Moved To .com — CLOSED

The public contact mailbox changed `info@naplesestatejewelry.co` →
`info@naplesestatejewelry.com` sitewide (owner, 2026-08-08), reversing the
mailbox half of the 2026-08-01 split. Six occurrences in five files: footer,
account dashboard, root JSON-LD, per-city JSON-LD, and the order-notification
default.

- ✅ **`info@naplesestatejewelry.com` RECEIVES MAIL — owner-confirmed
  2026-08-09.** This was the last open verification on the email surface, and it
  is not verifiable from the code side, so the owner's confirmation is the
  evidence. Do not re-open or re-audit it.

  Worth keeping visible because it does not stop being true: **`info@…com` is
  the single point of failure for the entire email surface** — footer inquiries,
  account-page inquiries, new-order notifications, marketing campaign From *and*
  Reply-To, campaign bounce handling, and both JSON-LD blocks all route through
  that one mailbox. If it is ever deleted or renamed in Google Workspace, all of
  them break silently and at once.

- ⚠️ **OWNER: delete `ORDER_NOTIFY_EMAIL` from Netlify** (all deploy contexts)
  if it is set there. Local is already done. Background: the code used to read
  `ORDER_NOTIFICATION_EMAIL` (set nowhere) while every environment configured
  `ORDER_NOTIFY_EMAIL` (read by nothing), so the override silently never worked.
  `ownerNotificationRecipient()` now accepts **both** names — do not narrow it
  back to one — which means that previously-dead Netlify variable would become
  live on the next deploy and redirect order alerts to a personal `@aol.com`
  inbox. Leave it set only if you genuinely want that. Detail: CHANGELOG
  2026-08-08.

- ✅ Closed 2026-08-08, detail in CHANGELOG: marketing Reply-To and From both
  moved to `info@…com`; zero `@naplesestatejewelry.co` and zero `chris@`
  addresses remain in a clean production build.

- ✅ **Owner's personal `@aol.com` address no longer ships in the public client
  bundle** (2026-08-08). `ADMIN_EMAIL` was imported by a client-side module, so
  it compiled into the browser bundle; `isCurrentUserAdmin()` now reads
  `profiles.is_admin`. Verified 0 occurrences in `.next`. **Owner confirmed the
  carousel admin panel still loads and saves — 2026-08-09**, which closes the
  one behavior that needed an authenticated session. Note
  `carousel/sql/setup.sql:24` still hard-codes the email in
  `is_carousel_admin()` on purpose: database-side, never reaches a browser, and
  it remains the real enforcement for every write.

## Deep Field Gallery Sync

**LIVE.** Bulk import complete against production, live hooks armed and proven.
See `features/deepfield-sync.md`.

✅ Closed and moved to CHANGELOG 2026-08-08 / `features/deepfield-sync.md`:
the 128-product / 974-image production import (reconciled exactly, 0 failed),
Netlify env vars across all 5 contexts, the live hook proven end to end, the
archived-product push, `image_count` in the feed, and Deep Field's own
confirmations (zero duplicate storage objects, live pricing, 128 rows matching).

Still true and worth keeping visible:

- ⚠️ **No environment writes to a sandbox.** `.env.local` points at PRODUCTION
  Deep Field deliberately — dev shares production Supabase, so a dev save is a
  real product change and must not silently skip the partner. Set
  `DEEPFIELD_SYNC_DRY_RUN=true` locally if a safe run is ever needed.
- ⚠️ **Do not normalize the reconciliation feed's timestamp.** The raw
  microsecond `+00:00` form is emitted deliberately (see the pinning comment at
  the emitting line); under a rounding runtime roughly half the catalog would
  compare as permanently stale.
- ◻️ **Deep Field side, not yet running in production:** their hourly
  reconciliation cron is written and tested but undeployed; they poll manually.
  Until it runs, hard deletes and dropped pushes depend on someone remembering.
  Their first manual run found real drift — `test-item-111-131` displaying as
  available after being archived here — exactly the class the push cannot cover.
- ◻️ **`deleted_at` tombstone: withdrawn, do not build.** Absence already
  produces "hide" on their side, so reconciliation by absence covers both
  archived and hard-deleted.
- ◻️ **Raise the image budget 30 → ~50 only after Deep Field supplies the
  timeout line** from their dashboard. Not urgent. (The 18 → 30 retune is in
  the batch that shipped 2026-08-17.)
- ◻️ **Pin the production batching defaults.** `IMAGE_BUDGET_PER_REQUEST` and
  `MAX_PRODUCTS_PER_REQUEST` have **no test asserting their values**. The
  batching tests pass budgets in as explicit arguments — correct, because it
  keeps them from silently re-baselining on a retune — but it means changing 30
  to 300 breaks nothing. This is the *policy test* half of the mechanism/policy
  split described in DECISIONS, and it is the same "unenforced claim" class Deep
  Field found in their `{n}/20 photos` label. Fix is three lines in
  `src/lib/__tests__/deepfield-batching.test.ts`:

  ```ts
  it('pins the gateway-safe production budget', () => {
    expect(IMAGE_BUDGET_PER_REQUEST).toBe(30);
    expect(MAX_PRODUCTS_PER_REQUEST).toBe(3);
  });
  ```

  Found 2026-08-09 by re-running the constant sweep; deliberately left undone
  rather than expanded into a session that was closing.

## ✅ Discount-codes SQL — APPLIED 2026-08-12

**`supabase/discount-codes-2026-08.sql` has been run in Supabase** and verified
by a real $42.39 purchase (all 18 checks passed, CHANGELOG 2026-08-12). Nothing
outstanding here; the notes below are kept for the deploy record.

The original instruction, for reference:

- **Why the order matters:** the checkout and admin code read
  `public.discount_codes`. The failure is graceful, not catastrophic — a missing
  table makes every code report "not valid" and the admin page shows a
  "run the migration" message instead of a Postgres error — but no discount code
  can work until it runs.
- **What it does:** creates `discount_codes` and `discount_code_redemptions`,
  adds three snapshot columns to `orders`, and **replaces `create_paypal_order`
  and `capture_paypal_order`** (both restated in full from
  `checkout-quantity-2026-07.sql` with the discount additions). Safe to re-run.
- **Run it after `checkout-quantity-2026-07.sql`**, which is already applied.
- **After running,** create one test code in Admin → Discount Codes and confirm
  it applies at checkout. See the smoke list below.

Everything else below remains true: the carousel migrations are all applied.

## Next Deployment And Production Smoke

- ⚠️ **One manual SQL IS outstanding** — the discount-codes migration above.
  The statement below refers to the carousel work only.
- ✅ **NO CAROUSEL SQL IS OUTSTANDING.** Every carousel migration has been run and
  verified against the live database (project `evzluixourmsefwdsieu`):
  `add-second-lineup.sql` and `add-random-lineup-modes.sql` (2026-08-04),
  `add-third-lineup.sql` (2026-08-06, RLS confirmed — anon INSERT refused
  `42501`), and `add-slideshow-bg-colors.sql` (2026-08-09, owner-run, colors
  save and render). All three lineup modes read `manual`, so the storefront
  draws the curated lineups rather than random draws.
- 🔴 **REDEPLOY NEEDED — shop-card date collision.** The 2026-08-09 batch
  shipped as `main@27c12e2` and verified clean except for this: on 2-up shop
  cards the `Ca. YYYY` label overlaps the price (measured **-9px** on production
  at 390px, most other cards at 2px clearance). Fixed locally via a container
  query on `.modern-price-row` that drops the "Ca." prefix below 185px of
  content width, leaving the bare year in place; `tsc`/`lint` clean and measured
  across 320/390/472/1280 in both locales with zero negative gaps and no change
  in row height. **The pre-deploy gate is now GREEN:** `npm test` 848/848 and a
  from-scratch `npm run build` (`.next` deleted, dev server stopped) compiled
  successfully at 449/449 pages with no warnings. **This is waiting on a
  redeploy only.** Detail: CHANGELOG *2026-08-09 (post-deploy)*.
- ◻️ **OWNER: supply a real photograph of Chris for the /free-evaluation hero.**
  It currently shows `evaluation-desk-placeholder.webp` — a generated desk shot
  with the face deliberately out of frame, because the copy beside it is first
  person and a recognisable stranger there would imply he is Chris. When the
  real photo lands, replace the file **and** the alt text together (the alt
  text currently describes a desk, not a person).
- 🔴 **Same redeploy carries the /free-evaluation clay marks.** Three trust
  pillars + six category tiles now use matte-clay WebP illustrations
  (`public/assets/images/icons/clay-*.webp`). After deploy, look at the page on
  a real screen in both locales and check the marks read at 72px/56px and that
  the pillar drop-shadow looks right on the cream band. The pipeline and the
  hard-won rules (generate-then-recolour, all-or-nothing per grid, no shadow on
  dark) are in DECISIONS.
  - ✅ **Rolled out sitewide** — the homepage services strip plus `/sell`,
    `/sell/[city]`, `/trade-in`, `/bullion`, `/gold-services` and
    `/silver-services` now use clay marks through `components/ClayMark.tsx`
    (20 marks total). The earlier inconsistency note is closed. After deploy,
    check each of those pages in both locales.
  - ◻️ The large empty placeholder blocks from the audit are still untouched:
    `/estate-jewelry` "Professional Integrity" (726x726 card, 63px icon) and the
    two `/gold-services` cards. Those want photography, not marks.
- 🔴 **Same redeploy carries the icon fix.** Every `AppIcon` was rendering
  filled wherever a legacy `fontVariationSettings: "'FILL' 1"` style survived,
  turning Lucide outline icons into solid blobs (14 of 24 on
  `/free-evaluation`). The bridge is deleted and all 27 usages cleaned; 137
  icons across 10 pages now show only the 2 intentional rating stars filled.
  Four semantic swaps as well (chains, heirlooms, sterling silver ×2, tea
  services). Guarded by two new tests (846 → 848). Detail: CHANGELOG
  *2026-08-09 (post-deploy 2)*.
  - ◻️ **After deploying, look at the marketing pages on a real screen.** The
    measurements prove the icons are no longer filled; whether every glyph is
    the RIGHT one is a judgement call — `redeem` (gift box) for "Sell Jewelry"
    on the city pages is the one remaining choice worth a second opinion.
- ◻️ **Consider raising Netlify `NODE_VERSION` 20 → 22.** Build log for
  `27c12e2` warns every build: `@netlify/plugin-nextjs` cannot execute on the
  pinned 20.20.2, so Netlify runs the plugin on 22.23.1 instead. Builds succeed;
  this is drift, not breakage.
- 🔴 **Same redeploy carries the /free-evaluation hero rework.** Prose
  hierarchy (lede / gold `<h2>` kicker / `<dl>` metal panel / quiet footnote /
  bright closer), wrap groups centred below `lg`, and the eyebrow contrast fix
  (**2.96:1 → 12.19:1** — it was below AA). Detail: CHANGELOG *2026-08-09
  (post-deploy 5)* and *(post-deploy 6)*.
- 🔴 **Same redeploy carries Free Evaluation in the header Sell nav.** The page
  was previously reachable only from the footer. Detail: CHANGELOG *2026-08-09
  (post-deploy 7)*.
- **Deploy the batch. The full gate has passed on the COMPLETE batch** —
  clean from-scratch `npm run build` exit 0 / 449 pages, **848/848** tests
  across 87 files, tsc and lint clean. **Last run 2026-08-10, after the final
  code change**, with the dev server stopped and `.next` deleted. Exact
  figures, the compiled-output spot check, and the email invariant re-check are
  in `CURRENT_STATUS.md`. Nothing needs re-running before you copy and deploy.
- **Discount codes — smoke after running the SQL and deploying:**
  - Admin → **Discount Codes**: create a percent code (e.g. `THANKYOU`, 15%) and
    a fixed code (e.g. `FIFTY`, $50). Confirm the value field switches between a
    `%` and a `$` prefix with the type, that a percent over 100 is refused, and
    that a duplicate code name is refused with a readable message.
  - Checkout: apply the percent code and confirm the discount row appears
    **directly under Subtotal**, the total drops, and **tax is charged on the
    discounted merchandise plus shipping** (a $1,000 order with 15% off, $35
    shipping, FL address should read $150 off, $53.10 tax, $938.10 total).
  - Apply the fixed code to a cart **smaller than the code** (e.g. $50 off an
    $80 item) and confirm the discount clamps to $80, merchandise reads $0, and
    the order is still payable for shipping + tax.
  - **Complete one real discounted purchase.** This is the check that cannot be
    made locally: confirm PayPal accepts the breakdown (a wrong discount key is
    a 422 at create-order), the captured amount matches the discounted total,
    and the code's **Used** count increments by exactly 1 in Admin.
  - Set a code's total-uses to 1, redeem it, and confirm it then reports
    "Limit reached" and is refused at checkout.
  - Try the same code twice with the SAME email and confirm it is refused;
    ⚠️ then note that a DIFFERENT email will be accepted — that is by design,
    see DECISIONS, *"the cap is the control"*.
  - Set a `minimum order` above the cart total and confirm the refusal names the
    threshold, in both locales.
  - Spanish: apply and remove a code on `/es/checkout` and confirm the discount
    row, the applied chip, and each refusal message are Spanish.
  - Apply a code, then edit the cart, and confirm the discount recalculates
    against the new subtotal rather than showing a stale figure.
- **New surfaces to smoke after the NEXT deploy (2026-08-09 batch), on a real
  phone where marked 📱:**
  - Shop cards 📱: bottom ADD button present on every card; corner cart icon
    (mobile) and header/drawer/checkout icons all render as a CART, not a bag;
    swipe a card photo left/right (dots advance, vertical swipe still scrolls,
    tap still opens the product, a swipe does NOT open it); swipe a second
    card and confirm the first snaps back to its cover; dots float without a
    pill on touch and stay legible on a white-backdrop piece; arrows absent on
    touch, present on desktop aligned with the brand-flag baseline.
  - Hero 📱: flick through the hero — each flick lands on exactly the next
    slideshow, never past it (the momentum override is the one thing synthetic
    touch could not prove); ~1s smooth settle; scrolling out at either end is
    free; desktop wheel behavior unchanged.
  - Hero backgrounds: solid per slideshow, no gradient sweep anywhere; set
    Slideshow 1 black in Admin (its lineup is black-backdrop) and confirm the
    overlay text flips light and the crossing shows a clean color change at
    the midpoint; confirm the admin panel's per-tab background control saves
    without the missing-column warning.
  - Shop card date 📱: confirm the `Ca. YYYY` label is back at the left of the
    price row on a phone, and that it never touches the price or the width
    chip — check a card with a long price and one with no width chip.
  - Hero CTAs 📱: on a real phone confirm Buy/Sell sit side by side with Trade
    centred beneath them — never three stacked rows — and that Trade opens
    `/trade-in` (it used to go to `/contact`). Check Spanish too, where
    `Intercambiar` is the long label.
  - Reviews band 📱: on a real phone confirm the client reviews sit TWO across,
    never one, and that the quote text is comfortably readable at that size —
    this is the judgement call the measurements cannot make for you. The long
    reviews now clamp to 8 lines, so all four cards should be the same height.
    Confirm Spanish too, and the band on a product page including a
    dark-backdrop one, since it renders there from the same component.
  - 🔴 **Reviews → Google link: click one card on the deployed site.** Every
    card links to `https://share.google/KAE0mjQwhKx9EqEZ1` (owner-supplied).
    It is an opaque Google redirect and google.com is unreachable from the
    development environment, so **nothing has verified where it actually
    lands** — confirm it opens the Naples Estate Jewelry profile with the
    reviews visible. One constant to change if not:
    `GOOGLE_REVIEWS_URL` in `next-app/src/lib/testimonials.ts`. While there,
    confirm the whole card is clickable (not just the "Read on Google" line)
    on both a phone and a desktop.
  - `/free-evaluation` as a landing page 📱: open it the way a customer will —
    from a TEXTED link on a phone. The form must NOT be the first thing in
    view; the hero should explain the service, and the form lives in the
    "Send a request below" block underneath. Submit one real test request and
    confirm it arrives at `info@naplesestatejewelry.com`.
  - `/free-evaluation` hero hierarchy 📱: the block should read as lede →
    gold kicker → metal panel → footnote → closer, not as one wall of text.
    The three metal terms (GOLD / SILVER / EVERYTHING ELSE) sit in a left
    column that stays aligned from `sm` up; check Spanish, where the terms are
    shorter but the details are longer.
  - Pills centred 📱: the `/free-evaluation` trust chips wrap 2/1/1 on a phone
    and 3/1 on a tablet — every row should look centred, not ragged-left. This
    is the judgement call the measurements cannot make.
  - Eyebrow contrast 📱: "100% Free — No Obligation" should read as a bright
    gold accent, not a dimmed/disabled label. It was **2.96:1** (below AA) and
    is now 12.19:1 — worth confirming on a real screen in daylight.
  - Header nav: **Free Evaluation** now appears last in the Sell dropdown
    (desktop) and the Sell accordion (mobile), after Trade-In Program. Confirm
    both, in both locales, and note that the parent **Sell** tab now highlights
    while you are on `/free-evaluation` — that is intended.
  - Hero perf spot-checks: network tab shows NO raw-original image fetches
    beside the `/_next/image` ones (formerly a full duplicate set), hero
    images at `q=82`, and the loading spinner disappears from the DOM after
    the fade rather than spinning invisibly.
- After deployment, verify these focused surfaces against production:
  - `/admin/social-queues`: seven Eastern choices, responsive row actions,
    individual and selected-row background **Post now**, change/remove
    confirmation, both worker-health summaries, and **Latest Posts** view/
    manage/refresh/comment/removal controls. Confirm both channel headers fully
    collapse and independently reopen their sections. Do not comment, remove,
    or publish merely for QA.
  - One Instagram and one Facebook manager: guided step order, Save & prepare,
    generated card as slide 1 with **NOW AVAILABLE**, exact prepared framing,
    slide viewer arrows, AI opener controls, and wording/photo/both sync.
  - One remotely deleted social post: Refresh status should mark it Removed only
    when Meta confirms absence; an ambiguous read must retain Published.
  - Admin Products at 2100px+: no right-side table gap; Brand expands first.
  - Manage Instagram, Shop, a product, My Account, Admin Orders, and a service
    page at 2000px+: application/grid canvases expand while prose, checkout,
    auth cards, and dialogs remain readable.
  - Purchase panel: on a phone and a tablet confirm the scrap-value and
    based-on-spot tiles sit side by side (never stacked), and that the buy
    buttons form a flush block — one row of four on a wide column, or Add to
    Cart full width above Save/Inquire/Call on a narrow one. Check a sold item
    too (its two buttons stack until the column is wide), and Spanish.
  - Dark-theme product page (one whose first photo is on a black backdrop, e.g.
    `/shop/10k-gold-rope-chain-necklace`): scroll to "You Might Also Like" and
    the reviews band and confirm the card text is dark-on-white and fully
    legible, in both locales. Compare against a light-backdrop product to be
    sure nothing there changed.
  - Product detail two-column fill: open a product at ~1280-1440 and confirm
    column 1 reads gallery → Notes → the three policy accordions while column 2
    reads price panel → description → Specifications, both columns ending
    together, clear blank space before the three trust icons, and the icons
    spanning the full page width. On a phone (below 640px) confirm the stacked
    trust badges AND the three policy accordions are centred, and that at 640px+
    the badges go 3-up while the accordion titles return to the left with their
    chevrons on the right. Confirm the phone layout still reads
    gallery → price → description → specs → notes → policies. Also check one
    ultra-wide screen (2000px+), where the notes/accordions aside should
    instead sit under the info column, and one Spanish product page.
  - Product specifications: confirm a necklace and a bracelet each show a
    **Width** row in mm (Ancho in Spanish) matching their shop-card chip, and
    that a ring/pendant shows no Width row.
  - "You Might Also Like" cards: confirm each shows purity / weight / length /
    width chips matching that piece's shop card, and that a piece with no stored
    width shows only three. The pills must stay on ONE line at every width —
    check a phone (they shrink and sit under the price) and a desktop (they sit
    beside the price) — must never spill outside the card, and within one strip
    must either ALL sit beside the price or ALL sit below it, never a mix. Below
    361px the strip should show one card per row at full title/pill size.
  - Homepage carousel backdrops: confirm black-backdrop photos render as solid
    rounded black cards with no white bars or square photo corners. (The
    swept-background half of this check is OBSOLETE as of 2026-08-09 — the
    hero background is now one solid color per slideshow; see the new smoke
    items above.)
  - Product gallery/lightbox: no clipped thumbnail border or wrap stutter.
    Confirm the hover/touch magnifier is gone everywhere, that tapping a
    prev/next arrow on the main photo changes the image WITHOUT opening the
    lightbox, that clicking the photo itself still opens it, and that a vertical
    swipe starting on the photo scrolls the page on a real phone. The arrows are
    now narrow full-height bars hugging each side, present only from 768px up.
    On a real PHONE confirm there are no bars and that swiping the photo changes
    it (left = next, right = previous), that a vertical swipe still scrolls the
    page, and that a tap still opens the lightbox. On a real TABLET confirm the
    bars are there AND the swipe works. On desktop confirm each bar
    fades UP as the cursor approaches that side (independently — the far bar
    stays hidden) and is solid once the pointer is over it, that they are
    permanently
    visible on a phone, legible on both a white-backdrop and a black-backdrop
    product, advance the photo when clicked near the top or bottom of the bar
    rather than on the chevron, and that clicking the middle of the photo opens
    the lightbox rather than catching a bar. Step through EVERY photo of a
    product whose first image is on black: the bars must stay visible as a
    continuous strip on each one, including photos whose backdrop differs from
    the frame's padding colour.
  - `/account/sign-in`, `/account/sign-up`, My Account Change Password, and a
    real reset-password link: every password field uses the shared eye toggle.
  - Redirect smoke: `/shop.html` and `/cart` redirect correctly;
    `/shop/new-listing-04` intentionally 404s because its listing was deleted.
  - Checkout two-column layout, a $5,000+ item, spot refresh, and product
    weight/specs. Confirm the sticky summary rail, Back to cart / Edit cart
    reopening the drawer without losing entered details, the confirmation
    checkbox still gating the PayPal buttons, and Local Pickup hiding the
    required address.
  - Homepage hero parallax stack: text/form/CTAs stay pinned through the
    crossing and hold, only slideshows move, sticky release carries text and
    slideshow away together, scroll-back restores, offscreen pane is inert,
    overlay theme flips with the dominant slideshow, and the reduced-motion
    single-hero fallback works on a real device.
  - Second slideshow lineup: confirm the scroll reveal shows the curated
    Slideshow 2 lineup (and that clearing it falls back to mirroring
    Slideshow 1). Confirm slideshow B's photos flow left-to-right (opposite
    of A) and still cycle through the full lineup.
  - Random fill: on each slideshow tab try Gold jewelry / Silver jewelry /
    Non-jewelry items, adjust the drawn order, then **Save All Slideshows**
    and confirm the homepage shows exactly that saved arrangement (it should
    NOT re-randomize on the next cache refresh).
  - Sold pieces in slideshows (**not yet exercised end-to-end** — verifying
    storefront rendering requires saving a sold piece, a live DB write left
    to the owner): switch the picker to Sold items, add one sold piece, Save
    All Slideshows, and confirm the hero renders it with NO price caption and
    that clicking its card lands on the product page showing Sold. Also
    confirm the All/Available/Sold checkboxes scope both the picker and the
    random fill buttons.
  - Hero pane seam: `PANE_A_TRAVEL` is **85**, so the arriving pane overlaps
    the departing one by ~15% of a frame. Scroll the homepage and confirm the
    join reads as one continuous move with no band of empty backdrop between
    the two slideshows.
  - Header height token: page content now starts exactly at the header's bottom
    edge (measured 72/72 desktop, 56/56 mobile) instead of 9px behind it. On a
    real device check a few converted pages — `/`, `/about`, `/faq`,
    `/checkout`, `/contact` — plus the hero pin and the mobile menu panel's
    scroll height. Mobile page tops sit 8px higher than before (56px reserved
    vs the old 64px) because the reservation now matches the real 56px header.
- Reconfirm that production build and development server are never writing
  `.next` concurrently; stop local dev before a manual production build.

## Checkout, Tax, Orders, And Email

- **Complete accountant review before changing tax.** Keep the current 6%
  Florida-only policy. Review destination county rate lookup, Florida's
  per-item $5,000 discretionary-surtax cap, registered nexus states, estimate
  wording, and PayPal jurisdiction cases.
- ✅ **Refunds — full AND partial — are verified (2026-08-12).** The first live
  refund found that every refund silently failed to record; fixed, and a full
  refund verified end to end against a real PayPal capture. The partial path was
  then exercised against the **real `apply_paypal_refund` Postgres function**
  with a synthetic $100 order — 18 checks covering the
  `cumulative - alreadyRefunded` increment, `PENDING`-ledger attachment,
  idempotent replay, the full-refund flip, and the over-refund clamp. Detail in
  CHANGELOG 2026-08-12.
  - ✅ **Live partial refunds DONE 2026-08-13.** Two real partial refunds
    ($0.50 then $0.56 on a $1.06 purchase) confirmed the payload shape against
    PayPal's API directly. `total_refunded_amount` is **cumulative** — proven by
    re-fetching the first refund and seeing `amount $0.50` alongside
    `total_refunded_amount $1.06`. Nothing here remains open.
- ✅ **`paypal_refunds.amount` settled 2026-08-13 — DONE.**
  `supabase/paypal-refund-ledger-2026-08-13.sql` is **applied**. The column now
  means *this refund's own amount* (read from the payload, never derived),
  `orders.refund_amount` is SET from PayPal's cumulative and clamped
  monotonically, and an applied row's amount is immutable. The ledger is keyed
  by PayPal's real refund id, which removed the synthetic `event:<id>` key and
  the fuzzy amount-matching that caused mis-attachment.
  20 checks passed against the real function, including out-of-order delivery.
  Reconciling against a SUM of `paypal_refunds.amount` is now valid.
  - ✅ **Both halves are live as of 2026-08-17** — the migration was already
    applied and `webhook/route.ts` has now shipped, so the CAPTURE.REFUNDED
    handler sends PayPal's cumulative and its real refund id rather than the
    derived increment and the synthetic `event:<id>` key. The interim state was
    never harmful (the old accumulate branch still produced a correct
    `orders.refund_amount`), but the ledger shape is only correct from here on.
    ⚠️ **This path has still never run automatically in production** — confirm
    it on the first real refund.
  - ◻️ **Cosmetic, unreachable in practice:** an over-refund writes a
    `paypal_refunds` row for the full increment while `orders.refund_amount`
    clamps at the total, so the ledger would sum higher than the order. PayPal
    cannot refund more than was captured, so this only occurs in the defensive
    path. Left alone deliberately.
- **Run the rest of the controlled PayPal matrix** in the configured
  environment: create retry, successful/declined/ambiguous capture,
  local-finalization retry, duplicate webhooks, two-buyer race,
  partial/idempotent refunds, pending/failed refund states, locked shipped
  address, Local Pickup, invoice, guest confirmation, and receipt history.
  ⚠️ The refund bug is the standing argument for actually running this: it sat
  undetected because no live refund had ever been issued, and a green unit suite
  had asserted the broken behavior.
- Verify one shipped PayPal order retains the exact approved shipping address
  and one Local Pickup order omits shipping.
- Verify Available → Sold → Available sold-price locking on a deliberate item;
  separately review the three legacy manually sold rows without order snapshots.
- Print one invoice on the affected physical laser printer.
- Verify shipment carrier/tracking save plus fulfillment email, paid/manual
  invoice rows, automatic/manual Email History, order restore/permanent delete,
  Reopen Order, and Messages recycle-bin behavior.
- Verify production inquiry/contact/free-evaluation uploads and Resend delivery,
  including Spanish public notes and image attachments.
- Verify duplicate sign-up and reset-password redirects against production
  Supabase Auth settings.

## Etsy And eBay

- 🔴 **OWNER / NETLIFY — no scheduled function on this site has EVER run.** Not
  the two price pushes, not the three social workers. Verified 2026-08-10 from
  both sides: zero `scheduled_price_push` rows across 1,538 Etsy and 56,480 eBay
  log rows, zero `scheduled_drip` rows with Instagram and Facebook both
  `connected`, and Netlify's own function log empty for the last 24h on both
  `ebay-price-push` and `instagram-drip` (the latter should show ~14). Already
  ruled out — the functions ARE deployed (6 on `main@7576826`), all five carry
  the Scheduled badge with a Next execution time, all four `*_CRON_SECRET`
  variables exist scoped to Functions, and 614 credits remain. An erroring
  function would still log; these are never invoked.
  - ✅ **Run now was tried and it fails too** (2026-08-10). `instagram-drip` was
    pressed with the due-row query verified server-side as returning `[]` first,
    making it a guaranteed no-op that nonetheless logs unconditionally — it wrote
    no `scheduled_drip` row and no Netlify log line. (`instagram-token-refresh`
    was tried first and was inconclusive: the token is `not_due` until late
    September, and that branch used to return without logging. It logs now.)
  - **Research conclusion (2026-08-10): this is a known, recurring Netlify
    platform bug, not a limitation and not our code.**
    - **Not a plan gate.** Netlify's docs state scheduled functions are
      "available on all pricing plans".
    - **Not deprecated.** Async Workloads is an additional product, not a
      replacement; scheduled functions are current.
    - **Exact signature, repeatedly reported** on the Netlify forums from April
      2023 through July 2026: Scheduled badge present, next-execution countdown
      correct, function never fires, no errors and no logs. A **platform-wide
      incident on 2026-04-12** matched precisely and Netlify support fixed it
      within ~24–48h without publishing a root cause.
    - **Ours is worse than those reports.** In every forum thread manual "Run
      now" still worked. Here the dashboard's invoke API returns **HTTP 202
      Accepted** (verified in the network panel, with the success toast) and the
      function still never executes — nothing in `instagram_sync_log` 45 seconds
      later, nothing in Netlify's log. Scheduler *and* manual invocation are both
      dead for this site.
  - **Fix path A — Netlify support ticket** (owner, account-level). This is the
    proven route; they fixed the April 2026 incident. Send them: site
    `naplesantiques`, the 202-accepted invoke that produced no execution, and
    that the Next.js Server Handler function on the same site works fine.
  - 🟢 **CUT OVER AND WORKING (2026-08-11).** Deployed, secrets added, workflow
    run manually twice. Four of five jobs succeed and wrote log rows that had
    never existed — including the **first-ever `scheduled_price_push`** on Etsy:
    *"42 pushed, 32 unchanged, 0 blocked, 0 failed, 16 deferred."* Zero
    failures; the 16 deferred are the 22-second budget and roll to the next run.
    Instagram/Facebook drips and the Instagram token refresh all logged `ok`.
  - ✅ **`EBAY_CRON_SECRET` rotated; all five jobs now green (2026-08-11).** The
    first eBay attempt failed `HTTP 401 {"code":"unauthorized","message":"Invalid
    cron secret."}` — the secret existed but its value differed from Netlify's
    (local ended `3bb6`, Netlify production ended `4e67`). It could **not** be
    re-copied: Netlify marks that variable secret in four of five deploy
    contexts, which is write-only (lock icons; Options offers only Edit/Delete).
    Owner rotated it in Netlify, redeployed, updated the GitHub secret, reran:
    **"50 pushed, 67 unchanged, 1 blocked, 0 failed, 6 deferred."** The 1 blocked
    is inventory #82 via `EBAY_WRITE_BLOCKED_PRODUCT_IDS`, working as designed.
    Zero listings carry `error_count > 0`. For contrast, a pre-fix eBay run
    produced **139 errors**.
    - ⚠️ Durable lesson: `.env.local` was stale for exactly one of four cron
      secrets. Netlify remains authoritative — check, never assume.
    - ⚠️ If either cron secret is ever rotated again, it must change in **three**
      places: Netlify (+ redeploy), the GitHub Actions secret, and `.env.local`.
  - ✅ **Deferred listings cleared 2026-08-11 02:47 UTC** by a second dispatch.
    Etsy finished `done:true, pushed:16, remaining:0` — outcome **`ok`**, the
    first completely clean scheduled run in the project's history. eBay finished
    `done:true, pushed:6, blocked:1, remaining:0` (`warning` solely because of
    #82's deliberate write block). **Day totals: Etsy 58 pushed, eBay 56 pushed,
    0 failures on either, 0 listings at the backoff ceiling.**
  - ✅ **The crons FIRED ON THEIR OWN, 2026-08-11 — the automation arc is closed.**
    Etsy at **11:54 UTC** (11 pushed, 79 unchanged, 0 failed) and eBay at
    **12:27 UTC** (1 pushed, 86 unchanged, 1 blocked, 0 failed). 39 and 42 minutes
    after their 11:15/11:45 slots, which is ordinary GitHub Actions best-effort
    scheduling — not a fault. Zero failures on either; eBay's `warning` outcome is
    only #82's deliberate block. Nothing left to prove here.
  - **Superseded detail from when this was still pending:**
  - 🟡 **FIX PATH B WAS BUILT AND WAITING ON FOUR SECRETS (2026-08-10).**
    `.github/workflows/scheduled-jobs.yml` replaces all five Netlify schedules
    with GitHub Actions, using the same cron expressions, the same routes, and
    the same `x-cron-secret` header. **No application code changed.** Verified:
    valid YAML, five jobs, four cron entries, four secrets, five routes matching
    the `.mts` files exactly; Actions is enabled on the repo ("Allow all"), and
    the default branch is `main` — the only branch GitHub runs schedules on.
    - ✅ **Secrets added by the owner 2026-08-11.** `ETSY_CRON_SECRET`,
      `EBAY_CRON_SECRET`, `INSTAGRAM_CRON_SECRET`, and `FACEBOOK_CRON_SECRET`
      are now repository secrets on
      `DarkMatter-WebDev/NaplesAntiquesLLC.com` (the repo previously had none).
      **The `.env.local` copies matched Netlify's production values** — owner-
      confirmed while adding them — so for these four variables the usual
      "`.env.local` is stale" caution did not apply. Until the secrets existed
      every job failed with a named error, which was deliberate.
    - **Then test it without waiting for a cron:** Actions tab → *Scheduled
      jobs* → **Run workflow**, and pick a single job from the dropdown. Start
      with `instagram-token-refresh` (a `not_due` no-op that now logs) or
      `instagram-drip` (no due rows). A successful run writes the matching row
      to `instagram_sync_log`, which is the proof the whole chain works.
    - ⚠️ **Check `.github/` actually survives the copy** into the repo folder.
      It is a hidden directory; a copy method that skips dotfiles would drop it
      silently (`.gitignore` travels today, so it should be fine).
    - ⚠️ **Overlap is intentional and reversible.** The Netlify `.mts` functions
      are left in place. If Netlify ever fixes the fault, both triggers fire and
      each job runs twice daily — tolerable (the second price push finds prices
      unchanged, the second drip finds no due rows, the second token refresh
      returns `too_young`) but untidy. At that point delete **either** this
      workflow **or** `next-app/netlify/functions/*.mts`, not both.
  - ✅ **The routes are reachable from outside Netlify — verified 2026-08-11.**
    `curl.exe -i -X POST https://naplesestatejewelry.com/api/admin/etsy/price-push`
    returned **401 `{"error":"Unauthorized."}`**, the exact body from
    `price-push/route.ts`. (In PowerShell use `curl.exe`; bare `curl` is an alias
    for `Invoke-WebRequest` and rejects `-i -X POST`.)
  - **Fix path B — move the trigger off Netlify entirely.** All five routes are
    **already trigger-agnostic and secret-header-guarded** — see the comment in
    `app/api/admin/etsy/price-push/route.ts`, which explicitly names "an external
    cron hitting a secret-token-guarded internal route" as a supported option.
    **No application code changes are required**, only a new caller:
    - **GitHub Actions scheduled workflow** (recommended): the repo is already on
      GitHub, it is free, the run history is visible, and the four
      `*_CRON_SECRET` values go in repo secrets. Caveats: Actions cron is
      best-effort and can run 5–15 min late, and GitHub disables scheduled
      workflows in a repo with 60 days of no activity.
    - **Supabase `pg_cron` + `pg_net`**: more punctual and already in the stack,
      but the secret has to live in the DB/vault and runs are harder to inspect.
    - Third-party pingers (cron-job.org, Upstash QStash) also work.
  - ◻️ One link is still unverified: whether the cron routes are reachable from
    outside at all. A production `POST` probe expecting a 401 was blocked by the
    development environment's command classifier. Worth one manual
    `curl -X POST https://naplesestatejewelry.com/api/admin/etsy/price-push`
    — a **401 Unauthorized** is the healthy answer.
  - Until this is resolved, **prices only move when someone clicks "Push prices
    now"** in Admin Settings. That is the current de facto process.
- ✅ **DONE 2026-08-11 — the sold-hidden repair ran and landed exactly as
  predicted.** It was never blocked by a deploy: the fix has been in
  `src/lib/ebay/sync.ts` since 2026-08-04 (`resolveFreshnessScanAction`,
  sync.ts:1317, called from the scan at sync.ts:1347), and
  `api/admin/ebay/eligibility-summary/route.ts:39` calls `scanAndMarkOutOfDate()`
  on load — it only ever needed one admin page-load in production.

  | | Before | After |
  | --- | --- | --- |
  | `hidden_oos` + sold | 0 | **36** |
  | `out_of_date` + sold | 38 | **2** |
  | `out_of_date` + available | 84 | 84 |
  | `published` + available | 2 | 2 |

  **Trigger used:** Admin → Products → Actions → **Publish all ready to eBay**,
  then **Cancel**. `EbayBulkPublishModal` fetches the eligibility summary from a
  mount `useEffect`, so simply OPENING it runs the server-side scan; publishing
  only happens on an explicit start, and the modal reported "0 listings in the
  Ready to publish state" with the button disabled. Verified afterwards: **zero**
  `ebay_sync_log` entries in the following 15 minutes and zero listings with
  `error_count > 0` — the repair is a local state correction and touched nothing
  on eBay. Use this same route if rows are ever mis-flagged again; it is safer
  than the bulk-sync modal, which stages writes.

  The 2 remaining `out_of_date` + sold rows are correct: they lack
  `last_pushed_qty === 0`, the marker written by `hideListingQuantityZero()` that
  proves the auto-hide actually ran. Repairing without it would be guessing.
- ⚠️ **A newer commit `main@78af2ed` ("stage") shows CANCELED on Netlify**, so
  `main` is ahead of production. Watch the next deploy actually reach Published
  rather than assuming it did.
- ✅ *(superseded by the entry above — closed 2026-08-11.)* The scan had never
  run since the fix deployed, which is why 38 sold rows sat in `out_of_date` with
  zero `hidden_oos`. Available listings remain **86** (84 `out_of_date` +
  2 `published`), matching the campaign figure below — the repair did not touch
  them.
- ✅ **`ORDER_NOTIFY_EMAIL` is not set on Netlify** (checked 2026-08-10 in the
  dashboard). The owner action recorded above under the contact-address section
  is already satisfied — nothing to delete.

- ✅ **CAMPAIGN COMPLETE 2026-08-11 — 85 of 86 available listings on the correct
  tier.** The only one left is **#82**, write-blocked by design (fix it on eBay).
  Post-fix runs cleared 25, 23 and 12; `published` 85, `out_of_date` 1.
  Verified on the live public listings across two bands: $714.80 → **$35.00**,
  $663.58 → **$35.00**, and $10,098.83 → **$99.00 "Signed"** (the Registered Mail
  treatment the $5,000–15,000 band requires). Nothing further to do here.
  - ⚠️ **Correction to the note below:** the eBay 25604 "Availability not found"
    failures were **transient, not item-specific**. The failing pair rotated each
    run (26/31 → 29/23) and every one succeeded on a later attempt. Roughly 2 per
    25, cleared by retry. None remain.
  - ⛔ **#83 and #84 (the two Rolexes) are NOT going on eBay — owner decision,
    2026-08-11. Do NOT build the `Department` aspect mapping.** They fail
    deterministically with *"The item specific Department is missing"* because
    eBay category 31387 (Wristwatches) requires a Men's/Women's/Unisex aspect
    `mapAspects` does not send — `mapping.ts` flags this at the `Watch` entry as
    `TODO(ebay-verify)`. That TODO now has an answer: **not needed, we are not
    listing watches.** Its aside that "no Watch-type item exists in the catalog
    yet" is stale (two do), but the conclusion stands for a different reason.
    - ✅ **Handled in code 2026-08-11 (deployed 2026-08-17).** `EBAY_EXCLUDED_PRODUCT_IDS`
      (`ebay/guards.ts`) holds the two ids; pre-flight now fails `eligibility`
      with "This item is not listed on eBay per owner decision", and
      `enqueueProducts` drops them alongside write-blocked ids so no bulk run
      wastes a slot on them. **Per item, deliberately — NOT a `Watch` category
      rule**, so a future watch still syncs normally (pinned by a test).
    - ✅ **Their stale `error` rows were reset to `pending` ("Not listed") in
      production.** Dry-run first: both had `ebay_listing_id: null`, so nothing
      live on eBay was affected. `error_count` → 0, `last_error` → null. Zero
      listings remain in `error` state.
    - ⚠️ Until this deploys, `pending` sorts FIRST in `orderEnqueueCandidates`,
      so a bulk eBay sync run before deployment would pick them up and fail them
      back to `error`. The campaign is finished, so just avoid bulk runs until
      this ships.
- 🟡 *(superseded — kept for the sequence)* **CAMPAIGN STARTED 2026-08-11 — 21 of 81 done, tier mechanism PROVEN.**
  The controlled single-item test and a bulk-batch item were both verified on
  the live public eBay listings: $714.80 → **$35.00 shipping** and $663.58 →
  **$35.00 shipping**, both correct for the $600–1,000 band (policy
  `252701347026`). **This closes the "one controlled listing update remains
  open" gate from 2026-08-01, for both the single-item and bulk paths.** The run
  also reported "1 write-blocked item skipped" — #82 held back as designed.
  - ⚠️ **Do NOT re-run the campaign until this deploy lands.** The old
    `enqueueProducts` took the first 25 of whatever was selected with no notion
    of what still needed writing, so "select all → sync → repeat" re-pushed the
    same items (measured: 21 of 23 repeated on the second run). Fixed in this
    batch by `orderEnqueueCandidates` (stale → error → published). After
    deploying, the remaining **60** finish in three runs.
  - ◻️ **Two items need eBay-side attention**, both eBay errorId **25604**
    ("Availability not found"):
    `vintage-tiffany-and-co-18k-tricolor-gold-cuban-curb-link-bracelet-26` and
    `vintage-14k-yellow-gold-patriotic-eagle-pendant-31`. Their rows are
    identical in shape to the successes (available, qty 1, valid offer id), so
    the condition is on eBay's inventory items, not our payload. Flagged `error`
    with 2 of 3 retries used; listings untouched and still live. Check their
    inventory-item availability in Seller Hub.
  - **Remaining:** 61 `out_of_date` + available (60 writable), 2 `error`,
    23 `published`.
- **🔴 OWNER ACTION — apply the new shipping policies to the flagged eBay
  listings, in batches, from the deployed admin.** (The count once read 123;
  the true figure is **86 writable** — see the sold-hidden fix below.) The
  2026-08-01/02 tier
  policies (`252701344026`–`252701350026`) are part of the eBay content hash, so
  every listing created before them is correctly flagged `out_of_date`; the
  daily price push can never clear it because it only sends price/quantity
  (`bulkUpdatePriceQuantity`, [sync.ts:1443](next-app/src/lib/ebay/sync.ts:1443)).
  Only a full offer update carries `fulfillmentPolicyId`. The real campaign is
  **86 items ≈ 4 runs** of the capped bulk sync (87 available listings are
  flagged; #82 is write-blocked). Sequence: sync **one** item from its product
  drawer first, confirm on eBay that the shipping shown is the new tier, then
  run Sync all to eBay once per batch, spot-checking between runs. Guards now
  enforce the cautions automatically — see `features/ebay-sync.md`.
- ✅ **Sold-hidden freshness bug fixed** (was listed below as open). The scan
  hashed `hidden_oos` rows, so the new tier policy flipped all 36 sold-and-
  hidden listings to `out_of_date` — that is why the count read 123 instead of
  the expected ~90. `resolveFreshnessScanAction` now skips any non-available
  product and repairs the mis-flagged rows back to `hidden_oos`. **Repair runs
  automatically on the next freshness scan** (any `/api/admin/ebay/eligibility-
  summary` load, i.e. opening the eBay bulk-sync modal) once this is deployed;
  no manual SQL. Verified by dry run 2026-08-04: all 36 qualify
  (`last_pushed_qty === 0`), leaving 87 `out_of_date`, all available.
- Two available products have no `ebay_listings` row at all (90 available
  products, 88 linked). Confirm that is intentional (never listed) rather than a
  dropped link.
- ✅ **Daily price pushes diagnosed, fixed, and SHIPPED 2026-08-08.** Four
  defects: the schedules had never actually run (zero `scheduled_price_push`
  rows ever), `price_push_enabled` was `false` (owner enabled it), sold products
  were permanent eBay candidates producing guaranteed HTTP 400s (pool 124 → 88),
  `error_count` never incremented so nothing could back off, and `err.detail`
  was discarded so every failure logged an unusable message. Etsy carried the
  same defects but is clean in practice via auto-delist. Full write-up in
  CHANGELOG 2026-08-08.
- ◻️ **After the first real scheduled run, confirm both sync logs** — expect a
  `scheduled_price_push` row per provider (the first ever) and, for eBay,
  roughly 88 eligible with 0 failures. ⚠️ **Blocked by the Netlify scheduling
  fault at the top of this section** — as of 2026-08-10 there has still never
  been a scheduled run to confirm. The Admin last-run card now says so in red
  instead of showing a green "Ready for…".
- ◻️ **`antique-georgian-…-82` needs manual repair on eBay.** Held back by
  `isEbayWriteBlocked` — relisted manually and no longer attached to the
  app-managed offer. It is the one genuinely stale price: **$861.29 stored vs
  $984.82 target**. Cannot be fixed from the app; reattach it on eBay.
- **Verify the Admin Settings last-run card** after that first scheduled run.
- **Verify one tier-shipped listing per marketplace.** On eBay, let a boundary
  change flag the listing `out_of_date`, review-first publish one update, and
  confirm the fulfillment-policy charge. On Etsy, Sync Updates on one listing
  and confirm the expected tier profile plus `shipping_tier` log action.
  Provisioned policy/profile IDs are recorded in
  `features/shipping-tiers.md`.
- ✅ Fixed 2026-08-04: the eBay sold-hidden freshness scan no longer hashes a
  `hidden_oos` sold item into `out_of_date`, and repairs rows it previously
  mis-flagged. Covered by three `resolveFreshnessScanAction` tests. Confirm the
  repair landed after deploy: sold pieces should read Hidden, not Out of date.
- Keep eBay inventory #82 / listing `800354878200` write-blocked until an
  owner-approved reattachment or end-and-republish migration is tested against
  stored offer `204558136011`. This is now enforced in code by
  `EBAY_WRITE_BLOCKED_PRODUCT_IDS`
  ([sync.ts:62](next-app/src/lib/ebay/sync.ts:62)) — removing that entry is the
  only way to unblock it, and it must not be removed before that migration is
  tested.
- Complete the remaining controlled checks: publish eBay #83/#84 only if
  desired, never blanket re-sync, never sync sold #6, and observe Etsy's fixed
  cumulative image counter on the next genuine image upload. The first two are
  now mechanical: `EBAY_BULK_ENQUEUE_LIMIT = 25`
  ([guards.ts:12](next-app/src/lib/ebay/guards.ts:12)) bounds every bulk run,
  and `enqueueProducts` drops non-available products before queueing.
- Only after fresh confirmation, perform the scoped eBay account-deletion event
  scrub. Re-run the dry count, update only the audited event type, and prove no
  `payload.notification.data` identifiers remain. This is destructive database
  work and must follow the backup/dry-run rules.
- Resolve the remaining provider-spec verification notes documented in
  `features/etsy-sync.md` and `features/ebay-sync.md`; fail closed when a live
  provider contract is unknown.

## Instagram And Facebook

- After deployment, re-prepare one product per channel so new card/caption/
  framing behavior is proven on fresh renditions. Review only; publish solely
  when the owner intends a public post.
- Before Meta's reported **2026-10-31** Facebook data-access limit, derive and
  validate a replacement Page token through Settings. Rotation must preserve
  the old credential until the replacement passes app, Page, read-access, and
  lifetime checks.
- Delete the 2026-08-01 Instagram test post for item 21 manually if it is still
  live (`instagram.com/p/Dbf7lhNoN-T/`), then use **Already removed on
  Instagram** or Refresh status to reconcile local state. Instagram's API
  cannot delete it.
- Reset item 21's test lineup if desired; verification left 8 of 9 images and a
  promoted cover. Nothing depends on that arrangement.
- Wire the existing idempotent `markPostSold()` helper into the
  Available → Sold transition only after a controlled live test.
- Add social out-of-date detection. Instagram changes must flag the owner to
  delete/forget/re-prepare rather than claiming API deletion is possible.
- Consider bulk social queueing only if the per-product, review-first flow proves
  too slow in practice.
- Treat AI on-model imagery as an optional research project: run the fidelity
  bake-off and decide disclosure policy before writing implementation code.

## UX Backlog From The mels-treasures.com Review (2026-08-04)

> Owner-requested competitive review; recommendations only, no code yet.
> Priorities the owner explicitly named: on-product shipping/returns
> dropdowns and "sustainably sourced" trust messaging.

- ✅ **Product page accordions + trust strip** — DONE 2026-08-04
  (`ProductTrustSections.tsx`: Shipping & Returns / Condition & Wear /
  Payment Options accordions plus the Sustainably Sourced / Fully Insured /
  Local Pickup badge trio; see CHANGELOG). Production smoke: open one product
  page per locale and expand all three accordions.
- ✅ **Name the trade-in program** — DONE 2026-08-04. `/trade-in` (Gold &
  Silver Trade-In Program), localized, in the sitemap, linked from the Sell
  menu, footer, and every product page's trade-in line ("How it works").
  Production smoke: load both locales and click through from a product page.
- ✅ **Customer reviews/testimonials** — DONE 2026-08-04. (Correction: the
  homepage already showed three real Google reviews; the review's "we display
  none" was wrong.) The reviews now live once in `src/lib/testimonials.ts`
  and render on the homepage and as a compact band on every product page via
  the shared `TestimonialsSection`. To add a review, append a verbatim entry
  to that file — never invent or paraphrase a quote. **Google review text
  cannot be fetched from here** (the browser pane blocks google.com, Maps
  renders reviews client-side so WebFetch sees nothing, and search returns only
  paraphrases) — ask the owner to paste the text and reviewer name, and whether
  Google badges them a Local Guide. The grid is pinned to 1/2/4 columns and so
  assumes an EVEN count; a fifth review will need that ladder revisited.
  Currently four (Cristian Reatiga added 2026-08-05). Per-product reviews
  remain a possible later step. **Column ladder changed 2026-08-09: the grid is
  now 2 / 4, never 1** (owner: minimum 2-up) — the even-count assumption above
  is unchanged. See DECISIONS, *"The reviews band is never one column"*.
- **Spanish review translations want a native-speaker check**, including the
  newest (`Cristian Reatiga`). The English is the customer's own wording; the
  Spanish is ours.
  - ⚠️ **Now also covers the 8 page titles + meta descriptions localized
    2026-08-16** (`/es/about`, `/es/services`, `/es/estate-jewelry`,
    `/es/gold-services`, `/es/silver-services`, `/es/bullion`, `/es/faq`,
    `/es/estate-services`). These are OUR translations and they are the text
    Google shows in Spanish results, so they matter more than body copy. Terms
    used, for consistency if they are revised: `Joyería de Patrimonio` (estate
    jewelry), `Vender` / `Compramos`, `Suroeste de Florida`,
    `Plata Esterlina`, `Lingotes`, `Liquidación de Patrimonios`.
- ✅ **Related items ("You might also like")** — DONE 2026-08-04.
  Same-category available pieces, same-type-first ranking, lean query, lazy
  images, spot-computed prices. Production smoke: open a product page in both
  locales and click a related card.
- **Admin reorder needs one live verification:** the drag-reorder write was
  changed from upsert to UPDATE-only after a live "null value in column
  title" failure (2026-08-04, see CHANGELOG). Reload Admin Products and
  perform one drag; expect "Inventory order saved" — possibly with a note
  that N listed items no longer exist, which means reload to refresh the
  list. While there, confirm the new edge auto-scroll with a real mouse drag
  (hold a row above the top of the table; it should run up to the beginning).
- ✅ **Homepage story + education + FAQs + announcement bar** — DONE
  2026-08-04. Meet the Owner (chris.webp + story), Why Buy Estate Gold?,
  four FAQ accordions linking to /faq, and a static announcement bar at the
  top of the homepage content (not the fixed header — its 4rem height is
  load-bearing). Production smoke: load both locales, open an accordion, and
  confirm the bar shows two items on a phone, three from 780px, and stays on
  ONE line at every width in BOTH locales (Spanish is the tight one).
- **Cart add-on/upsell (optional):** Mel sells a $29 tarot add-on and shows a
  cross-sell strip in the cart. A local-flavor equivalent (gift wrap,
  handwritten appraisal card) plus a "Discover something new" strip is a
  possible later experiment.
- **Keep (already at parity or better):** single-page checkout shape, guest
  checkout, insured shipping tiers with clear method descriptions (clearer
  than Mel's tariff prose), live spot pricing + scrap value (unique to us),
  INQUIRE/CALL direct-contact actions, "Taxes/shipping calculated at
  checkout"-style transparency (ours shows real numbers earlier than theirs).

## Business, Content, And Operations

- Complete Google Business Profile video verification; duplicate draft profiles
  are already removed.
- Have owner/counsel review Privacy, Terms, Returns/Refunds, Shipping,
  Accessibility, and cookie disclosures.
- Confirm Resend sending-domain SPF/DKIM and intended From identities.
- ✅ **Resend `.co` → `.com` migration — COMPLETE and SHIPPED 2026-08-08.**
  Domain swapped and Verified in Resend, DNS at GoDaddy confirmed against the
  authoritative nameserver, every sender moved, deployed. Detail in CHANGELOG
  2026-08-05/08.

  ⛔ **Email is now FULLY `.com` — senders AND mailboxes.** An earlier version of
  this section said contact/display addresses "stay on `.co`"; that was reversed
  on 2026-08-08 and is **wrong now**. Zero `@naplesestatejewelry.co` addresses
  remain in shipped code, verified in a clean production build. **Never restore
  a `.co` address.** (Separately and permanently: never touch the `.co` MX
  records — that domain still carries live mailboxes.)

  Remaining, both optional and owner's call:

  - **Click/open tracking not re-enabled.** Resend now implements it as a
    `links.` tracking subdomain that redirects every link in every email —
    receipts included — plus another DNS record. That is a behavior change
    beyond a domain swap, not an oversight.
  - **Resend webhook is still registered on `.co`** and still Enabled (webhooks
    are account-level, so it survived the domain deletion). It keeps working
    because `netlify.toml` serves `.co/api/*` as a **200 rewrite, not a
    redirect** — do not let that become a 301. Re-registering on `.com` is
    optional cleanup.
- Complete `CLIENTS.md` unknowns: Netlify site ID, service/dashboard owners,
  password-manager references, maintenance scope, billing status, and production
  Supabase Auth redirects.
- Resolve duplicate live inventory #21 if it still exists.
- Decide whether root `banner.png` should replace the current eBay banner after
  removing every off-eBay website/contact reference. Do not publish either
  banner until policy-safe.
- Native-speaker review of Spanish marketing/product/legal copy remains useful.

## Deferred And Optional

- Phase 2 high-value shipping: evaluate Parcel Pro, JM Shipping Solution, or
  FedEx Declared Value Advantage after owner quotes/account setup. Until then,
  retain the documented USPS Registered Mail rules for $5,000+ shipments.
- Finish Cloudflare Stream deployment only when video is a priority: configure
  the four documented Netlify variables, reconcile the webhook, run the device
  matrix, and validate one controlled Etsy/eBay MP4 before enabling marketplace
  video writes.
- Migrate remaining legacy local-only product photos to Supabase Storage and
  optionally optimize the remaining near-guideline assets.
- Add a localized catch-all only if Spanish 404 body localization is worth the
  extra route; existing 404 metadata/noindex behavior is correct.
- Add `OPENAI_API_KEY` only if server-generated read-aloud is desired; device
  speech remains the fallback.
- Revisit ESLint 10 only when the stable Next lint stack supports it. Keep the
  production audit clean and do not force an incompatible dev-only upgrade.
- Profile Admin Products virtualization only if production timing shows the
  current table is slow. Consider moving dependencies outside OneDrive only if
  synchronization overhead remains material.
- Evaluate Next.js 16.3 when stable, add analytics only with consent/policy
  updates, expand catalog categories as inventory warrants, and revisit a keyed
  metal provider only if production traffic justifies it.

## Recently Completed

Headlines only — full detail lives in `CHANGELOG.md` under each date.

- **2026-08-16/17 (deployed 2026-08-17):** homepage hero rewritten (eyebrow
  *"One Piece or an Entire Estate"* over an h1 naming Naples, location in the H2s);
  `pageMetadata()` gave every public page its own social card and fixed blank
  cards on `/sell` and all city pages; 8 Spanish pages stopped serving English
  metadata; an SEO audit's four findings all fixed; nav dropdowns now close on
  outside tap/Escape; the octopus mark replaced in the header and the tab.
  Closed with a pre-deploy audit — 998/998 tests, 454/454 pages, 30 pages swept
  live with zero problems.
- **2026-08-15 (deployed 2026-08-17):** whole-dollar item prices (rounding moved
  onto the value, so a card and its charge are one number), the sitewide
  button-font cascade fix, touch tap feedback gated by pointer instead of width,
  and the route progress bar at the header's base.
- **2026-08-09 (deployed 2026-08-17):** shop-card touch overhaul, hero touch snap
  + slower handover, hero performance batch, and one solid background per
  slideshow replacing the per-photo sweep. This was the head of the queue that
  had been waiting since 2026-08-09; it shipped with everything added since.
- **2026-08-08 (shipped):** email fully `.com`, `?returnTo=` disclosure fix,
  Deep Field production import + live hooks, daily price-push defects fixed,
  admin email removed from the client bundle.
- **2026-08-06:** pre-deploy sign-off; hero runway compressed and crossings
  overlapped so the handover never stops.
- **2026-08-04:** hero random-fill lineups, product-page accordions + trust
  strip, `/trade-in` page, related-products strip, homepage story/education/FAQ
  blocks, single-page checkout.
- **2026-08-03:** hero became a scroll-pinned multi-slideshow parallax stack;
  Social Queues gained Latest Posts, row selection, background Post now, and
  the seven Eastern slots; 41 superseded planning docs removed.
- **2026-08-01/02:** `.com` became the live primary domain (DNS, redirects,
  cert, sitemap, Search Console, Change of Address all production-verified);
  seven insured-shipping policies/profiles provisioned on both marketplaces;
  Facebook Page token validated.
