# Owner Setup — eBay Sync

> Everything in this file is a **manual step for the owner and/or a
> developer** — none of it can be done by the implementing AI agent (per
> `AGENTS.md`: no git, no live Supabase/Netlify/eBay access). Do these in
> order; each step says what to do and how to confirm it worked.
>
> **Status: FINALIZED (2026-07-09, session 14) — the build is code-complete.**
> `tsc`/`lint`/`build`/`vitest` (238/238 tests) all pass; **no live eBay
> account was available to the build agent**, so nothing below step 1/7 has
> been tested against real eBay infrastructure. Steps that were 🔨
> (blocked on the build) are now unblocked — the code they depend on exists
> at the file paths cited in each step. See
> `project-docs/features/ebay-sync.md` for the full feature writeup and
> every `TODO(ebay-verify)` left in the code, and
> `project-docs/CHANGELOG.md` (2026-07-09, session 14) for why each one was
> left that way.

## 1. ✅ Done (2026-07-09) — Developers Program registration + keysets exist

**Confirmed live in the developer portal:** the app is named **PostnSync**,
registered under the owner's existing eBay account (Q13 — Seller Hub shows
100% feedback, 128 reviews, 4 active listings, "Above Standard" seller
level, real sales in the last 90 days — matches the "existing account with
a few unrelated listings" decision). Both keysets already exist:

- **Sandbox keyset** — present and enabled.
- **Production keyset** — present but, as expected, showing **"Your Keyset
  is currently disabled — Comply with marketplace deletion/account closure
  notification process or apply for an exemption."** This is exactly the
  Q10 gate the plan anticipated. The whole Production panel (including its
  "User Tokens" link, needed for step 6) is inert until step 4–5 below are
  done — confirmed by clicking it and observing no response.

**Nothing left to do here.** Skip to step 2 once the build exists.

**Handle the credentials like passwords.** They go into Netlify env vars
(step 3) and nowhere else — never into chat, files in this folder, or email.

## 2. Run the database migration

`supabase/ebay-sync.sql` is written (4 tables + the claim RPC). Run it in
the Supabase SQL Editor for this project (ref `evzluixourmsefwdsieu`). It is
additive and safe to re-run (same pattern as `supabase/etsy-sync.sql`).

**Verify it worked:**
- Table Editor shows 4 new tables: `ebay_connection`, `ebay_oauth_states`,
  `ebay_listings`, `ebay_sync_log`.
- `select * from ebay_connection;` returns exactly one row (`id = 1`,
  `status = 'disconnected'`).
- `select proname from pg_proc where proname = 'claim_next_pending_ebay_listing';`
  returns one row.

## 3. Set the Netlify environment variables

Netlify site → **Site configuration → Environment variables**. Names only —
values come from the sources below and are never shared elsewhere:

| Variable | Required now? | How to get it |
| --- | --- | --- |
| `EBAY_CLIENT_ID` | **Yes** | Developer portal → Application Keys → production **App ID (Client ID)** |
| `EBAY_CLIENT_SECRET` | **Yes** | Same page → production **Cert ID (Client Secret)** |
| `EBAY_RUNAME` | **Yes** (value exists after step 6) | The production RuName string the portal generates in step 6 — add/update this var then |
| `EBAY_TOKEN_ENC_KEY` | **Yes** | Any random string — the code SHA-256-derives a stable 32-byte AES key from it (same mechanism as `ETSY_TOKEN_ENC_KEY`). Generate: `openssl rand -base64 32`. **Do not reuse a secret from elsewhere.** |
| `EBAY_VERIFICATION_TOKEN` | **Yes** | Any random 32–80 char string using only letters/numbers/`_`/`-` (eBay's rule). Generate: `openssl rand -hex 24`. You will paste this same value into the eBay portal in step 5 — they must match exactly. |
| `EBAY_ENV` | **Yes** | `production` (set `sandbox` only in a local/dev environment with the sandbox keyset) |
| `EBAY_CRON_SECRET` | Only when you want the daily price push running | Any random string (e.g. `openssl rand -hex 24`) — guards the scheduled price-push route, same pattern as `ETSY_CRON_SECRET` |

After setting these, trigger a new Netlify deploy (env changes don't apply
to an already-running deploy).

## 4. Deploy the app with the eBay code

The account-deletion endpoint
(`next-app/src/app/api/webhooks/ebay-account-deletion/route.ts`) must be
live on <https://naplesestatejewelry.co> before step 5 can succeed — eBay
calls it during subscription setup. Deploy after step 3's env vars are set
(the route 503s without `EBAY_VERIFICATION_TOKEN` — see below).

**Verify it worked:**
- `GET https://naplesestatejewelry.co/api/webhooks/ebay-account-deletion`
  (no `challenge_code` query param) returns **HTTP 400** with body
  `{"error":{"code":"missing_challenge_code",...}}` — this proves the route
  is deployed and reachable (a 404 would mean the deploy didn't include it).
- `GET .../ebay-account-deletion?challenge_code=test123` returns **HTTP
  200** with a `challengeResponse` hex string once `EBAY_VERIFICATION_TOKEN`
  is set (503 with `{"error":{"code":"not_configured",...}}` if it isn't
  yet — confirms step 3 took effect).

## 5. Activate the production keyset (marketplace account-deletion subscription)

In the developer portal: **Application Keys → your production App ID →
"Notifications"** (the Alerts & Notifications page). Choose the
**Marketplace Account Deletion** section and enter:

1. An alert email (your business email).
2. Notification endpoint URL:
   `https://naplesestatejewelry.co/api/webhooks/ebay-account-deletion`
3. Verification token: the **exact** `EBAY_VERIFICATION_TOKEN` value from
   step 3.

On save, eBay immediately sends a challenge to the endpoint; if the deploy
(step 4) and token match, it validates. Then click **Send Test
Notification**.

✅ **Done and confirmed live (2026-07-09, session 14).** The GET challenge
validated immediately and auto-enabled the production keyset — that alone
satisfies the compliance gate, "Send Test Notification" is a separate
optional check. "Send Test Notification" also now succeeds (two real bugs
were found and fixed via live debugging: eBay's digest is SHA1 not SHA256,
and its public-key response needs reformatting into a proper multi-line
PEM — see `project-docs/CHANGELOG.md` 2026-07-09 session 14 second
addendum). **One tip for whoever does this next time** (e.g. after a
verification-token rotation): eBay's portal seems to reject a pure
lowercase-hex token (e.g. a raw GUID) with a red/invalid field — a token
with mixed case and more character variety (e.g.
`-join((48..57)+(65..90)+(97..122)|Get-Random -Count 40|%{[char]$_})` in
PowerShell) was accepted without issue.

**Verify it worked:** the portal shows the subscription active and the
keyset **enabled** (confirmed); the test notification shows as delivered
with no failure banner and no errors in Netlify's function logs (confirmed).

## 6. Configure the RuName (OAuth redirect)

✅ **Done (2026-07-09, session 14).** RuName created and OAuth-enabled:
`Christopher_Sur-Christop-PostnS-ubfab`, Display Title "Naples Estate
Jewelry", privacy/accepted/declined URLs set exactly as below. Set
`EBAY_RUNAME=Christopher_Sur-Christop-PostnS-ubfab` in Netlify (not
secret — a public redirect identifier) and redeploy to pick it up.

> Confirmed 2026-07-09: this panel is genuinely locked until step 5 clears
> — don't attempt this early, it won't respond.

Developer portal → Application Keys → click **User Tokens** next to the
production App ID → add a Redirect URL ("RuName"):

- **Display title:** Naples Estate Jewelry (shown on the consent page)
- **Privacy policy URL:** `https://naplesestatejewelry.co/privacy`
- **Your auth accepted URL:**
  `https://naplesestatejewelry.co/api/admin/ebay/callback`
- **Your auth declined URL:**
  `https://naplesestatejewelry.co/admin/settings?ebay=declined`
- Ensure it is **OAuth-enabled** (not the legacy Auth'n'Auth option).

Copy the generated **RuName** string into the `EBAY_RUNAME` Netlify var
(step 3) and redeploy.

**Verify it worked:** the User Tokens page lists the RuName with the URLs
above; `EBAY_RUNAME` is set in Netlify.

## 7. ✅ Done (2026-07-09) — Business Policies created

**Confirmed live at <https://www.ebay.com/bp/manage>** (found via My eBay →
Account → Site Preferences → Business Policies; several guessed
`ebay.com/sh/...` paths 404'd first). The account opted into Business
Policies and all **four** policies exist:

| Policy | Type | Settings |
| --- | --- | --- |
| **NEJ Insured Flat Rate** | Shipping | USPS Priority Mail, flat $15.00 first item / $5.00 each additional, 2 business day handling. Signature confirmation + declared-value insurance are **not** baked into the policy (eBay's business-policy form has no such toggle) — add them manually per shipment at label-print time for genuinely high-value pieces. |
| **NEJ Express High-Value** | Shipping | FedEx 2Day, flat $50.00 first item / $50.00 each additional, **1 business day handling**. New addition (2026-07-09, see [13-open-questions.md](13-open-questions.md) Q16) — our sync code chooses this policy instead of the standard one when the computed eBay price exceeds an admin-editable threshold (seeded $1000). eBay itself has no conditional/price-based policy logic; the choice is made entirely in `lib/ebay/mapping.ts` at offer-creation time. |
| **NEJ 30-Day Returns** | Return | 30 days, buyer pays return shipping, money-back refund (Q8b) — all were the page's own defaults. |
| **NEJ Immediate Payment** | Payment | "Require immediate payment when buyer uses Buy It Now" (Q8c) — checked by default on eBay's form, no offline payment methods added. |

**Verify it worked:** all four appear in Business Policies; when you later
open Settings → eBay Sync in our admin (step 8), the dropdowns list them —
including **two** shipping-policy pickers (standard default + express/
high-value default) and the price threshold field.

Also confirm your account standing while you're in Seller Hub (limits were
already confirmed fine — Q14; this is just a glance at Account health).

## 8. Connect eBay in the site admin and finish in-app setup

✅ **Done and confirmed live (2026-07-09, session 14).** Connected,
all 4 policy dropdowns set (Standard: NEJ Insured Flat Rate, Express: NEJ
Express High-Value, Payment: NEJ Immediate Payment, Return: NEJ 30-Day
Returns), and the inventory location was created successfully via the
settings-panel UI (`merchant_location_key = 'nej-naples-fl'`).

1. Go to **`/admin/settings` → eBay Sync panel → Connect eBay**; approve
   the consent screen on ebay.com (sign in as the selling account). This
   hits `next-app/src/app/api/admin/ebay/connect/route.ts` →
   `.../callback/route.ts`, which calls `completeOauthExchange()`
   (`next-app/src/lib/ebay/auth.ts:106-167`).
2. Back in the panel, pick the default **shipping / payment / return
   policies** (and the new **express shipping policy + high-value
   threshold**, Q16) from the dropdowns and save — populated from
   `GET /api/admin/ebay/account-profiles`.
3. **Out-of-Stock Control program opt-in (Q7) is automatic** — the connect
   flow calls it best-effort right after token exchange
   (`next-app/src/lib/ebay/auth.ts`, the `program/opt_in` call in
   `completeOauthExchange()`). Verify: check "Recent eBay activity" in the
   settings panel, or `sell/account/v1/program/get_opted_in_programs` in
   Seller Hub/API, for `OUT_OF_STOCK_CONTROL`. If it didn't take (e.g. it
   failed silently, which the code allows so a hiccup here never blocks
   connecting), re-trigger by disconnecting and reconnecting, or opt in
   directly in Seller Hub.
4. **Inventory location creation** — a one-time step, not automated at
   connect time (needs the business's real postal code, which isn't stored
   anywhere else in this codebase; guessing one risked submitting wrong
   shipping-origin data to eBay — see `project-docs/DECISIONS.md`
   2026-07-09, session 14). ✅ **A proper UI for this now exists**
   (`next-app/src/app/api/admin/ebay/location/route.ts` +
   `EbaySettingsPanel.tsx`, added same session): in the settings panel,
   under "Inventory location," type your business ZIP code and click
   **Create**. It uses your already-connected session's access token — no
   separate credentials needed. The location key
   (`nej-naples-fl`) is **immutable once set** (eBay rule) — double-check
   the ZIP before clicking Create. Safe to click twice (a repeat is treated
   as a no-op, not an error).

**Verify it worked:** panel shows Connected (username is intentionally
blank — see `project-docs/features/ebay-sync.md` gap #3), a reconnect-by
date ~18 months out, and the selling-limit readout; in Supabase,
`ebay_connection.status = 'connected'` with encrypted (3-part
`iv.tag.ciphertext`) token columns, `merchant_location_key` set (step 4
above), and `ebay_oauth_states` empty.

## 9. Live verification pass

Work through `ebay-sync-plan/14-verification-checklist.md` in order —
Phase 1 items 1–10. Dry-run (`POST /api/admin/ebay/preview`, or the
product drawer's eBay preview) across the decided cases: a spot-priced
chain, a manual-priced item, a ring (check the "Ring Size" aspect), **a
Coin/Bullion item — confirm it shows the clean "not synced to eBay per
owner decision" ineligibility, never an error**, a silverware item, and
**an item priced over $1000 — confirm the preview shows "Shipping: express"
and the "NEJ Express High-Value" policy resolved (Q16)**.

⚠️ **Do not test a vermeil item yet** — pre-flight will correctly block it
("no Fashion Jewelry category id is pinned yet") until you complete the
category-pinning step below. This is expected, not a bug.

**Before publishing any vermeil/plated item**, pin real Fashion Jewelry
category ids. A developer runs, locally (never paste the Client Secret
into chat/files/email — same rule as step 1):

```
EBAY_CLIENT_ID=... EBAY_CLIENT_SECRET=... npm run ebay:pin-fashion-categories
```

(`next-app/scripts/pin-ebay-fashion-categories.mjs` — needs only the
keyset, via a client-credentials application token; no seller OAuth
connection required, so this can be run before step 8's Connect eBay.) It
calls the live Taxonomy API and prints candidate category ids/paths for
each jewelry type — review them (the script itself warns: a suggestion can
be a near-miss, not always the exact leaf), then paste the ones you want
into `EBAY_FASHION_CATEGORY_MAP` in `next-app/src/lib/ebay/mapping.ts` (it
is intentionally empty — see the comment above it) and redeploy. Until
then, vermeil items are safely excluded from eBay, not incorrectly listed.

Then publish **one real cheap item review-first** and eyeball it live on
ebay.com before anything else goes up: photos in order (WebP shows fine —
no transcode needed), title ≤80 chars reads well, aspects shown, condition
"Pre-owned" with the Q5 template text, price = site price × (1 + markup),
and — if it's a high-value item — the shipping section actually shows
FedEx 2Day / 1-business-day handling.

**Note on the account-deletion webhook's signature verification**
(`next-app/src/app/api/webhooks/ebay-account-deletion/route.ts`): the
challenge-echo half (used in step 5 above) is exact and unit-tested. The
POST-notification signature check (`X-EBAY-SIGNATURE` header decoding +
`getPublicKey` response parsing) was written from commonly-documented eBay
Notification API conventions, without a live contract to verify against —
after step 5's "Send Test Notification" succeeds, that IS your live
verification of this path; if it doesn't verify, the header/response
parsing in that file is the first place to check against eBay's real
payload shape.

Note on sandbox: the full sandbox pass in `14-verification-checklist.md` is
a developer-grade activity (test users, sandbox keyset, separate
`EBAY_ENV=sandbox` credentials). It was not run by the build agent (no
sandbox credentials available) — running it first is recommended before
the production smoke test above, but not required; the review-first gate
means nothing goes public without your explicit click either way.

## 10. Optional, later

- **Daily price push:** set `EBAY_CRON_SECRET` (step 3), then have
  something call `POST /api/admin/ebay/price-push` on a schedule with header
  `x-cron-secret: <that value>`. There is no Netlify Scheduled Function
  wired up for this in the repo (the same is true of the Etsy price-push
  route — neither has an in-repo scheduler); use an external scheduler
  (e.g. a free cron service, GitHub Actions on a schedule, or a Netlify
  Scheduled Function you add yourself) hitting that URL daily. Until this
  is set up, spot-priced eBay listings drift from the live market — use
  **"Push prices to eBay now"** in the settings panel (`push-prices` route)
  to push manually in the meantime.
- **Phase 3 (order ingest):** deliberately not built (Q15). Until then, when
  eBay notifies you of a sale, mark the item **sold** in Product Admin —
  with Phase 2 live, that automatically hides it on eBay and delists it on
  Etsy.
