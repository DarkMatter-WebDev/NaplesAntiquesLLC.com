# AGENTS.md

This project uses a persistent Markdown memory system in **`project-docs/`**.

## At the start of every session

Read these first and summarize the current state before making changes:

1. `project-docs/PROJECT_OVERVIEW.md` (read first)
2. `project-docs/CURRENT_STATUS.md`
3. `project-docs/TASKS.md`
4. `project-docs/DECISIONS.md`

See `project-docs/README.md` for the full index and conventions.

## Build structure & integrity (keep the site consistent over time)

- `project-docs/STRUCTURE.md` — canonical repo map, single-sources-of-truth, and
  the structural **invariants** that must not be broken.
- `project-docs/INTEGRITY.md` — concrete integrity rules + the pre-publish
  checklist.
- `project-docs/features/shop-listings.md` — product schema + the step-by-step
  runbook for adding a listing.

Run the dependency-free guardrail after any listing/structural/script change
(no npm install needed):

```bash
node tools/check-integrity.mjs
```

It exits non-zero if a product is malformed, an image is missing, EN/ES shop
cards drift apart, or a Spanish page uses a relative path.

## Before ending a session

Keep the memory current — never leave project state undocumented:

- Update `project-docs/CURRENT_STATUS.md` and `project-docs/TASKS.md`.
- Record decisions in `project-docs/DECISIONS.md`.
- Add meaningful changes to `project-docs/CHANGELOG.md`.
- Update `project-docs/ARCHITECTURE.md` if architecture changed.
- Update `project-docs/CLIENTS.md` / `project-docs/features/` as relevant.

## Hard rules

- Never commit secrets. Record only *where* credentials live, never the values.
  `.env` / `.env.local` are gitignored. Only the Supabase **anon** key (public)
  belongs in client config.
- Prefer updating existing docs over creating new files.
- Documentation quality is part of the implementation, not optional.
