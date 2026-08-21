-- Per-book shelf presentation preferences.
-- These settings belong to the user's copy/relationship, not the shared book catalog.

alter table public.user_books
  add column if not exists display_style text not null default 'auto'
    check (display_style in (
      'auto',
      'spine',
      'front_cover',
      'cassette',
      'cassette_case',
      'audio_case',
      'e_reader',
      'digital_tile'
    )),
  add column if not exists display_edition_id text,
  add column if not exists display_cover_url text;

comment on column public.user_books.display_style is
  'Per-user shelf rendering choice. Auto follows the item format.';
comment on column public.user_books.display_edition_id is
  'Optional external/internal edition identifier selected specifically for shelf display.';
comment on column public.user_books.display_cover_url is
  'Optional selected cover image for shelf display when multiple edition covers are available.';
