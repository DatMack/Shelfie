-- Persist each reader's custom shelf arrangement.

alter table public.user_books
  add column if not exists shelf_position integer not null default 0;

create index if not exists user_books_shelf_order_idx
  on public.user_books (user_id, status, shelf_position, created_at);

-- Backfill a stable position for existing rows without changing ownership/privacy rules.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, status
      order by created_at, id
    ) - 1 as position
  from public.user_books
)
update public.user_books ub
set shelf_position = ranked.position
from ranked
where ub.id = ranked.id;
