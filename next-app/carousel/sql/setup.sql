-- ============================================================
--  Carousel setup — run once in the Supabase SQL editor.
--  Creates the curated-selection table and the display-settings
--  row, then locks them down with row-level security:
--    * anyone (anon or logged-in shopper) can READ -> storefront works
--    * ONLY the admin account can WRITE            -> admin-only curation
--
--  The admin is identified by email (see is_carousel_admin below). Shoppers
--  may have their own logins, but only the admin email can edit the carousel.
--
--  NOTE: products.id is TEXT (slug-style), so the foreign key below
--  is TEXT to match. If your products PK type ever changes, change
--  product_id's type here too.
-- ============================================================

-- ---------- admin check (single source of truth) ----------
-- Returns true only for the store admin. To change the admin email later,
-- edit the address on the one line below and re-run this statement.
create or replace function public.is_carousel_admin()
returns boolean
language sql
stable
as $$
  select (auth.jwt() ->> 'email') = 'rcman12589@aol.com';
$$;

-- ---------- curated selection (which products + order) ----------
-- bg_color: per-photo hero backdrop. NULL means "inherit the global
-- carousel_settings.bg_color". When set (e.g. '#ffffff' or '#000000') the
-- home hero fades to this color while this photo is the front-facing card,
-- letting the admin sequence light- and dark-shot photos together.
create table if not exists public.carousel_selection (
  product_id text primary key
    references public.products (id) on delete cascade,
  position   int  not null default 0,
  bg_color   text
);

-- If the table already existed without bg_color, add it.
alter table public.carousel_selection
  add column if not exists bg_color text;

create index if not exists carousel_selection_position_idx
  on public.carousel_selection (position);

alter table public.carousel_selection enable row level security;

-- Table-level privileges. RLS (below) filters WHICH rows each role sees, but
-- PostgREST still needs these GRANTs to touch the table at all. Without them
-- every query fails with "permission denied for table carousel_selection".
grant select on public.carousel_selection to anon, authenticated;
grant insert, update, delete on public.carousel_selection to authenticated;

-- Anyone may read (storefront).
drop policy if exists carousel_selection_read on public.carousel_selection;
create policy carousel_selection_read
  on public.carousel_selection for select
  to anon, authenticated
  using (true);

-- Only the admin email may insert/update/delete.
drop policy if exists carousel_selection_write on public.carousel_selection;
create policy carousel_selection_write
  on public.carousel_selection for all
  to authenticated
  using (public.is_carousel_admin())
  with check (public.is_carousel_admin());

-- ---------- display settings (single row) ----------
-- visible_count / visible_count_mobile: how many cards are on the ring at once
-- (windowed carousel) on desktop and mobile respectively. Fewer = closer/more
-- intimate; the rest of the list cycles through.
create table if not exists public.carousel_settings (
  id                   int     primary key default 1,
  show_price           boolean not null default false,
  bg_color             text    not null default '#ffffff',
  visible_count        int     not null default 6,
  visible_count_mobile int     not null default 4,
  constraint carousel_settings_single_row check (id = 1)
);

-- If the table already existed without these columns, add them.
alter table public.carousel_settings
  add column if not exists bg_color text not null default '#ffffff';
alter table public.carousel_settings
  add column if not exists visible_count int not null default 6;
alter table public.carousel_settings
  add column if not exists visible_count_mobile int not null default 4;

insert into public.carousel_settings (id, show_price, bg_color, visible_count, visible_count_mobile)
values (1, false, '#ffffff', 6, 4)
on conflict (id) do nothing;

alter table public.carousel_settings enable row level security;

-- Table-level privileges (see note on carousel_selection above). The single
-- settings row is updated in place, so authenticated needs UPDATE but not
-- INSERT/DELETE (the row is seeded by the insert above).
grant select on public.carousel_settings to anon, authenticated;
grant update on public.carousel_settings to authenticated;

-- Anyone may read (storefront needs the show_price flag).
drop policy if exists carousel_settings_read on public.carousel_settings;
create policy carousel_settings_read
  on public.carousel_settings for select
  to anon, authenticated
  using (true);

-- Only the admin email may change settings.
drop policy if exists carousel_settings_write on public.carousel_settings;
create policy carousel_settings_write
  on public.carousel_settings for update
  to authenticated
  using (public.is_carousel_admin())
  with check (public.is_carousel_admin());

-- ---------- FK relationship for the embedded select ----------
-- The storefront query uses:
--   from('carousel_selection').select('position, product:products(...)')
-- which relies on the foreign key above so PostgREST can embed the
-- product row. Reload the schema cache after running this file:
notify pgrst, 'reload schema';
