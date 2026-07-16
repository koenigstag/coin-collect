-- Run this once against your self-hosted Supabase instance
-- (Studio → SQL Editor, or `psql` connected to the project's Postgres).

create table if not exists public.coin_collections (
  sync_code text primary key,
  cells jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter publication supabase_realtime add table public.coin_collections;

alter table public.coin_collections enable row level security;

-- The sync code itself acts as the shared secret between your devices,
-- so anon access is scoped by knowing the code, not by a login.
create policy "anon can read coin_collections"
  on public.coin_collections for select
  to anon
  using (true);

create policy "anon can insert coin_collections"
  on public.coin_collections for insert
  to anon
  with check (true);

create policy "anon can update coin_collections"
  on public.coin_collections for update
  to anon
  using (true)
  with check (true);
