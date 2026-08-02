# Instagram Auto-Posting — Plan and Build Log

> Status 2026-08-01: **LIVE.** All phases built and live-verified —
> `@naples_estate_jewelry` connected (token valid to 2026-09-30, weekly
> refresh armed), a real 9-image carousel published through the operator UI on
> 2026-08-01 (that test post awaits manual deletion — API cannot delete). The
> owner steps listed below are all ✅ done. The caption was restructured later
> the same day (see "Caption shape" below), and cross-channel tools
> (publish-to-both, copy-curation, discard) landed — `CHANGELOG.md` has the
> full sequence. The plan sections below are the original build log.

## Caption shape (as of 2026-08-01 — supersedes the caption notes below)

The caption now mirrors the Facebook message structure line for line
(`src/lib/instagram/mapping.ts` → `buildInstagramPost`, tested in
`__tests__/mapping.test.ts`):

```
Available now!

{title}

{spec line — no inventory number}

≈ $X at time of posting (based on $Y/oz {metal} spot).

🇪🇸 {Spanish line}

Shop: NaplesEstateJewelry.com/p/{inventory#}

{CTA — default: "DM or visit NaplesEstateJewelry.com for live spot-linked pricing"}

#hashtags
```

Same rules as Facebook: exactly one blank line between every line; "Available
now!" only while status is available; the spot parenthetical only for
spot-linked prices; no description body; no inventory number anywhere public
(caption + alt text — `buildPublicSpecLine`, shared by both channels). The one
channel difference: Instagram never linkifies caption URLs, so the Shop line is
a **typeable** brand-case short link (no `https://`) rather than Facebook's
clickable full URL; without an inventory number it falls back to the bare
domain. The default CTA deliberately does not repeat the domain — "the site"
leans on the Shop line above it. ⚠️ Open decision before the first publish
with this caption: the line uses brand-case **.com**, which the owner owns but
has not yet pointed anywhere — see `TASKS.md`.

Slides (both channels, since 2026-08-01 evening): the generated card **replaces
its source photo** — the photo is composited full-bleed inside the card, so the
standalone copy was a visible duplicate. Dropped only when the card actually
rendered; a card failure keeps every photo. Prepared-slide thumbnails open
full-size in an AdminModal on click.

## 0. Live configuration (created 2026-07-31)

Meta app: **Naples Estate Jewelry Social**
- Meta App ID: `1551269126645242`
- **Instagram app ID: `1561238015679345`** (distinct from the Meta App ID —
  this is the one the Instagram endpoints use)
- Instagram app secret: in the Meta dashboard under Instagram → API setup with
  Instagram login. **Value never recorded here**; owner copies it to Netlify.
- Business portfolio: Naples Estate Jewelry (verification already complete)
- Mode: development (correct — publishing to our own account needs no App Review)
- Use case: "Manage messaging & content on Instagram"
- Permissions **Ready for testing**: `instagram_business_basic`,
  `instagram_business_content_publish`, `instagram_business_manage_comments`,
  `instagram_business_manage_messages` (the last came with the required set and
  is unused by this integration).

### Owner decisions (2026-07-31)
1. Caption price: **"≈ $1,718 at time of posting"** + link-in-bio pointer.
2. Sold items: **auto-comment "SOLD"**, leave the post up.
3. Language: **English + one short Spanish line**.
4. Queue: **review-first** — nothing posts without explicit approval.
5. Cadence: **2 posts/day**.

### Remaining owner steps before Phase 2 can be live-tested (✅ all done 2026-07-31/08-01)
1. Run `supabase/instagram-sync.sql` in the Supabase SQL Editor.
2. Add to Netlify: `INSTAGRAM_TOKEN_ENC_KEY` (any random string),
   `INSTAGRAM_CRON_SECRET` (any random string). `INSTAGRAM_APP_SECRET` is only
   needed if a short-lived token is ever pasted.
3. In the Meta dashboard: App roles → add the Instagram account as an
   **Instagram Tester**, then accept the invite from the Instagram account
   (Settings → Apps and websites → Tester invites).
4. Instagram → API setup with Instagram login → **Generate access tokens** →
   Add account, then paste the token into Admin → Settings → Instagram Posting.

---

## Original exploration (verified against Meta docs 2026-07-31)

## 1. Verified API facts (Meta official docs, checked 2026-07-31)

The right integration is the **"Instagram API with Instagram Login"** (the
newer 2024+ variant), NOT the older Facebook-Login flavor:

- **No Facebook Page required.** It works directly against an Instagram
  **professional** account (Business or Creator) with an Instagram User
  access token.
- Permissions: `instagram_business_basic` + `instagram_business_content_publish`
  (+ `instagram_business_manage_comments` if we auto-comment SOLD — see §6).
  The old `instagram_basic`/`instagram_content_publish` scopes were deprecated
  Jan 2025.
- **Development mode is enough for our use.** Adding the owner's own Instagram
  account as an **Instagram Tester** on the app (accepted at
  instagram.com/accounts/manage_access) allows publishing to that account
  without Meta App Review. Review is only needed to serve arbitrary
  third-party accounts, which we never will.
- **Tokens:** short-lived → exchange for a long-lived Instagram User token
  (**60 days**), refreshable via `GET /refresh_access_token` any time the
  token is ≥24 h old and not yet expired. An unused/expired token forces
  re-auth, so we keep it warm on a schedule (§5).
- **Publishing model:** two-step container flow. For a carousel:
  1. `POST /{ig-user-id}/media` once per image with `is_carousel_item=true`
  2. `POST /{ig-user-id}/media` with `media_type=CAROUSEL` + `children=[...]`
  3. `POST /{ig-user-id}/media_publish` with the carousel container id
  Containers **expire after 24 hours** if unpublished.
- **Carousel limits: max 10 children.** All images are cropped to the FIRST
  image's aspect ratio (default 1:1). Products with more than 10 images must
  be capped (Etsy caps at 20 today; Instagram caps at 10).
- **JPEG only.** WebP and PNG are rejected — and our entire catalog is WebP.
  A transcode step is mandatory (precedent: Etsy also rejects WebP and
  `lib/etsy/images.ts` already does Sharp WebP→JPEG).
- **Media must be publicly fetchable by URL** — Meta cURLs the `image_url`
  at container-creation time.
- **Rate limit: 100 API-published posts per rolling 24 h** (a carousel counts
  as one). Quota is queryable via `GET /{ig-user-id}/content_publishing_limit`.
- **Captions cannot be edited after publish via the API.** The only automated
  correction is delete + repost (losing likes/comments). Posting comments on
  our own media IS supported. `alt_text` is supported on image posts
  (added Mar 2025). Caption cap ~2,200 chars, ≤30 hashtags.
- **No sandbox environment.** Controlled testing happens on a real
  professional account (recommendation: also add a private throwaway
  IG business account as a second tester for dry runs).

## 2. Meta app setup (owner, Phase 0 — no code)

1. In the existing Meta developer account, **create a NEW app** (keep the
   other project's app separate): type Business, add the **Instagram** product,
   configure **Instagram API with Instagram Login**.
2. Ensure the target Instagram account is a **professional** account.
3. App Dashboard → Instagram → add the account as an **Instagram Tester**;
   accept the invite from the IG account's "Apps and websites" settings.
4. Generate a token once in the dashboard to smoke-test, then prove the flow
   manually (Graph API Explorer or curl): create 2-3 image containers from
   public JPEG URLs → carousel container → publish → verify the post →
   delete it.
5. Record app id/secret **location** (not values) in `CLIENTS.md`; values go
   to Netlify env when implementation starts.

## 3. Architecture — mirror the existing marketplace pattern

Follow the established rule: parallel tree, zero cross-imports from
`lib/etsy`/`lib/ebay` (the same way eBay copied Etsy's *shape* only).
Instagram's container→publish maps naturally onto **eBay's
`review`/`publish-live` model** (Instagram has no true draft concept, and
24-hour container expiry makes "park a draft remotely" impossible).

```
supabase/instagram-sync.sql
  instagram_connection   (single row id=1: status, ig_user_id, username,
                          access_token_enc (AES-256-GCM, INSTAGRAM_TOKEN_ENC_KEY),
                          token_expires_at, auto_publish=false,
                          caption/price/sold policy settings)
  instagram_oauth_states (state handshake rows; no PKCE verifier needed)
  instagram_posts        (product_id PK → products.id CASCADE,
                          ig_media_id, permalink, sync_state:
                            pending|review|publishing|published|out_of_date|
                            deleted|error,
                          child_container_ids jsonb, carousel_container_id,
                          container_expires_at,      -- NEW vs Etsy/eBay
                          content_hash, posted_caption, posted_price,
                          last_error, error_count, timestamps)
  instagram_sync_log     (same 8-column shape as etsy_sync_log)
  claim_next_pending_instagram_post()  -- FOR UPDATE SKIP LOCKED

next-app/src/lib/instagram/{client,auth,store,mapping,sync,images}.ts
next-app/src/app/api/admin/instagram/{connect,callback,disconnect,status,
  settings,preview,sync,sync-batch,posts,verify-post,delete,
  eligibility-summary,publish-summary,refresh-token}/route.ts
next-app/src/components/admin/{InstagramSettingsPanel,InstagramProductPanel,
  InstagramBulkSyncModal,InstagramBulkPublishModal}.tsx
next-app/src/app/[locale]/admin/products/[id]/instagram/page.tsx
netlify/functions/instagram-token-refresh.mts   (weekly keep-warm)
```

Known wire-up points (verified in current source): `AdminSettingsPanel.tsx`
(~line 341, add panel), `SelectedProductsActionsModal.tsx` (action union at
line 5), `AdminShell.tsx` ~3679 (bulk action handler), ~4795 (third "Manage
Instagram" card), `ProductMarketplaceManagerPage.tsx` (`ProductMarketplaceName`
union), `SelectedMarketplaceReviewFlow.tsx` (`marketplace` union — its
preview/sync fetches are already templated).

Env additions (Netlify): `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`,
`INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_TOKEN_ENC_KEY`, `INSTAGRAM_CRON_SECRET`.

## 4. Image pipeline (the one genuinely new subsystem)

Products store WebP (Storage URLs + legacy `/assets` paths). Instagram needs
public **JPEG** URLs and uniform aspect ratio (first image dictates the crop).

Plan: at prepare time, per image (max 10, order = gallery order):
1. Fetch bytes exactly like `lib/etsy/images.ts` (Storage path or absolutized
   `/assets` path).
2. Sharp: flatten onto white, pad to **1080×1080 square** (respecting the
   existing `image_padding` fields), encode JPEG (~quality 85).
3. Upload renditions to Supabase Storage `instagram-renditions/{product_id}/{n}.jpg`
   with immutable cache headers; those public URLs feed the containers.
4. **Add `instagram-renditions/` to the Storage GC reference scan** (hard rule
   in AGENTS.md), and delete renditions when a post is deleted/replaced.

Square-padding beats cropping for jewelry: no gemstone or clasp ever gets
cut off, and the first-image-dictates-ratio rule becomes a non-issue.

## 5. Token lifecycle

- `ensureFreshAccessToken()` in `lib/instagram/auth.ts`: refresh when within
  ~7 days of expiry (allowed any time ≥24 h after issue/refresh).
- Weekly Netlify scheduled function (`instagram-token-refresh.mts`, cron-secret
  guarded like the price pushes) keeps the token warm even if the admin UI
  is idle for weeks — otherwise a quiet 60 days kills the connection.
- On refresh failure / expiry → `status='needs_reauth'`, surfaced on the
  Settings card exactly like Etsy/eBay.

## 6. Caption design + policy decisions (owner input needed)

Caption mapper is a pure `mapping.ts` allowlist (same never-touch private
fields: cost basis, minimum price, internal notes, private label, melt).
Proposed template (configurable in Settings):

```
{title}

{price line}
14K Yellow Gold · 53.91 g · 7.75 in · Inventory #21
{first ~2 sentences of description}

DM or call (239) 404-8505 · Live spot-linked pricing at the link in bio
{hashtags: from product tags + a configured base set, ≤30}
```

Decisions the owner must make before build:

1. **Price staleness** (captions are uneditable; spot moves daily):
   - (a) omit the number — "live spot-linked pricing on our site";
   - (b) **recommended:** include it as "≈ $1,718 (at time of posting)" plus
     the live-pricing pointer;
   - (c) daily auto-comment with the current price (noisy; burns quota).
   If a price IS included, the mapper must call
   `getMarketplaceSpotPriceError()` and **fail closed on fallback spot**,
   same as Etsy/eBay (DECISIONS.md rule for external writes).
2. **Sold handling** (options, configurable): auto-comment "SOLD" on the post
   (needs `instagram_business_manage_comments`), delete the post, or leave it.
   Recommended default: auto-comment + leave up (social proof).
3. **Language:** captions are single-post; EN-only vs EN with a short ES line.
4. **Cadence:** ~127 public items ≫ don't flood the feed. Recommended: manual
   review-first posting at first; later an optional scheduled drip (e.g.
   1-3 posts/day, oldest-unposted-first) — technically capped at 100/day.
5. **Auto-post trigger:** should newly-`available` products enqueue
   automatically, or stay strictly manual? (Recommend manual until trust
   is established — review-first is the house default.)

## 7. Sync semantics

- **Review-first:** "prepare" = compute caption + renditions + preview
  locally (`sync_state='review'`, nothing remote — containers would expire in
  24 h anyway). "Publish" = bounded step chain (children → carousel →
  publish → store `ig_media_id`/`permalink`), resumable via checkpointed
  container ids + `container_expires_at`, driven by the same
  client-re-POSTs-while-not-done pattern as Etsy/eBay.
- **out_of_date:** `content_hash` over caption inputs + image source keys.
  Since edits are impossible, "Republish" = explicit delete + repost with a
  clear engagement-loss warning in the UI. Price-only drift does NOT mark
  out_of_date (same as marketplaces).
- **Quota:** check `content_publishing_limit` before bulk drains; bound runs.
- **Verification:** `GET /{ig-media-id}` after publish; log everything to
  `instagram_sync_log`; 90-day opportunistic prune.

## 8. Phases

- **Phase 0 — DONE 2026-07-31:** Meta app created and configured (see §0).
- **Phase 1 — BUILT 2026-07-31.** Shipped:
  - `supabase/instagram-sync.sql` — `instagram_connection`, `instagram_posts`,
    `instagram_sync_log`, `claim_next_pending_instagram_post()`, all
    service-role-only with RLS deny-all.
  - `src/lib/instagram/client.ts` — Graph API wrapper with bounded retry,
    secret redaction, and typed container/publish/comment/quota helpers.
  - `src/lib/instagram/auth.ts` — AES-256-GCM token storage plus a pure
    `decideTokenRefresh` covering expired / too-young / not-due / due.
  - `src/lib/instagram/store.ts` — typed CRUD, queue helpers, audit log.
  - `src/lib/instagram/mapping.ts` — pure caption builder (price qualifier,
    spec line, Spanish line, hashtags, alt text, fail-closed spot rule,
    price-insensitive content hash).
  - Routes: `status`, `connect`, `disconnect`, `settings`, `refresh-token`
    (cron-secret guarded).
  - `InstagramSettingsPanel` wired into Admin → Settings after eBay.
  - `netlify/functions/instagram-token-refresh.mts` — Mondays 12:15 UTC.
  - 30 new unit tests (522 total), TypeScript, lint, and the 425-page
    production build all green.

  **Connection design note:** token acquisition is paste-then-auto-refresh, not
  a redirect OAuth flow. Instagram rejects `http://localhost` redirect URIs,
  which would have made the owner's LAN/dev testing impossible, and this is a
  single owner-operated account on a development-mode app where Meta's own
  documented path is dashboard token generation. The weekly refresh keeps the
  60-day token alive indefinitely, so the paste is one-time. Redirect OAuth can
  be layered on later without changing the schema.
- **Phase 2 — single-product posting:** mapping + rendition pipeline +
  preview + review-first publish + verify + delete; per-product panel, row
  chips, Actions-modal card; controlled live test on the real account
  (post → verify → delete, then one kept post).
- **Phase 3 — scale-out:** bulk enqueue/drain with quota guard, sold
  auto-comment, out-of-date scan + delete-and-repost flow, optional
  scheduled drip posting.
- **Future (separate decisions):** product tagging / Instagram Shopping
  (needs approved shop + catalog — big lift), Reels from product videos
  (blocked on the Cloudflare Stream rollout), Stories.

## 8b. AI on-model first image — exploration (planning only, 2026-08-01)

> Goal: generate a photorealistic image of the actual piece **worn on a model**
> and lead the carousel with it. The per-post image lineup editor (built
> 2026-08-01) is the groundwork: an AI image is just another entry that can be
> reordered to position 1 and removed if it disappoints.

### The hard constraint: product fidelity

This is not "generate a picture of a gold bracelet." Every listing is a
**one-of-one estate piece** — the image must show *this* bracelet, with its
exact link pattern, clasp, wear, and hallmarks. Two failure modes matter and
they are not equal:

1. **Cosmetic implausibility** (a necklace floating off the collarbone) — bad,
   obvious, cheap to reject.
2. **Silent product drift** (the AI "cleans up" the piece, changes link count,
   invents a smoother clasp) — worse, because it looks great and is
   **materially misleading about goods actually for sale**. A buyer receiving
   a piece that doesn't match the lead photo is a real dispute, not a design
   nitpick.

Fidelity, not beauty, is the acceptance criterion.

### Model options (verified 2026-08-01)

**Claude cannot do this.** Claude has vision (image input) but generates no
images. This pipeline requires a third-party image provider — a genuinely new
external dependency for the project, unlike the AI listing assistant which
already runs on Anthropic.

Two families, and the choice is a real fork:

| Option | What it is | Fit |
|---|---|---|
| **General image-editing models** — Google Gemini 3 Pro Image / "Nano Banana 2" (up to 14 reference images), ByteDance Seedream 5, FLUX.1 Kontext | Reference-image editing that preserves identity, lighting, and color | Flexible, cheap per image, one API. Fidelity on fine jewelry detail is the open question |
| **Purpose-built jewelry try-on** (Photta, SellerPic, NeuroViz, thenewblack.ai) | Trained specifically for on-model jewelry placement | Understands that earrings hang, rings sit at the right proportion, necklaces drape. Narrower, another vendor, less control |

The jewelry-specific services exist precisely because generic "put the product
on a model" tools fail on the anatomy — which argues for evaluating at least
one of each rather than assuming the general models win.

### Proposed approach — bake-off before build

The mistake would be picking a provider and building a pipeline around it.
Instead:

1. **Owner picks 5-8 representative pieces** spanning the hard cases: a chain
   (drape), a ring (proportion on a finger), earrings (hang), a bracelet
   (wrist curve), and one piece with distinctive wear or an unusual clasp.
2. **Run each through 2-3 candidates by hand** — no code. Web UIs are fine.
3. **Score only fidelity**, against the real photos: link pattern, stone count
   and placement, clasp type, proportion, metal color. Beauty is a tiebreak.
4. **Decide go/no-go on the evidence.** A believable outcome is that no
   provider clears the bar for one-of-one estate pieces, in which case the
   feature is correctly abandoned before any code exists. That is a cheap,
   successful result.

### If it clears the bar — implementation sketch

Deliberately thin, and it reuses what exists:

- `product_ai_images` table (or a `source: 'ai'` flag on renditions):
  provider, prompt, source image, generated URL, `approved_at`, `approved_by`.
- One admin action on the Instagram panel: **Generate on-model image** →
  side-by-side against the real photo → explicit **Approve** or **Discard**.
  Never auto-inserted; approval is a human act, mirroring the AI listing
  assistant's accept/keep-existing rule in `DECISIONS.md`.
- On approval it becomes an image in the lineup, positioned first via the
  existing **Cover** control. The lineup editor already handles everything
  after that point.
- Generated images live in Storage under their own prefix and **must be added
  to the Storage GC reference scan** — the same trap the Instagram renditions
  hit.

### Disclosure — decide before the first public post

An AI-generated image of a real product shown to buyers needs a position, and
this is an owner/counsel call, not a technical one:

- **Recommended:** label it in the caption ("first image is an AI visualization
  — remaining photos are the actual piece") and never let it be the *only*
  image. Cheap, honest, and it preempts the complaint.
- FTC guidance on endorsements and deceptive imagery, Instagram's own synthetic
  media labeling, and marketplace rules (Etsy/eBay both restrict misleading
  imagery) all point the same way. Worth a look before launch rather than after.
- The site's existing "buyer-facing copy excludes seller guesses" rule in
  `DECISIONS.md` is the same instinct applied to text; extending it to imagery
  is consistent.

### Open questions for the owner

1. Does an on-model image actually move the needle for estate jewelry, where
   buyers are scrutinizing condition and authenticity? A styled flat-lay or a
   scale shot next to a hand might convert as well for far less risk.
2. One model look, or varied? A consistent "house model" reads as a brand;
   varied models read as stock.
3. Is this worth a paid subscription and per-image cost at 2 posts/day?

## 8c. Decorative first-image "ad card" via compositing (measured 2026-08-01)

> ✅ **BUILT 2026-08-01 — but not the way this section proposed.** The cutout
> approach below was implemented, measured, and then **abandoned in favour of
> matching the card background to the photo's own backdrop**, which removes the
> need to cut the product out at all. Read §8d for what shipped. This section is
> retained because its measurements are still correct and still load-bearing —
> the backdrop profile, the keyability threshold, and the silver-on-white
> finding all carried over — and because it records why the obvious approach was
> the wrong one.

The safer alternative to on-model generation: composite the **real product
photo** onto a designed card. The product's pixels are never redrawn, so drift
is impossible by construction — masking is subtractive, it can only delete
pixels, never invent them. The worst failure is a ragged edge or a stray hole:
visually obvious and one click to reject, never a silently-wrong product.

**Do not** ask an image model to "edit this photo but don't change the
product." Diffusion models regenerate every pixel; the instruction is soft
guidance, not a constraint, and the first thing lost is the high-frequency
detail that matters most on one-of-one estate pieces (link count, clasp
geometry, hallmarks, honest wear).

### Measured backdrop profile of the real catalog

Sampled via canvas across gold and silver inventory:

| Backdrop | Sample | Corner spread | Verdict |
|---|---|---|---|
| Legacy cream | `RGB(251,247,244)` | 0-2 | Cleanly keyable |
| White | `RGB(254,254,254)` | 0-1 | Cleanly keyable |
| Black | `RGB(0,0,0)` | 0 | Cleanly keyable, easiest |
| Contextual / in-hand | mixed | ~198 | Not keyable — leave as-is |

Corner spread separates studio shots from contextual ones by two orders of
magnitude, so **auto-detecting which photos can be cut out is deterministic
and needs no ML** — sample the four corners, derive the key colour per image,
and treat a spread above ~12 as "not keyable". The owner reports all future
photography will be black or white, so the cream set is a bounded, shrinking
legacy problem that cutout absorbs anyway.

### The two genuinely hard parts

1. **Enclosed background.** A bracelet laid in a loop has backdrop *inside* it.
   Flood-filling inward from the edges never reaches that region and leaves a
   disc of cream floating in the middle of the piece. A global colour key
   handles it correctly but is more aggressive — which leads to:
2. **Specular highlights on light backdrops.** Measured 0.5-1.8% of gold-on-cream
   pixels as bright metal at risk from a naive threshold. **Silver on white is
   the worst case: 7-12% of the product sits within 25 luminance of the
   backdrop** (David Yurman bangle 11.8%, Tiffany ladle 6.9%, coin-silver coffee
   pot 10.5%). Those pixels are the polished highlights — exactly what a
   luminance-only threshold eats. A chroma-aware key classifies them correctly;
   a naive one does not.

**Photography recommendation:** shoot silver on **black**, not white. Silver on
white is the single hardest combination in the catalog; silver on black is
trivial. This costs nothing and permanently removes the hard case going forward.

### Build order if pursued

1. Auto-detect key colour + keyability per image (corner sampling — cheap,
   deterministic, no dependency).
2. Cutout via a chroma-aware matte, not a luminance threshold. Sharp alone
   cannot segment; either a tuned colour-distance matte with despeckling, or a
   local background-removal model, with the enclosed-region case handled
   explicitly.
3. **Preview-and-approve is mandatory** — never auto-insert a generated card.
4. Composite onto a card design; the result becomes an image in the existing
   per-post lineup and is promoted with the existing Cover control.
5. Generated cards live in Storage under their own prefix and **must be added
   to the Storage GC reference scan** — the same trap the renditions hit.

### Open question worth testing

Whether a designed card should be the cover at all. It is the grid thumbnail
and the scroll-stopper, and shoppers on a jewelry account may respond better to
the actual piece. A card with the real product large and centered — a frame
rather than a poster — is the compromise worth A/B-ing against a plain product
cover before committing.

## 8d. What actually shipped: backdrop matching (built 2026-08-01)

The cutout in §8c works — the prototype cut a Cuban bracelet cleanly, gaps
transparent, no holes in the gold — but only after per-image threshold tuning to
separate the studio drop shadow from real dark detail, and it still could not
handle sterling on cream. The shadow is the trap: near-neutral, only ~10-35
luminance below the sweep, so every term that catches it also catches crevices.

**The insight that replaced it:** the shadow was only a problem because a
cream-lit product was being placed on a black card. Paint the card in the
photo's own backdrop colour and the shadow lands on the surface it was cast on.
No matte, no thresholds, no chance of eroding the piece — and one code path for
cream, white and black, with the type theme flipping on backdrop luminance.

Corrected catalog measurement (all 128 products with images, reading covers
specifically and accounting for alpha):

| Cover backdrop | Count | Notes |
|---|---|---|
| Light / cream | 109 | The majority; `tolerance` crop mode |
| Opaque black | 19 | The chains; `saturation` crop mode |
| Non-uniform | 0 | Contextual shots exist but are never covers |
| Transparent | 0 | Occurs on secondary images; composites to white |

An earlier count in this file's history said the dark set was negligible. That
was wrong: it came from scraping rendered HTML, which saw 93 of 976 images and
missed all 16 chains whose covers are legacy paths under
`public/assets/images/shop` rather than Supabase Storage. Query the table, not
the markup.

**Shipped:**

- `lib/instagram/backdrop.ts` — one decode yields backdrop colour, uniformity
  and a proposed content box. Corner samples composite over white, so a
  background-removed photo agrees with whatever `flatten()` paints.
- `lib/instagram/card.ts` — sharp for pixels, Satori for type (see DECISIONS
  for why not sharp's SVG text). Part of the pipeline rather than a setting:
  every carousel leads with a card, so photos cap at 9 of Meta's 10 slots. A
  render failure degrades to photos only with a warning instead of blocking the
  post.
- Per-image crops in `instagram_posts.image_crops`, normalized and keyed by
  image URL, with an auto-proposal and a drag editor. Applied only to Instagram
  renditions.
- The §8c trap was avoided: cards are written under the existing
  `instagram-renditions/` prefix, already covered by the Storage GC scan.
- Separately, this work exposed and fixed a live defect — `renderSquareJpeg`
  padded white unconditionally, framing all 19 black-backdrop products in white
  bars.

**Still open from §8c:** whether the card should be the cover at all. It is the
grid thumbnail, and a plain product photo may outperform it on a jewelry
account. The owner chose to bake the card into the pipeline rather than expose a
toggle, so testing the alternative now means a code change rather than a
setting — worth revisiting if engagement on carded posts underperforms.

## 9. Risks / open items

- Meta may change scopes/limits; re-verify §1 at build time.
- Dev-mode apps are for the tester accounts only — fine for our own account,
  but a future switch to Live mode would trigger App Review + business
  verification.
- The Netlify Edge `/api/*` per-IP rate limit must not throttle Meta's image
  fetchers — renditions live on Supabase Storage URLs (not `/api/*`), so this
  is avoided by design; keep it that way.
- Legacy `/assets`-only products work (bytes fetched and re-hosted as
  renditions), but the pending Storage migration in TASKS.md would simplify.
- No sandbox: every live test touches the real account — Phase 2 test plan
  must stay small and delete-first.
