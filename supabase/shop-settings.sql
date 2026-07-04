-- Public shop display settings (single-row).
--
-- Currently holds one toggle: whether SOLD products are shown in the public shop
-- gallery. Default TRUE preserves the existing behavior (available + sold are
-- both shown) until an admin turns it off.
--
-- Reads: the public storefront needs this value, so anon/authenticated may SELECT.
-- Writes: only the admin API route (service-role client, gated by requireAdmin())
-- writes it, so no public write policy is needed. The service role bypasses RLS
-- but in this project still needs explicit table grants.
--
-- Run in the Supabase SQL Editor. Safe to re-run (idempotent).

create table if not exists public.shop_settings (
  id              boolean     primary key default true check (id),
  show_sold_items boolean     not null default true,
  updated_at      timestamptz not null default now()
);

-- Seed the single row so reads always find it.
insert into public.shop_settings (id, show_sold_items)
values (true, true)
on conflict (id) do nothing;

alter table public.shop_settings enable row level security;

-- Public read: the storefront (anon, cookie-free client) reads the toggle.
drop policy if exists "Public reads shop settings" on public.shop_settings;
create policy "Public reads shop settings"
  on public.shop_settings for select
  to anon, authenticated
  using (true);

grant select on public.shop_settings to anon, authenticated;

-- Admin writes go through the service role (RLS-bypassing) in the admin API.
grant select, insert, update on public.shop_settings to service_role;

notify pgrst, 'reload schema';
