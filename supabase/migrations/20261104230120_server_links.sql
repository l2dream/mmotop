-- A server's other networks besides Discord — Telegram, VK, YouTube, Twitch,
-- TikTok, Facebook, Instagram, X, a forum, anything else — as a list the
-- owner adds to, in place of the single community_url (no server had one).
-- Each entry is {"kind": "...", "url": "https://..."}; up to eight.

create function public.server_links_ok(links jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(links) = 'array'
    and jsonb_array_length(links) <= 8
    and not exists (
      select 1 from jsonb_array_elements(links) l
      where jsonb_typeof(l) <> 'object'
         or not (l ->> 'kind') = any (array['telegram', 'vk', 'youtube', 'twitch', 'tiktok', 'facebook', 'instagram', 'x', 'forum', 'other'])
         or coalesce(l ->> 'url', '') !~ '^https://'
         or char_length(l ->> 'url') > 200
    )
$$;
revoke execute on function public.server_links_ok(jsonb) from public, anon, authenticated;

alter table public.servers add column links jsonb not null default '[]'
  check (public.server_links_ok(links));
alter table public.servers drop column community_url;

create or replace function public.servers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    new.owner_id := old.owner_id;
    if new.status is distinct from old.status and new.status not in ('hidden', 'pending') then
      new.status := old.status;
    end if;
    if (new.name, new.game, new.requested_game, new.chronicle, new.rate, new.rate_text, new.url, new.description, new.language, new.language_text, new.discord_url, new.links)
       is distinct from (old.name, old.game, old.requested_game, old.chronicle, old.rate, old.rate_text, old.url, old.description, old.language, old.language_text, old.discord_url, old.links)
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
