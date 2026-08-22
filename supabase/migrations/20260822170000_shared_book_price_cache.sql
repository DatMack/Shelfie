-- Shared, server-side pricing cache. Only trusted Edge Functions can write or read
-- these rows directly; browser clients receive the safe subset returned by the
-- book-prices function.
create table if not exists public.book_price_cache (
  cache_key text primary key,
  isbn text,
  title text not null,
  author text,
  options jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(options) = 'array')
);

create index if not exists book_price_cache_expires_at_idx
  on public.book_price_cache (expires_at);

alter table public.book_price_cache enable row level security;

drop trigger if exists book_price_cache_set_updated_at on public.book_price_cache;
create trigger book_price_cache_set_updated_at
before update on public.book_price_cache
for each row execute function public.set_updated_at();

comment on table public.book_price_cache is
  'Shared 14-day cache for physical and ebook market lookups. Access is restricted to trusted server code.';
