insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their own book covers" on storage.objects;
create policy "Users upload their own book covers" on storage.objects for insert to authenticated
with check (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update their own book covers" on storage.objects;
create policy "Users update their own book covers" on storage.objects for update to authenticated
using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete their own book covers" on storage.objects;
create policy "Users delete their own book covers" on storage.objects for delete to authenticated
using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);
