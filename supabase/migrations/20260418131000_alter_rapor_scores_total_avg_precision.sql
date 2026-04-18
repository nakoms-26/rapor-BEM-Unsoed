alter table public.rapor_scores
  alter column total_avg type numeric(5,2)
  using total_avg::numeric(5,2);