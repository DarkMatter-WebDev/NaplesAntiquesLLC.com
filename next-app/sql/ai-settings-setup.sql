-- ============================================================
--  AI settings setup — run once in the Supabase SQL editor.
--  Creates a single-row table holding the editable system prompt
--  that drives the live AI listing assistant (photo + transcript
--  autofill). When system_prompt is NULL the app falls back to the
--  built-in default baked into ai-product-provider.ts.
--
--  Locked down with row-level security: ONLY app admins
--  (profiles.is_admin = true) may read or write. There is no anon
--  or non-admin access — this prompt is operator-only.
-- ============================================================

-- ---------- admin check (profiles.is_admin) ----------
-- SECURITY DEFINER so the function can read profiles regardless of the
-- caller's RLS on that table. Returns true only for the logged-in admin.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- ---------- editable AI settings (single row) ----------
create table if not exists public.ai_settings (
  id            int         primary key default 1,
  system_prompt text,
  updated_at    timestamptz not null default now(),
  constraint ai_settings_single_row check (id = 1)
);

-- Seed the row. NULL system_prompt means "use the built-in default".
insert into public.ai_settings (id, system_prompt)
values (1, null)
on conflict (id) do nothing;

alter table public.ai_settings enable row level security;

-- Table-level privileges. RLS (below) still gates rows to admins, but
-- PostgREST needs these GRANTs to touch the table at all. Without them
-- every query fails with "permission denied for table ai_settings".
grant select, update on public.ai_settings to authenticated;

-- Only app admins may read the prompt.
drop policy if exists ai_settings_admin_read on public.ai_settings;
create policy ai_settings_admin_read
  on public.ai_settings for select
  to authenticated
  using (public.is_app_admin());

-- Only app admins may change the prompt.
drop policy if exists ai_settings_admin_write on public.ai_settings;
create policy ai_settings_admin_write
  on public.ai_settings for update
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Reload the PostgREST schema cache so the new table/policies take effect.
notify pgrst, 'reload schema';
