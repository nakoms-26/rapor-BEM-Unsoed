-- =============================================================================
-- Migration: Assign PJ Kemenko for Internship (Cakrawala)
-- PJ Kemenko only configures sub-indicator templates for their kemenko.
-- Interns are evaluated by PJ Kementerian.
--
-- F1F026118 (Panji Surya Erlangga) -> Sekjend, Polper, Respub
-- E1A026023 (Fairuz Hafidh Ardiansyah) -> PM, Rismed, SPI
-- =============================================================================

-- 1. Update is_pj_kemenkoan flag on profiles
UPDATE public.profiles
SET is_pj_kemenkoan = true
WHERE nim IN ('F1F026118', 'E1A026023');

-- 2. Insert Kemenko assignments for F1F026118 (Sekjend, Polper, Respub)
-- Kemenko: Sekretaris Jenderal
INSERT INTO public.pj_assignments (id, nim, target_unit_id, scope, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'F1F026118', '7e3682c4-69cc-4542-a07a-f90f8290a478', 'kemenko', true, now(), now())
ON CONFLICT (nim, scope, target_unit_id) DO UPDATE SET is_active = true, updated_at = now();

-- Kemenko: Politik Pergerakan
INSERT INTO public.pj_assignments (id, nim, target_unit_id, scope, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'F1F026118', 'a5263966-6d0f-4cc5-94e9-7c841ff3895c', 'kemenko', true, now(), now())
ON CONFLICT (nim, scope, target_unit_id) DO UPDATE SET is_active = true, updated_at = now();

-- Kemenko: Relasi Publik
INSERT INTO public.pj_assignments (id, nim, target_unit_id, scope, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'F1F026118', '24a951aa-30b5-422c-90c1-6972f7fcd4af', 'kemenko', true, now(), now())
ON CONFLICT (nim, scope, target_unit_id) DO UPDATE SET is_active = true, updated_at = now();


-- 3. Insert Kemenko assignments for E1A026023 (PM, Rismed, SPI)
-- Kemenko: Pemberdayaan Mahasiswa
INSERT INTO public.pj_assignments (id, nim, target_unit_id, scope, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'E1A026023', 'f2530077-614f-4a74-a8b7-22a610dacc28', 'kemenko', true, now(), now())
ON CONFLICT (nim, scope, target_unit_id) DO UPDATE SET is_active = true, updated_at = now();

-- Kemenko: Riset dan Media
INSERT INTO public.pj_assignments (id, nim, target_unit_id, scope, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'E1A026023', '01e09287-4406-4b4c-b0a6-c1b3d360a0db', 'kemenko', true, now(), now())
ON CONFLICT (nim, scope, target_unit_id) DO UPDATE SET is_active = true, updated_at = now();

-- Kemenko: Satuan Pengawas Internal
INSERT INTO public.pj_assignments (id, nim, target_unit_id, scope, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'E1A026023', '90cb7958-5ed5-43bf-a0d5-7b9ed13f2ae8', 'kemenko', true, now(), now())
ON CONFLICT (nim, scope, target_unit_id) DO UPDATE SET is_active = true, updated_at = now();
