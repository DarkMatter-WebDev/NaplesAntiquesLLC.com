-- ============================================================
--  Run these in the Supabase SQL editor and send back the output.
--  They tell us your table/column names, the primary-key TYPE
--  (so the selection table's foreign key matches), and the actual
--  format of your image values (full URL vs Storage path).
--  Read-only — nothing is modified.
-- ============================================================

-- 1) All tables in your public schema (find the products table's real name)
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2) Columns + types for the products table.
--    >>> change 'products' below if step 1 shows a different name <<<
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'products'
order by ordinal_position;

-- 3) A few sample rows so we can see the ACTUAL image value format
--    (is it a full https://... URL, a storage path, an array, JSON?).
--    >>> change 'products' if needed <<<
select * from public.products limit 3;
