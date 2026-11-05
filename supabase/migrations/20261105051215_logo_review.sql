-- A new logo for a server already on the site no longer sends the server back
-- to review (and off the site): it waits in logo_pending while the server
-- stays listed with its old one, and the moderator accepts or drops it alone.
-- Taking the logo away needs no review. A server not yet approved keeps its
-- logo in logo, looked at with the rest of it.

alter table public.servers add column logo_pending text check (
  logo_pending is null or (
    logo_pending ~ '^https://xpfgjhyuompskzxsmwrc\.supabase\.co/storage/v1/object/public/server-images/'
    and char_length(logo_pending) <= 300
  )
);
-- The admin moves it into logo, or drops it; an owner's write is overruled
-- by the guard below.
grant update (logo_pending) on public.servers to authenticated;

create or replace function public.servers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    new.owner_id := old.owner_id;
    new.logo_pending := old.logo_pending;
    if new.status is distinct from old.status and new.status not in ('hidden', 'pending') then
      new.status := old.status;
    end if;
    -- The logo of a listed server: a new one waits for the moderator, none
    -- (taken away) applies at once.
    if old.status = 'approved' and new.logo is distinct from old.logo then
      if new.logo is null then
        new.logo_pending := null;
      else
        new.logo_pending := new.logo;
        new.logo := old.logo;
      end if;
    end if;
    if (new.name, new.game, new.requested_game, new.chronicle, new.rate, new.rate_text, new.url, new.description, new.language, new.language_text, new.links)
       is distinct from (old.name, old.game, old.requested_game, old.chronicle, old.rate, old.rate_text, old.url, old.description, old.language, old.language_text, old.links)
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
