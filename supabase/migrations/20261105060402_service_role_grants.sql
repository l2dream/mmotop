-- The functions work as service_role, which this project hands no rights on
-- new tables by default (see init's grants): login_requests is the qr-login
-- function's, and catalog and server_moves are given the same for the
-- dashboard and any function to come.
grant select, insert, update, delete on public.login_requests, public.catalog, public.server_moves to service_role;
