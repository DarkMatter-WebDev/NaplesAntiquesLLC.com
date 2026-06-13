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

- **Frontend**: Next.js app in `next-app/` using the App Router, React,
  TypeScript, Tailwind, and `next-intl` for EN/ES routes.
- **Auth + data**: Supabase (Postgres + Auth) for customer accounts, profiles,
  favorites/wishlist behavior, inquiries, admin data, and products. Project ref:
  `evzluixourmsefwdsieu`.
- **Server/API**: Next route handlers for metal pricing and inquiries, deployed
  on Netlify with `@netlify/plugin-nextjs`.
- **Hosting**: Netlify (`base = "next-app"`, publish `.next`).
- **Email / marketing**: Resend-backed inquiry flow in the Next app; older
  MailerLite/static-form notes may remain in legacy docs.
- **Product catalog**: Supabase `products` table, with local image paths under
  `next-app/public/assets` and newer uploaded images via Supabase Storage.
- **Legacy note**: the old root static HTML site and vanilla scripts were
  removed on 2026-06-13. See `LEGACY_REMOVAL_REPORT.md`.

## Deployment Details

- **Host**: Netlify, configured by root `netlify.toml` with
  `base = "next-app"` and `publish = ".next"`.
- **Primary domain**: `naplesestatejewelry.co`
- **Related domains** (listed as `sameAs`): `naplesjewelrybuyers.com`,
  `naplesestatejewelry.com`.
- **Source**: `https://github.com/DarkMatter-WebDev/NaplesAntiquesLLC.com`.
- **Deploy flow**: root `netlify.toml` sets `base = "next-app"`, runs
  `npm run build`, and publishes `.next`.
- See `CLIENTS.md` for hosting/repo/credential reference locations.

## High-Level Summary

A fast, SEO-optimized Next.js site with a luxury "editorial" visual theme. Most
pages are marketing/trust content. The dynamic surfaces are:

- the **shop** (`/shop`, `/shop/[id]`) backed by Supabase products and priced
  live against metal spot,
- **customer accounts** backed by Supabase,
- **admin and inquiries** backed by Supabase/Next route handlers,
- localized EN/ES routes powered by `next-intl`.

The site is built and maintained by **Dark Matter Web Services**
(`darkmatterwebdev.com`); a credit badge appears in the footer of every page.
