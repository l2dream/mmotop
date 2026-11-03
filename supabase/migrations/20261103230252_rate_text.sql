-- A server with no rates may say what it has instead — PvP, GvE, RvR, or a
-- word of its own — shown where "x50" would be. Only with no number: the two
-- never stand together.
alter table public.servers add column rate_text text
  check (rate_text is null or char_length(rate_text) between 1 and 20);
alter table public.servers add constraint servers_rate_or_text
  check (rate is null or rate_text is null);

-- As before (other_game), with rate_text among the fields an owner's edit
-- sends back to moderation.
create or replace function public.servers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    new.owner_id := old.owner_id;
    if new.status is distinct from old.status and new.status not in ('hidden', 'pending') then
      new.status := old.status;
    end if;
    if (new.name, new.game, new.requested_game, new.chronicle, new.rate, new.rate_text, new.url, new.description)
       is distinct from (old.name, old.game, old.requested_game, old.chronicle, old.rate, old.rate_text, old.url, old.description)
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
