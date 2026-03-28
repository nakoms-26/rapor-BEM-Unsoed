-- Backfill legacy role values after enum additions are committed.

update public.profiles
set role = 'staff'
where role = 'user';
