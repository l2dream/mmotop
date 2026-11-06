-- Moderators, appointed by an admin from the account page instead of by hand
-- in the dashboard: admin_list() shows who they are, admin_set(email, on)
-- makes someone one or takes it away. Both refuse anyone but an admin, and
-- the last admin cannot be taken away.

create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if auth.role() <> 'service_role' then
    -- admin_set() below may change is_admin, nobody else.
    if coalesce(current_setting('mmotop.admin_set', true), '') <> 'on' then
      new.is_admin := old.is_admin;
    end if;
    new.telegram_id := old.telegram_id;
  end if;
  return new;
end $$;

create or replace function public.admin_list()
returns table (id uuid, email text, telegram boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.telegram_id is not null
    from public.profiles p join auth.users u on u.id = p.id
    where p.is_admin
    order by u.email;
end $$;

create or replace function public.admin_set(p_email text, p_on boolean)
returns text
language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  select u.id into target from auth.users u where lower(u.email) = lower(trim(p_email));
  if target is null then
    return 'no_user';
  end if;
  if not p_on and (select count(*) from public.profiles where is_admin) <= 1
     and exists (select 1 from public.profiles where id = target and is_admin) then
    return 'last_admin';
  end if;
  perform set_config('mmotop.admin_set', 'on', true);
  update public.profiles set is_admin = p_on where id = target;
  perform set_config('mmotop.admin_set', 'off', true);
  return 'ok';
end $$;

revoke execute on function public.admin_list() from public, anon;
revoke execute on function public.admin_set(text, boolean) from public, anon;
grant execute on function public.admin_list() to authenticated;
grant execute on function public.admin_set(text, boolean) to authenticated;
