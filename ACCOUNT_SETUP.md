# Supabase Account Setup

The current site is the Next.js app in `next-app/`. Supabase supports:

- customer auth
- profiles
- product catalog/admin data
- inquiries
- wishlist/cart-related state used by the app

## 1. Create or Open the Supabase Project

Project ref: `evzluixourmsefwdsieu`.

In the Supabase SQL Editor, run the relevant scripts in `supabase/`:

- `schema.sql` - account/profile/favorites/cart foundation
- `products.sql` - product table and product policies
- `inquiries.sql` - inquiry table and policies
- `fix-permissions.sql` - idempotent permission/column repair

## 2. Auth URL Configuration

In **Authentication -> URL configuration**:

- Site URL: `https://naplesestatejewelry.co`
- Redirect URLs:
  - `https://naplesestatejewelry.co/**`
  - `http://localhost:3000/**`
  - `http://127.0.0.1:3000/**`

The Next app account routes are:

- `/account/sign-in`
- `/account/sign-up`
- `/account`

## 3. Environment Variables

Local values live in `next-app/.env.local` and must not be committed.

Required public values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
```

Server-only values, if enabled:

```bash
RESEND_API_KEY=
```

Only `NEXT_PUBLIC_*` values are exposed to browser code. Never use a Supabase
service-role key in client code.

## 4. Deploy

Root `netlify.toml` builds from `next-app/`:

```bash
npm run build
```

Set the same environment variables in Netlify. Keep secrets in Netlify's
environment settings, not in repository files.
