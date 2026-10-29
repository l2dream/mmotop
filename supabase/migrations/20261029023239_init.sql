-- MMOTOP: accounts, servers, votes.
--
-- Reads that the site makes in the browser go through Row Level Security:
-- everyone may read approved servers and the month's vote counts; owners may
-- read and edit their own servers and their postback settings; admins may
-- moderate. Votes themselves are written only by the `vote` Edge Function,
-- with the service role, after it has checked the captcha and the per-IP
-- limit, so no browser can insert one directly.

create extension if not exists pgcrypto;

-- ── Profiles ──────────────────────────────────────────────────────────────
-- One per account, made by the trigger below when someone signs up, however
-- they signed up (email, Google, Discord, Telegram).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Only the name can be changed that way; is_admin is set by hand in the
-- dashboard (or by the service role), never by the account itself.
create function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'user_name',
      split_part(new.email, '@', 1)
    ), 40)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- ── Servers ───────────────────────────────────────────────────────────────
-- The id is the server's address on the site (/lineage2/<id>/), so it is a
-- lowercase slug, and never one of its game's chronicle or rate slugs (the
-- site's landing pages share that path; the build checks it too).
create table public.servers (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' and id !~ '^x[0-9]'),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 24),
  game text not null check (game in ('lineage2', 'wow', 'mu', 'aion', 'pw', 'rf', 'sro', 'metin2', 'rappelz', 'tibia')),
  chronicle text not null check (char_length(chronicle) between 1 and 40),
  rate numeric check (rate is null or (rate > 0 and rate <= 100000)),
  url text not null check (url ~ '^https?://'),
  open_date date not null,
  description text check (char_length(description) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  listed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index servers_status_idx on public.servers (status);
create index servers_owner_idx on public.servers (owner_id);

alter table public.servers enable row level security;

create policy "servers: public reads approved" on public.servers
  for select using (status = 'approved');
create policy "servers: owner reads own" on public.servers
  for select using (auth.uid() = owner_id);
create policy "servers: admin reads all" on public.servers
  for select using (public.is_admin());
-- A new server always starts as pending, owned by whoever adds it.
create policy "servers: owner adds" on public.servers
  for insert with check (auth.uid() = owner_id and status = 'pending');
create policy "servers: owner edits own" on public.servers
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "servers: admin moderates" on public.servers
  for update using (public.is_admin());
create policy "servers: owner deletes own" on public.servers
  for delete using (auth.uid() = owner_id);

-- An owner's edit of anything that shows on the site sends the server back
-- to moderation; the status itself only an admin moves, and approval stamps
-- the listing date.
create function public.servers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    new.owner_id := old.owner_id;
    if new.status is distinct from old.status and new.status not in ('hidden', 'pending') then
      new.status := old.status;
    end if;
    if (new.name, new.game, new.chronicle, new.rate, new.url, new.description)
       is distinct from (old.name, old.game, old.chronicle, old.rate, old.url, old.description)
       and old.status = 'approved' then
      new.status := 'pending';
    end if;
  end if;
  if new.status = 'approved' and new.listed_at is null then
    new.listed_at := now();
  end if;
  return new;
end $$;

create trigger servers_guard before update on public.servers
  for each row execute function public.servers_guard();

-- ── Postback (the reward for a vote) ──────────────────────────────────────
-- Where the vote function tells the server someone voted, and the secret it
-- signs that message with. Kept apart from `servers` so the public read of
-- servers can never show them; only the owner sees their own.
create table public.server_postbacks (
  server_id text primary key references public.servers (id) on delete cascade,
  url text check (url is null or url ~ '^https://'),
  secret text not null default encode(gen_random_bytes(24), 'hex'),
  enabled boolean not null default false
);

alter table public.server_postbacks enable row level security;

create policy "postbacks: owner reads" on public.server_postbacks
  for select using (exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));
create policy "postbacks: owner writes" on public.server_postbacks
  for insert with check (exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));
create policy "postbacks: owner updates" on public.server_postbacks
  for update using (exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));

-- ── Votes ─────────────────────────────────────────────────────────────────
-- Written only by the vote function (service role). The IP is kept only as a
-- salted hash, enough to enforce one vote per IP per server per period.
create table public.votes (
  id bigint generated always as identity primary key,
  server_id text not null references public.servers (id) on delete cascade,
  ip_hash text not null,
  nickname text check (char_length(nickname) <= 32),
  user_id uuid references public.profiles (id) on delete set null,
  postback_status smallint,
  created_at timestamptz not null default now()
);

create index votes_limit_idx on public.votes (server_id, ip_hash, created_at desc);
create index votes_month_idx on public.votes (created_at, server_id);

alter table public.votes enable row level security;
-- No policies: browsers can neither read nor write vote rows.

-- This calendar month's votes per approved server — what TOP GAMES ranks by;
-- counts reset on the 1st (UTC).
create view public.server_votes_month
with (security_invoker = false) as
  select s.id as server_id, count(v.id)::int as votes
  from public.servers s
  left join public.votes v
    on v.server_id = s.id and v.created_at >= date_trunc('month', now())
  where s.status = 'approved'
  group by s.id;

grant select on public.server_votes_month to anon, authenticated;

-- ── Grants ────────────────────────────────────────────────────────────────
-- The project doesn't expose new tables automatically, so each role gets
-- exactly what its policies above can use; RLS still decides which rows.
grant select, update (display_name) on public.profiles to authenticated;
grant select on public.servers to anon, authenticated;
grant insert, update, delete on public.servers to authenticated;
grant select, insert, update on public.server_postbacks to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- The Edge Functions work as the service role.
grant all on public.profiles, public.servers, public.server_postbacks, public.votes to service_role;
grant select on public.server_votes_month to service_role;
grant usage on all sequences in schema public to service_role;
