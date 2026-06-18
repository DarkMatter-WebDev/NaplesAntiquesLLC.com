-- ============================================================
--  Migration: per-photo hero background color
--  Run once in the Supabase SQL editor (idempotent).
--
--  Adds carousel_selection.bg_color so the admin can set each
--  carousel photo's hero backdrop. NULL = inherit the global
--  carousel_settings.bg_color. The home hero fades to this color
--  while the photo is the front-facing card.
--
--  No new GRANT/RLS needed: the column lives on carousel_selection,
--  which already grants select to anon/authenticated and write to
--  the admin (see setup.sql).
-- ============================================================

alter table public.carousel_selection
  add column if not exists bg_color text;

-- Reload PostgREST's schema cache so the new column is queryable.
notify pgrst, 'reload schema';
