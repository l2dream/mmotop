-- A check constraint runs its function as whoever writes the row — the owner
-- saving their server — so they must be allowed to call it. It only checks a
-- list of links and reveals nothing.
grant execute on function public.server_links_ok(jsonb) to anon, authenticated, service_role;
