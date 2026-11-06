-- More checks on votes, and tools for the moderator:
--  * dc_ranges: address ranges of data centres, hosting and VPN providers
--    (the open lists of github.com/X4BNet/lists_vpn), refreshed every week
--    by pg_cron + pg_net. A vote from such an address needs Turnstile.
--  * votes.net_hash: the voter's /24 (IPv4) or /48 (IPv6) network, salted
--    and hashed like ip_hash; past three votes for a server in 12 hours from
--    one network, the next one needs Turnstile.
--  * votes.browser_hash: a random mark the browser keeps, hashed; one vote
--    per browser per server per 12 hours, whatever the address.
--  * vote_annulments + votes.annulment_id: a moderator annuls a server's
--    votes over a period; they stop counting. Deleting the annulment
--    restores them.
--  * admin_vote_hours / admin_vote_suspects / admin_annul_votes /
--    admin_vote_annulments / admin_restore_votes for the moderation page.

-- ── Data-centre and VPN ranges ───────────────────────────────────────────
create table public.dc_ranges (range cidr primary key);
create index dc_ranges_gist on public.dc_ranges using gist (range inet_ops);
alter table public.dc_ranges enable row level security;
revoke all on public.dc_ranges from anon, authenticated;

-- The refresh in flight: the pg_net requests asked for, read a while later.
create table public.dc_refresh (request_id bigint primary key, requested_at timestamptz not null default now());
alter table public.dc_refresh enable row level security;
revoke all on public.dc_refresh from anon, authenticated;

create or replace function public.dc_refresh_request()
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.dc_refresh;
  insert into public.dc_refresh (request_id)
  select net.http_get(url := u, timeout_milliseconds := 30000)
  from unnest(array[
    'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/datacenter/ipv4.txt',
    'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv4.txt'
  ]) u;
end $$;

-- Replaces the ranges once both lists came back whole; otherwise keeps the
-- old ones (a failed download never empties the table).
create or replace function public.dc_refresh_apply()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  body text;
  got integer;
begin
  if (select count(*) from public.dc_refresh) < 2
     or (select count(*) from net._http_response r join public.dc_refresh q on q.request_id = r.id
         where r.status_code = 200) < (select count(*) from public.dc_refresh) then
    return 0;
  end if;
  select string_agg(r.content, E'\n') into body
  from net._http_response r join public.dc_refresh q on q.request_id = r.id;

  create temp table dc_new (range cidr primary key) on commit drop;
  insert into dc_new
  select distinct network(l::inet)
  from regexp_split_to_table(body, E'\n') l
  where l ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}$'
  on conflict do nothing;
  get diagnostics got = row_count;
  if got < 10000 then
    return 0;
  end if;

  delete from public.dc_ranges;
  insert into public.dc_ranges select range from dc_new;
  delete from public.dc_refresh;
  return got;
end $$;

-- Whether an address belongs to a data centre or a VPN; false for anything
-- that is not an address.
create or replace function public.is_datacenter_ip(p_ip text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.dc_ranges where range >>= p_ip::inet);
exception when others then
  return false;
end $$;

revoke execute on function public.dc_refresh_request(), public.dc_refresh_apply(), public.is_datacenter_ip(text) from public, anon, authenticated;
grant execute on function public.is_datacenter_ip(text) to service_role;

-- Mondays: ask at 03:17 UTC, take the answers in at 03:27.
select cron.schedule('dc-ranges-request', '17 3 * * 1', 'select public.dc_refresh_request()');
select cron.schedule('dc-ranges-apply', '27 3 * * 1', 'select public.dc_refresh_apply()');

-- ── Votes: network, browser, annulment ───────────────────────────────────
create table public.vote_annulments (
  id bigint generated always as identity primary key,
  server_id text not null references public.servers (id) on delete cascade on update cascade,
  from_at timestamptz not null,
  to_at timestamptz not null,
  votes integer not null,
  reason text check (char_length(reason) <= 500),
  by_user uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index vote_annulments_server_idx on public.vote_annulments (server_id, created_at desc);
alter table public.vote_annulments enable row level security;
revoke all on public.vote_annulments from anon, authenticated;
grant select on public.vote_annulments to service_role;

alter table public.votes
  add column net_hash text,
  add column browser_hash text,
  add column annulment_id bigint references public.vote_annulments (id) on delete set null;
create index votes_net_idx on public.votes (server_id, net_hash, created_at desc) where net_hash is not null;
create index votes_browser_idx on public.votes (server_id, browser_hash, created_at desc) where browser_hash is not null;
create index votes_annulment_idx on public.votes (annulment_id) where annulment_id is not null;

-- Why a vote was sent to Turnstile: burst, spread, datacenter, subnet.
alter table public.vote_checks add column reason text;

-- Annulled votes do not count, in the ranking or in the owner's chart.
create or replace view public.server_votes_month
with (security_invoker = false) as
  select s.id as server_id, count(v.id)::int as votes
  from public.servers s
  left join public.votes v
    on v.server_id = s.id and v.created_at >= date_trunc('month', now()) and v.annulment_id is null
  where s.status = 'approved'
  group by s.id;

create or replace function public.server_vote_days(p_server text)
returns table (day date, votes integer)
language sql stable security definer set search_path = public as $$
  select d::date, count(v.id)::integer
  from generate_series((now() at time zone 'utc')::date - 29, (now() at time zone 'utc')::date, interval '1 day') d
  left join public.votes v on v.server_id = p_server and (v.created_at at time zone 'utc')::date = d::date
    and v.annulment_id is null
  where exists (select 1 from public.servers s where s.id = p_server and (s.owner_id = auth.uid() or public.is_admin()))
  group by d order by d
$$;

-- ── For the moderator ────────────────────────────────────────────────────
-- A server's votes hour by hour (UTC): counted, annulled, and from how many
-- different networks — many votes from few networks is the tell.
create or replace function public.admin_vote_hours(p_server text, p_hours integer default 72)
returns table (hour timestamptz, votes integer, annulled integer, nets integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
  select h, count(v.id) filter (where v.annulment_id is null)::integer,
         count(v.id) filter (where v.annulment_id is not null)::integer,
         count(distinct v.net_hash) filter (where v.annulment_id is null)::integer
  from generate_series(date_trunc('hour', now()) - make_interval(hours => least(greatest(p_hours, 1), 24 * 31) - 1),
                       date_trunc('hour', now()), interval '1 hour') h
  left join public.votes v on v.server_id = p_server and v.created_at >= h and v.created_at < h + interval '1 hour'
  group by h order by h;
end $$;

-- The servers whose votes were sent to Turnstile most over the last day.
create or replace function public.admin_vote_suspects()
returns table (server_id text, name text, checks integer, reasons jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
  select c.server_id, s.name, sum(c.n)::integer, jsonb_object_agg(coalesce(c.reason, 'other'), c.n)
  from (select vc.server_id, vc.reason, count(*) n from public.vote_checks vc
        where vc.kind = 'need_captcha' and vc.created_at > now() - interval '1 day' and vc.server_id is not null
        group by vc.server_id, vc.reason) c
  join public.servers s on s.id = c.server_id
  group by c.server_id, s.name
  order by 3 desc
  limit 10;
end $$;

-- Annuls a server's counted votes in [p_from, p_to); returns how many.
create or replace function public.admin_annul_votes(p_server text, p_from timestamptz, p_to timestamptz, p_reason text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  a bigint;
  n integer;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if p_to <= p_from then
    raise exception 'empty period' using errcode = '22023';
  end if;
  insert into public.vote_annulments (server_id, from_at, to_at, votes, reason, by_user)
  values (p_server, p_from, p_to, 0, nullif(trim(p_reason), ''), auth.uid())
  returning id into a;
  update public.votes set annulment_id = a
  where server_id = p_server and created_at >= p_from and created_at < p_to and annulment_id is null;
  get diagnostics n = row_count;
  if n = 0 then
    delete from public.vote_annulments where id = a;
  else
    update public.vote_annulments set votes = n where id = a;
  end if;
  return n;
end $$;

create or replace function public.admin_vote_annulments(p_server text)
returns table (id bigint, from_at timestamptz, to_at timestamptz, votes integer, reason text, created_at timestamptz, by_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
  select a.id, a.from_at, a.to_at, a.votes, a.reason, a.created_at, p.display_name
  from public.vote_annulments a left join public.profiles p on p.id = a.by_user
  where a.server_id = p_server
  order by a.created_at desc
  limit 20;
end $$;

-- Undoes an annulment: its votes count again.
create or replace function public.admin_restore_votes(p_annulment bigint)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  delete from public.vote_annulments where id = p_annulment;
end $$;

revoke execute on function public.admin_vote_hours(text, integer), public.admin_vote_suspects(),
  public.admin_annul_votes(text, timestamptz, timestamptz, text), public.admin_vote_annulments(text),
  public.admin_restore_votes(bigint) from public, anon;
grant execute on function public.admin_vote_hours(text, integer), public.admin_vote_suspects(),
  public.admin_annul_votes(text, timestamptz, timestamptz, text), public.admin_vote_annulments(text),
  public.admin_restore_votes(bigint) to authenticated;

-- The first lists, now; dc_refresh_apply() takes them in a minute later.
select public.dc_refresh_request();
