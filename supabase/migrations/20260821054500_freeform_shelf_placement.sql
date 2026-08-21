-- Shelf placement is independent from reading status.
-- A user can arrange any book on any visual shelf without changing whether it is
-- Currently Reading, Want to Read, Read, or DNF.

alter table public.user_books
  add column if not exists shelf_index integer not null default 0
    check (shelf_index >= 0 and shelf_index <= 20);

create index if not exists user_books_shelf_placement_idx
  on public.user_books (user_id, shelf_index, shelf_position);

comment on column public.user_books.shelf_index is
  'Zero-based visual shelf row. Independent from reading status.';
