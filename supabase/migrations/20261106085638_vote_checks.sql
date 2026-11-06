-- For the moderation page's line "Suspicious votes in the last day": the vote
-- function notes each vote it sent to Turnstile (need_captcha) and each vote
-- that came with a passed Turnstile (captcha_passed). Kept a week. Only the
-- function writes; admin_vote_checks() gives an admin the day's counts.
create table public.vote_checks (
  id bigint generated always as identity primary key,
  server_id text,
  kind text not null check (kind in ('need_captcha', 'captcha_passed')),
  created_at timestamptz not null default now()
);
create index vote_checks_created_idx on public.vote_checks (created_at);
alter table public.vote_checks enable row level security;
revoke all on public.vote_checks from anon, authenticated;
grant select, insert, delete on public.vote_checks to service_role;

create or replace function public.admin_vote_checks()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'need_captcha', (select count(*) from public.vote_checks where kind = 'need_captcha' and created_at > now() - interval '1 day'),
    'captcha_passed', (select count(*) from public.vote_checks where kind = 'captcha_passed' and created_at > now() - interval '1 day')
  );
end $$;
revoke execute on function public.admin_vote_checks() from public, anon;
grant execute on function public.admin_vote_checks() to authenticated;
