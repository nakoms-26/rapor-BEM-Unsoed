-- ============================================================================
-- SEED / UPDATE DATA: THE MERIDIAN (PJ KEMENTERIAN / BIRO)
-- Berdasarkan: Nama Unit/Kementerian dan NIM saja (Nama lengkap tidak di-overwrite)
-- ============================================================================

DO $$
BEGIN
  -- 1. Pastikan role 'the_meridian' tersedia di enum app_role
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'the_meridian' 
      AND enumtypid = 'public.app_role'::regtype
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'the_meridian';
  END IF;
END $$;

-- 2. CTE Pemetaan Unit & NIM
WITH raw_data (nama_unit_input, nim) AS (
  VALUES
    -- Biro Keuangan
    ('Biro Keuangan', 'A1A025166'),
    ('Biro Keuangan', 'H1C024110'),

    -- Biro Kesekretariatan
    ('Biro Kesekretariatan', 'F1A025105'),
    ('Biro Kesekretariatan', 'F1C025191'),

    -- Biro Pengendali & Penjamin Mutu
    ('Biro Pengendali & Penjamin Mutu', 'A1A025089'),
    ('Biro Pengendali & Penjamin Mutu', 'K1C024052'),

    -- Biro Pengembangan Sumber Daya Anggota
    ('Biro Pengembangan Sumber Daya Anggota', 'F1B024064'),
    ('Biro Pengembangan Sumber Daya Anggota', 'E1A024226'),

    -- Kementerian Advokasi Kesejahteraan Mahasiswa
    ('Kementerian Advokasi Kesejahteraan Mahasiswa', 'E1A025174'),
    ('Kementerian Advokasi Kesejahteraan Mahasiswa', 'F1C025193'),

    -- Kementerian Aksi dan Propaganda
    ('Kementerian Aksi dan Propaganda', 'F1F025099'),
    ('Kementerian Aksi dan Propaganda', 'B1A025249'),

    -- Kementerian Analisis Isu Strategis
    ('Kementerian Analisis Isu Strategis', 'F1B025033'),
    ('Kementerian Analisis Isu Strategis', 'I1A024093'),

    -- Kementerian Pemberdayaan Perempuan
    ('Kementerian Pemberdayaan Perempuan', 'E1A025097'),
    ('Kementerian Pemberdayaan Perempuan', 'E1B025008'),

    -- Kementerian Pengembangan Sumber Daya Mahasiswa
    ('Kementerian Pengembangan Sumber Daya Mahasiswa', 'J1D025024'),
    ('Kementerian Pengembangan Sumber Daya Mahasiswa', 'F1F025003'),

    -- Kementerian Seni dan Olahraga
    ('Kementerian Seni dan Olahraga', 'F1D024135'),
    ('Kementerian Seni dan Olahraga', 'A1C025195'),

    -- Kementerian Prestasi dan Inovasi
    ('Kementerian Prestasi dan Inovasi', 'A1D025180'),
    ('Kementerian Prestasi dan Inovasi', 'A1D025012'),

    -- Kementerian Dalam Negeri
    ('Kementerian Dalam Negeri', 'K1A025170'),
    ('Kementerian Dalam Negeri', 'H1A024138'),

    -- Kementerian Luar Negeri
    ('Kementerian Luar Negeri', 'F1C025181'),
    ('Kementerian Luar Negeri', 'A0B025063'),

    -- Kementerian Pengabdian Masyarakat
    ('Kementerian Pengabdian Masyarakat', 'F1D025026'),
    ('Kementerian Pengabdian Masyarakat', 'F1D025108'),

    -- Kementerian Media Kreatif dan Aplikatif
    ('Kementerian Media Kreatif dan Aplikatif', 'J1D024138'),
    ('Kementerian Media Kreatif dan Aplikatif', 'F1C024030'),

    -- Kementerian Media Komunikasi dan Informasi
    ('Kementerian Media Komunikasi dan Informasi', 'H1D025059'),
    ('Kementerian Media Komunikasi dan Informasi', 'A1D025176'),

    -- Kementerian Riset dan Data
    ('Kementerian Riset dan Data', 'K1C025076'),
    ('Kementerian Riset dan Data', 'B0A024037')
),
resolved_data AS (
  SELECT 
    UPPER(TRIM(rd.nim)) AS nim,
    'the_meridian'::public.app_role AS role,
    u.id AS unit_id
  FROM raw_data rd
  JOIN public.ref_units u 
    ON u.nama_unit = rd.nama_unit_input 
    OR u.nama_unit ILIKE '%' || rd.nama_unit_input || '%'
    OR rd.nama_unit_input ILIKE '%' || u.nama_unit || '%'
)
-- 3. Upsert ke tabel public.profiles (Jika profile sudah ada, nama_lengkap TIDAK diubah)
INSERT INTO public.profiles (nim, nama_lengkap, role, unit_id, created_at, updated_at)
SELECT 
  rd.nim,
  rd.nim AS nama_lengkap, -- Default fallback jika data baru
  rd.role,
  rd.unit_id,
  now(),
  now()
FROM resolved_data rd
ON CONFLICT (nim) DO UPDATE SET
  role = EXCLUDED.role,
  unit_id = EXCLUDED.unit_id,
  updated_at = now();

-- 4. Upsert ke tabel public.app_accounts (Password default = NIM jika akun baru dibuat)
WITH raw_data (nama_unit_input, nim) AS (
  VALUES
    ('Biro Keuangan', 'A1A025166'),
    ('Biro Keuangan', 'H1C024110'),
    ('Biro Kesekretariatan', 'F1A025105'),
    ('Biro Kesekretariatan', 'F1C025191'),
    ('Biro Pengendali & Penjamin Mutu', 'A1A025089'),
    ('Biro Pengendali & Penjamin Mutu', 'K1C024052'),
    ('Biro Pengembangan Sumber Daya Anggota', 'F1B024064'),
    ('Biro Pengembangan Sumber Daya Anggota', 'E1A024226'),
    ('Kementerian Advokasi Kesejahteraan Mahasiswa', 'E1A025174'),
    ('Kementerian Advokasi Kesejahteraan Mahasiswa', 'F1C025193'),
    ('Kementerian Aksi dan Propaganda', 'F1F025099'),
    ('Kementerian Aksi dan Propaganda', 'B1A025249'),
    ('Kementerian Analisis Isu Strategis', 'F1B025033'),
    ('Kementerian Analisis Isu Strategis', 'I1A024093'),
    ('Kementerian Pemberdayaan Perempuan', 'E1A025097'),
    ('Kementerian Pemberdayaan Perempuan', 'E1B025008'),
    ('Kementerian Pengembangan Sumber Daya Mahasiswa', 'J1D025024'),
    ('Kementerian Pengembangan Sumber Daya Mahasiswa', 'F1F025003'),
    ('Kementerian Seni dan Olahraga', 'F1D024135'),
    ('Kementerian Seni dan Olahraga', 'A1C025195'),
    ('Kementerian Prestasi dan Inovasi', 'A1D025180'),
    ('Kementerian Prestasi dan Inovasi', 'A1D025012'),
    ('Kementerian Dalam Negeri', 'K1A025170'),
    ('Kementerian Dalam Negeri', 'H1A024138'),
    ('Kementerian Luar Negeri', 'F1C025181'),
    ('Kementerian Luar Negeri', 'A0B025063'),
    ('Kementerian Pengabdian Masyarakat', 'F1D025026'),
    ('Kementerian Pengabdian Masyarakat', 'F1D025108'),
    ('Kementerian Media Kreatif dan Aplikatif', 'J1D024138'),
    ('Kementerian Media Kreatif dan Aplikatif', 'F1C024030'),
    ('Kementerian Media Komunikasi dan Informasi', 'H1D025059'),
    ('Kementerian Media Komunikasi dan Informasi', 'A1D025176'),
    ('Kementerian Riset dan Data', 'K1C025076'),
    ('Kementerian Riset dan Data', 'B0A024037')
)
INSERT INTO public.app_accounts (nim, password_hash, created_at, updated_at)
SELECT 
  UPPER(TRIM(nim)) AS nim,
  UPPER(TRIM(nim)) AS password_hash,
  now(),
  now()
FROM raw_data
ON CONFLICT (nim) DO UPDATE SET
  updated_at = now();

-- ============================================================================
-- 5. VERIFIKASI DATA
-- ============================================================================
SELECT 
  p.nim,
  p.nama_lengkap,
  p.role,
  u.nama_unit,
  u.kategori,
  p.updated_at
FROM public.profiles p
JOIN public.ref_units u ON p.unit_id = u.id
WHERE p.role = 'the_meridian'
ORDER BY u.nama_unit, p.nim;
