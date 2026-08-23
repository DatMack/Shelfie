-- Owned To Be Read books and the server-owned Shelfie Shop economy.

alter table public.user_books drop constraint if exists user_books_status_check;
alter table public.user_books
  add constraint user_books_status_check
  check (status in ('want_to_read', 'to_be_read', 'currently_reading', 'read', 'dnf'));

create or replace function public.shelfie_normalize_book_status_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owned and new.status = 'want_to_read' then
    new.status := 'to_be_read';
  elsif not new.owned and new.status = 'to_be_read' then
    new.status := 'want_to_read';
  end if;
  return new;
end;
$$;

drop trigger if exists user_books_normalize_status_ownership on public.user_books;
create trigger user_books_normalize_status_ownership
before insert or update of status, owned on public.user_books
for each row execute function public.shelfie_normalize_book_status_ownership();

-- Existing owned wishlist books are the TBR books this status was meant to represent.
update public.user_books
set status = 'to_be_read', updated_at = now()
where owned and status = 'want_to_read';

alter table public.reader_progress
  add column if not exists coins integer not null default 0 check (coins >= 0),
  add column if not exists lifetime_coins integer not null default 0 check (lifetime_coins >= 0);

alter table public.xp_events
  add column if not exists xp_applied integer not null default 0 check (xp_applied >= 0),
  add column if not exists coins_awarded integer not null default 0 check (coins_awarded >= 0);

update public.xp_events
set xp_applied = xp
where xp_applied = 0 and coins_awarded = 0;

create table if not exists public.coin_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  source_id text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists coin_events_user_created_idx
  on public.coin_events (user_id, created_at desc);

alter table public.coin_events enable row level security;
drop policy if exists "Users can read their own coin history" on public.coin_events;
create policy "Users can read their own coin history"
on public.coin_events for select to authenticated
using ((select auth.uid()) = user_id);

-- Cap any pre-existing overflow at Level 100 and preserve it as coins.
with maximum as (
  select coalesce(max(xp_required) filter (where level = 100), 34155)::integer as max_xp
  from public.level_definitions
), overflowing as (
  select rp.user_id, rp.total_xp - maximum.max_xp as overflow, maximum.max_xp
  from public.reader_progress rp cross join maximum
  where rp.total_xp > maximum.max_xp
)
update public.reader_progress rp
set total_xp = overflowing.max_xp,
    level = 100,
    coins = rp.coins + overflowing.overflow,
    lifetime_coins = rp.lifetime_coins + overflowing.overflow,
    updated_at = now()
from overflowing
where rp.user_id = overflowing.user_id;

create or replace function public.shelfie_award_xp(
  p_user_id uuid,
  p_event_type text,
  p_xp integer,
  p_idempotency_key text,
  p_source_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
  current_total integer;
  current_coins integer;
  maximum_xp integer;
  applied_xp integer;
  awarded_coins integer;
  new_total integer;
  new_balance integer;
  new_level integer;
begin
  if p_xp <= 0 then return; end if;

  insert into public.xp_events (user_id, event_type, xp, source_id, idempotency_key)
  values (p_user_id, p_event_type, p_xp, p_source_id, p_idempotency_key)
  on conflict (user_id, idempotency_key) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return; end if;

  insert into public.reader_progress (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select total_xp, coins
  into current_total, current_coins
  from public.reader_progress
  where user_id = p_user_id
  for update;

  select xp_required into maximum_xp
  from public.level_definitions
  where level = 100 and active = true
  limit 1;
  maximum_xp := coalesce(maximum_xp, 34155);

  applied_xp := least(p_xp, greatest(maximum_xp - current_total, 0));
  awarded_coins := p_xp - applied_xp;
  new_total := current_total + applied_xp;
  new_balance := current_coins + awarded_coins;

  update public.xp_events
  set xp_applied = applied_xp, coins_awarded = awarded_coins
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  update public.reader_progress
  set total_xp = new_total,
      coins = new_balance,
      lifetime_coins = lifetime_coins + awarded_coins,
      updated_at = now()
  where user_id = p_user_id;

  if awarded_coins > 0 then
    insert into public.coin_events (user_id, event_type, amount, balance_after, source_id, idempotency_key)
    values (p_user_id, 'xp_conversion', awarded_coins, new_balance, p_source_id, 'xp:' || p_idempotency_key)
    on conflict (user_id, idempotency_key) do nothing;
  end if;

  select level into new_level
  from public.level_definitions
  where active = true and xp_required <= new_total
  order by xp_required desc
  limit 1;

  update public.reader_progress
  set level = coalesce(new_level, 1), updated_at = now()
  where user_id = p_user_id;

  insert into public.user_rewards (user_id, reward_id)
  select p_user_id, reward.id
  from public.reward_catalog reward
  where reward.active = true and reward.unlock_level <= coalesce(new_level, 1)
  on conflict (user_id, reward_id) do nothing;

  update public.reader_progress progress
  set streak_saves = (
    select count(*)::integer
    from public.user_rewards user_reward
    join public.reward_catalog reward on reward.id = user_reward.reward_id
    where user_reward.user_id = p_user_id and reward.reward_type = 'streak_save'
  ), updated_at = now()
  where progress.user_id = p_user_id;
end;
$$;

revoke all on function public.shelfie_award_xp(uuid, text, integer, text, text) from public, anon, authenticated;

create table if not exists public.shop_items (
  id text primary key,
  name text not null,
  description text not null,
  item_type text not null check (item_type in ('shelf_style', 'shelf_finish', 'site_theme', 'decoration', 'effect', 'profile_frame')),
  coin_cost integer not null check (coin_cost > 0),
  rarity text not null default 'Common' check (rarity in ('Common', 'Rare', 'Epic', 'Legendary')),
  payload jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_items enable row level security;
drop policy if exists "Signed-in users can browse active shop items" on public.shop_items;
create policy "Signed-in users can browse active shop items"
on public.shop_items for select to authenticated
using (active);

create table if not exists public.shop_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_item_id text not null references public.shop_items(id) on delete restrict,
  coin_cost integer not null check (coin_cost > 0),
  purchased_at timestamptz not null default now(),
  unique (user_id, shop_item_id)
);

create index if not exists shop_purchases_user_created_idx
  on public.shop_purchases (user_id, purchased_at desc);

alter table public.shop_purchases enable row level security;
drop policy if exists "Users can read their own shop purchases" on public.shop_purchases;
create policy "Users can read their own shop purchases"
on public.shop_purchases for select to authenticated
using ((select auth.uid()) = user_id);

-- Purchases are atomic and server-owned: clients cannot grant coins or inventory.
create or replace function public.purchase_shop_item(p_shop_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  item_record public.shop_items;
  current_level integer;
  current_balance integer;
  next_balance integer;
begin
  if current_user_id is null then raise exception 'You must be signed in to use the shop.'; end if;

  select * into item_record
  from public.shop_items
  where id = p_shop_item_id and active
  limit 1;
  if not found then raise exception 'That shop item is not available.'; end if;

  insert into public.reader_progress (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select level, coins into current_level, current_balance
  from public.reader_progress
  where user_id = current_user_id
  for update;

  if current_level < 100 then raise exception 'Shelf Coins unlock at Level 100.'; end if;

  if exists (
    select 1 from public.shop_purchases
    where user_id = current_user_id and shop_item_id = p_shop_item_id
  ) then
    return jsonb_build_object('purchased', true, 'already_owned', true, 'coins', current_balance);
  end if;

  if current_balance < item_record.coin_cost then raise exception 'You do not have enough Shelf Coins yet.'; end if;
  next_balance := current_balance - item_record.coin_cost;

  update public.reader_progress
  set coins = next_balance, updated_at = now()
  where user_id = current_user_id;

  insert into public.shop_purchases (user_id, shop_item_id, coin_cost)
  values (current_user_id, p_shop_item_id, item_record.coin_cost);

  insert into public.coin_events (user_id, event_type, amount, balance_after, source_id, idempotency_key)
  values (current_user_id, 'shop_purchase', -item_record.coin_cost, next_balance, p_shop_item_id, 'purchase:' || p_shop_item_id)
  on conflict (user_id, idempotency_key) do nothing;

  return jsonb_build_object('purchased', true, 'already_owned', false, 'coins', next_balance);
end;
$$;

revoke all on function public.purchase_shop_item(text) from public, anon;
grant execute on function public.purchase_shop_item(text) to authenticated;

grant select on table public.shop_items, public.shop_purchases, public.coin_events to authenticated;
grant select on table public.reader_progress, public.xp_events to authenticated;
