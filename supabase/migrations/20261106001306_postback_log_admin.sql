-- The admin reads every server's reward notifications too, from moderation,
-- to look into "the reward never came" without the database. The postback
-- settings themselves (address, secret key) stay the owner's alone.
create policy "postback_log: admin reads" on public.postback_log
  for select using (public.is_admin());
