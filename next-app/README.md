# Naples Estate Jewelry - Next App

This is the active Next.js App Router application for Naples Estate Jewelry &
Antiques. The parent repository contains project docs, Supabase SQL, and Netlify
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
- Hosting: Netlify, configured from the parent `netlify.toml` with
  `base = "next-app"`

Keep secrets in `.env.local` or deployment environment settings only. Do not
commit service-role keys, email provider keys, or other credentials.
