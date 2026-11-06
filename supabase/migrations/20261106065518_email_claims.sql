-- Adding an email to an account made with Telegram (which has only a
-- placeholder address): the account-email function mails a code to the new
-- address and, once it is typed back, gives the account that address. The
-- pending code waits here, hashed; only that function touches the table.

create table public.email_claims (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts smallint not null default 0,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes'
);
alter table public.email_claims enable row level security;
revoke all on public.email_claims from anon, authenticated;
grant select, insert, update, delete on public.email_claims to service_role;

-- Whether another account already has this address (for the function only).
create or replace function public.email_taken(p_email text, p_except uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(p_email)) and id <> p_except)
$$;
revoke execute on function public.email_taken(text, uuid) from public, anon, authenticated;
grant execute on function public.email_taken(text, uuid) to service_role;
