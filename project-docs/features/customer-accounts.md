# Feature: Customer Accounts (Supabase)

## Summary

Customer accounts support sign-in, editable customer profile/contact/address
details, saved favorites, and cart-related state. Accounts are backed by
Supabase Auth and Postgres. Setup instructions live in `ACCOUNT_SETUP.md`.

## Key Files

- `next-app/src/app/[locale]/account/page.tsx` - account dashboard route.
- `next-app/src/components/account/AccountProfileForm.tsx` - editable profile,
  contact, phone, and complete address form.
- `next-app/src/app/[locale]/account/sign-in/page.tsx` and
  `next-app/src/app/[locale]/account/sign-up/page.tsx` - auth entry points.
- `next-app/src/components/checkout/CheckoutClient.tsx` - checkout prefill from
  saved profile data.
- `next-app/src/lib/supabase/client.ts` and
  `next-app/src/lib/supabase/server.ts` - browser/server Supabase clients.
- `supabase/schema.sql` - tables, triggers, RLS.
- `supabase/profile-contact-fields.sql` - idempotent upgrade for full profile
  contact/address columns.
- `supabase/fix-permissions.sql` - idempotent fixup for grants/columns.

## Data Model

See `ARCHITECTURE.md` -> Data Model. Tables: `profiles`, `customer_carts`, and
`favorites`, all RLS-protected so users only access their own rows. A new user
triggers auto-creation of a profile + empty cart.

`profiles` stores:

- name fields: `first_name`, `last_name`, `full_name`
- contact fields: `email`, `phone`, `alternate_phone`
- address fields: `address_line1`, `address_line2`, `city`, `state`,
  `postal_code`, `country`
- customer flags/preferences: marketing opt-out/consent fields, `is_vip`,
  `is_admin`

## Auth Flow

1. Next/Supabase client config reads `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Sign up sends a confirmation email and stores account consent metadata for
   Terms/Privacy acceptance.
3. Supabase trigger creates `profiles` + `customer_carts` rows.
4. `/account` reads the profile server-side and renders the editable profile
   form.
5. Checkout prefill reads signed-in profile contact data when available.
6. `/account/security` exposes security/account preference surfaces.

## VIP / Private Pricing

`profiles.is_vip` can be set manually in Supabase for future private pricing
flows. `profiles.is_admin` grants access to the admin routes.

## Setup Reminders

- Run `supabase/schema.sql` in the SQL Editor; enable Email auth.
- For existing projects, run `supabase/profile-contact-fields.sql` once.
- Run `supabase/compliance-consent.sql` so Terms/Privacy acceptance metadata can
  persist on profiles.
- Set **Auth -> URL configuration** Site URL + Redirect URLs to match the live
  domain and localhost dev URLs.
- Only the anon key belongs in browser config. Never use a service-role key in
  client code.
