-- ============================================================================
-- Cleanup Script - Menghapus semua dummy seed data secara clean
-- ============================================================================
-- Jalankan script ini untuk reset database ke kondisi sebelum seed
-- Urutan penghapusan diatur berdasarkan foreign key constraints

BEGIN;

-- Daftar NIM dummy dari seed 20260405003000_seed_dummy_data.sql
WITH dummy_nims AS (
  SELECT unnest(ARRAY[
    'A0001',
    'M0001', 'M0002',
    'K0001', 'K0002', 'K0003',
    'MK0001', 'MK0002',
    'MT0001', 'MT0002', 'MT0003',
    'S0001', 'S0002', 'S0003', 'S0004',
    'P0001'
  ]::text[]) AS nim
)
SELECT COUNT(*) FROM dummy_nims;

-- ============================================================================
-- 1. DELETE RAPOR DETAILS (paling dalam dalam hierarchy)
-- ============================================================================
DELETE FROM public.rapor_details
WHERE rapor_id IN (
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
WHERE nim IN (
  SELECT unnest(ARRAY[
    'A0001',
    'M0001', 'M0002',
    'K0001', 'K0002', 'K0003',
    'MK0001', 'MK0002',
    'MT0001', 'MT0002', 'MT0003',
    'S0001', 'S0002', 'S0003', 'S0004',
    'P0001'
  ]::text[])
);

-- ============================================================================
-- 4. DELETE PJ ASSIGNMENTS
-- ============================================================================
DELETE FROM public.pj_assignments
WHERE nim IN (
  SELECT unnest(ARRAY[
    'A0001',
    'M0001', 'M0002',
    'K0001', 'K0002', 'K0003',
    'MK0001', 'MK0002',
    'MT0001', 'MT0002', 'MT0003',
    'S0001', 'S0002', 'S0003', 'S0004',
    'P0001'
  ]::text[])
);

-- ============================================================================
-- 5. DELETE APP ACCOUNTS (harus sebelum profiles karena FK app_accounts -> profiles)
-- ============================================================================
DELETE FROM public.app_accounts
WHERE nim IN (
  SELECT unnest(ARRAY[
    'A0001',
    'M0001', 'M0002',
    'K0001', 'K0002', 'K0003',
    'MK0001', 'MK0002',
    'MT0001', 'MT0002', 'MT0003',
    'S0001', 'S0002', 'S0003', 'S0004',
    'P0001'
  ]::text[])
);

-- ============================================================================
-- 6. DELETE PROFILES
-- ============================================================================
DELETE FROM public.profiles
WHERE nim IN (
  SELECT unnest(ARRAY[
    'A0001',
    'M0001', 'M0002',
    'K0001', 'K0002', 'K0003',
    'MK0001', 'MK0002',
    'MT0001', 'MT0002', 'MT0003',
    'S0001', 'S0002', 'S0003', 'S0004',
    'P0001'
  ]::text[])
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
WHERE rapor_id IN (
  SELECT id FROM public.rapor_scores
  WHERE catatan = 'Penilaian dummy untuk testing'
);

COMMIT;

-- ============================================================================
-- Optional: Rollback if issues detected
-- If any errors occur above, uncomment the line below (only works if 
-- errors prevent COMMIT)
-- ROLLBACK;
-- ============================================================================
