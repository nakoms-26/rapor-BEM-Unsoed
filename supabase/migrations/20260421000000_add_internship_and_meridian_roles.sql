-- Migration: Add internship, the_meridian, and pj_ppm_intern roles & report types

DO $$
BEGIN
  -- Add app_role enum values
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'internship' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'internship';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'the_meridian' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'the_meridian';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pj_ppm_intern' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'pj_ppm_intern';
  END IF;

  -- Add rapor_type enum values if exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rapor_type') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'internship' AND enumtypid = 'public.rapor_type'::regtype) THEN
      ALTER TYPE public.rapor_type ADD VALUE 'internship';
    END IF;
  END IF;

  -- Add pj_assignment_scope enum values if exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pj_assignment_scope') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'internship' AND enumtypid = 'public.pj_assignment_scope'::regtype) THEN
      ALTER TYPE public.pj_assignment_scope ADD VALUE 'internship';
    END IF;
  END IF;
END$$;
