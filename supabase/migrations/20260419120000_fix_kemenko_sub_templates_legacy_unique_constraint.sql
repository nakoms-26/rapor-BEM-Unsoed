-- Ensure kemenko sub-indicator template uniqueness is period-specific.
-- This migration removes any legacy unique constraint that does not include periode_id.

BEGIN;

DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'kemenko_sub_indicator_templates'
      AND c.contype = 'u'
      AND (
        SELECT string_agg(att.attname, ',' ORDER BY x.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS x(attnum, ord)
        JOIN pg_attribute att
          ON att.attrelid = c.conrelid
         AND att.attnum = x.attnum
      ) = 'kemenko_unit_id,main_indicator_name,sub_indicator_name'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.kemenko_sub_indicator_templates DROP CONSTRAINT %I',
      con.conname
    );
  END LOOP;
END $$;

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

COMMIT;
