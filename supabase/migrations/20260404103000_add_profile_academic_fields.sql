alter table public.profiles
add column if not exists jurusan text null;

alter table public.profiles
add column if not exists tahun_angkatan int null check (tahun_angkatan between 2000 and 2100);