-- Replace Supabase Auth with application-managed accounts and sessions.

create table if not exists public.app_accounts (
  nim text primary key references public.profiles(nim) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  nim text not null references public.profiles(nim) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_sessions_nim on public.app_sessions(nim);
create index if not exists idx_app_sessions_expires_at on public.app_sessions(expires_at);

drop trigger if exists trg_app_accounts_updated_at on public.app_accounts;
create trigger trg_app_accounts_updated_at
before update on public.app_accounts
for each row
execute function public.set_updated_at();
