-- Seed rapor periods for year 2026.
-- March 2026 is set as published so recap dashboards have an active period.

insert into public.rapor_periods (bulan, tahun, status)
values
  (1, 2026, 'draft'),
  (2, 2026, 'draft'),
  (3, 2026, 'published'),
  (4, 2026, 'draft'),
  (5, 2026, 'draft'),
  (6, 2026, 'draft'),
  (7, 2026, 'draft'),
  (8, 2026, 'draft'),
  (9, 2026, 'draft'),
  (10, 2026, 'draft'),
  (11, 2026, 'draft'),
  (12, 2026, 'draft')
on conflict (bulan, tahun) do update
set status = excluded.status;
