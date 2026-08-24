-- Make Add Book a single ownership-safe transaction and keep cover/spine
-- uploads scoped to the signed-in reader's storage folder.

drop function if exists public.add_book_to_my_library(jsonb, text, boolean, text);
drop function if exists public.add_book_to_my_library(jsonb, text, boolean, text, jsonb);

create function public.add_book_to_my_library(
  p_catalog jsonb,
  p_status text default 'want_to_read',
  p_owned boolean default false,
  p_format text default null,
  p_copy jsonb default '{}'::jsonb
)
returns public.user_books
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  catalog_book_id uuid;
  added public.user_books;
  normalized_source text := coalesce(nullif(trim(p_catalog ->> 'external_source'), ''), 'manual');
  normalized_external_id text := nullif(trim(p_catalog ->> 'external_id'), '');
  normalized_title text := nullif(trim(p_catalog ->> 'title'), '');
  normalized_format text := nullif(trim(p_format), '');
  normalized_condition text := nullif(trim(p_copy ->> 'condition'), '');
  normalized_spine_design text := coalesce(nullif(trim(p_copy ->> 'spine_design'), ''), 'leather');
  normalized_spine_title_font text := coalesce(nullif(trim(p_copy ->> 'spine_title_font'), ''), 'classic');
begin
  if current_user_id is null then raise exception 'You must be signed in to add a book.'; end if;
  if normalized_title is null then raise exception 'A title is required.'; end if;
  if normalized_external_id is null then raise exception 'Shelfie could not identify this book. Please try again.'; end if;
  if p_status is null or p_status not in ('want_to_read', 'to_be_read', 'currently_reading', 'read', 'dnf') then
    raise exception 'Choose a valid reading status.';
  end if;
  if p_owned and normalized_format is not null
     and normalized_format not in ('hardcover', 'paperback', 'mass_market', 'ebook', 'audiobook', 'other') then
    raise exception 'Choose a valid book format.';
  end if;
  if normalized_condition is not null
     and normalized_condition not in ('new', 'like_new', 'very_good', 'good', 'fair', 'poor') then
    raise exception 'Choose a valid book condition.';
  end if;
  if normalized_spine_design not in ('leather', 'custom_image') then
    raise exception 'Choose a valid spine design.';
  end if;
  if normalized_spine_title_font not in ('classic', 'modern', 'typewriter', 'storybook') then
    raise exception 'Choose a valid spine title font.';
  end if;

  select id into catalog_book_id
  from public.books
  where external_source = normalized_source
    and external_id = normalized_external_id
  limit 1;

  if catalog_book_id is null then
    begin
      insert into public.books (
        external_source, external_id, work_key, isbn10, isbn13, title, subtitle, authors,
        description, cover_url, publisher, published_date, publication_year, page_count,
        genres, subjects, language, metadata
      ) values (
        normalized_source,
        normalized_external_id,
        nullif(trim(p_catalog ->> 'work_key'), ''),
        nullif(trim(p_catalog ->> 'isbn10'), ''),
        nullif(trim(p_catalog ->> 'isbn13'), ''),
        normalized_title,
        nullif(trim(p_catalog ->> 'subtitle'), ''),
        coalesce(array(select jsonb_array_elements_text(coalesce(p_catalog -> 'authors', '[]'::jsonb))), '{}'),
        nullif(trim(p_catalog ->> 'description'), ''),
        nullif(trim(p_catalog ->> 'cover_url'), ''),
        nullif(trim(p_catalog ->> 'publisher'), ''),
        nullif(trim(p_catalog ->> 'published_date'), ''),
        nullif(trim(p_catalog ->> 'publication_year'), '')::integer,
        nullif(trim(p_catalog ->> 'page_count'), '')::integer,
        coalesce(array(select jsonb_array_elements_text(coalesce(p_catalog -> 'genres', '[]'::jsonb))), '{}'),
        coalesce(array(select jsonb_array_elements_text(coalesce(p_catalog -> 'subjects', '[]'::jsonb))), '{}'),
        nullif(trim(p_catalog ->> 'language'), ''),
        coalesce(p_catalog -> 'metadata', '{}'::jsonb)
      ) returning id into catalog_book_id;
    exception when unique_violation then
      select id into catalog_book_id
      from public.books
      where external_source = normalized_source and external_id = normalized_external_id
      limit 1;
    end;
  else
    -- A user-provided cover or richer description should repair a sparse shared
    -- catalog row without replacing metadata that is already present.
    update public.books
    set cover_url = coalesce(cover_url, nullif(trim(p_catalog ->> 'cover_url'), '')),
        description = coalesce(description, nullif(trim(p_catalog ->> 'description'), '')),
        publisher = coalesce(publisher, nullif(trim(p_catalog ->> 'publisher'), '')),
        page_count = coalesce(page_count, nullif(trim(p_catalog ->> 'page_count'), '')::integer),
        genres = case when cardinality(genres) = 0
          then coalesce(array(select jsonb_array_elements_text(coalesce(p_catalog -> 'genres', '[]'::jsonb))), '{}')
          else genres end,
        subjects = case when cardinality(subjects) = 0
          then coalesce(array(select jsonb_array_elements_text(coalesce(p_catalog -> 'subjects', '[]'::jsonb))), '{}')
          else subjects end
    where id = catalog_book_id;
  end if;

  insert into public.user_books (
    user_id, book_id, status, current_page, rating, is_favorite, reread_count,
    mood_tags, custom_tags, owned, format, condition, purchase_price,
    purchase_date, acquired_from, storage_location,
    manual_estimated_value, manual_value_low, manual_value_high,
    special_edition, signed, first_edition, gifted,
    display_style, display_edition_id, display_cover_url,
    spine_design, spine_color, spine_accent,
    spine_title_visible, spine_title_font, spine_title_size, spine_title_color,
    custom_spine_url,
    custom_spine_position_x, custom_spine_position_y, custom_spine_zoom,
    shelf_index, shelf_column, shelf_position
  ) values (
    current_user_id,
    catalog_book_id,
    p_status,
    greatest(coalesce(nullif(trim(p_copy ->> 'current_page'), '')::integer, 0), 0),
    nullif(trim(p_copy ->> 'rating'), '')::numeric,
    coalesce((p_copy ->> 'is_favorite')::boolean, false),
    greatest(coalesce(nullif(trim(p_copy ->> 'reread_count'), '')::integer, 0), 0),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_copy -> 'mood_tags', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_copy -> 'custom_tags', '[]'::jsonb))), '{}'),
    p_owned,
    case when p_owned then normalized_format else null end,
    case when p_owned then normalized_condition else null end,
    case when p_owned then nullif(trim(p_copy ->> 'purchase_price'), '')::numeric else null end,
    case when p_owned then nullif(trim(p_copy ->> 'purchase_date'), '')::date else null end,
    case when p_owned then nullif(trim(p_copy ->> 'acquired_from'), '') else null end,
    case when p_owned then nullif(trim(p_copy ->> 'storage_location'), '') else null end,
    case when p_owned then nullif(trim(p_copy ->> 'manual_estimated_value'), '')::numeric else null end,
    case when p_owned then nullif(trim(p_copy ->> 'manual_value_low'), '')::numeric else null end,
    case when p_owned then nullif(trim(p_copy ->> 'manual_value_high'), '')::numeric else null end,
    coalesce((p_copy ->> 'special_edition')::boolean, false),
    coalesce((p_copy ->> 'signed')::boolean, false),
    coalesce((p_copy ->> 'first_edition')::boolean, false),
    coalesce((p_copy ->> 'gifted')::boolean, false),
    case when nullif(trim(p_copy ->> 'display_style'), '') is not null
      then p_copy ->> 'display_style' else 'auto' end,
    nullif(trim(p_copy ->> 'display_edition_id'), ''),
    nullif(trim(p_copy ->> 'display_cover_url'), ''),
    normalized_spine_design,
    nullif(trim(p_copy ->> 'spine_color'), ''),
    nullif(trim(p_copy ->> 'spine_accent'), ''),
    coalesce((p_copy ->> 'spine_title_visible')::boolean, true),
    normalized_spine_title_font,
    coalesce(nullif(trim(p_copy ->> 'spine_title_size'), '')::integer, 12),
    nullif(trim(p_copy ->> 'spine_title_color'), ''),
    nullif(trim(p_copy ->> 'custom_spine_url'), ''),
    coalesce(nullif(trim(p_copy ->> 'custom_spine_position_x'), '')::numeric, 50),
    coalesce(nullif(trim(p_copy ->> 'custom_spine_position_y'), '')::numeric, 50),
    coalesce(nullif(trim(p_copy ->> 'custom_spine_zoom'), '')::numeric, 100),
    greatest(coalesce(nullif(trim(p_copy ->> 'shelf_index'), '')::integer, 0), 0),
    0,
    0
  )
  on conflict (user_id, book_id) do update set
    status = excluded.status,
    current_page = greatest(public.user_books.current_page, excluded.current_page),
    rating = coalesce(excluded.rating, public.user_books.rating),
    is_favorite = public.user_books.is_favorite or excluded.is_favorite,
    reread_count = greatest(public.user_books.reread_count, excluded.reread_count),
    mood_tags = case when cardinality(excluded.mood_tags) > 0 then excluded.mood_tags else public.user_books.mood_tags end,
    custom_tags = case when cardinality(excluded.custom_tags) > 0 then excluded.custom_tags else public.user_books.custom_tags end,
    owned = public.user_books.owned or excluded.owned,
    format = coalesce(excluded.format, public.user_books.format),
    condition = coalesce(excluded.condition, public.user_books.condition),
    purchase_price = coalesce(excluded.purchase_price, public.user_books.purchase_price),
    purchase_date = coalesce(excluded.purchase_date, public.user_books.purchase_date),
    acquired_from = coalesce(excluded.acquired_from, public.user_books.acquired_from),
    storage_location = coalesce(excluded.storage_location, public.user_books.storage_location),
    manual_estimated_value = coalesce(excluded.manual_estimated_value, public.user_books.manual_estimated_value),
    manual_value_low = coalesce(excluded.manual_value_low, public.user_books.manual_value_low),
    manual_value_high = coalesce(excluded.manual_value_high, public.user_books.manual_value_high),
    special_edition = public.user_books.special_edition or excluded.special_edition,
    signed = public.user_books.signed or excluded.signed,
    first_edition = public.user_books.first_edition or excluded.first_edition,
    gifted = public.user_books.gifted or excluded.gifted,
    display_style = case when p_copy ? 'display_style' then excluded.display_style else public.user_books.display_style end,
    display_edition_id = coalesce(excluded.display_edition_id, public.user_books.display_edition_id),
    display_cover_url = coalesce(excluded.display_cover_url, public.user_books.display_cover_url),
    spine_design = case when p_copy ? 'spine_design' then excluded.spine_design else public.user_books.spine_design end,
    spine_color = coalesce(excluded.spine_color, public.user_books.spine_color),
    spine_accent = coalesce(excluded.spine_accent, public.user_books.spine_accent),
    spine_title_visible = case when p_copy ? 'spine_title_visible' then excluded.spine_title_visible else public.user_books.spine_title_visible end,
    spine_title_font = case when p_copy ? 'spine_title_font' then excluded.spine_title_font else public.user_books.spine_title_font end,
    spine_title_size = case when p_copy ? 'spine_title_size' then excluded.spine_title_size else public.user_books.spine_title_size end,
    spine_title_color = coalesce(excluded.spine_title_color, public.user_books.spine_title_color),
    custom_spine_url = coalesce(excluded.custom_spine_url, public.user_books.custom_spine_url),
    custom_spine_position_x = case when p_copy ? 'custom_spine_position_x' then excluded.custom_spine_position_x else public.user_books.custom_spine_position_x end,
    custom_spine_position_y = case when p_copy ? 'custom_spine_position_y' then excluded.custom_spine_position_y else public.user_books.custom_spine_position_y end,
    custom_spine_zoom = case when p_copy ? 'custom_spine_zoom' then excluded.custom_spine_zoom else public.user_books.custom_spine_zoom end,
    updated_at = now()
  returning * into added;

  return added;
end;
$$;

revoke all on function public.add_book_to_my_library(jsonb, text, boolean, text, jsonb) from public, anon;
grant execute on function public.add_book_to_my_library(jsonb, text, boolean, text, jsonb) to authenticated;

grant select, insert on table public.books to authenticated;
grant select, insert, update on table public.user_books to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('book-covers', 'book-covers', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('book-spines', 'book-spines', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their own book covers" on storage.objects;
drop policy if exists "Users update their own book covers" on storage.objects;
drop policy if exists "Users delete their own book covers" on storage.objects;
drop policy if exists "Users can upload their own book spines" on storage.objects;
drop policy if exists "Users can update their own book spines" on storage.objects;
drop policy if exists "Users can delete their own book spines" on storage.objects;

create policy "Users upload their own book covers"
on storage.objects for insert to authenticated
with check (bucket_id = 'book-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users update their own book covers"
on storage.objects for update to authenticated
using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'book-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete their own book covers"
on storage.objects for delete to authenticated
using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own book spines"
on storage.objects for insert to authenticated
with check (bucket_id = 'book-spines' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own book spines"
on storage.objects for update to authenticated
using (bucket_id = 'book-spines' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'book-spines' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own book spines"
on storage.objects for delete to authenticated
using (bucket_id = 'book-spines' and (storage.foldername(name))[1] = (select auth.uid())::text);

comment on function public.add_book_to_my_library(jsonb, text, boolean, text, jsonb) is
  'Atomically saves shared book metadata and the signed-in reader''s private copy details.';
