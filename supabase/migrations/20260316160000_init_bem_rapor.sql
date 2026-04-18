-- BEM Monthly Report System
-- Run in Supabase SQL Editor or via Supabase migrations.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'menko', 'user');
  end if;

  if not exists (select 1 from pg_type where typname = 'unit_kategori') then
    create type unit_kategori as enum ('kemenko', 'kementerian', 'biro');
  end if;

  if not exists (select 1 from pg_type where typname = 'period_status') then
    create type period_status as enum ('draft', 'published');
  end if;
end $$;

create table if not exists public.ref_units (
  id uuid primary key default gen_random_uuid(),
  nama_unit text not null unique,
  kategori unit_kategori not null,
  parent_id uuid null references public.ref_units(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  nim text primary key,
  nama_lengkap text not null,
  unit_id uuid not null references public.ref_units(id) on delete restrict,
  role app_role not null default 'user',
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rapor_periods (
  id uuid primary key default gen_random_uuid(),
  bulan int not null check (bulan between 1 and 12),
  tahun int not null check (tahun between 2000 and 2100),
  status period_status not null default 'draft',
  created_at timestamptz not null default now(),
  unique (bulan, tahun)
);

create table if not exists public.rapor_scores (
  id uuid primary key default gen_random_uuid(),
  user_nim text not null references public.profiles(nim) on delete cascade,
  periode_id uuid not null references public.rapor_periods(id) on delete cascade,
  penilai_nim text not null references public.profiles(nim) on delete restrict,
  total_avg numeric(5,2) not null default 0 check (total_avg between 0 and 100),
  created_at timestamptz not null default now(),
  unique (user_nim, periode_id)
);

create table if not exists public.rapor_details (
  id uuid primary key default gen_random_uuid(),
  rapor_id uuid not null references public.rapor_scores(id) on delete cascade,
  main_indicator_name text not null,
  sub_indicator_name text not null,
  catatan text,
  score numeric(3,2) not null check (score between 0 and 5),
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_unit on public.profiles(unit_id);
create index if not exists idx_scores_user on public.rapor_scores(user_nim);
create index if not exists idx_scores_period on public.rapor_scores(periode_id);
create index if not exists idx_details_rapor on public.rapor_details(rapor_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Helper: derive current user's NIM from profile relation
create or replace function public.current_nim()
returns text
language sql
stable
as $$
  select p.nim
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1
$$;

-- Helper: check whether user is menko for a specific unit parent
create or replace function public.is_menko_for_parent(target_parent uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role = 'menko'
      and p.unit_id = target_parent
  )
$$;

alter table public.ref_units enable row level security;
alter table public.profiles enable row level security;
alter table public.rapor_periods enable row level security;
alter table public.rapor_scores enable row level security;
alter table public.rapor_details enable row level security;

-- profiles policies
create policy "profiles self or admin can read"
on public.profiles
for select
using (
  nim = public.current_nim()
  or exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid() and p.role = 'admin'
  )
);

create policy "admin can manage profiles"
on public.profiles
for all
using (
  exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid() and p.role = 'admin'
  )
);

-- units and periods readable for authenticated users
create policy "authenticated can read units"
on public.ref_units
for select
using (auth.uid() is not null);

create policy "authenticated can read periods"
on public.rapor_periods
for select
using (auth.uid() is not null);

-- only admin manages ref data
create policy "admin manage units"
on public.ref_units
for all
using (
  exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid() and p.role = 'admin'
  )
);

create policy "admin manage periods"
on public.rapor_periods
for all
using (
  exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid() and p.role = 'admin'
  )
);

-- rapor_scores policies
create policy "admin insert rapor_scores"
on public.rapor_scores
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid() and p.role = 'admin'
  )
);

create policy "staff read own rapor_scores"
on public.rapor_scores
for select
using (user_nim = public.current_nim());

create policy "menko read coordinated rapor_scores"
on public.rapor_scores
for select
using (
  exists (
    select 1
    from public.profiles staff
    join public.ref_units u on u.id = staff.unit_id
    where staff.nim = rapor_scores.user_nim
      and public.is_menko_for_parent(u.parent_id)
  )
);

-- rapor_details policies
create policy "admin insert rapor_details"
on public.rapor_details
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid() and p.role = 'admin'
  )
);

create policy "staff read own rapor_details"
on public.rapor_details
for select
using (
  exists (
    select 1
    from public.rapor_scores rs
    where rs.id = rapor_details.rapor_id
      and rs.user_nim = public.current_nim()
  )
);

create policy "menko read coordinated rapor_details"
on public.rapor_details
for select
using (
  exists (
    select 1
    from public.rapor_scores rs
    join public.profiles staff on staff.nim = rs.user_nim
    join public.ref_units u on u.id = staff.unit_id
    where rs.id = rapor_details.rapor_id
      and public.is_menko_for_parent(u.parent_id)
  )
);

-- Optional seed: adjust names according to your final BEM structure
insert into public.ref_units (nama_unit, kategori, parent_id)
values
  ('Kemenko Internal', 'kemenko', null),
  ('Kemenko Eksternal', 'kemenko', null),
  ('Kementerian PSDM', 'kementerian', (select id from public.ref_units where nama_unit = 'Kemenko Internal')),
  ('Kementerian Dalam Negeri', 'kementerian', (select id from public.ref_units where nama_unit = 'Kemenko Internal')),
  ('Kementerian Hubungan Luar', 'kementerian', (select id from public.ref_units where nama_unit = 'Kemenko Eksternal')),
  ('Biro PPM', 'biro', null)
on conflict (nama_unit) do nothing;
