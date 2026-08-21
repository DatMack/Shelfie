-- Shelfie initial database schema
-- Privacy-first: user-owned data is private by default and protected with RLS.

create extension if not exists pgcrypto;

-- Keep updated_at fields current.
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

-- User profiles. Keep this intentionally minimal.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  bio text,
  profile_visibility text not null default 'private'
    check (profile_visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Automatically create a minimal profile when a Supabase Auth account is created.
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
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      'reader_' || substr(new.id::text, 1, 8)
    ),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Shared book metadata. Nothing in this table is personal user data.
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  external_source text,
  external_id text,
  isbn text,
  title text not null,
  subtitle text,
  authors text[] not null default '{}',
  description text,
  cover_url text,
  publisher text,
  published_date text,
  page_count integer check (page_count is null or page_count >= 0),
  genres text[] not null default '{}',
  language text,
  created_at timestamptz not null default now()
);

create unique index if not exists books_external_source_id_unique
  on public.books (external_source, external_id)
  where external_source is not null and external_id is not null;

create index if not exists books_isbn_idx on public.books (isbn);
create index if not exists books_title_idx on public.books (title);

alter table public.books enable row level security;

create policy "Signed-in users can read book metadata"
on public.books
for select
to authenticated
using (true);

create policy "Signed-in users can add book metadata"
on public.books
for insert
to authenticated
with check (true);

-- A user's copy / relationship to a book.
create table if not exists public.user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  status text not null default 'want_to_read'
    check (status in ('want_to_read', 'currently_reading', 'read', 'dnf')),
  format text,
  current_page integer not null default 0 check (current_page >= 0),
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  is_favorite boolean not null default false,
  started_at date,
  finished_at date,
  visibility text not null default 'private'
    check (visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create index if not exists user_books_user_id_idx on public.user_books (user_id);
create index if not exists user_books_status_idx on public.user_books (user_id, status);

alter table public.user_books enable row level security;

create policy "Users can read their own shelf"
on public.user_books
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add to their own shelf"
on public.user_books
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own shelf"
on public.user_books
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can remove from their own shelf"
on public.user_books
for delete
to authenticated
using ((select auth.uid()) = user_id);

create trigger user_books_set_updated_at
before update on public.user_books
for each row execute function public.set_updated_at();

-- Reading progress history.
create table if not exists public.reading_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  page integer check (page is null or page >= 0),
  percent numeric(5,2) check (percent is null or (percent >= 0 and percent <= 100)),
  logged_at timestamptz not null default now()
);

create index if not exists reading_logs_user_book_idx
  on public.reading_logs (user_book_id, logged_at desc);

alter table public.reading_logs enable row level security;

create policy "Users can read their own reading logs"
on public.reading_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own reading logs"
on public.reading_logs
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.user_books ub
    where ub.id = user_book_id and ub.user_id = (select auth.uid())
  )
);

create policy "Users can delete their own reading logs"
on public.reading_logs
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Reviews are separate from private journals so sharing can be explicit later.
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
on public.reviews
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own reviews"
on public.reviews
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.user_books ub
    where ub.id = user_book_id and ub.user_id = (select auth.uid())
  )
);

create policy "Users can update their own reviews"
on public.reviews
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own reviews"
on public.reviews
for delete
to authenticated
using ((select auth.uid()) = user_id);

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

-- Journal entries are PRIVATE by default. Social sharing will be added explicitly later.
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  entry_type text not null default 'note',
  body text not null,
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
on public.journal_entries
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own journal entries"
on public.journal_entries
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.user_books ub
    where ub.id = user_book_id and ub.user_id = (select auth.uid())
  )
);

create policy "Users can update their own journal entries"
on public.journal_entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own journal entries"
on public.journal_entries
for delete
to authenticated
using ((select auth.uid()) = user_id);

create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row execute function public.set_updated_at();
