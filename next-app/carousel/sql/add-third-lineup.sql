-- ============================================================
--  Third hero slideshow — run once in the Supabase SQL editor.
--
--  The homepage hero's scroll parallax now reveals a THIRD slideshow after the
--  second. This file adds both halves of that feature:
--
--    1. public.carousel_selection_third — its curated lineup, a twin of
--       carousel_selection / carousel_selection_alt (a twin table rather than a
--       slot column so each table keeps its product_id primary key and one
--       product may appear in any or all lineups).
--    2. carousel_settings.selection_mode_third — its item source, matching the
--       other two columns: 'manual', 'random_gold_jewelry',
--       'random_silver_jewelry', or 'random_non_jewelry'.
--
--  Until this migration runs — or while the lineup is empty — the third
--  slideshow simply reuses the first lineup, so nothing breaks either way.
--
--  Requires setup.sql (is_carousel_admin, products, carousel_settings).
--  Safe to run before or after add-random-lineup-modes.sql.
-- ============================================================

create table if not exists public.carousel_selection_third (
  product_id text primary key
    references public.products (id) on delete cascade,
  position   int  not null default 0,
  bg_color   text
);

create index if not exists carousel_selection_third_position_idx
  on public.carousel_selection_third (position);

alter table public.carousel_selection_third enable row level security;

-- Table-level privileges (see note in setup.sql). RLS filters rows, but
-- PostgREST still needs these GRANTs to touch the table at all.
grant select on public.carousel_selection_third to anon, authenticated;
grant insert, update, delete on public.carousel_selection_third to authenticated;

-- Anyone may read (storefront).
drop policy if exists carousel_selection_third_read on public.carousel_selection_third;
create policy carousel_selection_third_read
  on public.carousel_selection_third for select
  to anon, authenticated
  using (true);

-- Only the admin email may insert/update/delete.
drop policy if exists carousel_selection_third_write on public.carousel_selection_third;
create policy carousel_selection_third_write
  on public.carousel_selection_third for all
  to authenticated
  using (public.is_carousel_admin())
  with check (public.is_carousel_admin());

-- Item source for the third slideshow (see add-random-lineup-modes.sql for the
-- full list of accepted values).
alter table public.carousel_settings
  add column if not exists selection_mode_third text not null default 'manual';

-- Reload the PostgREST schema cache so the new table and column are visible.
notify pgrst, 'reload schema';
