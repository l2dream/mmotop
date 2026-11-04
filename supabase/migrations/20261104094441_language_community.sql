-- The language a server's players speak (a two-letter code, or "multi"),
-- and a link to its community — Discord, Telegram, VK — shown beside the
-- link to its site. Both from the owner's form; both count among the fields
-- whose change sends a listed server back to moderation.
alter table public.servers add column language text
  check (language is null or language ~ '^[a-z]{2}$' or language = 'multi');
alter table public.servers add column community_url text
  check (community_url is null or (community_url ~ '^https://' and char_length(community_url) <= 200));

create or replace function public.servers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    new.owner_id := old.owner_id;
    if new.status is distinct from old.status and new.status not in ('hidden', 'pending') then
      new.status := old.status;
    end if;
    if (new.name, new.game, new.requested_game, new.chronicle, new.rate, new.rate_text, new.url, new.description, new.language, new.community_url)
       is distinct from (old.name, old.game, old.requested_game, old.chronicle, old.rate, old.rate_text, old.url, old.description, old.language, old.community_url)
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
