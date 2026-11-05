-- The owner's form, finished: a logo of the server's own, and whether a vote
-- brings a reward (so the vote box asks for the nickname only then).

-- A square picture in our storage (server-images), uploaded from the form.
alter table public.servers add column logo text check (
  logo is null or (
    logo ~ '^https://xpfgjhyuompskzxsmwrc\.supabase\.co/storage/v1/object/public/server-images/'
    and char_length(logo) <= 300
  )
);

-- Kept by the database from server_postbacks (switched on, with an address);
-- public, unlike the postback itself.
alter table public.servers add column reward boolean not null default false;

-- What the owner and the admin may write, column by column: everything they
-- did before plus the logo — not reward, listed_at or the timestamps, which
-- the database keeps.
revoke insert, update on public.servers from authenticated;
grant insert (id, owner_id, name, game, requested_game, chronicle, rate, rate_text, url, open_date, description, status, language, language_text, links, logo)
  on public.servers to authenticated;
grant update (id, owner_id, name, game, requested_game, chronicle, rate, rate_text, url, open_date, description, status, language, language_text, links, logo)
  on public.servers to authenticated;

create or replace function public.servers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    new.owner_id := old.owner_id;
    if new.status is distinct from old.status and new.status not in ('hidden', 'pending') then
      new.status := old.status;
    end if;
    if (new.name, new.game, new.requested_game, new.chronicle, new.rate, new.rate_text, new.url, new.description, new.language, new.language_text, new.links, new.logo)
       is distinct from (old.name, old.game, old.requested_game, old.chronicle, old.rate, old.rate_text, old.url, old.description, old.language, old.language_text, old.links, old.logo)
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

create or replace function public.server_postbacks_reward() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.servers set reward = (new.enabled and new.url is not null)
  where id = new.server_id and reward is distinct from (new.enabled and new.url is not null);
  return new;
end $$;
revoke execute on function public.server_postbacks_reward() from public, anon, authenticated;

create trigger server_postbacks_reward after insert or update on public.server_postbacks
  for each row execute function public.server_postbacks_reward();
