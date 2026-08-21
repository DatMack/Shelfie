-- Per-copy spine styling and user-uploaded spine photographs/art.

alter table public.user_books
  add column if not exists spine_design text not null default 'leather'
    check (spine_design in ('leather', 'custom_image')),
  add column if not exists spine_color text,
  add column if not exists spine_accent text,
  add column if not exists custom_spine_url text,
  add column if not exists custom_spine_position_x numeric(5,2) not null default 50
    check (custom_spine_position_x between 0 and 100),
  add column if not exists custom_spine_position_y numeric(5,2) not null default 50
    check (custom_spine_position_y between 0 and 100),
  add column if not exists custom_spine_zoom numeric(6,2) not null default 100
    check (custom_spine_zoom between 100 and 300);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-spines', 'book-spines', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their own book spines"
on storage.objects for insert to authenticated
with check (bucket_id = 'book-spines' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own book spines"
on storage.objects for update to authenticated
using (bucket_id = 'book-spines' and owner_id = (select auth.uid()::text))
with check (bucket_id = 'book-spines' and owner_id = (select auth.uid()::text));

create policy "Users can delete their own book spines"
on storage.objects for delete to authenticated
using (bucket_id = 'book-spines' and owner_id = (select auth.uid()::text));
