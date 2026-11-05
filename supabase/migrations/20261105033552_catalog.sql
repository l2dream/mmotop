-- What the site's lists hold beyond app/data/games.ts: games, versions, words
-- in place of rates and languages a moderator added while approving an
-- owner's server that asked for one. The deploy reads it into
-- app/data/live-catalog.json (scripts/fetch-servers.mjs), so an entry shows
-- in the filters, the category bar and the owner's form from the next build.

create table public.catalog (
  kind text not null check (kind in ('game', 'chronicle', 'rate_word', 'language')),
  -- The game a version belongs to; '' for the rest.
  game text not null default '',
  -- A game's address, a version's name, the word, a language's code.
  key text not null,
  -- A game's or a language's name as shown; the key again for the rest.
  name text not null check (char_length(name) between 1 and 40),
  badge text check (badge is null or char_length(badge) between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (kind, game, key),
  check (kind = 'chronicle' or game = ''),
  check (kind <> 'chronicle' or char_length(key) between 1 and 40),
  check (kind <> 'rate_word' or char_length(key) between 1 and 12),
  check (kind <> 'language' or key ~ '^[a-z]{2}$'),
  -- A game's address sits beside the site's own: /top/, /ru/, /account/…
  check (kind <> 'game' or (
    key ~ '^[a-z][a-z0-9-]{1,22}[a-z0-9]$'
    and key !~ '^[a-z]{2}(-[a-z]{2})?$'
    and key not in ('top', 'soon', 'started', 'new', 'all', 'server', 'account', 'other', 'fonts', 'og', 'sitemap')
  ))
);

alter table public.catalog enable row level security;
create policy "catalog: public reads" on public.catalog for select using (true);
create policy "catalog: admin adds" on public.catalog for insert with check (public.is_admin());
create policy "catalog: admin edits" on public.catalog for update using (public.is_admin());
create policy "catalog: admin removes" on public.catalog for delete using (public.is_admin());
grant select on public.catalog to anon, authenticated;
grant insert, update, delete on public.catalog to authenticated;

-- A server's game is one of the built-in ones, one added here, or 'other'
-- (asked for, waiting for a moderator).
create or replace function public.known_game(g text) returns boolean
language sql stable security definer set search_path = public as $$
  select g in ('lineage2', 'wow', 'mu', 'aion', 'pw', 'rf', 'sro', 'metin2', 'rappelz', 'tibia', 'other')
    or exists (select 1 from public.catalog where kind = 'game' and key = g)
$$;
grant execute on function public.known_game(text) to anon, authenticated;

alter table public.servers drop constraint servers_game_check;
alter table public.servers add constraint servers_game_check check (public.known_game(game));
