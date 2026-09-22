-- =============================================================================
-- Migration: Assign PJ Internship (Unit-Level Evaluator)
-- Penugasan PJ Internship untuk setiap kementerian dan biro (Cakrawala).
--
-- 1. F1F026056 -> dagri, pi
-- 2. A1F026076 -> risdat, lugri
-- 3. B1D026067 -> pempu, keu, adkesma
-- 4. C1B026046 -> akspro, pengmas, anstrat
-- 5. F1F026118 -> seniora, kestari, psda
-- 6. E1A026023 -> psdm, medkraf, medkom
-- =============================================================================

BEGIN;

-- 1. Update role profiles PJ ke 'pj_ppm_intern' (jika belum admin)
UPDATE public.profiles
SET
  role = 'pj_ppm_intern',
  updated_at = now()
WHERE nim IN (
  'F1F026056',
  'A1F026076',
  'B1D026067',
  'C1B026046',
  'F1F026118',
  'E1A026023'
)
AND role NOT IN ('admin');

-- 2. Insert/Upsert PJ Assignments (Scope: 'unit')
WITH assignment_data (nim, nama_unit) AS (
  VALUES
    -- F1F026056
    ('F1F026056', 'Kementerian Dalam Negeri'),
    ('F1F026056', 'Kementerian Prestasi dan Inovasi'),

    -- A1F026076
    ('A1F026076', 'Kementerian Riset dan Data'),
    ('A1F026076', 'Kementerian Luar Negeri'),

    -- B1D026067
    ('B1D026067', 'Kementerian Pemberdayaan Perempuan'),
    ('B1D026067', 'Biro Keuangan'),
    ('B1D026067', 'Kementerian Advokasi Kesejahteraan Mahasiswa'),

    -- C1B026046
    ('C1B026046', 'Kementerian Aksi dan Propaganda'),
    ('C1B026046', 'Kementerian Pengabdian Masyarakat'),
    ('C1B026046', 'Kementerian Analisis Isu Strategis'),

    -- F1F026118
    ('F1F026118', 'Kementerian Seni dan Olahraga'),
    ('F1F026118', 'Biro Kesekretariatan'),
    ('F1F026118', 'Biro Pengembangan Sumber Daya Anggota'),

    -- E1A026023
    ('E1A026023', 'Kementerian Pengembangan Sumber Daya Mahasiswa'),
    ('E1A026023', 'Kementerian Media Kreatif dan Aplikatif'),
    ('E1A026023', 'Kementerian Media Komunikasi dan Informasi')
)
INSERT INTO public.pj_assignments (id, nim, target_unit_id, scope, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  d.nim,
  u.id,
  'unit'::public.pj_assignment_scope,
  true,
  now(),
  now()
FROM assignment_data d
JOIN public.ref_units u ON u.nama_unit = d.nama_unit
ON CONFLICT (nim, scope, target_unit_id)
DO UPDATE SET
  is_active = true,
  updated_at = now();

COMMIT;

-- 3. Query Verifikasi untuk melihat hasil penugasan
SELECT
  p.nim,
  p.nama_lengkap,
  p.role,
  p.is_pj_kemenkoan,
  u.nama_unit,
  u.kategori,
  pa.scope,
  pa.is_active
FROM public.pj_assignments pa
JOIN public.profiles p ON p.nim = pa.nim
JOIN public.ref_units u ON u.id = pa.target_unit_id
WHERE pa.nim IN (
  'F1F026056',
  'A1F026076',
  'B1D026067',
  'C1B026046',
  'F1F026118',
  'E1A026023'
)
ORDER BY p.nim, u.nama_unit;
