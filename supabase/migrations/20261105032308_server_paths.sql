-- A server's page is /<game>/<version>/<id>/ now, and its owner may change
-- any of the three. Votes and postback settings follow a changed id, and
-- every address a listed server had is kept, so the site can send links to
-- the old one on to the new (scripts/fetch-servers.mjs, OLD_PATHS).

alter table public.votes drop constraint votes_server_id_fkey;
alter table public.votes add constraint votes_server_id_fkey
  foreign key (server_id) references public.servers (id) on update cascade on delete cascade;
alter table public.server_postbacks drop constraint server_postbacks_server_id_fkey;
alter table public.server_postbacks add constraint server_postbacks_server_id_fkey
  foreign key (server_id) references public.servers (id) on update cascade on delete cascade;

create table public.server_moves (
  server_id text not null references public.servers (id) on update cascade on delete cascade,
  game text not null,
  chronicle text not null,
  id text not null,
  moved_at timestamptz not null default now(),
  primary key (server_id, game, chronicle, id)
);

alter table public.server_moves enable row level security;
-- Old addresses of servers anyone can see; nothing else.
create policy "server_moves: public reads listed" on public.server_moves
  for select using (exists (select 1 from public.servers s where s.id = server_id and s.status = 'approved'));
grant select on public.server_moves to anon, authenticated;

-- Written by the database only: an address that was public (the server had
-- been listed) and changed.
create or replace function public.servers_remember_path() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.listed_at is not null and (new.id, new.game, new.chronicle) is distinct from (old.id, old.game, old.chronicle) then
    insert into public.server_moves (server_id, game, chronicle, id)
    values (new.id, old.game, old.chronicle, old.id)
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.servers_remember_path() from public, anon, authenticated;

create trigger servers_remember_path after update on public.servers
  for each row execute function public.servers_remember_path();
