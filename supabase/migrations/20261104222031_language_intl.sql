-- "intl": an international server, open to players of any language. The
-- form's default; the language filter counts it in every language, like
-- "multi".
alter table public.servers drop constraint servers_language_check;
alter table public.servers add constraint servers_language_check
  check (language is null or language ~ '^[a-z]{2}$' or language in ('multi', 'intl', 'other'));
