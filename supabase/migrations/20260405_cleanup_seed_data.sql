-- ============================================================================
-- Cleanup Script - Menghapus semua dummy seed data secara clean
-- ============================================================================
-- Jalankan script ini untuk reset database ke kondisi sebelum seed
-- Urutan penghapusan diatur berdasarkan foreign key constraints

BEGIN;

-- ============================================================================
-- 1. DELETE RAPOR DETAILS (paling dalam dalam hierarchy)
-- ============================================================================
DELETE FROM public.rapor_details
WHERE rapor_score_id IN (
  SELECT id FROM public.rapor_scores
  WHERE catatan = 'Penilaian dummy untuk testing'
);

-- ============================================================================
-- 2. DELETE RAPOR SCORES
-- ============================================================================
DELETE FROM public.rapor_scores
WHERE catatan = 'Penilaian dummy untuk testing';

-- ============================================================================
-- 3. DELETE APP SESSIONS (references profiles)
-- ============================================================================
DELETE FROM public.app_sessions
WHERE app_account_id IN (
  SELECT id FROM public.app_accounts
  WHERE username LIKE 'admin%'
    OR username LIKE 'pj_kemenkoan%'
    OR username LIKE 'pj_kementerian%'
    OR username LIKE 'menko%'
    OR username LIKE 'menteri%'
    OR username LIKE 'staff%'
    OR username LIKE 'pres_wapres%'
);

-- ============================================================================
-- 4. DELETE PJ ASSIGNMENTS
-- ============================================================================
DELETE FROM public.pj_assignments
WHERE nim IN (
  SELECT nim FROM public.profiles
  WHERE nama_lengkap IN (
    'Admin Sistem',
    'Hendra Wijaya',
    'Siti Nurhaliza',
    'Budi Santoso',
    'Maya Kusuma',
    'Rafi Harahap',
    'Dwi Prasetyo',
    'Eka Wijaksana',
    'Arif Setiawan',
    'Putri Handoko',
    'Gandi Surya',
    'Hendri Kusuma',
    'Lina Suhendra',
    'Ratna Widiastuti',
    'Yoga Permana',
    'Pratama Wiranto'
  )
);

-- ============================================================================
-- 5. DELETE PROFILES
-- ============================================================================
DELETE FROM public.profiles
WHERE nama_lengkap IN (
  'Admin Sistem',
  'Hendra Wijaya',
  'Siti Nurhaliza',
  'Budi Santoso',
  'Maya Kusuma',
  'Rafi Harahap',
  'Dwi Prasetyo',
  'Eka Wijaksana',
  'Arif Setiawan',
  'Putri Handoko',
  'Gandi Surya',
  'Hendri Kusuma',
  'Lina Suhendra',
  'Ratna Widiastuti',
  'Yoga Permana',
  'Pratama Wiranto'
);

-- ============================================================================
-- 6. DELETE APP ACCOUNTS (paling atas dalam hierarchy)
-- ============================================================================
DELETE FROM public.app_accounts
WHERE nim IN (
  'A0001',
  'M0001', 'M0002',
  'K0001', 'K0002', 'K0003',
  'MK0001', 'MK0002',
  'MT0001', 'MT0002', 'MT0003',
  'S0001', 'S0002', 'S0003', 'S0004',
  'P0001'
);

-- ============================================================================
-- 7. VERIFICATION - Show remaining data
-- ============================================================================

SELECT '=== CLEANUP VERIFICATION ===' as status;

SELECT 'Remaining Accounts' as check_name;
SELECT COUNT(*) as count FROM public.app_accounts;

SELECT 'Remaining Profiles' as check_name;
SELECT COUNT(*) as count FROM public.profiles;

SELECT 'Remaining PJ Assignments' as check_name;
SELECT COUNT(*) as count FROM public.pj_assignments;

SELECT 'Remaining Rapor Scores (Dummy)' as check_name;
SELECT COUNT(*) as count FROM public.rapor_scores
WHERE catatan = 'Penilaian dummy untuk testing';

SELECT 'Remaining Rapor Details (Dummy)' as check_name;
SELECT COUNT(*) as count FROM public.rapor_details
WHERE created_at > now() - INTERVAL '1 hour'; -- Dummy data created recently

COMMIT;

-- ============================================================================
-- Optional: Rollback if issues detected
-- If any errors occur above, uncomment the line below (only works if 
-- errors prevent COMMIT)
-- ROLLBACK;
-- ============================================================================
