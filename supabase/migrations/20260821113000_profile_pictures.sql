insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-pictures', 'profile-pictures', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their own profile picture"
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-pictures' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own profile picture"
on storage.objects for update to authenticated
using (bucket_id = 'profile-pictures' and owner_id = (select auth.uid()::text))
with check (bucket_id = 'profile-pictures' and owner_id = (select auth.uid()::text));

create policy "Users can delete their own profile picture"
on storage.objects for delete to authenticated
using (bucket_id = 'profile-pictures' and owner_id = (select auth.uid()::text));
