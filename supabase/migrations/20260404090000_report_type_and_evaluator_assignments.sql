do $$
begin
	if not exists (select 1 from pg_type where typname = 'rapor_type') then
		create type rapor_type as enum ('staf_unit', 'menteri_kepala_biro');
	end if;
end $$;

alter table public.rapor_scores
add column if not exists report_type rapor_type not null default 'staf_unit';

update public.rapor_scores rs
set report_type = case
	when p.role = 'menteri' then 'menteri_kepala_biro'::rapor_type
	else 'staf_unit'::rapor_type
end
from public.profiles p
where p.nim = rs.user_nim;

create table if not exists public.evaluator_unit_assignments (
	id uuid primary key default gen_random_uuid(),
	evaluator_nim text not null references public.profiles(nim) on delete cascade,
	target_unit_id uuid not null references public.ref_units(id) on delete cascade,
	is_active boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (evaluator_nim)
);

drop trigger if exists trg_evaluator_unit_assignments_updated_at on public.evaluator_unit_assignments;
create trigger trg_evaluator_unit_assignments_updated_at
before update on public.evaluator_unit_assignments
for each row
execute function public.set_updated_at();

create index if not exists idx_evaluator_assignments_target_unit
	on public.evaluator_unit_assignments(target_unit_id);
