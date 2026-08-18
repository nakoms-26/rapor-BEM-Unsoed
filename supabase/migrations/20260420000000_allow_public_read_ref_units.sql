-- Allow public / anon read access to ref_units table so the registration form can list units
drop policy if exists "authenticated can read units" on public.ref_units;
drop policy if exists "public can read units" on public.ref_units;
drop policy if exists "anyone can read units" on public.ref_units;

create policy "anyone can read units"
on public.ref_units
for select
using (true);
