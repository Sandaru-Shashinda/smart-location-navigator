-- Safe To Go — Supabase schema
--
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query)
-- for the project referenced by EXPO_PUBLIC_SUPABASE_URL. It adds the tables
-- and RLS policies backing:
--   - recent destination search history (Home screen "RECENT" list)
--   - user-reported traffic incidents (requirement #10, feeds alert system)
--   - fairness-aware route assignment counts (requirement #5)
--
-- Auth (email/password sign up) and GPS tracking need no schema — they use
-- Supabase Auth and on-device GPS directly.

-- ─────────────────────────────────────────────────────────────────────────
-- Recent searches
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.recent_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists recent_searches_user_created_idx
  on public.recent_searches (user_id, created_at desc);

alter table public.recent_searches enable row level security;

-- Postgres has no "create policy if not exists", so each policy is dropped
-- first to keep this whole script safe to re-run.
drop policy if exists "recent_searches_select_own" on public.recent_searches;
create policy "recent_searches_select_own"
  on public.recent_searches for select
  using (auth.uid() = user_id);

drop policy if exists "recent_searches_insert_own" on public.recent_searches;
create policy "recent_searches_insert_own"
  on public.recent_searches for insert
  with check (auth.uid() = user_id);

drop policy if exists "recent_searches_delete_own" on public.recent_searches;
create policy "recent_searches_delete_own"
  on public.recent_searches for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Incident reports (requirement #10 — user feedback & reporting)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('accident', 'hazard', 'police', 'closure', 'congestion', 'other')),
  description text,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists incident_reports_created_idx
  on public.incident_reports (created_at desc);

alter table public.incident_reports enable row level security;

-- Reports are anonymised at read time (no user_id is selected by the app),
-- so any signed-in driver can see recent nearby incidents to stay informed.
drop policy if exists "incident_reports_select_recent" on public.incident_reports;
create policy "incident_reports_select_recent"
  on public.incident_reports for select
  to authenticated
  using (created_at > now() - interval '3 hours');

drop policy if exists "incident_reports_insert_own" on public.incident_reports;
create policy "incident_reports_insert_own"
  on public.incident_reports for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Fairness-aware routing (requirement #5)
--
-- Each driver's client upserts one row for the route it is currently
-- navigating (identified by a stable hash of the rounded origin/destination).
-- The app then calls route_usage_counts() to see how many *other* drivers
-- are already on each candidate route and prefers the less-loaded one,
-- instead of piling everyone onto the single fastest road.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.active_route_assignments (
  user_id uuid primary key references auth.users (id) on delete cascade,
  route_hash text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  dest_lat double precision not null,
  dest_lng double precision not null,
  updated_at timestamptz not null default now()
);

create index if not exists active_route_assignments_hash_idx
  on public.active_route_assignments (route_hash);

alter table public.active_route_assignments enable row level security;

drop policy if exists "active_route_assignments_select_own" on public.active_route_assignments;
create policy "active_route_assignments_select_own"
  on public.active_route_assignments for select
  using (auth.uid() = user_id);

drop policy if exists "active_route_assignments_upsert_own" on public.active_route_assignments;
create policy "active_route_assignments_upsert_own"
  on public.active_route_assignments for insert
  with check (auth.uid() = user_id);

drop policy if exists "active_route_assignments_update_own" on public.active_route_assignments;
create policy "active_route_assignments_update_own"
  on public.active_route_assignments for update
  using (auth.uid() = user_id);

drop policy if exists "active_route_assignments_delete_own" on public.active_route_assignments;
create policy "active_route_assignments_delete_own"
  on public.active_route_assignments for delete
  using (auth.uid() = user_id);

-- Stale assignments (driver closed the app mid-trip) roll off after 30
-- minutes so they stop counting toward road load.
create or replace function public.route_usage_counts(hashes text[])
returns table (route_hash text, active_users bigint)
language sql
security definer
set search_path = public
as $$
  select route_hash, count(*) as active_users
  from public.active_route_assignments
  where route_hash = any(hashes)
    and updated_at > now() - interval '30 minutes'
  group by route_hash;
$$;

grant execute on function public.route_usage_counts(text[]) to authenticated;
