-- Persist each reader's custom shelf arrangement.
-- Placement is deliberately independent from reading status.
-- shelf_index = physical row, shelf_column = cubby/column (0 for long shelves),
-- shelf_position = order within that row/cubby.

alter table public.user_books
  add column if not exists shelf_index integer not null default 0 check (shelf_index >= 0),
  add column if not exists shelf_column integer not null default 0 check (shelf_column >= 0),
  add column if not exists shelf_position integer not null default 0 check (shelf_position >= 0);

-- Give pre-existing rows a sensible initial physical row without making status
-- responsible for placement after this migration.
update public.user_books
set shelf_index = case status
  when 'currently_reading' then 0
  when 'read' then 1
  when 'want_to_read' then 2
  when 'dnf' then 2
  else 0
end
where shelf_index = 0;

drop index if exists public.user_books_shelf_order_idx;
create index user_books_shelf_order_idx
  on public.user_books (user_id, shelf_index, shelf_column, shelf_position, created_at);

-- Backfill a stable order within each physical location.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, shelf_index, shelf_column
      order by created_at, id
    ) - 1 as position
  from public.user_books
)
update public.user_books ub
set shelf_position = ranked.position
from ranked
where ub.id = ranked.id;
