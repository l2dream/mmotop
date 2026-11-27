-- A server in several languages names them (27 November 2026): `language`
-- holds a comma list of two-letter codes, "en,ru", up to ten; or "intl"
-- (international) or "other" (with language_text) alone. "multi" (several,
-- unnamed) is gone; no server used it.
alter table public.servers drop constraint if exists servers_language_check;
alter table public.servers add constraint servers_language_check check (
  language is null
  or language ~ '^[a-z]{2}(,[a-z]{2}){0,9}$'
  or language in ('intl', 'other')
);
