-- Odnoklassniki (ok.ru) joins the built-in networks, with its own mark.
create or replace function public.server_links_ok(links jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select jsonb_typeof(links) = 'array'
    and jsonb_array_length(links) <= 8
    and not exists (
      select 1 from jsonb_array_elements(links) l
      where jsonb_typeof(l) <> 'object'
         or not (
           (l ->> 'kind') = any (array['discord', 'telegram', 'vk', 'ok', 'youtube', 'twitch', 'tiktok', 'facebook', 'instagram', 'x', 'forum', 'other'])
           or exists (select 1 from public.catalog c where c.kind = 'network' and c.key = l ->> 'kind')
         )
         or coalesce(l ->> 'url', '') !~ '^https://'
         or char_length(l ->> 'url') > 200
         or (l ? 'name' and (jsonb_typeof(l -> 'name') <> 'string' or char_length(l ->> 'name') not between 1 and 30))
    )
$$;
