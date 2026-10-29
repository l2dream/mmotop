-- Security advisor: trigger functions run as triggers only, so nobody needs to
-- call them through the API; and every function pins its search_path.
alter function public.profiles_guard() set search_path = public;

revoke execute on function public.profiles_guard() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.servers_guard() from public, anon, authenticated;
