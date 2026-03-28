-- Seed official BEM 26 organization structure for ref_units.
-- Hierarchy:
-- Lingkar Presiden -> Kemenko -> Kementerian/Biro

-- 1) Top-level: Lingkar Presiden
insert into public.ref_units (nama_unit, kategori, parent_id)
values ('Lingkar Presiden', 'kemenko', null)
on conflict (nama_unit) do update
set
  kategori = excluded.kategori,
  parent_id = excluded.parent_id;

-- 2) Kemenko under Lingkar Presiden
insert into public.ref_units (nama_unit, kategori, parent_id)
select
  seed.nama_unit,
  seed.kategori::unit_kategori,
  lp.id
from (
  values
    ('Sekretaris Jenderal', 'kemenko'),
    ('Satuan Pengawas Internal', 'kemenko'),
    ('Politik Pergerakan', 'kemenko'),
    ('Pemberdayaan Mahasiswa', 'kemenko'),
    ('Relasi Publik', 'kemenko'),
    ('Riset dan Media', 'kemenko')
) as seed(nama_unit, kategori)
join public.ref_units lp on lp.nama_unit = 'Lingkar Presiden'
on conflict (nama_unit) do update
set
  kategori = excluded.kategori,
  parent_id = excluded.parent_id;

-- 3) Biro/Kementerian under each Kemenko
insert into public.ref_units (nama_unit, kategori, parent_id)
select
  seed.nama_unit,
  seed.kategori::unit_kategori,
  parent.id
from (
  values
    ('Biro Kesekretariatan', 'biro', 'Sekretaris Jenderal'),
    ('Biro Keuangan', 'biro', 'Sekretaris Jenderal'),

    ('Biro Pengembangan Sumber Daya Anggota', 'biro', 'Satuan Pengawas Internal'),
    ('Biro Pengendali & Penjamin Mutu', 'biro', 'Satuan Pengawas Internal'),

    ('Kementerian Advokasi dan Kesejahteraan Mahasiswa', 'kementerian', 'Politik Pergerakan'),
    ('Kementerian Aksi dan Propaganda', 'kementerian', 'Politik Pergerakan'),
    ('Kementerian Analisis Isu Strategis', 'kementerian', 'Politik Pergerakan'),
    ('Kementerian Pemberdayaan Perempuan', 'kementerian', 'Politik Pergerakan'),

    ('Kementerian Pengembangan Sumber Daya Mahasiswa', 'kementerian', 'Pemberdayaan Mahasiswa'),
    ('Kementerian Seni dan Olahraga', 'kementerian', 'Pemberdayaan Mahasiswa'),
    ('Kementerian Prestasi dan Inovasi', 'kementerian', 'Pemberdayaan Mahasiswa'),

    ('Kementerian Dalam Negeri', 'kementerian', 'Relasi Publik'),
    ('Kementerian Luar Negeri', 'kementerian', 'Relasi Publik'),
    ('Kementerian Pengabdian Masyarakat', 'kementerian', 'Relasi Publik'),

    ('Kementerian Media Kreatif dan Aplikatif', 'kementerian', 'Riset dan Media'),
    ('Kementerian Media Komunikasi dan Informasi', 'kementerian', 'Riset dan Media'),
    ('Kementerian Riset dan Data', 'kementerian', 'Riset dan Media')
) as seed(nama_unit, kategori, parent_nama_unit)
join public.ref_units parent on parent.nama_unit = seed.parent_nama_unit
on conflict (nama_unit) do update
set
  kategori = excluded.kategori,
  parent_id = excluded.parent_id;
