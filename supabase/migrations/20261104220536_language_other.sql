-- A language not on the site's list: "other", with its name as the owner
-- wrote it. Shown on the server's page; the language filter, which works on
-- the list, does not offer it.
alter table public.servers drop constraint servers_language_check;
alter table public.servers add constraint servers_language_check
  check (language is null or language ~ '^[a-z]{2}$' or language in ('multi', 'other'));
alter table public.servers add column language_text text
  check (language_text is null or char_length(language_text) between 2 and 30);
alter table public.servers add constraint servers_other_language
  check ((language is not distinct from 'other') = (language_text is not null));

create or replace function public.servers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    new.owner_id := old.owner_id;
    if new.status is distinct from old.status and new.status not in ('hidden', 'pending') then
      new.status := old.status;
    end if;
    if (new.name, new.game, new.requested_game, new.chronicle, new.rate, new.rate_text, new.url, new.description, new.language, new.language_text, new.community_url)
       is distinct from (old.name, old.game, old.requested_game, old.chronicle, old.rate, old.rate_text, old.url, old.description, old.language, old.language_text, old.community_url)
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
