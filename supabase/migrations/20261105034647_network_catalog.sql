-- "Other network…" in the owner's form: a link may carry the name of a
-- network the list lacks ({kind: 'other', url, name}). A moderator then adds
-- that network to the catalog (kind 'network': key = the link's kind from
-- then on, name = its label) and moves the link onto it.

alter table public.catalog drop constraint catalog_kind_check;
alter table public.catalog add constraint catalog_kind_check
  check (kind in ('game', 'chronicle', 'rate_word', 'language', 'network'));
alter table public.catalog add constraint catalog_network_key
  check (kind <> 'network' or key ~ '^[a-z0-9][a-z0-9-]{0,22}[a-z0-9]$');

create or replace function public.server_links_ok(links jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select jsonb_typeof(links) = 'array'
    and jsonb_array_length(links) <= 8
    and not exists (
      select 1 from jsonb_array_elements(links) l
      where jsonb_typeof(l) <> 'object'
         or not (
           (l ->> 'kind') = any (array['discord', 'telegram', 'vk', 'youtube', 'twitch', 'tiktok', 'facebook', 'instagram', 'x', 'forum', 'other'])
           or exists (select 1 from public.catalog c where c.kind = 'network' and c.key = l ->> 'kind')
         )
         or coalesce(l ->> 'url', '') !~ '^https://'
         or char_length(l ->> 'url') > 200
         or (l ? 'name' and (jsonb_typeof(l -> 'name') <> 'string' or char_length(l ->> 'name') not between 1 and 30))
    )
$$;
grant execute on function public.server_links_ok(jsonb) to anon, authenticated;
