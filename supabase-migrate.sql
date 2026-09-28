-- ============================================================================
-- PITCHATON — migrate an EXISTING Supabase project
-- ============================================================================
--
-- WHEN TO USE THIS
-- ----------------
-- Use this instead of `supabase-schema.sql` only if the project already has
-- tables named `pitches`, `founders`, `files`, `results`, `hub_news`,
-- `admin_settings`, `users` or `email_log` from an earlier build. This script
-- DROPS those objects and rebuilds them in the PITCHATON shape.
--
-- ⚠️  STEP 1 — LOOK BEFORE YOU DROP
-- ---------------------------------
-- Run this query first and read the counts. Any numbers above zero are rows
-- that will be permanently deleted by step 2.
--
--   select 'pitches' as tbl, count(*) from public.pitches
--   union all select 'founders',   count(*) from public.founders
--   union all select 'files',      count(*) from public.files
--   union all select 'results',    count(*) from public.results
--   union all select 'hub_news',   count(*) from public.hub_news
--   union all select 'admin_settings', count(*) from public.admin_settings
--   union all select 'users',      count(*) from public.users;
--
-- If those counts are zero (typical for a first launch) go straight to step 2.
-- If they hold real submissions, export them first: Table Editor → each table →
-- Export → CSV.
--
-- NOTHING OUTSIDE THESE TABLES IS TOUCHED. Supabase Auth users (`auth.users`),
-- Storage objects and any unrelated table of yours are left alone.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 2 — drop the old PITCHATON objects
-- ---------------------------------------------------------------------------
drop view  if exists public.leaderboard cascade;

drop table if exists public.results        cascade;
drop table if exists public.files          cascade;
drop table if exists public.founders       cascade;
drop table if exists public.hub_news       cascade;
drop table if exists public.email_log      cascade;
drop table if exists public.pitches        cascade;
drop table if exists public.admin_settings cascade;
drop table if exists public.users          cascade;

drop function if exists public.assign_pitch_code()  cascade;
drop function if exists public.touch_updated_at()   cascade;
drop sequence if exists public.pitch_code_seq       cascade;

-- ---------------------------------------------------------------------------
-- STEP 3 — rebuild in the PITCHATON shape
-- ---------------------------------------------------------------------------
-- Paste the entire contents of `supabase-schema.sql` here and run it, or just
-- run that file as a second query. It is idempotent and will now create every
-- table fresh.
--
-- Order matters: step 2 must finish before step 3 runs.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- STEP 4 — verify
-- ---------------------------------------------------------------------------
--   select table_name from information_schema.tables
--   where table_schema = 'public' order by table_name;
--
--   -- Row Level Security must be ON for every one of them:
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' order by tablename;
--
-- Expected: 8 tables (admin_settings, email_log, files, founders, hub_news,
-- pitches, results, users), every row security = true.
--
-- Then open https://your-site.netlify.app/api/health while signed in as an
-- admin — it prints an explicit verdict for the database, the storage bucket
-- and this project's settings row.
-- ---------------------------------------------------------------------------
