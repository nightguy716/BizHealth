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

-- ─────────────────────────────────────────────────────────────────────────────
-- TRADING JOURNAL, WATCHLIST, NOTIFICATIONS
-- Run this block in Supabase SQL Editor after the schema above.
-- ─────────────────────────────────────────────────────────────────────────────

-- 4. Trading journal entries
create table if not exists public.journal_entries (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  ticker        text not null,
  company_name  text,
  direction     text not null default 'long',   -- 'long' | 'short'
  entry_date    date not null,
  entry_price   numeric(18,4),
  quantity      numeric(18,4),
  exit_date     date,
  exit_price    numeric(18,4),
  thesis        text,
  notes         text,
  outcome       text not null default 'open',   -- 'open' | 'win' | 'loss'
  debate_result jsonb,                           -- cached Bull/Bear/Arbiter JSON
  created_at    timestamptz not null default now()
);

alter table public.journal_entries enable row level security;
create policy "journal_select" on public.journal_entries for select using (auth.uid() = user_id);
create policy "journal_insert" on public.journal_entries for insert with check (auth.uid() = user_id);
create policy "journal_update" on public.journal_entries for update using (auth.uid() = user_id);
create policy "journal_delete" on public.journal_entries for delete using (auth.uid() = user_id);

-- 5. User watchlist
create table if not exists public.user_watchlist (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  ticker        text not null,
  company_name  text,
  sector        text,
  currency      text default 'USD',
  target_price  numeric(18,4),
  notes         text,
  last_checked  timestamptz,
  added_at      timestamptz not null default now(),
  unique (user_id, ticker)
);

alter table public.user_watchlist enable row level security;
create policy "watchlist_select" on public.user_watchlist for select using (auth.uid() = user_id);
create policy "watchlist_insert" on public.user_watchlist for insert with check (auth.uid() = user_id);
create policy "watchlist_update" on public.user_watchlist for update using (auth.uid() = user_id);
create policy "watchlist_delete" on public.user_watchlist for delete using (auth.uid() = user_id);

-- 6. In-app notifications
create table if not exists public.notifications (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null,   -- 'watchlist_stale' | 'journal_open' | 'general'
  ticker        text,
  message       text not null,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.notifications enable row level security;
create policy "notif_select" on public.notifications for select using (auth.uid() = user_id);
create policy "notif_insert" on public.notifications for insert with check (auth.uid() = user_id);
create policy "notif_update" on public.notifications for update using (auth.uid() = user_id);
create policy "notif_delete" on public.notifications for delete using (auth.uid() = user_id);
