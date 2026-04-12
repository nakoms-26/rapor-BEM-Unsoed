-- Set PJ Kemenkoan flags and enforce one active kemenko access per PJ.
-- Based on approved mapping from task distribution.

BEGIN;

-- 1) Mapping PJ Kemenkoan -> exactly one kemenko unit
CREATE TEMP TABLE tmp_pj_kemenko_map (
  nama_lengkap text,
  nama_unit text
) ON COMMIT DROP;
ZZz
INSERT INTO tmp_pj_kemenko_map (nama_lengkap, nama_unit)
VALUES
  ('Novebri Rouli Simbolon', 'Sekretaris Jenderal'),
  ('Yesenia Kalila Ramadhani', 'Pemberdayaan Mahasiswa'),
  ('Zahra Indria Puspita', 'Politik Pergerakan'),
  ('Muhammad Fairuzy Alsya''Bani', 'Relasi Publik'),
  ('Abu Akhsin Ismail Husna', 'Riset dan Media');

-- 1a) Mapping PJ Kementerian -> exactly one unit
CREATE TEMP TABLE tmp_pj_unit_map (
  nama_lengkap text,
  nama_unit text
) ON COMMIT DROP;

INSERT INTO tmp_pj_unit_map (nama_lengkap, nama_unit)
VALUES
  ('Raden Roro Arimbi Fahti Ningrat', 'Biro Kesekretariatan'),
  ('Nailah Aqila Zahwa Siregar', 'Biro Keuangan'),
  ('Cheryl Anastasya Dwi Permatasari', 'Biro Pengendali & Penjamin Mutu'),
  ('Ezar Ogya Pandita', 'Biro Pengembangan Sumber Daya Anggota'),
  ('Abu Akhsin Ismail Husna', 'Kementerian Pengembangan Sumber Daya Mahasiswa'),
  ('Muhammad Fairuzy Alsya''Bani', 'Kementerian Prestasi dan Inovasi'),
  ('Zahra Indria Puspita', 'Kementerian Seni dan Olahraga'),
  ('Danish Arinal Haq', 'Kementerian Advokasi dan Kesejahteraan Mahasiswa'),
  ('Tita Willy Nurlatifah', 'Kementerian Aksi dan Propaganda'),
  ('Aman Santoso', 'Kementerian Analisis Isu Strategis'),
  ('Meylani Trihapsari', 'Kementerian Pemberdayaan Perempuan'),
  ('Salfiah Rahni', 'Kementerian Dalam Negeri'),
  ('Nahdiyatur Rizqo', 'Kementerian Luar Negeri'),
  ('Novebri Rouli Simbolon', 'Kementerian Pengabdian Masyarakat'),
  ('Yudhistira Eka Wardhana', 'Kementerian Media Komunikasi dan Informasi'),
  ('Yesenia Kalila Ramadhani', 'Kementerian Media Kreatif dan Aplikatif'),
  ('Mutia Nur Ummami', 'Kementerian Riset dan Data');

-- 2) Reset flags for all pj_kementerian first
UPDATE public.profiles
SET
  is_pj_kemenkoan = false,
  can_access_kemenko_report = false,
  updated_at = now()
WHERE role = 'pj_kementerian';

-- 3) Upsert active kemenko assignment from mapping
WITH resolved AS (
  SELECT
    p.nim,
    u.id AS target_unit_id
  FROM tmp_pj_kemenko_map m
  JOIN public.profiles p ON p.nama_lengkap = m.nama_lengkap
  JOIN public.ref_units u ON u.nama_unit = m.nama_unit
  WHERE u.kategori = 'kemenko'
)
INSERT INTO public.pj_assignments (nim, target_unit_id, scope, is_active, created_at, updated_at)
SELECT
  r.nim,
  r.target_unit_id,
  'kemenko'::public.pj_assignment_scope,
  true,
  now(),
  now()
FROM resolved r
ON CONFLICT (nim, scope, target_unit_id)
DO UPDATE SET
  is_active = true,
  updated_at = now();

-- 4) Deactivate any other active kemenko assignments for the same PJ
WITH resolved AS (
  SELECT
    p.nim,
    u.id AS target_unit_id
  FROM tmp_pj_kemenko_map m
  JOIN public.profiles p ON p.nama_lengkap = m.nama_lengkap
  JOIN public.ref_units u ON u.nama_unit = m.nama_unit
  WHERE u.kategori = 'kemenko'
)
UPDATE public.pj_assignments pa
SET
  is_active = false,
  updated_at = now()
FROM resolved r
WHERE pa.nim = r.nim
  AND pa.scope = 'kemenko'::public.pj_assignment_scope
  AND pa.is_active = true
  AND pa.target_unit_id <> r.target_unit_id;

-- 5) Set profile flags for mapped PJ Kemenkoan
WITH resolved AS (
  SELECT p.nim
  FROM tmp_pj_kemenko_map m
  JOIN public.profiles p ON p.nama_lengkap = m.nama_lengkap
)
UPDATE public.profiles p
SET
  is_pj_kemenkoan = true,
  can_access_kemenko_report = true,
  updated_at = now()
WHERE p.nim IN (SELECT nim FROM resolved);

-- 5a) Upsert active unit assignment for PJ Kementerian mapping
WITH resolved AS (
  SELECT
    p.nim,
    u.id AS target_unit_id
  FROM tmp_pj_unit_map m
  JOIN public.profiles p ON p.nama_lengkap = m.nama_lengkap
  JOIN public.ref_units u ON u.nama_unit = m.nama_unit
  WHERE u.kategori IN ('kementerian', 'biro')
)
INSERT INTO public.pj_assignments (nim, target_unit_id, scope, is_active, created_at, updated_at)
SELECT
  r.nim,
  r.target_unit_id,
  'unit'::public.pj_assignment_scope,
  true,
  now(),
  now()
FROM resolved r
ON CONFLICT (nim, scope, target_unit_id)
DO UPDATE SET
  is_active = true,
  updated_at = now();

-- 5b) Ensure one active unit assignment per mapped PJ Kementerian
WITH resolved AS (
  SELECT
    p.nim,
    u.id AS target_unit_id
  FROM tmp_pj_unit_map m
  JOIN public.profiles p ON p.nama_lengkap = m.nama_lengkap
  JOIN public.ref_units u ON u.nama_unit = m.nama_unit
  WHERE u.kategori IN ('kementerian', 'biro')
)
UPDATE public.pj_assignments pa
SET
  is_active = false,
  updated_at = now()
FROM resolved r
WHERE pa.nim = r.nim
  AND pa.scope = 'unit'::public.pj_assignment_scope
  AND pa.is_active = true
  AND pa.target_unit_id <> r.target_unit_id;

-- 6) Enforce rule at DB level: one active kemenko assignment per nim
CREATE UNIQUE INDEX IF NOT EXISTS uq_pj_assignments_one_active_kemenko_per_nim
ON public.pj_assignments (nim)
WHERE scope = 'kemenko'::public.pj_assignment_scope
  AND is_active = true;

-- 6a) Enforce one active unit assignment per nim
CREATE UNIQUE INDEX IF NOT EXISTS uq_pj_assignments_one_active_unit_per_nim
ON public.pj_assignments (nim)
WHERE scope = 'unit'::public.pj_assignment_scope
  AND is_active = true;

-- 7) Verification output
SELECT
  p.nim,
  p.nama_lengkap,
  p.role,
  p.is_pj_kemenkoan,
  p.can_access_kemenko_report,
  u.nama_unit AS kemenko_diakses
FROM public.profiles p
LEFT JOIN public.pj_assignments pa
  ON pa.nim = p.nim
 AND pa.scope = 'kemenko'::public.pj_assignment_scope
 AND pa.is_active = true
LEFT JOIN public.ref_units u ON u.id = pa.target_unit_id
WHERE p.nama_lengkap IN (
  'Novebri Rouli Simbolon',
  'Yesenia Kalila Ramadhani',
  'Zahra Indria Puspita',
  'Muhammad Fairuzy Alsya''Bani',
  'Abu Akhsin Ismail Husna'
)
ORDER BY p.nama_lengkap;

SELECT
  p.nim,
  p.nama_lengkap,
  u.nama_unit AS unit_diampu,
  pa.is_active
FROM public.profiles p
LEFT JOIN public.pj_assignments pa
  ON pa.nim = p.nim
 AND pa.scope = 'unit'::public.pj_assignment_scope
LEFT JOIN public.ref_units u ON u.id = pa.target_unit_id
WHERE p.nama_lengkap IN (
  'Raden Roro Arimbi Fahti Ningrat',
  'Nailah Aqila Zahwa Siregar',
  'Cheryl Anastasya Dwi Permatasari',
  'Ezar Ogya Pandita',
  'Abu Akhsin Ismail Husna',
  'Muhammad Fairuzy Alsya''Bani',
  'Zahra Indria Puspita',
  'Danish Arinal Haq',
  'Tita Willy Nurlatifah',
  'Aman Santoso',
  'Meylani Trihapsari',
  'Salfiah Rahni',
  'Nahdiyatur Rizqo',
  'Novebri Rouli Simbolon',
  'Yudhistira Eka Wardhana',
  'Yesenia Kalila Ramadhani',
  'Mutia Nur Ummami'
)
ORDER BY p.nama_lengkap, pa.is_active DESC;

COMMIT;
