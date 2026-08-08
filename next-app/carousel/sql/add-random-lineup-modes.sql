-- ============================================================
--  Random lineup modes — run once in the Supabase SQL editor.
--
--  Each hero slideshow can now run in one of four modes:
--    'manual'                - the admin-curated lineup in its selection table
--    'random_gold_jewelry'   - random available Gold wearable jewelry
--    'random_silver_jewelry' - random available Silver wearable jewelry
--    'random_non_jewelry'    - random available non-jewelry (coins, bullion,
--                              silverware, other), either metal
--
--  "Wearable jewelry" is the same split the shop's Jewelry & Watches category
--  filter uses; it is inferred in application code from the product's type and
--  tags, not stored in a column, so this table only records the chosen mode.
--
--  The superseded values 'random_gold' / 'random_silver' are still accepted and
--  map forward to their *_jewelry equivalents, so an older saved setting keeps
--  working.
--
--  selection_mode controls Slideshow 1 (carousel_selection);
--  selection_mode_alt controls Slideshow 2 (carousel_selection_alt).
--  Random lineups are resolved server-side on each home-payload cache
--  rebuild (~5 minutes, and immediately on every admin save), so they
--  rotate themselves as inventory changes. The curated selection tables
--  are untouched by random modes — switching back to 'manual' restores
--  the saved lineup exactly.
--
--  Unknown/missing values are treated as 'manual' by the application, so
--  this migration is safe to run before or after deploying the app code.
--
--  Requires setup.sql to have been run first (carousel_settings + RLS).
-- ============================================================

alter table public.carousel_settings
  add column if not exists selection_mode text not null default 'manual';
alter table public.carousel_settings
  add column if not exists selection_mode_alt text not null default 'manual';

-- Reload the PostgREST schema cache so the new columns are visible.
notify pgrst, 'reload schema';
