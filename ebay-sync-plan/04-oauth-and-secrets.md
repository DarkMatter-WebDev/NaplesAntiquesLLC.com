# 04 — OAuth 2.0 (Authorization Code), Token Storage & Secrets

> Planning only. Names of env vars appear here; **values never do** — all
> working env lives in Netlify (project standing rule). eBay OAuth reference:
> `developer.ebay.com/api-docs/static/oauth-tokens.html` and siblings.

## How eBay OAuth differs from Etsy's (summary)

| Aspect | Etsy (shipped) | eBay (this plan) |
| --- | --- | --- |
| Grant | Authorization code + **PKCE** | Authorization code, **no PKCE** — eBay requires HTTP Basic (`client_id:client_secret`) on every token call, i.e. a confidential client; exchange must be server-side (it already is in our architecture) |
| Redirect | raw registered URI | **RuName** — an eBay-generated identifier that *wraps* the real callback URL (configured in the dev portal); `redirect_uri=<RuName>` in requests |
| Access token | ~1h | **2h** (`expires_in: 7200`) |
| Refresh token | rotates every refresh; ~90-day idle expiry | **non-rotating**; hard expiry **~18 months** (`refresh_token_expires_in: 47304000`); no idle-death |
| Refresh race | conditional-update rotation guard needed | not a rotation race — but a **single-flight guard** still wanted (eBay caps token-minting calls per day) |
| Re-consent | on scope change / 90-day lapse | on scope growth, password/username change, user revocation, or the 18-month expiry |

## Scopes to request

Request the full outbound set up front so Phase 2 needs no re-auth; add the
fulfillment scope only when Phase 3 is approved (scope growth requires
re-consent — a refresh can only carry equal-or-subset scopes):

| Phase | Scope URLs |
| --- | --- |
| 1–2 (outbound sync) | `https://api.ebay.com/oauth/api_scope` (base) · `https://api.ebay.com/oauth/api_scope/sell.inventory` · `https://api.ebay.com/oauth/api_scope/sell.account` |
| 3 (order ingest, optional) | + `https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly` (read-only suffices — we never mark-shipped from our admin) |

Notes: scope URLs use the `api.ebay.com` host **even in sandbox**. Taxonomy /
Metadata reads work with an **application token** (client-credentials, base
scope) — the client mints and caches one for those calls rather than
consuming user-token capacity. Scopes must also be enabled on the keyset
(Developer Portal → Application Keys).

## Flow (Authorization Code, server-side)

Actors: owner's browser (signed in as admin) ↔ our Netlify routes ↔ ebay.com.

1. **Start** — owner clicks **Connect eBay** in `/admin/settings`.
   `GET /api/admin/ebay/connect` (admin-gated):
   - generates `state` (CSRF nonce) and stores
     `{state, admin_user_id, created_at}` in `ebay_oauth_states`
     (10-min TTL, single-use — same table pattern as `etsy_oauth_states`,
     minus the PKCE verifier);
   - 302-redirects to
     `https://auth.ebay.com/oauth2/authorize?client_id=<EBAY_CLIENT_ID>&redirect_uri=<EBAY_RUNAME>&response_type=code&scope=<url-encoded space-separated scopes>&state=<state>`.
2. **Consent** — owner approves on ebay.com (their own seller account).
3. **Callback** — eBay redirects to the RuName's configured "auth accepted
   URL" (our `GET /api/admin/ebay/callback?code=…&state=…&expires_in=…`):
   - look up + delete the `state` row (single-use); reject unknown/expired;
   - the `code` is **single-use and expires in ~299 seconds** — exchange
     immediately, never persist it:
     `POST https://api.ebay.com/identity/v1/oauth2/token` with headers
     `Authorization: Basic base64(client_id:client_secret)`,
     `Content-Type: application/x-www-form-urlencoded`, body
     `grant_type=authorization_code&code=…&redirect_uri=<EBAY_RUNAME>`;
   - response: `access_token` (7200s), `refresh_token`
     (`refresh_token_expires_in` ≈ 47,304,000s ≈ 18 months),
     `token_type: "User Access Token"`;
   - resolve identity for the admin panel: `getPrivileges` (Account API)
     confirms the token works and returns selling-limit info in the same
     call; store everything in the single-row `ebay_connection` table
     ([08-database-schema.md](08-database-schema.md));
   - redirect back to `/admin/settings?ebay=connected`.
4. **Use** — every eBay call sends `Authorization: Bearer <access_token>`
   (no Etsy-style composite `x-api-key` header exists here).

## Token refresh strategy

**Refresh on demand, not on a cron.** Before each eBay operation the client
checks `access_token_expires_at`; if within a 2-minute skew window it POSTs
`grant_type=refresh_token&refresh_token=…&scope=<same scope list>` first.

- **No rotation:** the response contains a new `access_token` only; the
  stored refresh token stays valid. Persist the new access token + expiry.
- **Single-flight guard:** eBay caps token-minting per app per day
  (refresh-token grant: 50,000/day — huge, but the guard also prevents
  thundering-herd refreshes from concurrent invocations). A cheap conditional
  update (`WHERE access_token_expires_at = <old>`) makes the second
  concurrent refresher a no-op reader — simpler than the Etsy rotation
  guard, kept for the same reason.
- **18-month hard expiry:** store `refresh_token_expires_at`. The admin
  status panel shows a countdown and the client surfaces a **Reconnect eBay**
  banner starting ~30 days out. Re-consent is the only renewal path.
- **Revocation triggers:** eBay kills all refresh tokens if the seller
  changes their eBay password or username, or revokes the app from My eBay.
  A refresh failing with `invalid_grant` marks the connection
  `status='needs_reauth'` + banner. No silent retry loops (Etsy rule kept).

## Where tokens live

**Same decision as the Etsy build, reusing its exact mechanism:** Supabase
single-row table `ebay_connection`, service-role access only, RLS enabled
with no policies, tokens encrypted at the app layer with AES-256-GCM using a
key derived (SHA-256) from `EBAY_TOKEN_ENC_KEY` — the identical
`encrypt/decrypt` helpers as `etsy/auth.ts` (extract to a tiny shared util or
copy; decide at build time, favor whichever keeps `lib/etsy/` untouched).

The eBay **Client ID (App ID) and Cert ID (Client Secret) are static app
credentials** → Netlify env only, never in the DB, never in the browser,
never in git. The Cert ID is resettable in the dev portal if compromised.

## Environment variables (names only)

| Name | Purpose |
| --- | --- |
| `EBAY_CLIENT_ID` | App ID / OAuth `client_id` (production keyset) |
| `EBAY_CLIENT_SECRET` | Cert ID / OAuth `client_secret` (Basic auth on token calls) |
| `EBAY_RUNAME` | The production RuName (sent as `redirect_uri`) |
| `EBAY_TOKEN_ENC_KEY` | Key material for AES-GCM encryption of stored tokens (any strong random string; SHA-256-derived, same as `ETSY_TOKEN_ENC_KEY`) |
| `EBAY_VERIFICATION_TOKEN` | 32–80 char token for the marketplace account-deletion endpoint challenge ([15-compliance.md](15-compliance.md)) |
| `EBAY_CRON_SECRET` | Guards the scheduled price-push (and Phase 3 order-poll) routes, mirroring `ETSY_CRON_SECRET` |
| `EBAY_ENV` | `production` \| `sandbox` — switches API hosts + auth host (sandbox uses a separate keyset/RuName; set the sandbox values in a dev env only) |

Server-only (no `NEXT_PUBLIC_*`). Sandbox note: sandbox has its **own**
keyset, Cert ID, and RuName — never mix environments (classic
`invalid_request` failure mode).

## RuName registration (replaces Etsy's redirect-URI step)

In the eBay Developer Portal (Application Keys → **User Tokens** next to the
Client ID → add a Redirect URL):

- Display title (shown on the consent page), privacy policy URL
  (`https://naplesestatejewelry.co/privacy`),
- **Auth accepted URL:** `https://naplesestatejewelry.co/api/admin/ebay/callback`
- **Auth declined URL:** `https://naplesestatejewelry.co/admin/settings?ebay=declined`
- The generated RuName string goes into `EBAY_RUNAME`. Repeat separately on
  the sandbox keyset with localhost/sandbox URLs if sandbox OAuth testing is
  wanted (`http://localhost:3002/api/admin/ebay/callback` — verify eBay
  accepts non-HTTPS localhost accepted-URLs at build time; if not, sandbox
  testing runs through a deployed preview or production host).

## Re-auth triggers

| Event | Handling |
| --- | --- |
| Scope set grows (Phase 3 adds `sell.fulfillment.readonly`) | New consent required: admin sees "Reconnect to enable order sync"; tokens replaced on success. |
| `invalid_grant` on refresh (revoked / password change / expired) | `status='needs_reauth'` + admin banner (mirrored on Product Admin, same as Etsy). |
| 18-month refresh-token expiry approaching | Countdown in settings panel; banner at ≤30 days; reconnect = plain re-consent. |
| Owner clicks **Disconnect** | Delete token row. eBay has no OAuth revoke endpoint — document that the grant can also be removed at ebay.com → Account → third-party app permissions. Listings on eBay are left untouched. |
| Keyset credentials rotated (Cert ID reset) | Update Netlify env; existing user tokens are expected to survive a Cert ID reset (`TODO(ebay-verify)` at build time — verify, and re-consent if not). |

## Hard rules

- No secrets in this repo, in `ebay-sync-plan/`, in `project-docs/`, or in
  logs (`ebay_sync_log` stores error messages — the client must redact
  `Authorization` headers and token payloads from anything it logs; same
  allowlist-detail rule as the Etsy client).
- Connect and callback routes are admin-gated *and* CSRF-protected via
  `state`; the callback additionally verifies the state row was created by an
  admin session.
- The authorization `code` is never logged or stored.
