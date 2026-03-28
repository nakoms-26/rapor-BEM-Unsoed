-- Final hardening migration: constraints, indexes, and legacy role cleanup.
-- Safe to run multiple times.

-- 1) Cleanup legacy role values and set final default role.
update public.profiles
set role = 'staff'
where role = 'user';

alter table public.profiles
alter column role set default 'staff';

-- Prevent legacy role from being inserted again.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_no_legacy_user_chk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_role_no_legacy_user_chk
    check (role <> 'user');
  end if;
end $$;

-- 2) Enforce data integrity for one score per user per period and one period per month-year.
create unique index if not exists uq_rapor_scores_user_periode
  on public.rapor_scores(user_nim, periode_id);

create unique index if not exists uq_rapor_periods_bulan_tahun
  on public.rapor_periods(bulan, tahun);

-- 3) Add stricter quality checks for indicator names.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rapor_details_main_indicator_not_blank_chk'
      and conrelid = 'public.rapor_details'::regclass
  ) then
    alter table public.rapor_details
    add constraint rapor_details_main_indicator_not_blank_chk
    check (length(trim(main_indicator_name)) > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rapor_details_sub_indicator_not_blank_chk'
      and conrelid = 'public.rapor_details'::regclass
  ) then
    alter table public.rapor_details
    add constraint rapor_details_sub_indicator_not_blank_chk
    check (length(trim(sub_indicator_name)) > 0);
  end if;
end $$;

-- 4) Performance indexes for common access patterns.
create index if not exists idx_profiles_role_unit
  on public.profiles(role, unit_id);

create index if not exists idx_scores_periode_user
  on public.rapor_scores(periode_id, user_nim);

create index if not exists idx_scores_penilai
  on public.rapor_scores(penilai_nim);

create index if not exists idx_sessions_expires_nim
  on public.app_sessions(expires_at, nim);
