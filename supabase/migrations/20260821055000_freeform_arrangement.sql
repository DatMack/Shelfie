-- Freeform virtual-shelf placement.
-- These fields describe presentation only; reading status and ownership remain separate concerns.

alter table public.user_books
  add column if not exists shelf_x numeric(6,5),
  add column if not exists shelf_y integer not null default 0,
  add column if not exists shelf_rotation smallint not null default 0,
  add column if not exists shelf_orientation text not null default 'upright';

-- Add defensive constraints without failing if this migration is repaired/replayed manually.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_books_shelf_x_range'
  ) then
    alter table public.user_books
      add constraint user_books_shelf_x_range
      check (shelf_x is null or (shelf_x >= 0 and shelf_x <= 1));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_books_shelf_y_nonnegative'
  ) then
    alter table public.user_books
      add constraint user_books_shelf_y_nonnegative
      check (shelf_y >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_books_shelf_rotation_range'
  ) then
    alter table public.user_books
      add constraint user_books_shelf_rotation_range
      check (shelf_rotation between -90 and 90);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_books_shelf_orientation_allowed'
  ) then
    alter table public.user_books
      add constraint user_books_shelf_orientation_allowed
      check (shelf_orientation in ('upright', 'horizontal'));
  end if;
end $$;

comment on column public.user_books.shelf_x is 'Normalized 0..1 horizontal placement within the selected shelf/cubby.';
comment on column public.user_books.shelf_y is 'Vertical support height in CSS pixels; gravity normally resolves this to shelf floor or a supported stack.';
comment on column public.user_books.shelf_rotation is 'Visual lean angle in degrees.';
comment on column public.user_books.shelf_orientation is 'upright or horizontal shelf presentation.';
