-- The account page, more of it:
--  * the moderator's reason for a rejection (or a hiding), shown to the owner;
--  * a message to the owner when the moderator decides — by Telegram if they
--    linked it, by email (the notify-owner function, called from here);
--  * the owner's language, for those messages;
--  * votes by day, for the chart beside each of the owner's servers.

alter table public.servers add column moderation_note text check (char_length(moderation_note) <= 500);
-- The status the owner was last told of; notify-owner sends only on a change.
alter table public.servers add column notified_status text;
grant update (moderation_note) on public.servers to authenticated;

alter table public.profiles add column locale text check (locale ~ '^[a-z]{2}(-[a-z]{2})?$');
grant update (locale) on public.profiles to authenticated;

create or replace function public.servers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    new.owner_id := old.owner_id;
    new.logo_pending := old.logo_pending;
    new.moderation_note := old.moderation_note;
    if new.status is distinct from old.status and new.status not in ('hidden', 'pending') then
      new.status := old.status;
    end if;
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
  -- Approved: whatever was said against it before no longer stands.
  if new.status = 'approved' then
    new.moderation_note := null;
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

-- A moderator's decision reaches the owner: notify-owner looks at the
-- server's status as it is and tells them if it changed since last time.
create or replace function public.servers_notify_owner() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected', 'hidden') then
    perform net.http_post(
      url := 'https://xpfgjhyuompskzxsmwrc.supabase.co/functions/v1/notify-owner',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('server_id', new.id)
    );
  end if;
  return new;
end $$;
revoke execute on function public.servers_notify_owner() from public, anon, authenticated;
create trigger servers_notify_owner after update on public.servers
  for each row execute function public.servers_notify_owner();

-- Votes by day over the last 30 days, for the owner of the server or an admin.
create or replace function public.server_vote_days(p_server text)
returns table (day date, votes integer)
language sql stable security definer set search_path = public as $$
  select d::date, count(v.id)::integer
  from generate_series((now() at time zone 'utc')::date - 29, (now() at time zone 'utc')::date, interval '1 day') d
  left join public.votes v on v.server_id = p_server and (v.created_at at time zone 'utc')::date = d::date
  where exists (select 1 from public.servers s where s.id = p_server and (s.owner_id = auth.uid() or public.is_admin()))
  group by d order by d
$$;
revoke execute on function public.server_vote_days(text) from public, anon;
grant execute on function public.server_vote_days(text) to authenticated;
