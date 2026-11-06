-- ALTCHA, the proof of work in front of a vote: each solved challenge counts
-- once. The vote function records a challenge's signature when a vote uses
-- it and refuses it after that; rows older than a day (challenges live ten
-- minutes) are cleared as new ones come.
create table public.altcha_used (
  signature text primary key,
  used_at timestamptz not null default now()
);
alter table public.altcha_used enable row level security;
revoke all on public.altcha_used from anon, authenticated;
grant select, insert, delete on public.altcha_used to service_role;
