-- Shelfie reader progression
-- Server-owned XP, daily reading streaks, level rewards, and cosmetic unlocks.

create table if not exists public.level_definitions (
  level integer primary key check (level > 0),
  title text not null,
  xp_required integer not null check (xp_required >= 0),
  active boolean not null default true
);

alter table public.level_definitions enable row level security;

create policy "Signed-in users can read level definitions"
on public.level_definitions for select to authenticated using (true);

insert into public.level_definitions (level, title, xp_required) values
  (1, 'Page Turner', 0),
  (2, 'Bookmark Collector', 100),
  (3, 'Chapter Chaser', 220),
  (4, 'Story Seeker', 360),
  (5, 'Bookworm', 520),
  (6, 'Night Reader', 700),
  (7, 'Shelf Builder', 900),
  (8, 'Plot Wanderer', 1125),
  (9, 'Lore Keeper', 1375),
  (10, 'Bibliophile', 1650),
  (12, 'Page Voyager', 2300),
  (15, 'Story Collector', 3500),
  (20, 'Library Curator', 6000),
  (25, 'Keeper of Stories', 9000),
  (35, 'Tome Warden', 16000),
  (50, 'Master Librarian', 30000),
  (75, 'Mythic Reader', 60000),
  (100, 'Eternal Reader', 100000)
on conflict (level) do update set
  title = excluded.title,
  xp_required = excluded.xp_required;

create table if not exists public.reward_catalog (
  id text primary key,
  name text not null,
  description text not null,
  unlock_level integer not null references public.level_definitions(level),
  reward_type text not null check (reward_type in ('title', 'shelf_theme', 'decoration', 'effect', 'profile_frame', 'streak_save')),
  rarity text not null default 'Common' check (rarity in ('Common', 'Rare', 'Epic', 'Legendary')),
  payload jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

alter table public.reward_catalog enable row level security;

create policy "Signed-in users can read rewards"
on public.reward_catalog for select to authenticated using (true);

insert into public.reward_catalog (id, name, description, unlock_level, reward_type, rarity, payload) values
  ('golden-bookmark', 'Golden Bookmark', 'A small gold bookmark accent for your profile.', 2, 'decoration', 'Common', '{"asset":"golden_bookmark"}'),
  ('warm-glow', 'Warm Glow', 'A warmer glow when books move forward on your shelf.', 3, 'effect', 'Common', '{"effect":"warm_glow"}'),
  ('walnut-shelf', 'Walnut Shelf', 'A rich walnut bookshelf finish.', 5, 'shelf_theme', 'Rare', '{"theme":"walnut"}'),
  ('bookmark-save', 'Streak Save', 'Protect one reading streak from a missed day.', 6, 'streak_save', 'Rare', '{"quantity":1}'),
  ('cozy-candle', 'Cozy Candle', 'A glowing candle decoration for your virtual shelf.', 7, 'decoration', 'Rare', '{"asset":"cozy_candle"}'),
  ('oak-library', 'Oak Library', 'A bright oak bookshelf theme.', 8, 'shelf_theme', 'Rare', '{"theme":"oak"}'),
  ('brass-bookends', 'Brass Bookends', 'Decorative brass bookends for your shelf.', 10, 'decoration', 'Epic', '{"asset":"brass_bookends"}'),
  ('falling-leaves', 'Falling Leaves', 'A subtle seasonal reading effect.', 12, 'effect', 'Rare', '{"effect":"falling_leaves"}'),
  ('enchanted-sparkles', 'Enchanted Sparkles', 'Give favorite books a magical particle effect.', 15, 'effect', 'Epic', '{"effect":"enchanted_sparkles"}'),
  ('grand-library', 'Grand Library', 'An ornate grand-library bookshelf theme.', 20, 'shelf_theme', 'Epic', '{"theme":"grand_library"}'),
  ('gilded-frame', 'Gilded Reader Frame', 'A gold profile frame that shows off your reader level.', 25, 'profile_frame', 'Epic', '{"frame":"gilded"}'),
  ('dragon-bookend', 'Dragon Bookend', 'A tiny dragon guards the edge of your shelf.', 35, 'decoration', 'Legendary', '{"asset":"dragon_bookend"}'),
  ('master-library', 'Master Library', 'A legendary library theme with animated details.', 50, 'shelf_theme', 'Legendary', '{"theme":"master_library"}'),
  ('mythic-aura', 'Mythic Aura', 'A rare profile and bookshelf aura.', 75, 'effect', 'Legendary', '{"effect":"mythic_aura"}'),
  ('eternal-library', 'Eternal Library', 'The highest-tier Shelfie library theme and Eternal Reader title.', 100, 'shelf_theme', 'Legendary', '{"theme":"eternal_library"}')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  unlock_level = excluded.unlock_level,
  reward_type = excluded.reward_type,
  rarity = excluded.rarity,
  payload = excluded.payload,
  active = excluded.active;

create table if not exists public.reader_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  level integer not null default 1 references public.level_definitions(level),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_reading_date date,
  streak_saves integer not null default 0 check (streak_saves >= 0),
  updated_at timestamptz not null default now()
);

alter table public.reader_progress enable row level security;

create policy "Users can read their own progression"
on public.reader_progress for select to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.user_cosmetics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shelf_theme text not null default 'classic',
  selected_effect text,
  profile_frame text,
  updated_at timestamptz not null default now()
);

alter table public.user_cosmetics enable row level security;

create policy "Users can read their own cosmetics"
on public.user_cosmetics for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update their own cosmetics"
on public.user_cosmetics for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.user_rewards (
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id text not null references public.reward_catalog(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, reward_id)
);

alter table public.user_rewards enable row level security;

create policy "Users can read their own unlocked rewards"
on public.user_rewards for select to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  xp integer not null check (xp > 0),
  source_id text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists xp_events_user_created_idx
  on public.xp_events (user_id, created_at desc);

alter table public.xp_events enable row level security;

create policy "Users can read their own XP history"
on public.xp_events for select to authenticated
using ((select auth.uid()) = user_id);

-- There are intentionally no client INSERT/UPDATE policies on progression, rewards, or XP events.
-- XP is awarded by database-owned trigger functions so a browser cannot simply grant itself points.

create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_book_id uuid references public.user_books(id) on delete cascade,
  minutes_read integer check (minutes_read is null or minutes_read >= 0),
  pages_read integer check (pages_read is null or pages_read >= 0),
  note text,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (coalesce(minutes_read, 0) > 0 or coalesce(pages_read, 0) > 0)
);

create index if not exists reading_sessions_user_date_idx
  on public.reading_sessions (user_id, read_at desc);

alter table public.reading_sessions enable row level security;

create policy "Users can read their own reading sessions"
on public.reading_sessions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can log their own reading sessions"
on public.reading_sessions for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    user_book_id is null
    or exists (
      select 1 from public.user_books ub
      where ub.id = user_book_id and ub.user_id = (select auth.uid())
    )
  )
);

create policy "Users can delete their own reading sessions"
on public.reading_sessions for delete to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.reading_activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  session_count integer not null default 0 check (session_count >= 0),
  minutes_total integer not null default 0 check (minutes_total >= 0),
  pages_total integer not null default 0 check (pages_total >= 0),
  primary key (user_id, activity_date)
);

alter table public.reading_activity_days enable row level security;

create policy "Users can read their own reading days"
on public.reading_activity_days for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.initialize_reader_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reader_progress (user_id) values (new.id)
    on conflict (user_id) do nothing;
  insert into public.user_cosmetics (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_reader_progress
after insert on auth.users
for each row execute function public.initialize_reader_progress();

-- Backfill any accounts created before this migration is installed.
insert into public.reader_progress (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.user_cosmetics (user_id)
select id from auth.users
on conflict (user_id) do nothing;

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
  new_total integer;
  new_level integer;
begin
  if p_xp <= 0 then return; end if;

  insert into public.xp_events (user_id, event_type, xp, source_id, idempotency_key)
  values (p_user_id, p_event_type, p_xp, p_source_id, p_idempotency_key)
  on conflict (user_id, idempotency_key) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return; end if;

  insert into public.reader_progress (user_id, total_xp)
  values (p_user_id, p_xp)
  on conflict (user_id) do update
    set total_xp = public.reader_progress.total_xp + excluded.total_xp,
        updated_at = now()
  returning total_xp into new_total;

  select level into new_level
  from public.level_definitions
  where active = true and xp_required <= new_total
  order by xp_required desc
  limit 1;

  update public.reader_progress
  set level = coalesce(new_level, 1), updated_at = now()
  where user_id = p_user_id;

  insert into public.user_rewards (user_id, reward_id)
  select p_user_id, r.id
  from public.reward_catalog r
  where r.active = true and r.unlock_level <= coalesce(new_level, 1)
  on conflict (user_id, reward_id) do nothing;

  update public.reader_progress rp
  set streak_saves = (
    select count(*)::integer
    from public.user_rewards ur
    join public.reward_catalog rc on rc.id = ur.reward_id
    where ur.user_id = p_user_id and rc.reward_type = 'streak_save'
  ),
  updated_at = now()
  where rp.user_id = p_user_id;
end;
$$;

revoke all on function public.shelfie_award_xp(uuid, text, integer, text, text) from public;
revoke all on function public.shelfie_award_xp(uuid, text, integer, text, text) from anon;
revoke all on function public.shelfie_award_xp(uuid, text, integer, text, text) from authenticated;

create or replace function public.process_reading_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_day date := (new.read_at at time zone 'UTC')::date;
  inserted_count integer;
  previous_date date;
  next_streak integer;
begin
  insert into public.reading_activity_days (user_id, activity_date, session_count, minutes_total, pages_total)
  values (new.user_id, activity_day, 1, coalesce(new.minutes_read, 0), coalesce(new.pages_read, 0))
  on conflict (user_id, activity_date) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    select last_reading_date into previous_date
    from public.reader_progress where user_id = new.user_id;

    if previous_date = activity_day - 1 then
      select current_streak + 1 into next_streak from public.reader_progress where user_id = new.user_id;
    else
      next_streak := 1;
    end if;

    update public.reader_progress
    set current_streak = next_streak,
        longest_streak = greatest(longest_streak, next_streak),
        last_reading_date = activity_day,
        updated_at = now()
    where user_id = new.user_id;

    perform public.shelfie_award_xp(new.user_id, 'daily_reading', 25, 'reading-day:' || activity_day::text, new.id::text);
  else
    update public.reading_activity_days
    set session_count = session_count + 1,
        minutes_total = minutes_total + coalesce(new.minutes_read, 0),
        pages_total = pages_total + coalesce(new.pages_read, 0)
    where user_id = new.user_id and activity_date = activity_day;
  end if;

  if coalesce(new.minutes_read, 0) >= 20 then
    perform public.shelfie_award_xp(new.user_id, 'focused_session', 10, 'focused-reading:' || activity_day::text, new.id::text);
  end if;

  return new;
end;
$$;

create trigger reading_session_progression
after insert on public.reading_sessions
for each row execute function public.process_reading_session();

create or replace function public.award_finished_book_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'read' and (tg_op = 'INSERT' or old.status is distinct from 'read') then
    perform public.shelfie_award_xp(new.user_id, 'finished_book', 100, 'finished-book:' || new.id::text, new.id::text);
  end if;
  return new;
end;
$$;

create trigger user_book_finished_progression
after insert or update of status on public.user_books
for each row execute function public.award_finished_book_xp();

create or replace function public.award_review_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.review_text, '')), '') is not null then
    perform public.shelfie_award_xp(new.user_id, 'reviewed_book', 25, 'review:' || new.id::text, new.id::text);
  end if;
  return new;
end;
$$;

create trigger review_progression
after insert on public.reviews
for each row execute function public.award_review_xp();
