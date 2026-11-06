-- The account page lists the ways into the account and lets the owner take
-- one away: Telegram (profiles.telegram_id), Google or Discord (an identity
-- in auth.identities). The email stays always — signing in by email works
-- for any account with a real address — so a way can be taken away as long
-- as the account has a real email; an account made with Telegram (a
-- placeholder address, never mailed) keeps its Telegram.

create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if auth.role() <> 'service_role' then
    if coalesce(current_setting('mmotop.admin_set', true), '') <> 'on' then
      new.is_admin := old.is_admin;
    end if;
    -- account_unlink() below may clear it, nobody else may change it.
    if coalesce(current_setting('mmotop.unlink', true), '') <> 'on' then
      new.telegram_id := old.telegram_id;
    end if;
  end if;
  return new;
end $$;

create or replace function public.account_ways()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'email', u.email is not null and u.email not like '%@telegram.mmotop.com',
    'telegram', p.telegram_id is not null,
    'google', exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google'),
    'discord', exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'discord')
  )
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = auth.uid()
$$;

create or replace function public.account_unlink(p_way text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  real_email boolean;
begin
  if me is null then
    raise exception 'signed out' using errcode = '42501';
  end if;
  select email is not null and email not like '%@telegram.mmotop.com' into real_email from auth.users where id = me;
  if not coalesce(real_email, false) then
    return 'only_way';
  end if;
  if p_way = 'telegram' then
    perform set_config('mmotop.unlink', 'on', true);
    update public.profiles set telegram_id = null where id = me;
    perform set_config('mmotop.unlink', 'off', true);
  elsif p_way in ('google', 'discord') then
    delete from auth.identities where user_id = me and provider = p_way;
  else
    return 'bad_way';
  end if;
  return 'ok';
end $$;

revoke execute on function public.account_ways() from public, anon;
revoke execute on function public.account_unlink(text) from public, anon;
grant execute on function public.account_ways() to authenticated;
grant execute on function public.account_unlink(text) to authenticated;
