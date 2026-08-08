# Naples Estate Jewelry - Next App

This is the active Next.js App Router application for Naples Estate Jewelry.
The parent project folder contains project docs, Supabase SQL, and Netlify
configuration; runtime app code lives here.

## Development

```bash
npm install
npm run dev
```

Local preview normally runs at:

```text
http://127.0.0.1:3000
```

### Windows + OneDrive: `.next`/`node_modules` are local junctions, not real folders here

This project folder lives inside OneDrive sync. Turbopack's dev cache
(`.next/dev/cache/turbopack`) corrupts if OneDrive locks it mid-write, which
used to cause sticky 500s requiring a manual `.next` delete. On this machine,
`next-app/.next` and `next-app/node_modules` are **NTFS directory junctions**
pointing at `%LOCALAPPDATA%\dev-cache\NaplesEstateJewelry\next-app\` (outside
OneDrive's synced tree), with a small `predev` script
(`scripts/dev-cache-guard.mjs`) that auto-clears an obviously-corrupted cache
before each `npm run dev`. If they look empty in File Explorer, that's
expected — don't delete the junctions. See `project-docs/DECISIONS.md`
(2026-07-07, "Relocate the Turbopack dev cache off OneDrive") for the full
rationale and how to reproduce this setup on another machine.

### Testing from another device (phone/tablet on the same Wi-Fi)

`next dev` already binds to all network interfaces, and `next.config.ts` lists
this machine's LAN IP in `allowedDevOrigins` (required — Next.js otherwise
blocks cross-origin dev asset/HMR requests, which breaks the page when loaded
from anything other than `localhost`). The dev server prints both URLs on
startup:

```text
- Local:    http://localhost:3000
- Network:  http://192.168.x.x:3000
```

Open the `Network` URL on a phone/tablet connected to the same Wi-Fi. If it
doesn't load, check:

- Windows Firewall may prompt "Allow Node.js to communicate on private
  networks" the first time — allow it (Private profile is enough).
- If your LAN IP changed (DHCP), update/add it in `allowedDevOrigins` in
  `next.config.ts` and restart `next dev`.
- Plain `http://<LAN-IP>:3000` is **not** a secure context, so the AI listing
  assistant's microphone (Web Speech API) won't be grantable there — only
  `localhost` gets a secure-context exemption over HTTP. To test mic/camera
  features from another device, either run `next dev --experimental-https`
  (self-signed cert; browsers will show a one-time warning to click through)
  or use Netlify Dev's live tunnel below, which is HTTPS by default.

### Testing via a public HTTPS tunnel (Netlify Dev)

To test from any device — including over cellular data, not just the same
Wi-Fi — or to exercise the real `netlify.toml` redirects/headers locally
without deploying, use Netlify Dev's live-share tunnel:

```bash
npx netlify-cli login    # one-time
npx netlify-cli link     # one-time, from the repo root — links to the live site
npx netlify-cli dev --live
```

Run this from the repository root (not `next-app/`) so it picks up
`../netlify.toml`'s `base = "next-app"`. It prints a public
`https://<name>--<site>.netlify.live` URL that proxies to your local dev
server — real HTTPS (mic/camera work), shareable with anyone while the
session is open, and nothing is deployed or published.

## Verification

Run from this directory after TypeScript, React, route, config, or schema-contract
changes:

```bash
npm run lint
npm run build
```

## Project Memory

Read the parent project docs before making changes:

```text
../project-docs/PROJECT_OVERVIEW.md
../project-docs/CURRENT_STATUS.md
../project-docs/TASKS.md
../project-docs/DECISIONS.md
```

See `../AGENTS.md` and `../project-docs/README.md` for the full agent workflow.

## Data And Services

- Supabase project ref: `evzluixourmsefwdsieu`
- Product catalog: Supabase `products`
- Product uploads: Supabase Storage bucket `product-images`
- Public assets: `public/assets`
- Payments: PayPal (JS SDK + Orders API v2) on `/checkout`; see
  `../project-docs/features/paypal-checkout.md`
- Hosting: Netlify, configured from the parent `netlify.toml` with
  `base = "next-app"`

Keep secrets in `.env.local` or deployment environment settings only. Do not
commit service-role keys, email provider keys, PayPal secrets, or other
credentials.
