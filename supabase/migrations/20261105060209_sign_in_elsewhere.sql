-- Signing in on someone else's computer without opening one's mail there:
--
-- * Telegram, tied to an existing account: profiles.telegram_id, set by the
--   telegram-auth function when a signed-in owner links their Telegram, and
--   looked up when they later sign in with it.
-- * A QR code: the computer asks the qr-login function for a request, shows
--   it as a QR code, and the owner's phone, signed in already, approves it.
--   Only that function touches login_requests (service role); the browser
--   never reads the table.

alter table public.profiles add column telegram_id bigint unique;

create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
    new.telegram_id := old.telegram_id;
  end if;
  return new;
end $$;

create table public.login_requests (
  id uuid primary key default gen_random_uuid(),
  -- sha256 of the secret only the computer and the QR code know.
  secret_hash text not null,
  -- Four digits shown on both screens, to compare before approving.
  code text not null,
  approved_user uuid references auth.users (id) on delete cascade,
  consumed boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes'
);
alter table public.login_requests enable row level security;
revoke all on public.login_requests from anon, authenticated;
