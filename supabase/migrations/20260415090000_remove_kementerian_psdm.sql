do $$
declare
  old_unit_id uuid;
  new_unit_id uuid;
begin
  select id into old_unit_id
  from public.ref_units
  where nama_unit = 'Kementerian PSDM';

  if old_unit_id is null then
    return;
  end if;

  select id into new_unit_id
  from public.ref_units
  where nama_unit = 'Kementerian Pengembangan Sumber Daya Mahasiswa';

  if new_unit_id is null then
    raise exception 'Unit pengganti Kementerian Pengembangan Sumber Daya Mahasiswa tidak ditemukan.';
  end if;

  update public.profiles
  set unit_id = new_unit_id
  where unit_id = old_unit_id;

  update public.evaluator_unit_assignments
  set target_unit_id = new_unit_id
  where target_unit_id = old_unit_id;

  update public.pj_assignments
  set target_unit_id = new_unit_id
  where target_unit_id = old_unit_id;

  delete from public.ref_units
  where id = old_unit_id;
end $$;
