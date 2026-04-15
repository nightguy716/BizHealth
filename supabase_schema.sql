-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- NOTE: If you already ran this once, skip to the "waitlist" section at the bottom.


-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  plan          text not null default 'free',   -- 'free' | 'pro' | 'charter'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Search history table
create table if not exists public.search_history (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  ticker       text not null,
  name         text,
  sector       text,
  currency     text default 'USD',
  filled       int  default 0,
  total        int  default 17,
  searched_at  timestamptz not null default now(),
  unique (user_id, ticker)      -- one row per ticker per user (upserted)
);

-- 3. Row Level Security
alter table public.profiles        enable row level security;
alter table public.search_history  enable row level security;

-- Profiles: user can only read/update their own row
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Search history: user can only see and modify their own rows
create policy "history_select" on public.search_history for select using (auth.uid() = user_id);
create policy "history_insert" on public.search_history for insert with check (auth.uid() = user_id);
create policy "history_update" on public.search_history for update using (auth.uid() = user_id);
create policy "history_delete" on public.search_history for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- WAITLIST  (run this block separately if you already ran the schema above)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       text not null unique,
  source      text default 'landing',   -- where they signed up from
  created_at  timestamptz not null default now()
);

alter table public.waitlist enable row level security;

-- Anyone can insert (join the waitlist without an account)
create policy "waitlist_insert" on public.waitlist
  for insert with check (true);

-- Only authenticated users can read (so you can see the list from dashboard)
create policy "waitlist_select" on public.waitlist
  for select using (auth.role() = 'authenticated');

-- Public count view — lets the frontend show "X people waiting" without exposing emails
create or replace view public.waitlist_count as
  select count(*)::int as total from public.waitlist;

grant select on public.waitlist_count to anon, authenticated;
