# Facebook Page Posting

> Status 2026-08-01 (later same day): **LIVE-VERIFIED end to end.** Page
> **Naples Estate Jewelry Co.** connected with a never-expiring Page token;
> prepare → publish → API-delete all proven through the operator UI against the
> live Graph API. Post copy: leads with "Available now · ≈ $X at time of
> posting" (available products only), carries the clickable Shop link, and
> omits the inventory number (since 2026-08-01 both channels omit it —
> `buildPublicSpecLine`). The card's brand line is
> NAPLESESTATEJEWELRY.COM. Card-image choice + on-demand Generate card shipped
> for both channels (`supabase/social-card-source-2026-08.sql` pending).
> Token-acquisition gotchas (use-case permissions, stale-scope OAuth failure,
> business-page invisibility in me/accounts) are recorded in `CHANGELOG.md`.

## What it is

Auto-posting products to the business's **Facebook Page** as multi-photo posts,
with the same operator flow as Instagram: prepare → review → publish (manual or
scheduled drip), per-product lineup and crop curation, the generated ad card as
slide one, and an auto-"SOLD" comment when an item sells.

## How it differs from Instagram — all driven by the Graph API

| | Instagram | Facebook |
|---|---|---|
| API host | graph.instagram.com | graph.facebook.com |
| Token | Instagram User token, 60-day, weekly refresh cron | **Page token, does not expire, no refresh cron** |
| Publish | container two-step + FINISHED polling | unpublished photos + one feed post, synchronous |
| Delete | **impossible via API** (manual + "forget") | `DELETE /{post-id}` genuinely works |
| Edit after publish | impossible | possible (not built; review-first regardless) |
| Links in caption | dead text — carries a *typeable* `Shop: NaplesEstateJewelry.com/p/N` line | **clickable — post carries a full `Shop:` product URL** |
| Publishing quota | queryable (100/24h) | none queryable; owner's daily limit only |

## Architecture

Mirrors `lib/instagram/*` file-for-file: `client` (own fetch wrapper — API
clients are never shared between channels), `auth` (AES-256-GCM at rest under
`FACEBOOK_TOKEN_ENC_KEY`, page-vs-user token detection via the Page-only
`category` field), `store`, `mapping`, `images`, `sync`.

Two things ARE shared, deliberately:

- **Pure caption/lineup helpers** (`sentenceSummary`, `buildSpecLine`,
  `buildHashtags`, `resolveImageLineup`, `buildCardSpecs`) are imported from
  `lib/instagram/mapping` so a copy fix lands on both channels.
- **The rendition/card engine** (`lib/instagram/images` + `card`), with one
  critical boundary: Facebook writes under its own `facebook-renditions/`
  Storage prefix and its own `facebook_posts.rendition_paths` reference column
  (both in the GC scan). Sharing objects would let one channel's re-prepare
  delete files the other still references.

Tables: `facebook_connection` / `facebook_posts` / `facebook_sync_log`
(service-role only, RLS deny-all), from `supabase/facebook-sync.sql`.
`image_selection` and `image_crops` are baked in from day one. Routes:
`/api/admin/facebook/{connect,disconnect,status,settings,preview,images,sync,delete,drip,posts}`.
The crop-suggest endpoint is shared with Instagram (channel-agnostic photo
analysis). Scheduled function `facebook-drip.mts` runs at 14:40/22:40 UTC —
twenty minutes after the Instagram drip so the channels never publish
simultaneously.

## Operator flow

Admin → Settings → **Facebook Posting**: paste a Page token once (Graph API
Explorer → select the app → grant `pages_show_list`, `pages_read_engagement`,
`pages_manage_posts`, `pages_manage_engagement` → switch "User or Page" to the
Page → copy). Per-product: the **Facebook** panel (editor drawer, Actions modal
card, or `/admin/products/[id]/facebook`) mirrors Instagram's — post preview
with the clickable link, lineup editor (max 9 photos + the card), crops,
queue/publish, and a real Remove that deletes the post from Facebook.

The Facebook lineup/crops are stored separately from Instagram's: curating one
never changes the other. Two cross-channel tools bridge that (2026-08-01):
**"Copy setup to Instagram/Facebook"** in each panel's lineup header copies the
saved lineup, crops, card source and background onto the other channel
(`/api/admin/social/copy-curation` — refused when the target post is live, and
the target must be re-Prepared), and **"Publish to both…"** opens a shared
side-by-side review modal (`SocialPublishBothModal`) that publishes Instagram
first (permanent channel — if it fails, nothing has gone out), then Facebook,
reporting per-channel results. API-published Instagram posts are NOT
auto-crossposted by Meta's linked-account sharing, so this never double-posts.

## Post shape (as of 2026-08-01 evening)

```
Available now!

{title}

{spec line — no inventory number}

≈ $X at time of posting (based on $Y/oz {metal} spot).

🇪🇸 {Spanish line}

Shop: https://naplesestatejewelry.com/p/{inventory#}

{CTA — default: "Message us here or shop the full collection online."}

#hashtags
```

Spacing rule: exactly one blank line between every line — uniform rhythm, no
tight clusters (tested).

"Available now!" only while status is available; the spot parenthetical only
for spot-linked prices; /p/ short links only when an inventory number exists
(fallback: full slug URL). No description body — deliberate; the spec line is
the extraction. The generated card carries a matching small price note.

Fail-closed rules are identical to Instagram's: no images → blocked; price
requested but spot data unavailable → blocked. The card leads every post and a
card render failure degrades to photos-only with a warning (never blocks).
Since 2026-08-01 evening the card **replaces its source photo** in the slides
(shared `buildRenditions` — the photo shows full-bleed inside the card, so the
standalone copy was a duplicate); prepared-slide thumbnails click open to a
full-size AdminModal view.

## Not built (parity gaps shared with Instagram)

- `markPostSold()` exists but is not wired to the available→sold transition.
- Out-of-date detection (content_hash stored, nothing compares it).
- Bulk queueing.
- Post-text editing after publish (Facebook allows it; Instagram's flow shape
  was kept instead — delete/re-post or edit by hand on Facebook).
