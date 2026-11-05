-- Discord joins the list of networks (servers.links) instead of a field of
-- its own; no server had a discord_url.
create or replace function public.server_links_ok(links jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(links) = 'array'
    and jsonb_array_length(links) <= 8
    and not exists (
      select 1 from jsonb_array_elements(links) l
      where jsonb_typeof(l) <> 'object'
         or not (l ->> 'kind') = any (array['discord', 'telegram', 'vk', 'youtube', 'twitch', 'tiktok', 'facebook', 'instagram', 'x', 'forum', 'other'])
         or coalesce(l ->> 'url', '') !~ '^https://'
         or char_length(l ->> 'url') > 200
    )
$$;

create or replace function public.servers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    new.owner_id := old.owner_id;
    if new.status is distinct from old.status and new.status not in ('hidden', 'pending') then
      new.status := old.status;
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

alter table public.servers drop column discord_url;
