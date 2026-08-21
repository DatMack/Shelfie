-- Shelfie initial database schema
-- Privacy-first and future-ready for reading, physical collections, discovery and recommendations.
-- Personal rows are private by default. Shared catalog rows contain no personal user data.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Minimal profile data. We intentionally do not collect address, phone, birthday, etc.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  bio text,
  profile_visibility text not null default 'private'
    check (profile_visibility in ('private', 'friends', 'public')),
  favorite_genres text[] not null default '{}',
  recommendation_opt_in boolean not null default true,
  feature_preferences jsonb not null default '{}'::jsonb,
  discover_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'reader_' || substr(new.id::text, 1, 8)),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Shared edition-aware book catalog. This is not personal data.
-- work_key lets several ISBN/editions later point to the same underlying work.
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  external_source text,
  external_id text,
  work_key text,
  edition_key text,
  isbn10 text,
  isbn13 text,
  title text not null,
  subtitle text,
  authors text[] not null default '{}',
  description text,
  cover_url text,
  publisher text,
  published_date text,
  publication_year integer,
  page_count integer check (page_count is null or page_count >= 0),
  genres text[] not null default '{}',
  subjects text[] not null default '{}',
  language text,
  series_name text,
  series_position numeric(6,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists books_external_source_id_unique
  on public.books (external_source, external_id)
  where external_source is not null and external_id is not null;
create index if not exists books_isbn10_idx on public.books (isbn10) where isbn10 is not null;
create index if not exists books_isbn13_idx on public.books (isbn13) where isbn13 is not null;
create index if not exists books_work_key_idx on public.books (work_key) where work_key is not null;
create index if not exists books_title_idx on public.books (title);
create index if not exists books_genres_gin_idx on public.books using gin (genres);
create index if not exists books_subjects_gin_idx on public.books using gin (subjects);

alter table public.books enable row level security;

create policy "Signed-in users can read book metadata"
on public.books for select to authenticated
using (true);

create policy "Signed-in users can add book metadata"
on public.books for insert to authenticated
with check (true);

-- A user's relationship to a work/edition and, optionally, their physical/digital copy.
-- Reading state and ownership are intentionally independent.
create table if not exists public.user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,

  status text not null default 'want_to_read'
    check (status in ('want_to_read', 'currently_reading', 'read', 'dnf')),
  current_page integer not null default 0 check (current_page >= 0),
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  is_favorite boolean not null default false,
  started_at date,
  finished_at date,
  reread_count integer not null default 0 check (reread_count >= 0),
  mood_tags text[] not null default '{}',
  custom_tags text[] not null default '{}',
  dnf_reason text,

  owned boolean not null default false,
  format text check (format is null or format in ('hardcover', 'paperback', 'mass_market', 'ebook', 'audiobook', 'other')),
  condition text check (condition is null or condition in ('new', 'like_new', 'very_good', 'good', 'fair', 'poor')),
  edition_note text,
  purchase_price numeric(10,2) check (purchase_price is null or purchase_price >= 0),
  purchase_currency text not null default 'USD',
  purchase_date date,
  acquired_from text,
  gifted boolean not null default false,
  signed boolean not null default false,
  first_edition boolean not null default false,
  special_edition boolean not null default false,
  storage_location text,
  loaned_to text,
  loaned_at date,

  manual_estimated_value numeric(10,2) check (manual_estimated_value is null or manual_estimated_value >= 0),
  manual_value_low numeric(10,2) check (manual_value_low is null or manual_value_low >= 0),
  manual_value_high numeric(10,2) check (manual_value_high is null or manual_value_high >= 0),
  value_currency text not null default 'USD',
  value_note text,

  visibility text not null default 'private'
    check (visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id),
  check (manual_value_low is null or manual_value_high is null or manual_value_low <= manual_value_high)
);

create index if not exists user_books_user_id_idx on public.user_books (user_id);
create index if not exists user_books_status_idx on public.user_books (user_id, status);
create index if not exists user_books_owned_idx on public.user_books (user_id, owned) where owned = true;
create index if not exists user_books_tags_gin_idx on public.user_books using gin (custom_tags);

alter table public.user_books enable row level security;

create policy "Users can read their own shelf"
on public.user_books for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add to their own shelf"
on public.user_books for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own shelf"
on public.user_books for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can remove from their own shelf"
on public.user_books for delete to authenticated
using ((select auth.uid()) = user_id);

create trigger user_books_set_updated_at
before update on public.user_books
for each row execute function public.set_updated_at();

-- Shared market observations for an edition. No normal browser-user write policy on purpose.
-- Later a trusted Edge Function/server job can populate this from a pricing source.
create table if not exists public.book_market_values (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  source text not null,
  condition text,
  currency text not null default 'USD',
  estimated_low numeric(10,2) check (estimated_low is null or estimated_low >= 0),
  estimated_high numeric(10,2) check (estimated_high is null or estimated_high >= 0),
  estimated_mid numeric(10,2) check (estimated_mid is null or estimated_mid >= 0),
  source_url text,
  observed_at timestamptz not null default now(),
  raw_metadata jsonb not null default '{}'::jsonb,
  check (estimated_low is null or estimated_high is null or estimated_low <= estimated_high)
);

create index if not exists market_values_book_idx
  on public.book_market_values (book_id, observed_at desc);

alter table public.book_market_values enable row level security;

create policy "Signed-in users can read market estimates"
on public.book_market_values for select to authenticated
using (true);

-- Reading progress history.
create table if not exists public.reading_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  page integer check (page is null or page >= 0),
  percent numeric(5,2) check (percent is null or (percent >= 0 and percent <= 100)),
  minutes_read integer check (minutes_read is null or minutes_read >= 0),
  logged_at timestamptz not null default now()
);

create index if not exists reading_logs_user_book_idx
  on public.reading_logs (user_book_id, logged_at desc);

alter table public.reading_logs enable row level security;

create policy "Users can read their own reading logs"
on public.reading_logs for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own reading logs"
on public.reading_logs for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.user_books ub
    where ub.id = user_book_id and ub.user_id = (select auth.uid())
  )
);

create policy "Users can delete their own reading logs"
on public.reading_logs for delete to authenticated
using ((select auth.uid()) = user_id);

-- Reviews are separate from journals so sharing a review never shares private notes.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  review_text text,
  visibility text not null default 'private'
    check (visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_book_id)
);

alter table public.reviews enable row level security;

create policy "Users can read their own reviews"
on public.reviews for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own reviews"
on public.reviews for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.user_books ub
    where ub.id = user_book_id and ub.user_id = (select auth.uid())
  )
);

create policy "Users can update their own reviews"
on public.reviews for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own reviews"
on public.reviews for delete to authenticated
using ((select auth.uid()) = user_id);

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

-- Journal entries are private by default. Social sharing will always be explicit.
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  entry_type text not null default 'note'
    check (entry_type in ('note', 'quote', 'character', 'prediction', 'reaction', 'review_draft', 'other')),
  body text not null,
  page integer check (page is null or page >= 0),
  mood_tags text[] not null default '{}',
  is_spoiler boolean not null default false,
  visibility text not null default 'private'
    check (visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_entries_user_book_idx
  on public.journal_entries (user_book_id, created_at desc);

alter table public.journal_entries enable row level security;

create policy "Users can read their own journal"
on public.journal_entries for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own journal entries"
on public.journal_entries for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.user_books ub
    where ub.id = user_book_id and ub.user_id = (select auth.uid())
  )
);

create policy "Users can update their own journal entries"
on public.journal_entries for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own journal entries"
on public.journal_entries for delete to authenticated
using ((select auth.uid()) = user_id);

create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row execute function public.set_updated_at();

-- Optional custom shelves such as Cozy Favorites, Signed Editions, Vacation Reads, etc.
create table if not exists public.custom_shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  visibility text not null default 'private'
    check (visibility in ('private', 'friends', 'public')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.custom_shelves enable row level security;

create policy "Users manage their own custom shelves"
on public.custom_shelves for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create trigger custom_shelves_set_updated_at
before update on public.custom_shelves
for each row execute function public.set_updated_at();

create table if not exists public.custom_shelf_books (
  shelf_id uuid not null references public.custom_shelves(id) on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sort_order integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (shelf_id, user_book_id)
);

alter table public.custom_shelf_books enable row level security;

create policy "Users manage books on their own custom shelves"
on public.custom_shelf_books for all to authenticated
using (
  (select auth.uid()) = user_id
  and exists (select 1 from public.custom_shelves s where s.id = shelf_id and s.user_id = (select auth.uid()))
)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.custom_shelves s where s.id = shelf_id and s.user_id = (select auth.uid()))
  and exists (select 1 from public.user_books ub where ub.id = user_book_id and ub.user_id = (select auth.uid()))
);

-- Recommendation feedback lets recommendations improve without storing extra personal information.
create table if not exists public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  feedback text not null check (feedback in ('saved', 'dismissed', 'not_interested', 'already_read')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

alter table public.recommendation_feedback enable row level security;

create policy "Users manage their own recommendation feedback"
on public.recommendation_feedback for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create trigger recommendation_feedback_set_updated_at
before update on public.recommendation_feedback
for each row execute function public.set_updated_at();
