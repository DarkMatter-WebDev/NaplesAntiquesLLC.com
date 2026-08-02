# 04 — OAuth 2.0 + PKCE, Token Storage & Secrets

> Planning only. Names of env vars appear here; **values never do** — all
> working env lives in Netlify (project standing rule).

## Scopes to request

Request the full outbound set up front so Phase 2 needs no re-auth; add
transaction scopes only when Phase 3 is approved (scope changes require the
owner to re-consent):

| Phase | Scopes |
| --- | --- |
| 1–2 (outbound sync) | `listings_r listings_w listings_d shops_r shops_w` |
| 3 (order ingest, optional) | + `transactions_r` (and `transactions_w` only if we ever mark-shipped from our admin — not planned) |

`listings_d` is included from the start because delist/relist and image
replacement can require delete calls; better one consent screen than two.

## Flow (Authorization Code + PKCE)

Actors: owner's browser (signed in as admin) ↔ our Netlify routes ↔ etsy.com.

1. **Start** — owner clicks **Connect Etsy** in `/admin/settings`.
   `GET /api/admin/etsy/connect` (admin-gated):
   - generates `state` (CSRF nonce) and a PKCE `code_verifier`, derives the
     S256 `code_challenge`;
   - stores `{state, code_verifier, admin_user_id, created_at}` in a
     short-lived server-side record (proposed `etsy_oauth_states` table with a
     10-minute TTL — serverless functions share no memory, so it must be in
     the DB, not a module variable);
   - 302-redirects to `https://www.etsy.com/oauth/connect?response_type=code&client_id=<keystring>&redirect_uri=…&scope=…&state=…&code_challenge=…&code_challenge_method=S256`.
2. **Consent** — owner approves on etsy.com (personal app → own account).
3. **Callback** — Etsy redirects to
   `GET /api/admin/etsy/callback?code=…&state=…`:
   - look up + delete the `state` row (single-use); reject unknown/expired;
   - POST `https://api.etsy.com/v3/public/oauth/token` with
     `grant_type=authorization_code`, `client_id`, `redirect_uri`, `code`,
     `code_verifier`;
   - response: `access_token` (~1h, format `{user_id}.{token}`),
     `refresh_token` (~90 days), `expires_in`;
   - resolve the shop: `getMe` → `shop_id` (`shops_r`); store everything in
     the single-row `etsy_connection` table ([08-database-schema.md](08-database-schema.md));
   - redirect back to `/admin/settings?etsy=connected`.
4. **Use** — every Etsy call sends `x-api-key: <keystring>` **and**
   `Authorization: Bearer {user_id}.{access_token}`.

## Token refresh strategy

**Refresh on demand, not on a cron.** Before each Etsy operation the client
(`lib/etsy/auth.ts`) checks `access_token_expires_at`; if within a 2-minute
skew window it POSTs `grant_type=refresh_token` first. Etsy **rotates refresh
tokens** — every refresh response contains a new refresh token that must be
persisted immediately (update-then-use, single row, last-write-wins).

- Concurrency: two Netlify invocations refreshing at once is harmless if we
  tolerate either token briefly (both are valid for a window), but to stay
  safe the refresh does a conditional update (`WHERE refresh_token = <old>`);
  the loser re-reads the row and uses the winner's tokens.
- **90-day idle expiry:** the refresh token dies if unused ~90 days. The
  Phase 2 daily price push keeps it warm as a side effect. Until then, if a
  call fails with an invalid-grant error, mark the connection
  `status='needs_reauth'` and surface a prominent **Reconnect Etsy** banner in
  admin ([07-admin-ux.md](07-admin-ux.md)). No silent retry loops.

## Where tokens live (decision + trade-offs)

**Recommended: Supabase table `etsy_connection`, service-role access only,
RLS enabled with no policies (deny-all to anon/authenticated), tokens
encrypted at the app layer with a key from env (`ETSY_TOKEN_ENC_KEY`,
AES-256-GCM).**

| Option | Verdict |
| --- | --- |
| Netlify env vars | ❌ Tokens rotate hourly/every-refresh; env is not writable at runtime. Only static credentials belong there. |
| Supabase table, plaintext, service-role-only | Acceptable floor — matches how the app already trusts service-role for `webhook_events` etc. |
| Supabase table + app-layer encryption (recommended) | Cheap defense-in-depth: a leaked DB dump/backup doesn't yield usable tokens without the Netlify-held key. Small code cost in `auth.ts`. |
| Supabase Vault | Fine too, but adds an extension dependency for one row; app-layer crypto keeps the pattern portable. |

The Etsy **keystring and shared secret are static app credentials** → Netlify
env only, never in the DB, never in the browser, never in git (`.env.local`
stays gitignored and is known-stale anyway).

## Environment variables (names only)

| Name | Purpose |
| --- | --- |
| `ETSY_API_KEY` | App keystring (also the OAuth `client_id`; sent as `x-api-key`) |
| `ETSY_SHARED_SECRET` | App shared secret (used where Etsy requires it, e.g. webhook signature verification in Phase 3) |
| `ETSY_TOKEN_ENC_KEY` | 32-byte key for AES-GCM encryption of stored tokens |
| `ETSY_REDIRECT_URI` | Explicit callback URL (avoids host-header guessing on Netlify) |
| `ETSY_WEBHOOK_SECRET` | Phase 3 only, if Etsy webhook registration issues a distinct signing secret |

Server-only (no `NEXT_PUBLIC_*` — same rule as the PayPal client id, which is
passed from the server page, not exposed as a public var).

## Redirect URIs to register on the Etsy app

- `https://naplesestatejewelry.co/api/admin/etsy/callback` (production)
- `http://localhost:3002/api/admin/etsy/callback` (local dev — port per
  project dev-server convention)
- Optionally the Netlify deploy-preview pattern is **not** registrable
  (wildcards not allowed); test OAuth against production or localhost only.

## Re-auth triggers

| Event | Handling |
| --- | --- |
| Scope set changes (Phase 3 adds `transactions_r`) | New consent required: admin sees "Reconnect to enable order sync" action; old tokens revoked/replaced on success. |
| `invalid_grant` on refresh (expired/revoked) | `status='needs_reauth'` + admin banner. |
| Owner clicks **Disconnect** | Delete token row (Etsy has no token-revocation endpoint to call; document that the grant can also be removed at etsy.com → Security → Apps). Listings on Etsy are left untouched. |
| Etsy app credentials rotated | Update Netlify env; existing user tokens continue to work (they're bound to the app, verify after rotation). |

## Hard rules

- No secrets in this repo, in `etsy-sync-plan/`, in `project-docs/`, or in
  logs (`etsy_sync_log` stores error messages — the client must redact
  `Authorization` headers and token payloads from anything it logs).
- Callback and connect routes are admin-gated *and* CSRF-protected via
  `state`; the callback additionally verifies the state row was created by an
  admin session.
