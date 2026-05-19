-- F1 Ergast-shaped JSON snapshots for season-tracker (/api/f1-db).
-- Apply in Supabase SQL editor or via CLI: supabase db push

create table if not exists public.f1_season_snapshots (
  year int not null check (year >= 1950 and year <= 2100),
  resource_type text not null check (
    resource_type in ('calendar', 'driverStandings', 'constructorStandings')
  ),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (year, resource_type)
);

create table if not exists public.f1_round_snapshots (
  year int not null check (year >= 1950 and year <= 2100),
  round int not null check (round >= 1 and round <= 99),
  suffix text not null check (char_length(suffix) <= 64),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (year, round, suffix)
);

create index if not exists f1_season_snapshots_year_idx on public.f1_season_snapshots (year);
create index if not exists f1_round_snapshots_year_round_idx on public.f1_round_snapshots (year, round);

alter table public.f1_season_snapshots enable row level security;
alter table public.f1_round_snapshots enable row level security;

drop policy if exists "f1_season_snapshots_public_read" on public.f1_season_snapshots;
create policy "f1_season_snapshots_public_read"
  on public.f1_season_snapshots
  for select
  to anon, authenticated
  using (true);

drop policy if exists "f1_round_snapshots_public_read" on public.f1_round_snapshots;
create policy "f1_round_snapshots_public_read"
  on public.f1_round_snapshots
  for select
  to anon, authenticated
  using (true);

-- Writes: service role only (bypasses RLS). No insert/update policies for anon.
