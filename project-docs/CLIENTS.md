# Clients — Dark Matter Web Services

> Client tracking for Dark Matter Web Services (`darkmatterwebdev.com`).
>
> **Purpose:** a reference roster for current and future clients. Add one section
> per client as you take them on, using the **template at the bottom** of this
> file. The Naples entry below is the first real example.
>
> **NEVER store actual passwords, secret keys, or service-role keys in this
> file.** Record only *where* credentials live (password manager entry name,
> environment variable name, dashboard owner, etc.). The Supabase **anon** key is
> public by design and may appear in the site's client config.

---

## Naples Estate Jewelry & Antiques

| Field | Value |
|-------|-------|
| **Client / business** | Naples Estate Jewelry & Antiques (Naples Antiques LLC) |
| **Primary contact** | Chris — (239) 404-8505 |
| **Primary domain** | `naplesantiquesllc.com` |
| **Related domains** | `naplesjewelrybuyers.com`, `naplesestatejewelry.com` |
| **Hosting** | Netlify (static site + functions) — site name/ID: _TBD_ |
| **GitHub repo** | `https://github.com/DarkMatter-WebDev/NaplesAntiquesLLC.com` (owner: DarkMatter-WebDev) |
| **Netlify site** | _TBD — confirm Netlify team + site slug_ |
| **DNS / registrar** | _TBD_ |
| **Maintenance plan** | _TBD — define scope, cadence, response time_ |
| **Billing status** | _TBD_ |

### Hosting details

- Netlify serves the repo root as a static site (`netlify.toml`:
  `publish = "."`, `functions = "netlify/functions"`).
- Single Netlify Function in use: `metal-prices` (live gold spot price).
- No Netlify environment variables required for the current feature set.

### Third-party services

| Service | Use | Account / dashboard owner | Where credentials live |
|---------|-----|---------------------------|------------------------|
| **Supabase** | Customer auth + data (project ref `evzluixourmsefwdsieu`) | _TBD_ | anon key is public in `scripts/shared/supabase-config.js`; **service-role key** (if any) → store reference only, never in repo |
| **gold-api.com** | Live gold spot price (XAU) | _TBD (public endpoint, no key currently)_ | n/a |
| **MailerLite** | Newsletter (form `I6Xvs6`) | _TBD_ | MailerLite dashboard login → _TBD_ |
| **Jotform** | "Submit Your Item" lead form (id `261379265677068`) — delivery + photo uploads | _TBD (Jotform account owner)_ | Jotform dashboard login → _TBD_; form embedded on `contact.html` |
| **Domain registrar** | DNS for the domains above | _TBD_ | _TBD_ |

### Credential locations (references only)

- Supabase project dashboard login: _TBD (password manager entry)_
- Netlify account login: _TBD_
- MailerLite login: _TBD_
- Domain registrar login: _TBD_
- `.env` / `.env.local` are gitignored and must never be committed.

### Outstanding requests

- Confirm Jotform notification recipient(s) and test an end-to-end submission.
- Confirm production Supabase auth redirect URLs match the live domain.
- Provide/confirm Netlify site name, DNS registrar, and maintenance-plan details
  to complete this record.

### Notes

- Site built and maintained by Dark Matter Web Services; footer credit badge is
  present on every page (theme version `darkmatter-credit-20260601`).
- Local dev on Windows / PowerShell; `git` was not on PATH at last check — confirm
  the deploy workflow (Git push to Netlify vs. manual deploy).

---

## Template — copy for each new client

```
## <Client / business name>

| Field | Value |
|-------|-------|
| **Client / business** | |
| **Primary contact** | |
| **Primary domain** | |
| **Related domains** | |
| **Hosting** | |
| **GitHub repo** | |
| **Netlify site** | |
| **DNS / registrar** | |
| **Maintenance plan** | |
| **Billing status** | |

### Third-party services
| Service | Use | Account owner | Where credentials live (reference only) |
|---------|-----|---------------|------------------------------------------|
| | | | |

### Outstanding requests
-

### Notes
-
```

