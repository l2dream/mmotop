-- Sign-in letters sent through the email-login function: who asked (salted
-- hashes of the address and its network), so a burst from one place needs
-- Turnstile on top of ALTCHA. A day at most; only the function reads it.
create table if not exists public.email_login_log (
  id bigserial primary key,
  ip_hash text not null,
  net_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.email_login_log enable row level security;
create index if not exists email_login_log_created_idx on public.email_login_log (created_at);
create index if not exists email_login_log_ip_idx on public.email_login_log (ip_hash, created_at);
create index if not exists email_login_log_net_idx on public.email_login_log (net_hash, created_at);
grant select, insert, delete on public.email_login_log to service_role;
grant usage, select on sequence public.email_login_log_id_seq to service_role;
