-- A server's name follows the rules for a domain name in any language:
-- letters of any script, digits and single hyphens, no hyphen at either end.
-- No spaces, dots or other signs, so a web address cannot pass for a name.
-- The account form allows only these as they are typed (and nothing outside
-- letters, marks and digits, which also keeps out emoji); this is the same
-- rule where a request could skip the form. Postgres has no class for
-- combining marks, so the check says what is not allowed — whitespace,
-- punctuation and every ASCII sign but the hyphen — rather than what is.
alter table public.servers add constraint servers_name_chars check (
  replace(name, '-', '') ~ $r$^[^[:space:][:cntrl:][:punct:]!-/:-@\[-`{-~]+$$r$
  and name !~ '^-|-$|--'
);
