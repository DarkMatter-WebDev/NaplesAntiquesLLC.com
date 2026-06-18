-- ============================================================
--  Migration: admin-editable "cards visible at once"
--  Run once in the Supabase SQL editor (idempotent).
--
--  Adds carousel_settings.visible_count — how many cards are on the
--  ring at once (the windowed/infinite carousel). Fewer = closer and
--  more intimate; the rest of the curated list cycles through.
--
--  No new GRANT/RLS needed: carousel_settings already grants update
--  to the admin (see setup.sql).
-- ============================================================

alter table public.carousel_settings
  add column if not exists visible_count int not null default 6;

-- Reload PostgREST's schema cache so the new column is queryable.
notify pgrst, 'reload schema';
