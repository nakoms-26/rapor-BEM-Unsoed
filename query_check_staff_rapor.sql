-- ============================================================================
-- Query untuk melihat SEMUA profiles beserta unit/kementeriannya
-- ============================================================================

SELECT 
  p.nim,
  p.nama_lengkap,
  p.role,
  u.nama_unit as unit_name,
  u.kategori as unit_kategori,
  p.can_access_kemenko_report,
  p.is_pj_kemenkoan
FROM public.profiles p
JOIN public.ref_units u ON p.unit_id = u.id
ORDER BY p.role, p.nama_lengkap;

-- ============================================================================
-- Query untuk melihat profile dengan pj_assignments mereka (PJ roles)
-- ============================================================================

SELECT 
  p.nim,
  p.nama_lengkap,
  p.role,
  u.nama_unit as assigned_unit,
  u.kategori as unit_kategori,
  pa.scope as assignment_scope,
  pa.is_active
FROM public.profiles p
JOIN public.ref_units u ON p.unit_id = u.id
LEFT JOIN public.pj_assignments pa ON p.nim = pa.nim
WHERE pa.id IS NOT NULL
ORDER BY p.role, p.nama_lengkap, pa.scope;

-- ============================================================================
-- Query untuk melihat staff beserta unit mereka dan rapor count
-- ============================================================================

SELECT 
  p.nim,
  p.nama_lengkap,
  p.role,
  u.nama_unit,
  u.kategori,
  COUNT(rs.id) as jumlah_rapor,
  COALESCE(ROUND(AVG(rs.total_avg::numeric), 2), 0) as rata_rata_skor
FROM public.profiles p
JOIN public.ref_units u ON p.unit_id = u.id
LEFT JOIN public.rapor_scores rs ON p.nim = rs.user_nim AND rs.catatan = 'Penilaian dummy untuk testing'
WHERE p.role = 'staff'
GROUP BY p.nim, p.nama_lengkap, p.role, u.id, u.nama_unit, u.kategori
ORDER BY p.nim;

-- ============================================================================
-- Query untuk melihat seluruh org structure dengan user assignments
-- ============================================================================

SELECT 
  u.nama_unit,
  u.kategori,
  STRING_AGG(p.nama_lengkap || ' (' || p.role || ')', ', ' ORDER BY p.role) as assigned_people
FROM public.ref_units u
LEFT JOIN public.profiles p ON u.id = p.unit_id
GROUP BY u.id, u.nama_unit, u.kategori
ORDER BY u.kategori, u.nama_unit;
