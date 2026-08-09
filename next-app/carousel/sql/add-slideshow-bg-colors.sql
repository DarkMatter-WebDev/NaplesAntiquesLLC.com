-- ============================================================
--  Per-slideshow background colors — run once in the Supabase SQL editor.
--
--  2026-08-09: the hero's per-photo background sweep was removed. Each of the
--  three hero slideshows now shows ONE solid admin-chosen background for the
--  whole time it is on screen, instead of the background following each
--  photo's backdrop as the ring turns (which flipped the hero between black
--  and white whenever a lineup mixed backdrop colors).
--
--  bg_color            (existing) - Slideshow 1's background
--  bg_color_alt        (new)      - Slideshow 2's background
--  bg_color_third      (new)      - Slideshow 3's background
--
--  Both new columns default to NULL, which the application reads as "inherit
--  Slideshow 1's color" — so running this migration changes nothing visible
--  until the admin picks a color on the Slideshow 2 or 3 tab. The app is also
--  safe to deploy BEFORE this runs: reads fall back a tier and saves succeed
--  minus these columns, with the admin panel naming this file in a warning.
--
--  Per-photo colors (carousel_selection*.bg_color) are untouched: they paint
--  each CARD's padding, which is a separate feature that remains.
--
--  Requires setup.sql to have been run first (carousel_settings + RLS; the
--  existing UPDATE policy on carousel_settings covers the new columns, since
--  policies are per-row, not per-column).
-- ============================================================

alter table public.carousel_settings
  add column if not exists bg_color_alt text;
alter table public.carousel_settings
  add column if not exists bg_color_third text;

-- Reload the PostgREST schema cache so the new columns are visible.
notify pgrst, 'reload schema';
