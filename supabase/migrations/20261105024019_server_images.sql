-- Pictures for server descriptions, kept with us rather than linked from
-- elsewhere. Anyone may look (a public bucket); only a signed-in owner may
-- upload, only into a folder named after their own id, only pictures, at
-- most 2 MB each (the account form shrinks them to WebP before sending).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('server-images', 'server-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "server images: owner uploads into own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'server-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "server images: owner deletes own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'server-images' and (storage.foldername(name))[1] = auth.uid()::text);
