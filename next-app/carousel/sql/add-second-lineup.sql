-- ============================================================
--  Second hero slideshow lineup — run once in the Supabase SQL editor.
--
--  The homepage hero's scroll parallax reveals a SECOND slideshow. This table
--  stores its own curated lineup, mirroring carousel_selection exactly (a twin
--  table instead of a slot column so the live table's product_id primary key
--  is untouched and the same product may appear in both lineups).
--
--  Until this migration runs — or while the table is empty — the second
--  slideshow simply reuses the primary lineup, so nothing breaks either way.
--
--  Requires setup.sql to have been run first (is_carousel_admin, products).
-- ============================================================

create table if not exists public.carousel_selection_alt (
  product_id text primary key
    references public.products (id) on delete cascade,
  position   int  not null default 0,
  bg_color   text
);

create index if not exists carousel_selection_alt_position_idx
  on public.carousel_selection_alt (position);

alter table public.carousel_selection_alt enable row level security;

-- Table-level privileges (see note in setup.sql). RLS filters rows, but
-- PostgREST still needs these GRANTs to touch the table at all.
grant select on public.carousel_selection_alt to anon, authenticated;
grant insert, update, delete on public.carousel_selection_alt to authenticated;

-- Anyone may read (storefront).
drop policy if exists carousel_selection_alt_read on public.carousel_selection_alt;
create policy carousel_selection_alt_read
  on public.carousel_selection_alt for select
  to anon, authenticated
  using (true);

-- Only the admin email may insert/update/delete.
drop policy if exists carousel_selection_alt_write on public.carousel_selection_alt;
create policy carousel_selection_alt_write
  on public.carousel_selection_alt for all
  to authenticated
  using (public.is_carousel_admin())
  with check (public.is_carousel_admin());

-- Reload the PostgREST schema cache so the embedded product select works.
notify pgrst, 'reload schema';
