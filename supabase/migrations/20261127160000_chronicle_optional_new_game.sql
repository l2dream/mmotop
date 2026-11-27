-- A new game (game = 'other', awaiting moderation) may come without a
-- chronicle: its owner ticks "No chronicle" (27 November 2026). The
-- moderator gives it one when approving the game; every listed server
-- keeps one, as its page address needs it.
alter table public.servers drop constraint if exists servers_chronicle_check;
alter table public.servers add constraint servers_chronicle_check check (
  char_length(chronicle) <= 40
  and (char_length(chronicle) >= 1 or game = 'other')
);
