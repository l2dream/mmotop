-- An owner who corrects a rejected server sends it back to review, as with
-- a change to a listed one; before, it stayed rejected however it was fixed.
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
    -- A change to a listed server goes back to review; so does a rejected
    -- server its owner has corrected (it would otherwise stay rejected).
    if (new.name, new.game, new.requested_game, new.chronicle, new.rate, new.rate_text, new.url, new.description, new.language, new.language_text, new.links)
       is distinct from (old.name, old.game, old.requested_game, old.chronicle, old.rate, old.rate_text, old.url, old.description, old.language, old.language_text, old.links)
       and old.status in ('approved', 'rejected') then
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
