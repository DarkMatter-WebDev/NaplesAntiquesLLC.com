-- ============================================================
--  Migration: separate "cards visible at once" for mobile
--  Run once in the Supabase SQL editor (idempotent).
--
--  Adds carousel_settings.visible_count_mobile so the admin can set
--  a different ring size on phones than on desktop. The existing
--  visible_count column is used for desktop.
--
--  No new GRANT/RLS needed: carousel_settings already grants update
--  to the admin (see setup.sql).
-- ============================================================

alter table public.carousel_settings
  add column if not exists visible_count_mobile int not null default 4;

-- Reload PostgREST's schema cache so the new column is queryable.
notify pgrst, 'reload schema';
