-- What became of each reward notification (the postback), for the owner to
-- see in the account page: a vote's, sent by the vote function, or a test
-- one, sent by the postback-test function. Written only by those functions;
-- an owner reads their own servers' rows.

create table public.postback_log (
  id bigint generated always as identity primary key,
  server_id text not null references public.servers (id) on update cascade on delete cascade,
  nickname text not null,
  test boolean not null default false,
  -- The server's HTTP status; 0 when it did not answer (timeout, no
  -- connection, a bad certificate).
  status integer not null,
  sent_at timestamptz not null default now()
);
create index postback_log_server_idx on public.postback_log (server_id, sent_at desc);

alter table public.postback_log enable row level security;
create policy "postback_log: owner reads" on public.postback_log
  for select using (exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));
revoke all on public.postback_log from anon, authenticated;
grant select on public.postback_log to authenticated;
grant select, insert, delete on public.postback_log to service_role;
