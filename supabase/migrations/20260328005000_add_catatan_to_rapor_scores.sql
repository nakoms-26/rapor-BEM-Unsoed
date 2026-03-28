-- Add notes column for admin input remarks.

alter table public.rapor_scores
add column if not exists catatan text null;
