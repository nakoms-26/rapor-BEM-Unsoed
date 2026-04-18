alter table public.rapor_details
  add column if not exists bentuk_tanggung_jawab text,
  add column if not exists nilai_kuantitatif_tanggung_jawab numeric(4,2),
  add column if not exists skala text,
  add column if not exists nilai_kuantitatif_skala numeric(4,2),
  add column if not exists nilai_kualitatif numeric(3,2),
  add column if not exists nilai_akhir numeric(4,2);