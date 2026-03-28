-- Auto-create profile after Auth sign up
-- This enables self registration from the login page (Sign Up).

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_unit_id uuid;
  new_nim text;
  new_name text;
begin
  -- NIM is derived from virtual email format: NIM@bem.local
  new_nim := upper(split_part(new.email, '@', 1));
  new_name := coalesce(new.raw_user_meta_data ->> 'nama_lengkap', new_nim);

  select id into default_unit_id
  from public.ref_units
  where nama_unit = 'Biro PPM'
  limit 1;

  if default_unit_id is null then
    select id into default_unit_id
    from public.ref_units
    order by created_at asc
    limit 1;
  end if;

  if default_unit_id is null then
    raise exception 'Tidak ada unit terdaftar. Isi ref_units terlebih dahulu.';
  end if;

  insert into public.profiles (nim, nama_lengkap, unit_id, role, auth_user_id)
  values (new_nim, new_name, default_unit_id, 'user', new.id)
  on conflict (nim)
  do update set
    nama_lengkap = excluded.nama_lengkap,
    auth_user_id = excluded.auth_user_id,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();
