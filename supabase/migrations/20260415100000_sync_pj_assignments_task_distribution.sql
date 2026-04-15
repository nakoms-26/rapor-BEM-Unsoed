-- Sync PJ assignments based on approved task distribution.
-- Idempotent migration: safe to run multiple times.

BEGIN;

-- 0) Allow one person to hold multiple active kemenko assignments.
DROP INDEX IF EXISTS public.uq_pj_assignments_one_active_kemenko_per_nim;

-- 1) Mapping PJ lingkar (scope kemenko)
CREATE TEMP TABLE tmp_pj_kemenko_map (
  nama_lengkap text,
  nama_unit text
) ON COMMIT DROP;

INSERT INTO tmp_pj_kemenko_map (nama_lengkap, nama_unit)
VALUES
  ('Novebri Rouli Simbolon', 'Sekretaris Jenderal'),
  ('Novebri Rouli Simbolon', 'Satuan Pengawas Internal'),
  ('Yesenia Kalila Ramadhani', 'Pemberdayaan Mahasiswa'),
  ('Zahra Indria Puspita', 'Politik Pergerakan'),
  ('Muhammad Fairuzy Alsya''Bani', 'Relasi Publik'),
  ('Abu Akhsin Ismail Husna', 'Riset dan Media');

-- 2) Mapping PJ kementerian/biro (scope unit)
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

-- 3) Validation: all names and unit names must exist
DO $$
DECLARE
  missing_people text;
  missing_units_kemenko text;
  missing_units_unit text;
BEGIN
  SELECT string_agg(m.nama_lengkap, ', ')
  INTO missing_people
  FROM (
    SELECT nama_lengkap FROM tmp_pj_kemenko_map
    UNION
    SELECT nama_lengkap FROM tmp_pj_unit_map
  ) m
  LEFT JOIN public.profiles p ON p.nama_lengkap = m.nama_lengkap
  WHERE p.nim IS NULL;

  IF missing_people IS NOT NULL THEN
    RAISE EXCEPTION 'Nama berikut tidak ditemukan di profiles: %', missing_people;
  END IF;

  SELECT string_agg(m.nama_unit, ', ')
  INTO missing_units_kemenko
  FROM tmp_pj_kemenko_map m
  LEFT JOIN public.ref_units u ON u.nama_unit = m.nama_unit
  WHERE u.id IS NULL;

  IF missing_units_kemenko IS NOT NULL THEN
    RAISE EXCEPTION 'Unit lingkar berikut tidak ditemukan di ref_units: %', missing_units_kemenko;
  END IF;

  SELECT string_agg(m.nama_unit, ', ')
  INTO missing_units_unit
  FROM tmp_pj_unit_map m
  LEFT JOIN public.ref_units u ON u.nama_unit = m.nama_unit
  WHERE u.id IS NULL;

  IF missing_units_unit IS NOT NULL THEN
    RAISE EXCEPTION 'Unit kementerian/biro berikut tidak ditemukan di ref_units: %', missing_units_unit;
  END IF;
END $$;

-- 4) Upsert active kemenko assignments
WITH resolved AS (
  SELECT p.nim, u.id AS target_unit_id
  FROM tmp_pj_kemenko_map m
  JOIN public.profiles p ON p.nama_lengkap = m.nama_lengkap
  JOIN public.ref_units u ON u.nama_unit = m.nama_unit
  WHERE u.kategori = 'kemenko'
)
INSERT INTO public.pj_assignments (nim, target_unit_id, scope, is_active, created_at, updated_at)
SELECT nim, target_unit_id, 'kemenko'::public.pj_assignment_scope, true, now(), now()
FROM resolved
ON CONFLICT (nim, scope, target_unit_id)
DO UPDATE SET
  is_active = true,
  updated_at = now();

-- 5) Deactivate stale kemenko assignments for mapped people
WITH mapped AS (
  SELECT p.nim, u.id AS target_unit_id
  FROM tmp_pj_kemenko_map m
  JOIN public.profiles p ON p.nama_lengkap = m.nama_lengkap
  JOIN public.ref_units u ON u.nama_unit = m.nama_unit
  WHERE u.kategori = 'kemenko'
),
mapped_people AS (
  SELECT DISTINCT nim FROM mapped
)
UPDATE public.pj_assignments pa
SET is_active = false, updated_at = now()
WHERE pa.scope = 'kemenko'::public.pj_assignment_scope
  AND pa.nim IN (SELECT nim FROM mapped_people)
  AND pa.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM mapped m
    WHERE m.nim = pa.nim
      AND m.target_unit_id = pa.target_unit_id
  );

-- 6) Upsert active unit assignments
WITH resolved AS (
  SELECT p.nim, u.id AS target_unit_id
  FROM tmp_pj_unit_map m
  JOIN public.profiles p ON p.nama_lengkap = m.nama_lengkap
  JOIN public.ref_units u ON u.nama_unit = m.nama_unit
  WHERE u.kategori IN ('kementerian', 'biro')
)
INSERT INTO public.pj_assignments (nim, target_unit_id, scope, is_active, created_at, updated_at)
SELECT nim, target_unit_id, 'unit'::public.pj_assignment_scope, true, now(), now()
FROM resolved
ON CONFLICT (nim, scope, target_unit_id)
DO UPDATE SET
  is_active = true,
  updated_at = now();

-- 7) Deactivate stale unit assignments for mapped people
WITH mapped AS (
  SELECT p.nim, u.id AS target_unit_id
  FROM tmp_pj_unit_map m
  JOIN public.profiles p ON p.nama_lengkap = m.nama_lengkap
  JOIN public.ref_units u ON u.nama_unit = m.nama_unit
  WHERE u.kategori IN ('kementerian', 'biro')
),
mapped_people AS (
  SELECT DISTINCT nim FROM mapped
)
UPDATE public.pj_assignments pa
SET is_active = false, updated_at = now()
WHERE pa.scope = 'unit'::public.pj_assignment_scope
  AND pa.nim IN (SELECT nim FROM mapped_people)
  AND pa.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM mapped m
    WHERE m.nim = pa.nim
      AND m.target_unit_id = pa.target_unit_id
  );

-- 8) Sync evaluator assignment table used by admin input flow
WITH resolved AS (
  SELECT p.nim AS evaluator_nim, u.id AS target_unit_id
  FROM tmp_pj_unit_map m
  JOIN public.profiles p ON p.nama_lengkap = m.nama_lengkap
  JOIN public.ref_units u ON u.nama_unit = m.nama_unit
  WHERE u.kategori IN ('kementerian', 'biro')
)
INSERT INTO public.evaluator_unit_assignments (evaluator_nim, target_unit_id, is_active, created_at, updated_at)
SELECT evaluator_nim, target_unit_id, true, now(), now()
FROM resolved
ON CONFLICT (evaluator_nim)
DO UPDATE SET
  target_unit_id = EXCLUDED.target_unit_id,
  is_active = true,
  updated_at = now();

-- 9) Sync profile role and flags for mapped people
WITH mapped_people AS (
  SELECT DISTINCT p.nim
  FROM (
    SELECT nama_lengkap FROM tmp_pj_kemenko_map
    UNION
    SELECT nama_lengkap FROM tmp_pj_unit_map
  ) x
  JOIN public.profiles p ON p.nama_lengkap = x.nama_lengkap
)
UPDATE public.profiles p
SET
  role = 'pj_kementerian',
  is_pj_kemenkoan = EXISTS (
    SELECT 1
    FROM public.pj_assignments pa
    WHERE pa.nim = p.nim
      AND pa.scope = 'kemenko'::public.pj_assignment_scope
      AND pa.is_active = true
  ),
  can_access_kemenko_report = EXISTS (
    SELECT 1
    FROM public.pj_assignments pa
    WHERE pa.nim = p.nim
      AND pa.scope = 'kemenko'::public.pj_assignment_scope
      AND pa.is_active = true
  ),
  updated_at = now()
WHERE p.nim IN (SELECT nim FROM mapped_people);

COMMIT;

-- 10) Verification queries
SELECT
  p.nama_lengkap,
  p.nim,
  p.role,
  p.is_pj_kemenkoan,
  p.can_access_kemenko_report
FROM public.profiles p
WHERE p.role = 'pj_kementerian'
ORDER BY p.nama_lengkap;

SELECT
  p.nama_lengkap,
  pa.scope,
  u.nama_unit,
  pa.is_active
FROM public.pj_assignments pa
JOIN public.profiles p ON p.nim = pa.nim
JOIN public.ref_units u ON u.id = pa.target_unit_id
WHERE pa.is_active = true
ORDER BY p.nama_lengkap, pa.scope, u.nama_unit;
