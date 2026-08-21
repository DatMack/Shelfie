-- Independent bookshelf showcases.
-- A reader can arrange the same books differently for every shelf style and reading view.

create table if not exists public.shelf_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shelf_style text not null,
  view_key text not null check (view_key in ('all', 'currently_reading', 'want_to_read', 'read', 'dnf')),
  shelf_count integer not null default 3 check (shelf_count between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, shelf_style, view_key)
);

create table if not exists public.shelf_layout_books (
  layout_id uuid not null references public.shelf_layouts(id) on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  shelf_index integer not null default 0 check (shelf_index >= 0),
  shelf_column integer check (shelf_column is null or shelf_column >= 0),
  x_position double precision not null default 0 check (x_position >= 0 and x_position <= 1),
  y_position double precision not null default 0 check (y_position >= 0),
  angle double precision not null default 0 check (angle >= -180 and angle <= 180),
  orientation text not null default 'upright' check (orientation in ('upright', 'horizontal')),
  z_index integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (layout_id, user_book_id)
);

create index if not exists shelf_layouts_user_idx
  on public.shelf_layouts (user_id, shelf_style, view_key);

create index if not exists shelf_layout_books_layout_idx
  on public.shelf_layout_books (layout_id, shelf_index, shelf_column, x_position);

alter table public.shelf_layouts enable row level security;
alter table public.shelf_layout_books enable row level security;

create policy "Readers can view their shelf layouts"
  on public.shelf_layouts for select
  using (auth.uid() = user_id);

create policy "Readers can create their shelf layouts"
  on public.shelf_layouts for insert
  with check (auth.uid() = user_id);

create policy "Readers can update their shelf layouts"
  on public.shelf_layouts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Readers can delete their shelf layouts"
  on public.shelf_layouts for delete
  using (auth.uid() = user_id);

create policy "Readers can view books in their shelf layouts"
  on public.shelf_layout_books for select
  using (
    exists (
      select 1
      from public.shelf_layouts layout
      where layout.id = shelf_layout_books.layout_id
        and layout.user_id = auth.uid()
    )
  );

create policy "Readers can add books to their shelf layouts"
  on public.shelf_layout_books for insert
  with check (
    exists (
      select 1
      from public.shelf_layouts layout
      join public.user_books ub on ub.id = shelf_layout_books.user_book_id
      where layout.id = shelf_layout_books.layout_id
        and layout.user_id = auth.uid()
        and ub.user_id = auth.uid()
    )
  );

create policy "Readers can update books in their shelf layouts"
  on public.shelf_layout_books for update
  using (
    exists (
      select 1
      from public.shelf_layouts layout
      where layout.id = shelf_layout_books.layout_id
        and layout.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.shelf_layouts layout
      join public.user_books ub on ub.id = shelf_layout_books.user_book_id
      where layout.id = shelf_layout_books.layout_id
        and layout.user_id = auth.uid()
        and ub.user_id = auth.uid()
    )
  );

create policy "Readers can remove books from their shelf layouts"
  on public.shelf_layout_books for delete
  using (
    exists (
      select 1
      from public.shelf_layouts layout
      where layout.id = shelf_layout_books.layout_id
        and layout.user_id = auth.uid()
    )
  );

comment on table public.shelf_layouts is
  'One independently saved virtual bookshelf per user, shelf style, and reading view.';

comment on table public.shelf_layout_books is
  'Per-book placement for a saved Shelfie layout, including row, cubby, position, rotation, and orientation.';
