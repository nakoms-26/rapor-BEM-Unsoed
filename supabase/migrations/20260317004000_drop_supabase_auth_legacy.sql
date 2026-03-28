-- Remove legacy Supabase Auth integration after migrating to table-based auth.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();

drop policy if exists "profiles self or admin can read" on public.profiles;
drop policy if exists "admin can manage profiles" on public.profiles;
drop policy if exists "authenticated can read units" on public.ref_units;
drop policy if exists "authenticated can read periods" on public.rapor_periods;
drop policy if exists "admin manage units" on public.ref_units;
drop policy if exists "admin manage periods" on public.rapor_periods;
drop policy if exists "admin insert rapor_scores" on public.rapor_scores;
drop policy if exists "staff read own rapor_scores" on public.rapor_scores;
drop policy if exists "menko read coordinated rapor_scores" on public.rapor_scores;
drop policy if exists "admin insert rapor_details" on public.rapor_details;
drop policy if exists "staff read own rapor_details" on public.rapor_details;
drop policy if exists "menko read coordinated rapor_details" on public.rapor_details;

alter table public.ref_units disable row level security;
alter table public.profiles disable row level security;
alter table public.rapor_periods disable row level security;
alter table public.rapor_scores disable row level security;
alter table public.rapor_details disable row level security;
alter table public.app_accounts disable row level security;
alter table public.app_sessions disable row level security;

drop function if exists public.current_nim();
drop function if exists public.is_menko_for_parent(uuid);

alter table public.profiles drop column if exists auth_user_id cascade;
