-- Introduce new role model: pres_wapres, menko, menteri, staff.
-- Data migration is intentionally split into a later migration because
-- PostgreSQL requires enum additions to be committed before first use.

do $$
begin
  alter type app_role add value if not exists 'pres_wapres';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type app_role add value if not exists 'menteri';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type app_role add value if not exists 'staff';
exception
  when duplicate_object then null;
end $$;
