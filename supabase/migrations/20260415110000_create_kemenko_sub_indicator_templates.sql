-- Store PJ Kemenkoan sub-indicator templates in a dedicated table.
-- Avoids misuse of rapor_scores/rapor_type enum for template data.

BEGIN;

CREATE TABLE IF NOT EXISTS public.kemenko_sub_indicator_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kemenko_unit_id uuid NOT NULL REFERENCES public.ref_units(id) ON DELETE CASCADE,
  main_indicator_name text NOT NULL,
  sub_indicator_name text NOT NULL,
  created_by_nim text NOT NULL REFERENCES public.profiles(nim) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kemenko_unit_id, main_indicator_name, sub_indicator_name)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kemenko_sub_templates_main_not_blank_chk'
      AND conrelid = 'public.kemenko_sub_indicator_templates'::regclass
  ) THEN
    ALTER TABLE public.kemenko_sub_indicator_templates
    ADD CONSTRAINT kemenko_sub_templates_main_not_blank_chk
    CHECK (length(trim(main_indicator_name)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kemenko_sub_templates_sub_not_blank_chk'
      AND conrelid = 'public.kemenko_sub_indicator_templates'::regclass
  ) THEN
    ALTER TABLE public.kemenko_sub_indicator_templates
    ADD CONSTRAINT kemenko_sub_templates_sub_not_blank_chk
    CHECK (length(trim(sub_indicator_name)) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kemenko_sub_templates_unit
  ON public.kemenko_sub_indicator_templates(kemenko_unit_id);

DROP TRIGGER IF EXISTS trg_kemenko_sub_templates_updated_at ON public.kemenko_sub_indicator_templates;
CREATE TRIGGER trg_kemenko_sub_templates_updated_at
BEFORE UPDATE ON public.kemenko_sub_indicator_templates
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_kemenko_sub_template_unit()
RETURNS trigger AS $$
DECLARE
  unit_category public.unit_kategori;
BEGIN
  SELECT kategori
  INTO unit_category
  FROM public.ref_units
  WHERE id = NEW.kemenko_unit_id;

  IF unit_category IS NULL THEN
    RAISE EXCEPTION 'kemenko_unit_id tidak ditemukan di ref_units';
  END IF;

  IF unit_category <> 'kemenko' THEN
    RAISE EXCEPTION 'Template sub-indikator hanya boleh untuk unit kategori kemenko';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_kemenko_sub_template_unit ON public.kemenko_sub_indicator_templates;
CREATE TRIGGER trg_validate_kemenko_sub_template_unit
BEFORE INSERT OR UPDATE ON public.kemenko_sub_indicator_templates
FOR EACH ROW
EXECUTE FUNCTION public.validate_kemenko_sub_template_unit();

COMMIT;
