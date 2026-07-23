# Owner Setup — Etsy Sync

> Everything in this file is a **manual step for the owner and/or a
> developer** — none of it was done by the implementing AI agent (per
> `AGENTS.md`: no git, no live Supabase/Netlify/Etsy access). Do these in
> order; each step says exactly what to run/click and how to confirm it
> worked. Background/what-was-built lives in
> `project-docs/features/etsy-sync.md`; this file is the checklist.

## 1. ✅ Done (2026-07-08) — database migration ran successfully

Run `supabase/etsy-sync.sql` in the Supabase SQL Editor for this project
(ref `evzluixourmsefwdsieu`). It is additive and safe to re-run. **Owner
confirmed all 5 tables created successfully** (after one fix along the way —
`products.id` turned out to be `text`, not `uuid`; see
`project-docs/CHANGELOG.md` 2026-07-08 "final").

**Verify it worked:**
- The Table Editor shows 5 new tables: `etsy_connection`, `etsy_oauth_states`,
  `etsy_listings`, `etsy_listing_images`, `etsy_sync_log`.
- `select * from etsy_connection;` returns exactly one row (`id = 1`,
  `status = 'disconnected'`).
- `select proname from pg_proc where proname = 'claim_next_pending_etsy_listing';`
  returns one row.

## 2. Set the Netlify environment variables

Netlify site → **Site configuration → Environment variables**. Names only —
values are generated below, never shared elsewhere:

| Variable | Required now? | How to get it |
| --- | --- | --- |
| `ETSY_API_KEY` | **Yes** | Etsy Developer dashboard → your app (`naples-estate-jewelry-sync`) → Keystring. Also sent as the OAuth `client_id`. |
| `ETSY_SHARED_SECRET` | **Yes** (updated 2026-07-08 — every API call needs it, not just Phase 3) | Same app page → Shared secret. **Every Etsy API call sends `x-api-key: <keystring>:<shared secret>`** — confirmed from the spec's own `securitySchemes` description after an earlier build attempt used the keystring alone and got `"Shared secret is required in x-api-key header"` on every call. See `project-docs/CHANGELOG.md` 2026-07-08 (even later). |
| `ETSY_TOKEN_ENC_KEY` | **Yes** | Any random string works — the code SHA-256-hashes it to a stable 32-byte AES key. Generate one with: `openssl rand -base64 32` (or any password generator). **Do not reuse a secret from elsewhere.** |
| `ETSY_REDIRECT_URI` | **Yes** | The exact callback URL — see step 3. Must match one of the redirect URIs registered on the Etsy app exactly (scheme, host, path). |
| `ETSY_WEBHOOK_SECRET` | No (Phase 3 only) | Not used — Phase 3 (order webhooks) was not built. |
| `ETSY_CRON_SECRET` | Only if you want the daily price push running | Any random string (e.g. `openssl rand -hex 24`). See step 7. |
| `ETSY_SYNC_BRACELET_LENGTH` | **No longer needed — length is now ON by default** | **Confirmed working live 2026-07-08** (session 8), generalized (session 9) to every length-bearing category (Necklace, Bracelet, Pendant, Charm, Earrings, Brooch, Cufflinks, Watch, Coin, Bullion, Silverware — not Ring, see below). As of session 9 the owner asked for length to auto-push, so **the code now pushes wearable length on every sync without any env var set** — the computed value to be pushed is shown in each product's dry-run preview (the old separate "Test Length" button was removed, session 9 ninth addendum). You only need this variable if you ever want to TURN IT OFF: set it to exactly `false`. (The old `true` value still means on, so an existing setting is harmless.) The name still says "Bracelet" but covers all the categories above. See `project-docs/CHANGELOG.md` 2026-07-08 (sessions 7-9). |
| `ETSY_SYNC_RING_SIZE` | **No longer needed — ring size is now ON by default** | **Confirmed working live 2026-07-08** (session 9) — a real enumerated size chart (e.g. "10 1/2"), not a placeholder. As of session 9 the owner asked for ring size to auto-push (same as length), so **the code now pushes ring size on every Ring sync without any env var set** — the computed size to be pushed is shown in each Ring's dry-run preview (the old separate "Test Ring Size" button was removed, session 9 ninth addendum). You only need this variable if you ever want to TURN IT OFF: set it to exactly `false`. (The old `true` value still means on, so an existing setting is harmless.) See `project-docs/CHANGELOG.md` 2026-07-08 (session 9, addendum + eighth + ninth addenda). |

After setting these, trigger a new Netlify deploy (env var changes don't apply
to an already-running deploy).

## 3. Register the redirect URI(s) on the Etsy app

In the Etsy Developer dashboard for `naples-estate-jewelry-sync`, add:

- Production: `https://naplesestatejewelry.co/api/admin/etsy/callback`
- Local dev (optional, if testing OAuth from a dev machine):
  `http://localhost:3002/api/admin/etsy/callback`

Set `ETSY_REDIRECT_URI` (step 2) to whichever one you're actually using for
that environment — it must match exactly.

## 4. Etsy shop setup (in the Etsy seller UI, not this app)

Complete these on etsy.com before connecting:

1. Finish Etsy's own shop onboarding (billing/payments) if not already done.
2. Create a **shipping profile** mirroring the site's `/shipping` page
   (carrier, price, handling time; consider insured shipping given the
   catalog includes gold).
3. Create a **return policy** mirroring the site's `/returns-refunds` page.
4. Set a **processing time / readiness** profile.
5. **Confirm "Domestic & Global Pricing" is OFF** (Shop Manager → Finances or
   Settings → Options, wording varies) — a single USD price per listing. The
   app pauses price pushes and warns if it ever detects this turned on
   (known Etsy API hazard, GitHub issue #977).

## 5. Connect Etsy

1. Sign in as the admin account, go to `/admin/settings`.
2. Under **Etsy Sync**, click **Connect Etsy** and approve the consent screen.
3. You should land back on `/admin/settings?etsy=connected` with the shop
   name showing "Connected · auto-renews".
4. Pick the **shipping profile**, **return policy**, and **readiness state**
   from the dropdowns (populated by reading your shop's real Etsy data) and
   confirm they save (a "Saved." toast, and they persist on reload).
   - The readiness-state dropdown reads
     `getShopReadinessStateDefinitions` (path confirmed correct against the
     full spec 2026-07-08). If it's empty, that means the shop has no
     processing profiles yet — create one on Etsy (Shop Manager → Settings
     → Options) and reload.

## 6. ✅ Done (2026-07-08) — Etsy taxonomy IDs are pinned; optional owner review

Real leaf IDs were fetched live (`GET
https://openapi.etsy.com/v3/application/seller-taxonomy/nodes`, 3065 nodes)
and pinned in `next-app/src/lib/etsy/mapping.ts`'s `ETSY_TAXONOMY_MAP`. This
was the item that blocked every product at pre-flight — it no longer does.

**Seven of twelve are exact matches** (Bracelet, Brooch, Cufflinks, Coin,
Silverware, Pendant, and Necklace). **Five are marked `approximate: true`**
because Etsy has no generic/plain leaf for that product type — the code
picked the closest reasonable bucket and flags it (non-blocking) in the
dry-run preview:

| Product type | Pinned category | Why it's approximate |
| --- | --- | --- |
| Ring | Jewelry > Rings > Statement Rings | No plain "ring" leaf exists |
| Charm | Jewelry > Necklaces > Charm Necklaces | No standalone finished-charm leaf (Etsy's "Charms" is a craft-supply category) |
| Earrings | Jewelry > Earrings > Stud Earrings | No plain "earrings" leaf; Stud is the most common style |
| Watch | Jewelry > Watches > Wrist Watches > Unisex Wrist Watches | No gender-neutral default at the top level |
| Bullion | Art & Collectibles > Collectibles > Coins & Money | No dedicated bullion/bar/ingot category exists anywhere in Etsy's taxonomy — reuses the Coin category |

**Optional:** if actual sales data suggests a better fit for any
`approximate` row (e.g. most rings are solitaires, not statement pieces),
edit the `taxonomyId`/`path` directly in `ETSY_TAXONOMY_MAP` and redeploy —
no other code changes needed.

**Still optional, not a blocker:** call
`GET /v3/application/seller-taxonomy/nodes/{taxonomy_id}/properties` for each
pinned leaf to wire best-effort structured properties (length, ring size,
metal) — currently skipped entirely (logged, never fails a sync) since no
property/scale IDs are pinned yet.

## 7. Verify (and optionally correct) the two remaining unconfirmed spec details

**Updated 2026-07-08:** a full local copy of the OpenAPI spec resolved two of
the original four unconfirmed items (the readiness-state endpoint path was
confirmed correct, and there is confirmed to be no rank-only image reorder
endpoint — see `project-docs/CHANGELOG.md` 2026-07-08 "even later"). Two
genuinely aren't documented anywhere in the machine-readable spec:

| Item | Where pinned | How to verify |
| --- | --- | --- |
| Image upload size/format caps | `next-app/src/lib/etsy/images.ts` (`MAX_UPLOAD_BYTES`, 20MB placeholder) | Try uploading a real image via the sync flow (step 8 below) and see if Etsy ever rejects on size; check Etsy's current seller-help docs for the documented cap (not in the OpenAPI spec). |
| Rate-limit response header names | `next-app/src/lib/etsy/client.ts` (`redactHeadersForLog`, guesses `x-limit-per-second` etc.) | After a few real API calls, check `etsy_sync_log.detail` / Netlify function logs for whatever headers Etsy actually sent back; update the allowlist if the names differ. |

## 8. First live verification pass

Work through `etsy-sync-plan/14-verification-checklist.md`'s **"Phase 1
verification"** section (11 items, stop at the first failure) in order:
OAuth round-trip → token refresh → defaults save → dry-run vs. reality on 5
varied products → first real draft publish → idempotency (click Sync again,
expect zero duplicates) → resume after an interrupted image sync → update
path (title/price/photo swap) → delist/relist → error paths (no-image
product blocked, disconnect banner, bogus price) → `npm run build` +
`npm run lint` clean (already true as of this build).

**Before activating any real listing publicly**, also check
`14-verification-checklist.md`'s "First LIVE listing checklist" (owner
reviews the draft, shipping/return policy are real, price sanity, vintage
claim is honest, trademark attribution present).

Then, once comfortable, the **Phase 2 verification highlights** in the same
file: a full supervised "Sync All to Etsy", a real PayPal sale auto-delisting
the Etsy listing, and the price push observed pushing on a >1% spot move /
skipping on a quiet day.

## 9. Wire the daily price push trigger (Phase 2, optional)

The route `POST /api/admin/etsy/price-push` (header `x-cron-secret` matching
`ETSY_CRON_SECRET`) runs the scheduled price push — it exists but nothing
calls it on a schedule yet. Pick one:

- **Simplest:** any external cron service (GitHub Actions scheduled
  workflow, cron-job.org, etc.) doing a daily
  `curl -X POST -H "x-cron-secret: <value>" https://naplesestatejewelry.co/api/admin/etsy/price-push`.
- **Netlify-native:** add a small Netlify Scheduled Function
  (`netlify/functions/etsy-price-push-cron.ts`, `export const config = { schedule: '@daily' }`)
  that just does the same `fetch` call. Not built in this pass — introducing
  a new Netlify Functions deployment target felt riskier to ship untested
  than documenting the option.

Also turn on **"Daily scheduled price push"** in `/admin/settings` → Etsy
Sync (it defaults off) once you're ready, and set the push threshold %.

## Reference: what "done" means here

Every item above that isn't checked off is genuinely not done. **Updated
2026-07-08:** the database migration ran successfully, and the owner
connected their real Etsy shop from `/admin/settings` — the full OAuth
round-trip (PKCE, code exchange, shop resolution, encrypted token storage,
single-use state cleanup) is now **verified live** against real Supabase
data, not just passing unit tests. See
`etsy-sync-plan/14-verification-checklist.md` item 1 (checked off) and
`project-docs/CURRENT_STATUS.md` "milestone" entry for the exact evidence.

Still **not** exercised live: token refresh (item 2), shop defaults save
(item 3), dry-run preview against real products (item 4), and — the big
one — any real draft/image/inventory write to Etsy (items 5+). Those are
next. This build is code-complete (passes `npx tsc --noEmit`, `npm run
lint`, `npm run build`, and 52 unit tests), but don't mark any
live-verification checklist item done without actually doing it.
