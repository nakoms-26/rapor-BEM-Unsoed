alter table public.rapor_scores
  drop constraint if exists rapor_scores_total_avg_check;

alter table public.rapor_scores
  add constraint rapor_scores_total_avg_check
  check (total_avg between 0 and 100);