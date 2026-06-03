# Project Docs — Persistent Memory System

This folder is the project's **long-term memory**. It exists so that any AI
session, chat reset, or new contributor can quickly understand the project
without re-explaining it. Treat documentation quality as part of the
implementation, not an optional extra.

## Files

| File | Purpose |
|------|---------|
| `PROJECT_OVERVIEW.md` | **Read first.** Purpose, business goals, audience, tech stack, deployment. |
| `CURRENT_STATUS.md` | Present state: what works, recent work, priorities, blockers, next steps. |
| `ARCHITECTURE.md` | System design, folder structure, DB schema, integrations, auth, hosting. |
| `STRUCTURE.md` | Canonical repo map + structural **invariants** that keep the site consistent. |
| `INTEGRITY.md` | Integrity rules + pre-publish checklist (enforced by `tools/check-integrity.mjs`). |
| `DECISIONS.md` | Dated log of important technical/design/business decisions + rationale. |
| `TASKS.md` | Backlog / In Progress / Completed task tracking. |
| `CHANGELOG.md` | Dated log of meaningful changes. |
| `CLIENTS.md` | Dark Matter Web Services client/hosting/maintenance tracking (no secrets). |
| `features/` | One file per feature with deeper detail. |
| `meetings/` | Dated notes (`YYYY-MM-DD-notes.md`). |

## Session Startup Behavior

At the start of every session:

1. Read `PROJECT_OVERVIEW.md`, `CURRENT_STATUS.md`, `TASKS.md`, `DECISIONS.md`.
2. Build an understanding of the project and **summarize current state** before
   making changes.
3. Ask for clarification only if required.

## Session Shutdown Behavior

Before ending a work session, never leave project state undocumented:

1. Update `CURRENT_STATUS.md`.
2. Update `TASKS.md` (move items between Backlog / In Progress / Completed).
3. Record important decisions in `DECISIONS.md`.
4. Add significant changes to `CHANGELOG.md`.
5. Update `ARCHITECTURE.md` if the architecture changed.
6. Update `CLIENTS.md` / `features/` as relevant.

## Working Rules

- Treat these Markdown files as the source of truth for project context.
- Keep docs concise but current; prefer updating existing files over creating new
  ones.
- If unsure whether something matters, document it.
- Write for both humans and AI agents.
- After any listing/structural/script change, run the guardrail
  `node tools/check-integrity.mjs` (no install needed) — see `INTEGRITY.md`.
- **Never commit secrets.** In `CLIENTS.md`, record only where credentials live,
  never the credentials themselves. (`.env` / `.env.local` are gitignored.)
