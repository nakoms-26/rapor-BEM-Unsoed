do $$
begin
  alter type public.app_role add value if not exists 'pj_kementerian';
exception
  when duplicate_object then null;
end$$;
