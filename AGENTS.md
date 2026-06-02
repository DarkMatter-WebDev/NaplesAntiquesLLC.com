# AGENTS.md

This project uses a persistent Markdown memory system in **`project-docs/`**.

## At the start of every session

Read these first and summarize the current state before making changes:

1. `project-docs/PROJECT_OVERVIEW.md` (read first)
2. `project-docs/CURRENT_STATUS.md`
3. `project-docs/TASKS.md`
4. `project-docs/DECISIONS.md`

See `project-docs/README.md` for the full index and conventions.

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
