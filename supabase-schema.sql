-- ============================================================================
-- PITCHATON — Supabase / PostgreSQL schema
-- ============================================================================
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- It is idempotent: re-running is safe.
--
-- How PITCHATON talks to this database
-- ------------------------------------
-- The Next.js server uses the SERVICE ROLE key from API routes only, so Row
-- Level Security is bypassed there — which is why every table below has RLS
-- enabled with *no* permissive policies. Result: if the anon key ever leaked,
-- the browser still could not read a single row. Access control lives in the
-- API layer (session cookie → role) plus these deny-all policies.
--
-- Note: public.users is the platform's own account table. It is NOT
-- auth.users — PITCHATON ships its own bcrypt credential store so the same
-- codebase also runs on a plain Postgres/local store without Supabase Auth.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  full_name     text not null,
  role          text not null default 'founder' check (role in ('founder', 'admin')),
  created_at    timestamptz not null default now()
);

create index if not exists users_role_idx on public.users (role);

-- ---------------------------------------------------------------------------
-- pitches
-- ---------------------------------------------------------------------------
create table if not exists public.pitches (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,                       -- human pitch ID, e.g. PCH-0001
  title       text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 20 and 8000),
  category    text,
  status      text not null default 'submitted'
              check (status in ('submitted','under_review','accepted','finalist','winner','rejected')),
  editable    boolean not null default false,     -- per-pitch edit unlock (admin controlled)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid not null references public.users (id) on delete cascade
);

create index if not exists pitches_status_idx on public.pitches (status);
create index if not exists pitches_created_by_idx on public.pitches (created_by);
create index if not exists pitches_created_at_idx on public.pitches (created_at desc);

-- ---------------------------------------------------------------------------
-- founders (team members of a pitch)
-- ---------------------------------------------------------------------------
create table if not exists public.founders (
  id          uuid primary key default gen_random_uuid(),
  pitch_id    uuid not null references public.pitches (id) on delete cascade,
  name        text not null,
  email       text not null,
  phone       text,
  school_year text,
  created_at  timestamptz not null default now()
);

create index if not exists founders_pitch_idx on public.founders (pitch_id);
create index if not exists founders_email_idx on public.founders (email);

-- ---------------------------------------------------------------------------
-- files (Supabase Storage object references)
-- ---------------------------------------------------------------------------
create table if not exists public.files (
  id           uuid primary key default gen_random_uuid(),
  pitch_id     uuid not null references public.pitches (id) on delete cascade,
  file_name    text not null,
  file_url     text not null,
  file_type    text,
  file_size    integer,
  storage_path text,                                -- object path inside the bucket
  uploaded_at  timestamptz not null default now()
);

create index if not exists files_pitch_idx on public.files (pitch_id);

-- ---------------------------------------------------------------------------
-- results (one row per pitch — unique)
-- ---------------------------------------------------------------------------
create table if not exists public.results (
  id          uuid primary key default gen_random_uuid(),
  pitch_id    uuid not null unique references public.pitches (id) on delete cascade,
  rank        integer not null check (rank >= 1),
  score       numeric(6,2),
  notes       text,
  uploaded_at timestamptz not null default now()
);

create index if not exists results_rank_idx on public.results (rank);

-- ---------------------------------------------------------------------------
-- hub_news (announcements + spotlights)
-- ---------------------------------------------------------------------------
create table if not exists public.hub_news (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  content           text not null,
  image_url         text,
  featured_pitch_id uuid references public.pitches (id) on delete set null,
  published_at      timestamptz not null default now(),
  created_by        uuid references public.users (id) on delete set null
);

create index if not exists hub_news_published_idx on public.hub_news (published_at desc);

-- ---------------------------------------------------------------------------
-- admin_settings (singleton row)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_settings (
  id                  text primary key default 'singleton' check (id = 'singleton'),
  submission_deadline timestamptz,
  competition_date    timestamptz,
  submission_enabled  boolean not null default true,
  edit_mode_enabled   boolean not null default false,
  results_published   boolean not null default false,
  hub_name            text not null default 'ICT Hub',
  institution_name    text not null default 'ICT Hub · Enugu, Nigeria',
  updated_at          timestamptz not null default now()
);

insert into public.admin_settings (id) values ('singleton') on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- email_log (delivery audit trail shown in the admin Settings tab)
-- ---------------------------------------------------------------------------
create table if not exists public.email_log (
  id         uuid primary key default gen_random_uuid(),
  to_email   text not null,
  subject    text not null,
  body       text,
  kind       text not null default 'system'
             check (kind in ('submission','status','spotlight','test','system')),
  status     text not null default 'queued'
             check (status in ('sent','queued','failed')),
  error      text,
  created_at timestamptz not null default now()
);

create index if not exists email_log_created_idx on public.email_log (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pitches_touch_updated_at on public.pitches;
create trigger pitches_touch_updated_at
  before update on public.pitches
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Pitch codes: PCH-0001, PCH-0002 … assigned automatically on insert
-- ---------------------------------------------------------------------------
create sequence if not exists public.pitch_code_seq start with 1;

create or replace function public.assign_pitch_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'PCH-' || lpad(nextval('public.pitch_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists pitches_assign_code on public.pitches;
create trigger pitches_assign_code
  before insert on public.pitches
  for each row execute function public.assign_pitch_code();

-- ---------------------------------------------------------------------------
-- Public leaderboard view (never leaks founder contact details)
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard as
select
  r.rank,
  r.score,
  r.notes,
  p.id           as pitch_id,
  p.code         as pitch_code,
  p.title        as pitch_title,
  p.category     as pitch_category,
  p.status       as pitch_status,
  coalesce(
    (select array_agg(f.name order by f.created_at) from public.founders f where f.pitch_id = p.id),
    '{}'::text[]
  ) as team
from public.results r
join public.pitches p on p.id = r.pitch_id
order by r.rank asc;

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled everywhere, with deny-all policies.
-- The service-role key used by the server bypasses RLS; nothing else can read.
-- ---------------------------------------------------------------------------
alter table public.users          enable row level security;
alter table public.pitches        enable row level security;
alter table public.founders       enable row level security;
alter table public.files          enable row level security;
alter table public.results        enable row level security;
alter table public.hub_news       enable row level security;
alter table public.admin_settings enable row level security;
alter table public.email_log      enable row level security;

-- Explicit deny policies (defence in depth: even if a permissive policy is
-- added later by mistake, these still restrict anonymous access).
do $$
declare
  t text;
begin
  foreach t in array array['users','pitches','founders','files','results','hub_news','admin_settings','email_log']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_deny_anon', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      t || '_deny_anon', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage bucket for pitch attachments (public read, server-side writes)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pitch-files', 'pitch-files', true, 52428800, null)
on conflict (id) do update
  set public = true,
      file_size_limit = 52428800;

-- Only the service role may write; anyone may read objects (needed for
-- download links that the API already authorised).
drop policy if exists "pitch_files_public_read" on storage.objects;
create policy "pitch_files_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'pitch-files');

-- ============================================================================
-- OPTIONAL: create the Hub admin account from SQL
-- ============================================================================
-- Accounts normally get created through the shared /signup form. To seed the
-- admin directly, first generate a bcrypt hash:
--
--   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'Cross0702'
--
-- then paste it below and run:
--
-- insert into public.users (email, password_hash, full_name, role)
-- values ('contacteihpitchaton@gmail.com', '<paste-hash-here>', 'ICT Hub Lead', 'admin')
-- on conflict (email) do update set role = 'admin';
--
-- Verify:
-- select email, role, created_at from public.users order by created_at;
-- ============================================================================
