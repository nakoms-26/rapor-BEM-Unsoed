-- Migration: Create separate tables for Internship Rapor system
-- Rapor internship operates as an independent "server" with its own tables,
-- separate from the staff rapor system.
--
-- Key roles:
--   pj_ppm_intern  → CRUD rapor intern + manage sub-indicator templates
--   the_meridian    → VIEW only intern rapor in their unit
--   internship      → VIEW own rapor
--   menteri         → VIEW intern rapor in their units
--   menko           → VIEW intern rapor in their kemenko
--   pres_wapres     → VIEW all intern rapor
--   admin           → full access

BEGIN;

-- ============================================================
-- 1. intern_rapor_scores — Main intern rapor score table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.intern_rapor_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_nim text NOT NULL REFERENCES public.profiles(nim) ON DELETE CASCADE,
  periode_id uuid NOT NULL REFERENCES public.rapor_periods(id) ON DELETE CASCADE,
  penilai_nim text NOT NULL REFERENCES public.profiles(nim) ON DELETE RESTRICT,
  total_avg numeric(5,2) NOT NULL DEFAULT 0 CHECK (total_avg BETWEEN 0 AND 100),
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_nim, periode_id)
);

CREATE INDEX IF NOT EXISTS idx_intern_rapor_scores_user ON public.intern_rapor_scores(user_nim);
CREATE INDEX IF NOT EXISTS idx_intern_rapor_scores_period ON public.intern_rapor_scores(periode_id);

-- ============================================================
-- 2. intern_rapor_details — Detail per indicator for intern rapor
-- ============================================================
CREATE TABLE IF NOT EXISTS public.intern_rapor_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rapor_id uuid NOT NULL REFERENCES public.intern_rapor_scores(id) ON DELETE CASCADE,
  main_indicator_name text NOT NULL,
  sub_indicator_name text NOT NULL,
  catatan text,
  score numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  -- Prestasi columns (same structure as staff)
  bentuk_tanggung_jawab text,
  nilai_kuantitatif_tanggung_jawab numeric(4,2),
  skala text,
  nilai_kuantitatif_skala numeric(4,2),
  nilai_kualitatif numeric(3,2),
  nilai_akhir numeric(4,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intern_rapor_details_rapor ON public.intern_rapor_details(rapor_id);

-- ============================================================
-- 3. intern_sub_indicator_templates — Template managed by PJ PPM Intern
-- ============================================================
CREATE TABLE IF NOT EXISTS public.intern_sub_indicator_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kemenko_unit_id uuid NOT NULL REFERENCES public.ref_units(id) ON DELETE CASCADE,
  periode_id uuid NOT NULL REFERENCES public.rapor_periods(id) ON DELETE CASCADE,
  main_indicator_name text NOT NULL,
  sub_indicator_name text NOT NULL,
  created_by_nim text NOT NULL REFERENCES public.profiles(nim) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kemenko_unit_id, periode_id, main_indicator_name, sub_indicator_name)
);

CREATE INDEX IF NOT EXISTS idx_intern_sub_templates_unit
  ON public.intern_sub_indicator_templates(kemenko_unit_id);

-- Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'intern_sub_templates_main_not_blank_chk'
      AND conrelid = 'public.intern_sub_indicator_templates'::regclass
  ) THEN
    ALTER TABLE public.intern_sub_indicator_templates
    ADD CONSTRAINT intern_sub_templates_main_not_blank_chk
    CHECK (length(trim(main_indicator_name)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'intern_sub_templates_sub_not_blank_chk'
      AND conrelid = 'public.intern_sub_indicator_templates'::regclass
  ) THEN
    ALTER TABLE public.intern_sub_indicator_templates
    ADD CONSTRAINT intern_sub_templates_sub_not_blank_chk
    CHECK (length(trim(sub_indicator_name)) > 0);
  END IF;
END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_intern_sub_templates_updated_at ON public.intern_sub_indicator_templates;
CREATE TRIGGER trg_intern_sub_templates_updated_at
BEFORE UPDATE ON public.intern_sub_indicator_templates
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. Row Level Security (RLS) — Disabled
-- (Project uses custom table-based session auth and admin client)
-- ============================================================
ALTER TABLE public.intern_rapor_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_rapor_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_sub_indicator_templates DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Data Backfill — Migrate existing internship data
-- ============================================================

-- Migrate rapor_scores rows where the user is an internship role
INSERT INTO public.intern_rapor_scores (id, user_nim, periode_id, penilai_nim, total_avg, catatan, created_at)
SELECT rs.id, rs.user_nim, rs.periode_id, rs.penilai_nim, rs.total_avg, rs.catatan, rs.created_at
FROM public.rapor_scores rs
JOIN public.profiles p ON p.nim = rs.user_nim
WHERE p.role = 'internship'
ON CONFLICT (user_nim, periode_id) DO NOTHING;

-- Migrate corresponding rapor_details
INSERT INTO public.intern_rapor_details (
  id, rapor_id, main_indicator_name, sub_indicator_name, catatan, score,
  bentuk_tanggung_jawab, nilai_kuantitatif_tanggung_jawab,
  skala, nilai_kuantitatif_skala, nilai_kualitatif, nilai_akhir, created_at
)
SELECT
  rd.id, rd.rapor_id, rd.main_indicator_name, rd.sub_indicator_name, rd.catatan, rd.score,
  rd.bentuk_tanggung_jawab, rd.nilai_kuantitatif_tanggung_jawab,
  rd.skala, rd.nilai_kuantitatif_skala, rd.nilai_kualitatif, rd.nilai_akhir, rd.created_at
FROM public.rapor_details rd
WHERE EXISTS (
  SELECT 1 FROM public.intern_rapor_scores irs
  WHERE irs.id = rd.rapor_id
)
ON CONFLICT DO NOTHING;

COMMIT;
