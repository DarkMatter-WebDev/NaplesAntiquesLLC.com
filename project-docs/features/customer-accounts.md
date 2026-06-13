# Feature: Customer Accounts (Supabase)

## Summary

Optional customer accounts for sign-in, profile, saved favorites, and a saved
cart that follows the user across devices. Backed by Supabase (Postgres + Auth).
Setup instructions live in the repo root at `ACCOUNT_SETUP.md`.

## Key Files

- `scripts/shared/supabase-config.js` — `window.NAPLES_SUPABASE` (project URL +
  **anon** key). Template: `supabase-config.example.js`.
- `scripts/shared/naples-auth.js` — `window.NaplesAuth` API.
- `scripts/shared/registered-only.js` — gates `[data-registered-*]` content.
- `account.html` + `scripts/account/account-portal.js` — sign in / sign up.
- `account-dashboard.html` + `scripts/account/account-dashboard.js` — profile,
  favorites, saved cart.
- `member-access.html` — example registered-only gated page.
- `supabase/schema.sql` — tables, triggers, RLS. `supabase/fix-permissions.sql` —
  idempotent fixup for grants/columns.

## Data Model

See `ARCHITECTURE.md` → Database Schema. Tables: `profiles`, `customer_carts`,
`favorites`, all RLS-protected so users only access their own rows. A new user
triggers auto-creation of a profile + empty cart.

## `window.NaplesAuth` API

`init`, `isConfigured`, `getClient`, `getSession`, `getProfile`,
`isVip`, `signUp(email, password, fullName)`, `signIn`, `signOut`,
`updateProfile(fields)`, `listFavorites`, `isFavorite(id)`,
`toggleFavorite(id)`, `loadCart`, `saveCart(items)`.

## Auth Flow

1. Config sets URL + anon key → `naples-auth.js` creates the client lazily.
2. Sign up sends a confirmation email (`emailRedirectTo` → `/account.html`).
3. After confirmation, session is established; user routed to the dashboard.
4. Cart merges local → account on sign-in (`ShopCart.syncFromAccount`).

## VIP / Private Pricing

`profiles.is_vip` (set manually in Supabase Table Editor) lets `ShopPricing`
display a product's `privatePriceLabel` instead of the public price.

## Setup Reminders (from `ACCOUNT_SETUP.md`)

- Run `supabase/schema.sql` in the SQL Editor; enable Email auth.
- Set **Auth → URL configuration** Site URL + Redirect URLs to match the live
  domain (and localhost for testing).
- If upgrading an older schema, run `supabase/fix-permissions.sql` once.
- Only the anon key belongs in browser config — never a service-role key.
