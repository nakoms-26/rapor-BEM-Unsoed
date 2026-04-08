-- Redesign PJ assignment model to support multi-task responsibilities.
-- Goals:
-- 1) One person can hold multiple PJ assignments.
-- 2) Separate scope between PJ Kemenkoan and PJ Kementerian/Biro.
-- 3) Keep existing tables intact for backward compatibility.

-- 1) New enum for assignment scope
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'pj_assignment_scope'
  ) THEN
    CREATE TYPE public.pj_assignment_scope AS ENUM ('kemenko', 'unit');
  END IF;
END$$;

-- 1a) Ensure profile columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'can_access_kemenko_report'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN can_access_kemenko_report boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'is_pj_kemenkoan'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN is_pj_kemenkoan boolean NOT NULL DEFAULT false;
  END IF;
END$$;

-- 2) New normalized assignment table
CREATE TABLE IF NOT EXISTS public.pj_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nim text NOT NULL REFERENCES public.profiles(nim) ON DELETE CASCADE,
  target_unit_id uuid NOT NULL REFERENCES public.ref_units(id) ON DELETE CASCADE,
  scope public.pj_assignment_scope NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nim, scope, target_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_pj_assignments_nim ON public.pj_assignments(nim);
CREATE INDEX IF NOT EXISTS idx_pj_assignments_target_unit ON public.pj_assignments(target_unit_id);
CREATE INDEX IF NOT EXISTS idx_pj_assignments_scope_active ON public.pj_assignments(scope, is_active);

DROP TRIGGER IF EXISTS trg_pj_assignments_updated_at ON public.pj_assignments;
CREATE TRIGGER trg_pj_assignments_updated_at
BEFORE UPDATE ON public.pj_assignments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 3) Scope validator: ensure scope matches unit category
CREATE OR REPLACE FUNCTION public.validate_pj_assignment_scope()
RETURNS trigger AS $$
DECLARE
  unit_category public.unit_kategori;
BEGIN
  SELECT kategori
  INTO unit_category
  FROM public.ref_units
  WHERE id = NEW.target_unit_id;

  IF unit_category IS NULL THEN
    RAISE EXCEPTION 'target_unit_id tidak ditemukan di ref_units';
  END IF;

  IF NEW.scope = 'kemenko' AND unit_category <> 'kemenko' THEN
    RAISE EXCEPTION 'Assignment scope kemenko hanya boleh ke unit kategori kemenko';
  END IF;

  IF NEW.scope = 'unit' AND unit_category NOT IN ('kementerian', 'biro') THEN
    RAISE EXCEPTION 'Assignment scope unit hanya boleh ke unit kategori kementerian/biro';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_pj_assignment_scope ON public.pj_assignments;
CREATE TRIGGER trg_validate_pj_assignment_scope
BEFORE INSERT OR UPDATE ON public.pj_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_pj_assignment_scope();

-- 4) Backfill from legacy evaluator assignments (if exists)
INSERT INTO public.pj_assignments (nim, target_unit_id, scope, is_active, created_at, updated_at)
SELECT
  eua.evaluator_nim,
  eua.target_unit_id,
  'unit'::public.pj_assignment_scope,
  eua.is_active,
  eua.created_at,
  eua.updated_at
FROM public.evaluator_unit_assignments eua
ON CONFLICT (nim, scope, target_unit_id)
DO UPDATE SET
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 5) Useful views
CREATE OR REPLACE VIEW public.v_pj_kemenko_active AS
SELECT
  pa.nim,
  p.nama_lengkap,
  pa.target_unit_id,
  u.nama_unit AS target_unit_name,
  pa.created_at,
  pa.updated_at
FROM public.pj_assignments pa
JOIN public.profiles p ON p.nim = pa.nim
JOIN public.ref_units u ON u.id = pa.target_unit_id
WHERE pa.scope = 'kemenko'
  AND pa.is_active = true;

CREATE OR REPLACE VIEW public.v_pj_unit_active AS
SELECT
  pa.nim,
  p.nama_lengkap,
  pa.target_unit_id,
  u.nama_unit AS target_unit_name,
  pa.created_at,
  pa.updated_at
FROM public.pj_assignments pa
JOIN public.profiles p ON p.nim = pa.nim
JOIN public.ref_units u ON u.id = pa.target_unit_id
WHERE pa.scope = 'unit'
  AND pa.is_active = true;

-- 6) Data setup from current task distribution (idempotent)
WITH kemenko_map(unit_name, person_name) AS (
  VALUES
    ('Sekretaris Jenderal', 'Novebri Rouli Simbolon'),
    ('Satuan Pengawas Internal', 'Novebri Rouli Simbolon'),
    ('Pemberdayaan Mahasiswa', 'Yesenia Kalila Ramadhani'),
    ('Politik Pergerakan', 'Zahra Indria Puspita'),
    ('Relasi Publik', 'Muhammad Fairuzy Alsya''Bani'),
    ('Riset dan Media', 'Abu Akhsin Ismail Husna')
),
unit_map(unit_name, person_name) AS (
  VALUES
    ('Biro Kesekretariatan', 'Raden Roro Arimbi Fahti Ningrat'),
    ('Biro Keuangan', 'Nailah Aqila Zahwa Siregar'),
    ('Biro Pengendali & Penjamin Mutu', 'Cheryl Anastasya Dwi Permatasari'),
    ('Biro Pengembangan Sumber Daya Anggota', 'Ezar Ogya Pandita'),
    ('Kementerian Pengembangan Sumber Daya Mahasiswa', 'Abu Akhsin Ismail Husna'),
    ('Kementerian Prestasi dan Inovasi', 'Muhammad Fairuzy Alsya''Bani'),
    ('Kementerian Seni dan Olahraga', 'Zahra Indria Puspita'),
    ('Kementerian Advokasi dan Kesejahteraan Mahasiswa', 'Danish Arinal Haq'),
    ('Kementerian Aksi dan Propaganda', 'Tita Willy Nurlatifah'),
    ('Kementerian Analisis Isu Strategis', 'Aman Santoso'),
    ('Kementerian Pemberdayaan Perempuan', 'Meylani Trihapsari'),
    ('Kementerian Dalam Negeri', 'Salfiah Rahni'),
    ('Kementerian Luar Negeri', 'Nahdiyatur Rizqo'),
    ('Kementerian Pengabdian Masyarakat', 'Novebri Rouli Simbolon'),
    ('Kementerian Media Komunikasi dan Informasi', 'Yudhistira Eka Wardhana'),
    ('Kementerian Media Kreatif dan Aplikatif', 'Yesenia Kalila Ramadhani'),
    ('Kementerian Riset dan Data', 'Mutia Nur Ummami')
),
resolved_kemenko AS (
  SELECT p.nim, u.id AS unit_id
  FROM kemenko_map km
  JOIN public.profiles p ON p.nama_lengkap = km.person_name
  JOIN public.ref_units u ON u.nama_unit = km.unit_name
),
resolved_unit AS (
  SELECT p.nim, u.id AS unit_id
  FROM unit_map um
  JOIN public.profiles p ON p.nama_lengkap = um.person_name
  JOIN public.ref_units u ON u.nama_unit = um.unit_name
)
INSERT INTO public.pj_assignments (nim, target_unit_id, scope, is_active)
SELECT nim, unit_id, 'kemenko'::public.pj_assignment_scope, true
FROM resolved_kemenko
ON CONFLICT (nim, scope, target_unit_id)
DO UPDATE SET
  is_active = EXCLUDED.is_active,
  updated_at = now();

WITH unit_map(unit_name, person_name) AS (
  VALUES
    ('Biro Kesekretariatan', 'Raden Roro Arimbi Fahti Ningrat'),
    ('Biro Keuangan', 'Nailah Aqila Zahwa Siregar'),
    ('Biro Pengendali & Penjamin Mutu', 'Cheryl Anastasya Dwi Permatasari'),
    ('Biro Pengembangan Sumber Daya Anggota', 'Ezar Ogya Pandita'),
    ('Kementerian Pengembangan Sumber Daya Mahasiswa', 'Abu Akhsin Ismail Husna'),
    ('Kementerian Prestasi dan Inovasi', 'Muhammad Fairuzy Alsya''Bani'),
    ('Kementerian Seni dan Olahraga', 'Zahra Indria Puspita'),
    ('Kementerian Advokasi dan Kesejahteraan Mahasiswa', 'Danish Arinal Haq'),
    ('Kementerian Aksi dan Propaganda', 'Tita Willy Nurlatifah'),
    ('Kementerian Analisis Isu Strategis', 'Aman Santoso'),
    ('Kementerian Pemberdayaan Perempuan', 'Meylani Trihapsari'),
    ('Kementerian Dalam Negeri', 'Salfiah Rahni'),
    ('Kementerian Luar Negeri', 'Nahdiyatur Rizqo'),
    ('Kementerian Pengabdian Masyarakat', 'Novebri Rouli Simbolon'),
    ('Kementerian Media Komunikasi dan Informasi', 'Yudhistira Eka Wardhana'),
    ('Kementerian Media Kreatif dan Aplikatif', 'Yesenia Kalila Ramadhani'),
    ('Kementerian Riset dan Data', 'Mutia Nur Ummami')
),
resolved_unit AS (
  SELECT p.nim, u.id AS unit_id
  FROM unit_map um
  JOIN public.profiles p ON p.nama_lengkap = um.person_name
  JOIN public.ref_units u ON u.nama_unit = um.unit_name
)
INSERT INTO public.pj_assignments (nim, target_unit_id, scope, is_active)
SELECT nim, unit_id, 'unit'::public.pj_assignment_scope, true
FROM resolved_unit
ON CONFLICT (nim, scope, target_unit_id)
DO UPDATE SET
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 7) Optional: align profile flags from active assignment state
UPDATE public.profiles p
SET
  role = 'pj_kementerian',
  can_access_kemenko_report = EXISTS (
    SELECT 1
    FROM public.pj_assignments pa
    WHERE pa.nim = p.nim
      AND pa.scope = 'kemenko'
      AND pa.is_active = true
  ),
  is_pj_kemenkoan = EXISTS (
    SELECT 1
    FROM public.pj_assignments pa
    WHERE pa.nim = p.nim
      AND pa.scope = 'kemenko'
      AND pa.is_active = true
  )
WHERE EXISTS (
  SELECT 1
  FROM public.pj_assignments pa
  WHERE pa.nim = p.nim
);
