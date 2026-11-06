-- A reward notification the game server did not take — no answer, or a
-- server error (5xx, 429) — is sent again: after 1, 5, 15 and 40 minutes,
-- about an hour in all, then given up. A clear refusal (another 4xx) is not
-- retried: the server said no. The same vote_id and voted_at go each time,
-- signed the same way, so the server can tell a repeat by vote_id.
--
-- The vote function puts such a vote in postback_retries; every minute
-- pg_cron, through pg_net, calls the postback-retry function, but only when
-- something is due.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.postback_retries (
  vote_id bigint primary key references public.votes (id) on delete cascade,
  server_id text not null references public.servers (id) on update cascade on delete cascade,
  nickname text not null,
  voted_at timestamptz not null,
  -- How many times it has been sent so far, the first included.
  attempts smallint not null default 1,
  next_at timestamptz not null
);
create index postback_retries_due_idx on public.postback_retries (next_at);
alter table public.postback_retries enable row level security;
revoke all on public.postback_retries from anon, authenticated;
grant select, insert, update, delete on public.postback_retries to service_role;

-- Which try a journal line was: 1 for the first, 2–5 for the repeats.
alter table public.postback_log add column attempt smallint not null default 1;

select cron.schedule(
  'postback-retry',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://xpfgjhyuompskzxsmwrc.supabase.co/functions/v1/postback-retry',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  where exists (select 1 from public.postback_retries where next_at <= now())
  $$
);
