-- A game the site does not list yet. The owner picks "Another game" and
-- names it; the server waits in moderation until the game is added to the
-- site (app/data/games.ts and the check below) and the server moved into it.
-- Approving it before that is refused, so it can never be listed under a
-- game the site has no pages for.
alter table public.servers drop constraint servers_game_check;
alter table public.servers add constraint servers_game_check
  check (game in ('lineage2', 'wow', 'mu', 'aion', 'pw', 'rf', 'sro', 'metin2', 'rappelz', 'tibia', 'other'));

alter table public.servers add column requested_game text
  check (requested_game is null or char_length(requested_game) between 2 and 40);
alter table public.servers add constraint servers_other_game
  check ((game = 'other') = (requested_game is not null));

-- As before, plus: the requested game counts as a visible field, and an
-- "other" server cannot be approved.
create or replace function public.servers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    new.owner_id := old.owner_id;
    if new.status is distinct from old.status and new.status not in ('hidden', 'pending') then
      new.status := old.status;
    end if;
    if (new.name, new.game, new.requested_game, new.chronicle, new.rate, new.url, new.description)
       is distinct from (old.name, old.game, old.requested_game, old.chronicle, old.rate, old.url, old.description)
       and old.status = 'approved' then
      new.status := 'pending';
    end if;
  end if;
  if new.status = 'approved' and new.game = 'other' then
    raise exception 'Add % to the site before approving this server', new.requested_game
      using errcode = 'check_violation';
  end if;
  if new.status = 'approved' and new.listed_at is null then
    new.listed_at := now();
  end if;
  return new;
end $$;
