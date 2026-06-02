# Project Overview

> **Read this file first** when starting a new session. It is the highest-level
> summary of the project. For the live state of work, read `CURRENT_STATUS.md`.

## Project Purpose

Marketing + commerce website for **Naples Estate Jewelry & Antiques** (legal
entity: *Naples Antiques LLC*). The site does two jobs:

1. **Lead generation** for a private, mobile, appointment-only buying service —
   the owner travels to clients throughout Southwest Florida to evaluate and buy
   estate jewelry, gold, sterling silver, diamonds, watches, antiques, coins, and
   full estates.
2. **Online shop** that sells curated estate jewelry (currently solid-gold chains,
   bracelets, and rings) with live, gold-spot-based pricing.

## Business Goals

- Generate qualified seller leads (people looking to sell jewelry/estates) via
  phone calls, the "Submit Your Item" form, and newsletter signups.
- Build trust and authority (private, discreet, knowledgeable, local) to win
  business against pawn shops and national mail-in buyers.
- Sell estate inventory directly online at fair, transparent, spot-linked prices.
- Capture and retain customers via accounts, saved favorites, and saved carts.
- Rank locally in SEO for estate jewelry / gold / silver / antique buying across
  Naples, Marco Island, Bonita Springs, Estero, Fort Myers, and Cape Coral.

## Target Audience

- **Sellers**: Southwest Florida residents (often retirees / estate executors /
  downsizing families) holding inherited jewelry, gold, silver, or full estates.
- **Buyers**: shoppers looking for solid-gold chains and estate pieces priced
  close to melt value with transparent, live pricing.

Primary persona is affluent, 50+, in the Naples/Fort Myers area, who values
discretion and a personal relationship over a storefront transaction.

## Owner / Contact

- **Owner**: Chris (15+ years experience, born and raised in Naples).
- **Phone / text**: (239) 404-8505
- **Service model**: mobile, appointment-only, no physical storefront.
- **Service area**: Naples, Marco Island, Bonita Springs, Estero, Fort Myers,
  Cape Coral, and nearby Southwest Florida communities.

## Tech Stack

- **Frontend**: Static, multi-page HTML (no SPA framework). Tailwind CSS via CDN
  (`cdn.tailwindcss.com`) with a custom `editorial-tailwind-config.js`, plus
  custom CSS (`editorial-base.css`, `editorial-theme.css`).
- **JavaScript**: Vanilla ES5-style JS in IIFEs under `scripts/`. No build step,
  no bundler for the site itself.
- **Auth + data**: Supabase (Postgres + Auth) for customer accounts, profiles,
  favorites, and saved carts. Project ref: `evzluixourmsefwdsieu`.
- **Serverless**: Netlify Functions (`netlify/functions/metal-prices.js`) for
  live gold spot pricing (bundled with esbuild).
- **Hosting**: Netlify (publish directory = repo root).
- **Email / marketing**: MailerLite (newsletter embed, form id `I6Xvs6`).
- **Item-submission form**: planned Formspree / FormSubmit integration
  (not yet configured — see `TASKS.md`).
- **Product catalog**: defined in code (`scripts/shop/shop-products.js`), NOT in
  a database.
- **Maintenance tooling**: PowerShell scripts (`_sync-editorial.ps1`,
  `_repair-site.ps1`) that re-sync the shared header/theme across all HTML pages.

## Deployment Details

- **Host**: Netlify, configured by `netlify.toml` (publish `.`, functions in
  `netlify/functions`, many legacy-URL redirects for moved assets/scripts).
- **Primary domain**: `naplesantiquesllc.com`
- **Related domains** (listed as `sameAs`): `naplesjewelrybuyers.com`,
  `naplesestatejewelry.com`.
- **Source**: `https://github.com/DarkMatter-WebDev/NaplesAntiquesLLC.com`.
- **Deploy flow**: deploys to Netlify (assumed Git-connected continuous deploy —
  confirm). No Netlify environment variables required for accounts; the only
  function in use is the gold-price function.
- See `CLIENTS.md` for hosting/repo/credential reference locations.

## High-Level Summary

A fast, SEO-optimized static site with a luxury "editorial" visual theme. Most
pages are pure marketing/trust content. The dynamic surfaces are:

- the **shop** (`shop.html` / `product.html`) priced live against gold spot,
- **customer accounts** (`account.html`, `account-dashboard.html`) backed by
  Supabase,
- the **newsletter** (MailerLite) and **item submission** lead form.

The site is built and maintained by **Dark Matter Web Services**
(`darkmatterwebdev.com`); a credit badge appears in the footer of every page.
