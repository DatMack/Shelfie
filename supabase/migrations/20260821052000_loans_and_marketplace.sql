-- Shelfie loans and optional community marketplace
-- Private-by-default. Public/friend browsing is intentionally NOT enabled yet.

-- Keep a real loan history instead of only storing the current borrower on user_books.
create table if not exists public.book_loans (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  borrower_user_id uuid references auth.users(id) on delete set null,
  borrower_name text,
  loaned_at date not null default current_date,
  due_date date,
  returned_at date,
  private_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (borrower_user_id is not null or nullif(trim(borrower_name), '') is not null),
  check (due_date is null or due_date >= loaned_at),
  check (returned_at is null or returned_at >= loaned_at)
);

create index if not exists book_loans_owner_idx
  on public.book_loans (owner_user_id, loaned_at desc);
create index if not exists book_loans_book_idx
  on public.book_loans (user_book_id, loaned_at desc);
create index if not exists book_loans_open_idx
  on public.book_loans (owner_user_id, due_date)
  where returned_at is null;

alter table public.book_loans enable row level security;

create policy "Owners can read their loan history"
on public.book_loans for select to authenticated
using ((select auth.uid()) = owner_user_id);

create policy "Owners can create loans for their books"
on public.book_loans for insert to authenticated
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.user_books ub
    where ub.id = user_book_id
      and ub.user_id = (select auth.uid())
      and ub.owned = true
  )
);

create policy "Owners can update their loans"
on public.book_loans for update to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy "Owners can delete their loans"
on public.book_loans for delete to authenticated
using ((select auth.uid()) = owner_user_id);

create trigger book_loans_set_updated_at
before update on public.book_loans
for each row execute function public.set_updated_at();

-- Optional marketplace listing for an owned physical copy.
-- Exact addresses, phone numbers, payment details, and shipping labels do NOT belong here.
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  listing_type text not null
    check (listing_type in ('trade', 'sale', 'free')),
  status text not null default 'active'
    check (status in ('draft', 'active', 'reserved', 'completed', 'cancelled')),
  visibility text not null default 'friends'
    check (visibility in ('friends', 'public')),
  asking_price numeric(10,2) check (asking_price is null or asking_price >= 0),
  currency text not null default 'USD',
  condition_snapshot text,
  description text,
  trade_wishlist text,
  shipping_offered boolean not null default false,
  local_exchange_offered boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (listing_type <> 'sale' or asking_price is not null),
  unique (user_book_id)
);

create index if not exists marketplace_seller_idx
  on public.marketplace_listings (seller_user_id, status, created_at desc);
create index if not exists marketplace_active_idx
  on public.marketplace_listings (status, listing_type, created_at desc)
  where status = 'active';

alter table public.marketplace_listings enable row level security;

-- For now only the seller can see/manage listings.
-- Friend/public browsing policies will be introduced only after profile/friend privacy is tested.
create policy "Sellers can read their own listings"
on public.marketplace_listings for select to authenticated
using ((select auth.uid()) = seller_user_id);

create policy "Sellers can list their own physical books"
on public.marketplace_listings for insert to authenticated
with check (
  (select auth.uid()) = seller_user_id
  and exists (
    select 1 from public.user_books ub
    where ub.id = user_book_id
      and ub.user_id = (select auth.uid())
      and ub.owned = true
      and ub.format in ('hardcover', 'paperback', 'mass_market', 'other')
  )
);

create policy "Sellers can update their own listings"
on public.marketplace_listings for update to authenticated
using ((select auth.uid()) = seller_user_id)
with check ((select auth.uid()) = seller_user_id);

create policy "Sellers can remove their own listings"
on public.marketplace_listings for delete to authenticated
using ((select auth.uid()) = seller_user_id);

create trigger marketplace_listings_set_updated_at
before update on public.marketplace_listings
for each row execute function public.set_updated_at();

-- Trade/buy interest. This is intentionally minimal until messaging is added.
create table if not exists public.marketplace_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  offerer_user_id uuid not null references auth.users(id) on delete cascade,
  offered_user_book_id uuid references public.user_books(id) on delete set null,
  cash_offer numeric(10,2) check (cash_offer is null or cash_offer >= 0),
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, offerer_user_id)
);

create index if not exists marketplace_offers_listing_idx
  on public.marketplace_offers (listing_id, status, created_at desc);
create index if not exists marketplace_offers_offerer_idx
  on public.marketplace_offers (offerer_user_id, status, created_at desc);

alter table public.marketplace_offers enable row level security;

create policy "Offer participants can read offers"
on public.marketplace_offers for select to authenticated
using (
  (select auth.uid()) = offerer_user_id
  or exists (
    select 1 from public.marketplace_listings ml
    where ml.id = listing_id and ml.seller_user_id = (select auth.uid())
  )
);

create policy "Users can make offers on other users listings"
on public.marketplace_offers for insert to authenticated
with check (
  (select auth.uid()) = offerer_user_id
  and exists (
    select 1 from public.marketplace_listings ml
    where ml.id = listing_id
      and ml.seller_user_id <> (select auth.uid())
      and ml.status = 'active'
  )
  and (
    offered_user_book_id is null
    or exists (
      select 1 from public.user_books ub
      where ub.id = offered_user_book_id
        and ub.user_id = (select auth.uid())
        and ub.owned = true
    )
  )
);

-- Offer status changes will later go through narrowly-scoped RPCs so an offerer
-- cannot accept their own offer and a seller cannot impersonate the offerer.

create trigger marketplace_offers_set_updated_at
before update on public.marketplace_offers
for each row execute function public.set_updated_at();
