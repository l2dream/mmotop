-- The project's default privileges also hand browsers TRUNCATE, REFERENCES
-- and TRIGGER on every table; TRUNCATE ignores RLS. Take them back, here and
-- for tables added later.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
