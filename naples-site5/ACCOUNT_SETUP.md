# Customer Accounts Setup

This setup keeps listings in the site files and only adds customer account data:

- sign in / create account
- customer profile
- saved favorites
- cart saved to the customer's account
- registered-user-only pages

There is no Shopify, no AI listing backend, and no admin product dashboard.

## 1. Create Supabase Project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**.
3. Run `supabase/schema.sql`.
4. In **Authentication -> Providers**, enable Email.

## 2. Add Browser Config

Open `supabase-config.js` and fill in:

```js
window.NAPLES_SUPABASE = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY'
};
```

The anon key is intended for browser apps. Do not put a service-role key in this file.

## 3. Deploy

Upload/deploy the site to Netlify after editing `supabase-config.js`.

No Netlify environment variables are required for accounts. The only Netlify Function still used is the live gold price function.

## 4. Customer Pages

- `account.html` — sign in, create account, profile, saved favorites, saved cart
- `member-access.html` — example registered-user-only page

Any future registered-only page can use:

```html
<div data-registered-gate>
  <p data-registered-message></p>
  <a href="account.html">Sign in</a>
</div>

<section data-registered-content hidden>
  Private content here.
</section>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
<script src="supabase-config.js"></script>
<script src="naples-auth.js"></script>
<script src="registered-only.js"></script>
```

## 5. Saved Cart Behavior

If the visitor is signed out:

- cart saves locally in the browser

If the visitor signs in:

- local cart merges with their Supabase cart
- future cart changes save to Supabase
- cart restores when they return on another visit/device

## 6. VIP Flag

The schema includes `profiles.is_vip` for later. You can set it manually in Supabase Table Editor when you want private/member-only behavior.
