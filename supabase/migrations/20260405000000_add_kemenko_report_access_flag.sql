alter table public.profiles
add column if not exists can_access_kemenko_report boolean not null default false;

alter table public.profiles
add column if not exists is_pj_kemenkoan boolean not null default false;