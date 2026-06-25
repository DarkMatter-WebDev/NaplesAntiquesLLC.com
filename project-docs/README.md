# Project Docs — Persistent Memory System

This folder is the project's **long-term memory**. It exists so that any AI
session, chat reset, or new contributor can quickly understand the project
without re-explaining it. Treat documentation quality as part of the
implementation, not an optional extra.

Project operating rules live in the root `AGENTS.md`. Read it before working:
this folder is the source-of-truth repo-ready copy, git operations are not part
of this workflow, and every session must leave the folder clean with current
docs and evidence-backed verification.

## Files

| File | Purpose |
|------|---------|
| `PROJECT_OVERVIEW.md` | **Read first.** Purpose, business goals, audience, tech stack, deployment. |
| `CURRENT_STATUS.md` | Present state: what works, recent work, priorities, blockers, next steps. |
| `ARCHITECTURE.md` | System design, folder structure, DB schema, integrations, auth, hosting. |
| `STRUCTURE.md` | Canonical repo map + structural **invariants** that keep the site consistent. |
| `INTEGRITY.md` | Next.js integrity rules + pre-publish checklist. |
| `LEGACY_REMOVAL_REPORT.md` | 2026-06-13 audit separating current Next.js app files from legacy static-site cleanup candidates. |
| `COMPLIANCE_AUDIT.md` | 2026-06-19 website compliance audit and implementation report. |
| `DECISIONS.md` | Dated log of important technical/design/business decisions + rationale. |
| `TASKS.md` | Backlog / In Progress / Completed task tracking. |
| `CHANGELOG.md` | Dated log of meaningful changes. |
| `CLIENTS.md` | Dark Matter Web Services client/hosting/maintenance tracking (no secrets). |
| `features/` | One file per feature with deeper detail. |
| `meetings/` | Dated notes (`YYYY-MM-DD-notes.md`). |

## Session Startup Behavior

At the start of every session:

1. Read root `AGENTS.md`.
2. Read `PROJECT_OVERVIEW.md`, `CURRENT_STATUS.md`, `TASKS.md`, `DECISIONS.md`.
3. Build an understanding of the project and **summarize current state** before
   making changes.
4. Ask for clarification only if required.

## Session Shutdown Behavior

Before ending a work session, never leave project state undocumented:

1. Update `CURRENT_STATUS.md`.
2. Update `TASKS.md` (move items between Backlog / In Progress / Completed).
3. Record important decisions in `DECISIONS.md`.
4. Add significant changes to `CHANGELOG.md`.
5. Update `ARCHITECTURE.md` if the architecture changed.
6. Update `CLIENTS.md` / `features/` as relevant.
7. Record exact verification commands and results.
8. Leave the source-of-truth folder repo-ready: no stray temp/archive/report
   files, and ignore rules still cover build output, caches, logs, and secrets.

## Working Rules

- Treat these Markdown files as the source of truth for project context.
- Keep docs concise but current; prefer updating existing files over creating new
  ones.
- If unsure whether something matters, document it.
- Write for both humans and AI agents.
- Do not run git operations in this source-of-truth folder; the human handles
  version control by wholesale copy elsewhere.
- For destructive work, dry-run/report first, archive or back up when practical,
  verify the reference set, then re-verify after the action.
- Keep image/data optimization defaults in mind: DB rows store URL/path strings,
  uploads use object storage + WebP/downscale/cache headers, and list queries
  select only needed columns.
- After app code, route, config, or schema-contract changes, run
  `npm run build` from `next-app/` - see `INTEGRITY.md`.
- **Never commit secrets.** In `CLIENTS.md`, record only where credentials live,
  never the credentials themselves. (`.env` / `.env.local` are gitignored.)
