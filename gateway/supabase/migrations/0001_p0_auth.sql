-- ============================================================================
-- P0: identity, API keys, usage/audit, and Row Level Security.
-- Run in Supabase SQL editor (or `supabase db push`) once.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: mirror of auth.users with app-level role + budget
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  budget_usd  numeric(10, 4) not null default 10.0,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- auto-create a profile whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- api_keys: stored hashed; only the gateway (service role) writes them
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null default 'default',
  prefix        text not null,
  key_hash      text not null,
  scopes        text[] not null default array['user'],
  last_used_at  timestamptz,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create unique index if not exists api_keys_prefix_key on public.api_keys (prefix);
create index if not exists api_keys_user_idx on public.api_keys (user_id);

alter table public.api_keys enable row level security;

-- users may list their own keys (never the hash, see note below)
drop policy if exists "api_keys_select_own" on public.api_keys;
create policy "api_keys_select_own" on public.api_keys
  for select using (auth.uid() = user_id);

-- No insert/update/delete policy for users: key issuance and revocation go
-- through the gateway with the service role.

-- ---------------------------------------------------------------------------
-- usage_events: billing + audit, written by the gateway
-- ---------------------------------------------------------------------------
create table if not exists public.usage_events (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  request_id         text,
  model              text,
  prompt_tokens      int not null default 0,
  completion_tokens  int not null default 0,
  cost_usd           numeric(12, 6) not null default 0,
  created_at         timestamptz not null default now()
);

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

alter table public.usage_events enable row level security;

drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own" on public.usage_events
  for select using (auth.uid() = user_id);

-- monthly spend rollup (used to reconcile Redis cost counters with the DB)
create or replace view public.monthly_spend as
select
  user_id,
  date_trunc('month', created_at) as month,
  sum(cost_usd) as spent_usd
from public.usage_events
group by user_id, date_trunc('month', created_at);
