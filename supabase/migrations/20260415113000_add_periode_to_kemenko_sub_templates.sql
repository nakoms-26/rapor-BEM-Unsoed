-- Make kemenko sub-indicator templates period-specific.
-- One template set per kemenko per period.

BEGIN;

ALTER TABLE public.kemenko_sub_indicator_templates
ADD COLUMN IF NOT EXISTS periode_id uuid NULL REFERENCES public.rapor_periods(id) ON DELETE CASCADE;

-- Backfill legacy rows to the latest available period so existing data remains usable.
WITH latest_period AS (
  SELECT id
  FROM public.rapor_periods
  ORDER BY tahun DESC, bulan DESC
  LIMIT 1
)
UPDATE public.kemenko_sub_indicator_templates t
SET periode_id = lp.id
FROM latest_period lp
WHERE t.periode_id IS NULL;

-- Enforce period-specific uniqueness.
ALTER TABLE public.kemenko_sub_indicator_templates
DROP CONSTRAINT IF EXISTS kemenko_sub_indicator_templates_kemenko_unit_id_main_indicator_name_sub_indicator_name_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kemenko_sub_templates_unique_per_periode'
      AND conrelid = 'public.kemenko_sub_indicator_templates'::regclass
  ) THEN
    ALTER TABLE public.kemenko_sub_indicator_templates
    ADD CONSTRAINT kemenko_sub_templates_unique_per_periode
    UNIQUE (kemenko_unit_id, periode_id, main_indicator_name, sub_indicator_name);
  END IF;
END $$;

ALTER TABLE public.kemenko_sub_indicator_templates
ALTER COLUMN periode_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kemenko_sub_templates_periode
  ON public.kemenko_sub_indicator_templates(periode_id);

COMMIT;
