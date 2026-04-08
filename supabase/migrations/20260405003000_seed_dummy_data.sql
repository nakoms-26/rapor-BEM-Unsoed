-- ============================================================================
-- Seed data untuk simulasi website yang sudah berjalan
-- Includes: dummy accounts, profiles, units, assignments, dan sample rapor data
-- ============================================================================

-- ============================================================================
-- 1. CLEAR EXISTING SEED DATA (optional, uncomment to reset)
-- ============================================================================
-- DELETE FROM public.rapor_details WHERE TRUE;
-- DELETE FROM public.rapor_scores WHERE TRUE;
-- DELETE FROM public.pj_assignments WHERE TRUE;
-- DELETE FROM public.app_sessions WHERE TRUE;
-- DELETE FROM public.app_accounts WHERE TRUE;
-- DELETE FROM public.profiles WHERE TRUE;

-- ============================================================================
-- 2. CREATE PROFILES FOR EACH ACCOUNT
-- ============================================================================

-- Note: Profiles must be created BEFORE app_accounts (foreign key constraint)
-- Assign unit_id from ref_units (get first unit from database)
INSERT INTO public.profiles (nim, nama_lengkap, role, unit_id, can_access_kemenko_report, is_pj_kemenkoan, created_at)
WITH default_unit AS (
  SELECT id FROM public.ref_units LIMIT 1
),
dummy_profiles AS (
  SELECT * FROM (
    VALUES
      ('A0001', 'Admin Sistem', 'admin'::public.app_role, true, false),
      ('M0001', 'Hendra Wijaya', 'menko'::public.app_role, true, false),
      ('M0002', 'Siti Nurhaliza', 'menko'::public.app_role, true, false),
      ('K0001', 'Budi Santoso', 'pj_kementerian'::public.app_role, false, false),
      ('K0002', 'Maya Kusuma', 'pj_kementerian'::public.app_role, false, false),
      ('K0003', 'Rafi Harahap', 'pj_kementerian'::public.app_role, false, false),
      ('MK0001', 'Dwi Prasetyo', 'menteri'::public.app_role, false, false),
      ('MK0002', 'Eka Wijaksana', 'menteri'::public.app_role, false, false),
      ('MT0001', 'Arif Setiawan', 'menteri'::public.app_role, false, false),
      ('MT0002', 'Putri Handoko', 'menteri'::public.app_role, false, false),
      ('MT0003', 'Gandi Surya', 'menteri'::public.app_role, false, false),
      ('S0001', 'Hendri Kusuma', 'staff'::public.app_role, false, false),
      ('S0002', 'Lina Suhendra', 'staff'::public.app_role, false, false),
      ('S0003', 'Ratna Widiastuti', 'staff'::public.app_role, false, false),
      ('S0004', 'Yoga Permana', 'staff'::public.app_role, false, false),
      ('P0001', 'Pratama Wiranto', 'pres_wapres'::public.app_role, false, false)
  ) AS t(nim, nama_lengkap, role, can_access_kemenko_report, is_pj_kemenkoan)
)
SELECT
  dp.nim,
  dp.nama_lengkap,
  dp.role,
  du.id,
  dp.can_access_kemenko_report,
  dp.is_pj_kemenkoan,
  now()
FROM dummy_profiles dp
CROSS JOIN default_unit du
ON CONFLICT (nim) DO UPDATE SET
  role = EXCLUDED.role,
  updated_at = now();

-- ============================================================================
-- 3. CREATE DUMMY ACCOUNTS
-- ============================================================================

-- All dummy accounts use: "dummypass123" as password for testing
INSERT INTO public.app_accounts (nim, password_hash)
SELECT * FROM (
  VALUES
    ('A0001', 'dummypass123_hash_A0001'),
    ('M0001', 'dummypass123_hash_M0001'),
    ('M0002', 'dummypass123_hash_M0002'),
    ('K0001', 'dummypass123_hash_K0001'),
    ('K0002', 'dummypass123_hash_K0002'),
    ('K0003', 'dummypass123_hash_K0003'),
    ('MK0001', 'dummypass123_hash_MK0001'),
    ('MK0002', 'dummypass123_hash_MK0002'),
    ('MT0001', 'dummypass123_hash_MT0001'),
    ('MT0002', 'dummypass123_hash_MT0002'),
    ('MT0003', 'dummypass123_hash_MT0003'),
    ('S0001', 'dummypass123_hash_S0001'),
    ('S0002', 'dummypass123_hash_S0002'),
    ('S0003', 'dummypass123_hash_S0003'),
    ('S0004', 'dummypass123_hash_S0004'),
    ('P0001', 'dummypass123_hash_P0001')
) AS t(nim, password_hash)
ON CONFLICT (nim) DO UPDATE SET
  updated_at = now();

-- ============================================================================
-- 4. CREATE PJ ASSIGNMENTS
-- ============================================================================

INSERT INTO public.pj_assignments (nim, target_unit_id, scope, is_active, created_at)
WITH unit_ids AS (
  SELECT id, kategori, ROW_NUMBER() OVER (PARTITION BY kategori ORDER BY created_at) as rn
  FROM public.ref_units
  WHERE kategori IN ('kemenko', 'kementerian', 'biro')
),
assignments AS (
  SELECT 'M0001'::text as nim, id as target_unit_id, 'kemenko'::public.pj_assignment_scope as scope
  FROM unit_ids WHERE kategori = 'kemenko' AND rn IN (1, 2)
  
  UNION ALL
  SELECT 'M0002', id, 'kemenko'::public.pj_assignment_scope
  FROM unit_ids WHERE kategori = 'kemenko' AND rn = 1
  
  UNION ALL
  SELECT 'K0001', id, 'unit'::public.pj_assignment_scope
  FROM unit_ids WHERE kategori IN ('kementerian', 'biro') AND rn = 1
  
  UNION ALL
  SELECT 'K0002', id, 'unit'::public.pj_assignment_scope
  FROM unit_ids WHERE kategori IN ('kementerian', 'biro') AND rn = 2
  
  UNION ALL
  SELECT 'K0003', id, 'unit'::public.pj_assignment_scope
  FROM unit_ids WHERE kategori IN ('kementerian', 'biro') AND rn = 3
)
SELECT nim, target_unit_id, scope, true, now()
FROM assignments
ON CONFLICT (nim, scope, target_unit_id) DO NOTHING;

-- ============================================================================
-- 5. CREATE SAMPLE RAPOR SCORES
-- ============================================================================

-- Get sample unit and menteri profiles for rapor_scores
WITH target_profiles AS (
  SELECT nim, nama_lengkap, role
  FROM public.profiles
  WHERE role IN ('menteri', 'staff')
  LIMIT 10
),
evaluator_profiles AS (
  SELECT nim, nama_lengkap, role
  FROM public.profiles
  WHERE role IN ('admin', 'menko', 'staff', 'pres_wapres')
  LIMIT 5
),
rapor_periods AS (
  SELECT id FROM public.rapor_periods
  LIMIT 3
)
INSERT INTO public.rapor_scores (
  user_nim,
  penilai_nim,
  periode_id,
  report_type,
  total_avg,
  catatan,
  created_at
)
SELECT
  tp.nim,
  ep.nim,
  rp.id,
  CASE
    WHEN tp.role = 'menteri' THEN 'menteri_kepala_biro'::public.rapor_type
    ELSE 'staf_unit'::public.rapor_type
  END,
  ROUND(CAST((RANDOM() * 4 + 1) AS numeric), 2),
  'Penilaian dummy untuk testing',
  now() - INTERVAL '1 day' * FLOOR(RANDOM() * 30)
FROM target_profiles tp
CROSS JOIN evaluator_profiles ep
CROSS JOIN rapor_periods rp
WHERE RANDOM() > 0.3 -- Create 70% probability of score existing
LIMIT 50
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. CREATE SAMPLE RAPOR DETAILS (sub-indicators)
-- ============================================================================

WITH scores AS (
  SELECT id
  FROM public.rapor_scores
  WHERE catatan = 'Penilaian dummy untuk testing'
  LIMIT 20
),
indicators AS (
  SELECT * FROM (
    VALUES
      ('Kompetensi Utama', 'Profesionalisme', 4.5),
      ('Kompetensi Utama', 'Komunikasi', 4.1),
      ('Kompetensi Utama', 'Inovasi', 4.4),
      ('Kompetensi Khusus', 'Kerjasama Tim', 4.5),
      ('Kompetensi Khusus', 'Manajemen Waktu', 3.9),
      ('Kompetensi Khusus', 'Inisiatif', 4.2)
  ) AS t(main_indicator, sub_indicator, nilai_default)
)
INSERT INTO public.rapor_details (
  rapor_id,
  main_indicator_name,
  sub_indicator_name,
  score,
  created_at
)
SELECT
  s.id,
  i.main_indicator,
  i.sub_indicator,
  ROUND(
    CAST((i.nilai_default + (RANDOM() - 0.5) * 0.8) AS numeric),
    2
  ),
  now()
FROM scores s
CROSS JOIN indicators i
WHERE RANDOM() > 0.1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. DISPLAY SEED RESULTS
-- ============================================================================

-- Show created accounts
SELECT 'Accounts Created' as info;
SELECT COUNT(*) as total_accounts FROM public.app_accounts;

SELECT 'Profiles Created' as info;
SELECT role, COUNT(*) as count FROM public.profiles GROUP BY role ORDER BY role;

SELECT 'PJ Assignments Created' as info;
SELECT COUNT(*) as total_assignments FROM public.pj_assignments WHERE is_active = true;

SELECT 'Rapor Scores Created' as info;
SELECT COUNT(*) as total_scores FROM public.rapor_scores WHERE catatan = 'Penilaian dummy untuk testing';

SELECT 'Sample Login Credentials (use nim as username)' as info;
SELECT p.nim, p.nama_lengkap, 'dummypass123' as password, p.role
FROM public.profiles p
JOIN public.app_accounts aa ON p.nim = aa.nim
ORDER BY p.role, p.nim;

-- End seed
