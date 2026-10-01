-- Migration: Add intern_status column to rapor_periods (MySQL / phpMyAdmin)
-- This separates draft/published status between staff rapor and intern rapor.
-- Staff rapor continues to use `status`.
-- Intern rapor now uses a separate `intern_status` column.

ALTER TABLE `rapor_periods` 
ADD COLUMN `intern_status` ENUM('draft', 'published') NOT NULL DEFAULT 'draft';

ALTER TABLE `rapor_periods` 
ADD INDEX `idx_rapor_periods_intern_status` (`intern_status`);

