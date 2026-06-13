-- Naples Estate Jewelry — Products table setup.
-- Run once in Supabase SQL Editor (safe to re-run: uses IF NOT EXISTS / OR REPLACE).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Products table ────────────────────────────────────────────────────────

create table if not exists public.products (
  id                   text        primary key,
  category             text        not null default 'Gold',
  title                text        not null,
  title_es             text,
  price_label          text,
  manual_price_label   text,
  price_mode           text        not null default 'spot-multiplier',
  purity               integer,
  weight_grams         numeric(8,2),
  pricing_multiplier   numeric(5,3),
  status               text        not null default 'Available',
  images               jsonb       not null default '[]',
  description          text,
  description_es       text,
  details              jsonb       not null default '[]',
  details_es           jsonb       not null default '[]',
  tags                 jsonb       not null default '[]',
  tags_es              jsonb       not null default '[]',
  private_price_label  text,
  gender               text        not null default 'Unisex',
  sort_order           integer     not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── 1b. Add columns introduced after initial deploy ─────────────────────────
-- Safe to re-run: IF NOT EXISTS prevents errors on fresh installs.
alter table public.products
  add column if not exists gender text not null default 'Unisex';

-- ── 2. Auto-update updated_at ────────────────────────────────────────────────

-- set_updated_at() is already defined in schema.sql; reuse it here.
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ── 3. Useful indexes ────────────────────────────────────────────────────────

create index if not exists products_status_idx    on public.products (status);
create index if not exists products_category_idx  on public.products (category);
create index if not exists products_sort_idx      on public.products (sort_order);

-- ── 4. Row Level Security ────────────────────────────────────────────────────

alter table public.products enable row level security;

-- Anyone (including anonymous visitors) can read the full catalogue.
drop policy if exists "Anyone can read products" on public.products;
create policy "Anyone can read products"
  on public.products for select
  using (true);

-- Only admins can insert new products.
drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
  on public.products for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Only admins can update products.
-- Both USING (row filter) and WITH CHECK (new-row filter) are set so that
-- the admin can also SELECT the row after the update without PGRST116 errors.
drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
  on public.products for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Only admins can delete products.
drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
  on public.products for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- ── 5. Table grants ──────────────────────────────────────────────────────────

-- Anonymous visitors need SELECT for the public shop page.
grant select on public.products to anon;

-- Authenticated users (including admins) need full access.
-- Row-level policies above restrict actual write access to admins only.
grant select, insert, update, delete on public.products to authenticated;

-- ── 6. Storage bucket: product-images ───────────────────────────────────────
-- Create this once via the Supabase dashboard (Storage → New bucket):
--   Name:   product-images
--   Public: true
--
-- Then add the following storage policies in the dashboard or paste into
-- the SQL editor:

-- Allow anyone to read uploaded images (public bucket).
drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Only admins may upload images.
drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Only admins may delete images.
drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
