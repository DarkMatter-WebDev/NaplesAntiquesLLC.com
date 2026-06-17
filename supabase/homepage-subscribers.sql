-- Homepage subscriber capture for admin Subscribers tab.
-- Run in Supabase SQL Editor before using the homepage signup form.

create extension if not exists "pgcrypto";

create table if not exists public.homepage_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  source text not null default 'homepage_hero',
  locale text not null default 'en',
  subscribed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists homepage_subscribers_subscribed_at_idx
  on public.homepage_subscribers (subscribed_at desc);

alter table public.homepage_subscribers enable row level security;

drop policy if exists "Admins read homepage subscribers" on public.homepage_subscribers;
create policy "Admins read homepage subscribers"
  on public.homepage_subscribers for select
  using (public.is_admin_user(auth.uid()));

grant select on public.homepage_subscribers to authenticated;

create or replace function public.subscribe_homepage(
  subscriber_email text,
  subscriber_name text default null,
  subscriber_locale text default 'en'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
begin
  normalized_email := lower(trim(subscriber_email));

  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid email address is required.';
  end if;

  insert into public.homepage_subscribers (
    email,
    full_name,
    source,
    locale,
    subscribed_at,
    updated_at
  )
  values (
    normalized_email,
    nullif(trim(coalesce(subscriber_name, '')), ''),
    'homepage_hero',
    case when subscriber_locale = 'es' then 'es' else 'en' end,
    now(),
    now()
  )
  on conflict (email) do update
  set
    full_name = coalesce(excluded.full_name, public.homepage_subscribers.full_name),
    locale = excluded.locale,
    source = excluded.source,
    updated_at = now();
end;
$$;

grant execute on function public.subscribe_homepage(text, text, text) to anon, authenticated;
