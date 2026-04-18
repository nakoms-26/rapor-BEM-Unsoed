alter table public.rapor_details
  drop constraint if exists rapor_details_score_check;

alter table public.rapor_details
  alter column score type numeric(5,2)
  using score::numeric(5,2);

alter table public.rapor_details
  add constraint rapor_details_score_check
  check (score between 0 and 100);
