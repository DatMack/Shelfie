-- Atomic, ownership-safe collection actions for browser clients.
create or replace function public.add_book_to_my_library(
  p_catalog jsonb,
  p_status text default 'want_to_read',
  p_owned boolean default false,
  p_format text default null
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
begin
  if current_user_id is null then raise exception 'You must be signed in to add a book.'; end if;
  if coalesce(p_catalog ->> 'title', '') = '' then raise exception 'A title is required.'; end if;

  select id into catalog_book_id
  from public.books
  where external_source = coalesce(p_catalog ->> 'external_source', 'manual')
    and external_id = p_catalog ->> 'external_id'
  limit 1;

  if catalog_book_id is null then
    begin
      insert into public.books (
        external_source, external_id, work_key, isbn10, isbn13, title, subtitle, authors,
        description, cover_url, publisher, published_date, publication_year, page_count,
        genres, subjects, language, metadata
      ) values (
        coalesce(p_catalog ->> 'external_source', 'manual'), p_catalog ->> 'external_id',
        p_catalog ->> 'work_key', p_catalog ->> 'isbn10', p_catalog ->> 'isbn13',
        p_catalog ->> 'title', nullif(p_catalog ->> 'subtitle', ''),
        coalesce(array(select jsonb_array_elements_text(coalesce(p_catalog -> 'authors', '[]'::jsonb))), '{}'),
        nullif(p_catalog ->> 'description', ''), nullif(p_catalog ->> 'cover_url', ''),
        nullif(p_catalog ->> 'publisher', ''), nullif(p_catalog ->> 'published_date', ''),
        nullif(p_catalog ->> 'publication_year', '')::integer,
        nullif(p_catalog ->> 'page_count', '')::integer,
        coalesce(array(select jsonb_array_elements_text(coalesce(p_catalog -> 'genres', '[]'::jsonb))), '{}'),
        coalesce(array(select jsonb_array_elements_text(coalesce(p_catalog -> 'subjects', '[]'::jsonb))), '{}'),
        nullif(p_catalog ->> 'language', ''), coalesce(p_catalog -> 'metadata', '{}'::jsonb)
      ) returning id into catalog_book_id;
    exception when unique_violation then
      select id into catalog_book_id from public.books
      where external_source = coalesce(p_catalog ->> 'external_source', 'manual')
        and external_id = p_catalog ->> 'external_id'
      limit 1;
    end;
  end if;

  insert into public.user_books (user_id, book_id, status, owned, format, shelf_index, shelf_column, shelf_position)
  values (current_user_id, catalog_book_id, p_status, p_owned, case when p_owned then p_format else null end, 0, 0, 0)
  on conflict (user_id, book_id) do update set
    owned = public.user_books.owned or excluded.owned,
    format = coalesce(excluded.format, public.user_books.format),
    updated_at = now()
  returning * into added;

  return added;
end;
$$;

create or replace function public.remove_my_library_book(p_user_book_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare removed_count integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in to remove a book.'; end if;
  delete from public.user_books where id = p_user_book_id and user_id = auth.uid();
  get diagnostics removed_count = row_count;
  return removed_count = 1;
end;
$$;

revoke all on function public.add_book_to_my_library(jsonb, text, boolean, text) from public, anon;
grant execute on function public.add_book_to_my_library(jsonb, text, boolean, text) to authenticated;
revoke all on function public.remove_my_library_book(uuid) from public, anon;
grant execute on function public.remove_my_library_book(uuid) to authenticated;
