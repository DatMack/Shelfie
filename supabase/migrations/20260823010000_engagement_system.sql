-- Shelfie engagement system: complete level curve, secure reading logger,
-- real daily quest events, and 100 server-verified achievements.

-- A gentle 1–100 curve. The cost to advance rises by 5 XP per level and
-- reaches 34,155 cumulative XP at level 100.
insert into public.level_definitions (level, title, xp_required, active)
select
  level,
  case
    when level = 100 then 'Eternal Reader'
    when level >= 90 then 'Legend of the Stacks'
    when level >= 75 then 'Mythic Reader'
    when level >= 60 then 'Grand Archivist'
    when level >= 50 then 'Master Librarian'
    when level >= 40 then 'Keeper of Legends'
    when level >= 35 then 'Tome Warden'
    when level >= 25 then 'Keeper of Stories'
    when level >= 20 then 'Library Curator'
    when level >= 15 then 'Story Collector'
    when level >= 12 then 'Page Voyager'
    when level >= 10 then 'Bibliophile'
    when level = 9 then 'Lore Keeper'
    when level = 8 then 'Plot Wanderer'
    when level = 7 then 'Shelf Builder'
    when level = 6 then 'Night Reader'
    when level = 5 then 'Bookworm'
    when level = 4 then 'Story Seeker'
    when level = 3 then 'Chapter Chaser'
    when level = 2 then 'Bookmark Collector'
    else 'Page Turner'
  end,
  ((level - 1) * 100) + ((5 * (level - 1) * (level - 2)) / 2),
  true
from generate_series(1, 100) as level
on conflict (level) do update set
  title = excluded.title,
  xp_required = excluded.xp_required,
  active = true;

update public.reader_progress rp
set level = coalesce((
      select ld.level
      from public.level_definitions ld
      where ld.active and ld.xp_required <= rp.total_xp
      order by ld.xp_required desc
      limit 1
    ), 1),
    updated_at = now();

insert into public.user_rewards (user_id, reward_id)
select rp.user_id, reward.id
from public.reader_progress rp
join public.reward_catalog reward on reward.active and reward.unlock_level <= rp.level
on conflict (user_id, reward_id) do nothing;

update public.reader_progress rp
set streak_saves = (
  select count(*)::integer
  from public.user_rewards ur
  join public.reward_catalog reward on reward.id = ur.reward_id
  where ur.user_id = rp.user_id and reward.reward_type = 'streak_save'
), updated_at = now();

alter table public.reading_sessions
  add column if not exists start_page integer check (start_page is null or start_page >= 0),
  add column if not exists end_page integer check (end_page is null or end_page >= 0),
  add column if not exists format text not null default 'print'
    check (format in ('print', 'ebook', 'audiobook')),
  add column if not exists mood text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reading_logs
  add column if not exists source_session_id uuid references public.reading_sessions(id) on delete cascade;

create index if not exists reading_logs_source_session_idx
  on public.reading_logs (source_session_id)
  where source_session_id is not null;

drop trigger if exists reading_sessions_set_updated_at on public.reading_sessions;
create trigger reading_sessions_set_updated_at
before update on public.reading_sessions
for each row execute function public.set_updated_at();

-- Reading totals can mint XP, so browser clients may only read them. All writes
-- go through the signed-in RPCs below, which validate ownership and sensible limits.
drop policy if exists "Users can log their own reading sessions" on public.reading_sessions;
drop policy if exists "Users can update their own reading sessions" on public.reading_sessions;
drop policy if exists "Users can delete their own reading sessions" on public.reading_sessions;
revoke insert, update, delete on table public.reading_sessions from authenticated;

drop policy if exists "Users can create their own reading logs" on public.reading_logs;
drop policy if exists "Users can delete their own reading logs" on public.reading_logs;
revoke insert, update, delete on table public.reading_logs from authenticated;

-- A journal entry must remain private, non-empty, and attached to one of the
-- signed-in reader's own books—even when a request bypasses the Shelfie UI.
drop policy if exists "Users can create their own journal entries" on public.journal_entries;
create policy "Users can create their own journal entries"
on public.journal_entries for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and visibility = 'private'
  and length(trim(body)) between 1 and 12000
  and exists (
    select 1 from public.user_books ub
    where ub.id = user_book_id and ub.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update their own journal entries" on public.journal_entries;
create policy "Users can update their own journal entries"
on public.journal_entries for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and visibility = 'private'
  and length(trim(body)) between 1 and 12000
  and exists (
    select 1 from public.user_books ub
    where ub.id = user_book_id and ub.user_id = (select auth.uid())
  )
);

-- Reviews use the same ownership invariant so changing a foreign key can never
-- attach one reader's private text to another reader's collection row.
drop policy if exists "Users can update their own reviews" on public.reviews;
create policy "Users can update their own reviews"
on public.reviews for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.user_books ub
    where ub.id = user_book_id and ub.user_id = (select auth.uid())
  )
);

-- Daily quests recognize both reading and calm, useful Shelfie actions.
alter table public.daily_quests drop constraint if exists daily_quests_event_type_check;
alter table public.daily_quests add constraint daily_quests_event_type_check check (
  event_type in (
    'minutes_read', 'pages_read', 'reading_session', 'progress_log', 'journal_entry',
    'rate_book', 'add_book', 'wishlist_book', 'own_book', 'customize_book',
    'favorite_book', 'start_book', 'finish_book', 'manual_book',
    'update_book_details', 'signed_book'
  )
);

create or replace function public.shelfie_apply_daily_quest_event(
  p_user_id uuid,
  p_activity_date date,
  p_event_type text,
  p_amount integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  new_progress integer;
  set_record record;
begin
  if p_amount <= 0 then return; end if;
  -- Historical logs remain useful records but cannot be used to manufacture old quest boards.
  if p_activity_date < current_date - 1 or p_activity_date > current_date + 1 then return; end if;

  perform public.shelfie_ensure_daily_quests_for_user(p_user_id, p_activity_date);

  for q in
    select * from public.daily_quests
    where user_id = p_user_id and quest_date = p_activity_date
      and event_type = p_event_type and completed_at is null
    order by position for update
  loop
    new_progress := least(q.target_amount, q.progress_amount + p_amount);
    update public.daily_quests
    set progress_amount = new_progress,
        completed_at = case when new_progress >= q.target_amount then now() else completed_at end
    where id = q.id;

    if q.progress_amount < q.target_amount and new_progress >= q.target_amount then
      perform public.shelfie_award_xp(p_user_id, 'daily_quest', q.reward_xp, 'daily-quest:' || q.id::text, q.id::text);
    end if;
  end loop;

  for set_record in
    select s.id, s.completion_bonus_xp from public.daily_quest_sets s
    where s.user_id = p_user_id and s.quest_date = p_activity_date
      and not exists (select 1 from public.daily_quests dq where dq.quest_set_id = s.id and dq.completed_at is null)
  loop
    if set_record.completion_bonus_xp > 0 then
      perform public.shelfie_award_xp(p_user_id, 'daily_quest_board', set_record.completion_bonus_xp, 'daily-quest-board:' || set_record.id::text, set_record.id::text);
    end if;
  end loop;
end;
$$;

revoke all on function public.shelfie_apply_daily_quest_event(uuid, date, text, integer) from public, anon, authenticated;

-- Rotate the third quest through a broader set of product actions. The first two
-- stay reading-centered so Shelfie never turns into a chore list with a book theme.
create or replace function public.shelfie_ensure_daily_quests_for_user(p_user_id uuid, p_local_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_set uuid;
  created_set uuid;
  seed integer;
  avg_minutes numeric;
  avg_pages numeric;
  minute_target integer;
  page_target integer;
  current_user_book_id uuid;
  current_title text;
  remaining_pages integer;
  library_count integer;
  engagement_choice integer;
  reading_title text;
  page_title text;
  headline_text text;
  third_title text;
  third_description text;
  third_event text;
  third_unit text;
  third_xp integer;
begin
  select id into existing_set from public.daily_quest_sets where user_id = p_user_id and quest_date = p_local_date;
  if existing_set is not null then return existing_set; end if;

  select avg(nullif(minutes_read, 0)), avg(nullif(pages_read, 0)) into avg_minutes, avg_pages
  from public.reading_sessions
  where user_id = p_user_id and activity_date >= p_local_date - 14 and activity_date < p_local_date;

  minute_target := greatest(10, least(25, (round(coalesce(avg_minutes, 15) / 5.0) * 5)::integer));
  page_target := greatest(10, least(30, (round(coalesce(avg_pages, 15) / 5.0) * 5)::integer));

  select ub.id, b.title,
         case when b.page_count is null then null else greatest(b.page_count - ub.current_page, 0) end
  into current_user_book_id, current_title, remaining_pages
  from public.user_books ub join public.books b on b.id = ub.book_id
  where ub.user_id = p_user_id and ub.status = 'currently_reading'
  order by ub.updated_at desc limit 1;

  select count(*)::integer into library_count
  from public.user_books
  where user_id = p_user_id;

  if remaining_pages between 1 and 30 then page_target := remaining_pages; end if;
  seed := hashtext(p_user_id::text || ':' || p_local_date::text) & 2147483647;
  engagement_choice := seed % 12;
  reading_title := (array['Cozy Focus','Quiet Chapter','Reading Reset','Settle In','Story Time'])[1 + (seed % 5)];
  page_title := case when remaining_pages between 1 and 30 then 'Finish Line'
    else (array['Turn the Page','Page Pocket','One More Stack','Chapter Push','Keep It Moving'])[1 + (seed % 5)] end;
  headline_text := case
    when current_title is not null then 'Today''s quests pair nicely with ' || current_title || '.'
    when library_count > 0 then 'Choose a current read whenever you feel ready.'
    else 'A few gentle first steps will bring your shelf to life.'
  end;

  select title, description, event_type, unit, reward_xp
  into third_title, third_description, third_event, third_unit, third_xp
  from (values
    (0, 'Show Up', 'Log one reading session today. Tiny check-ins count.', 'reading_session', 'session', 10),
    (1, 'Bookmark Check', 'Update your reading progress after a session.', 'progress_log', 'update', 10),
    (2, 'Leave a Breadcrumb', 'Save one thought, quote, prediction, or mood.', 'journal_entry', 'entry', 15),
    (3, 'Shelf Opinion', 'Give one book an honest star rating.', 'rate_book', 'rating', 10),
    (4, 'Future Story', 'Add one book to your wishlist.', 'wishlist_book', 'book', 10),
    (5, 'Make It Yours', 'Adjust the look of one book spine.', 'customize_book', 'book', 10),
    (6, 'Next Chapter', 'Mark a book as Currently Reading.', 'start_book', 'book', 10),
    (7, 'A New Arrival', 'Add one book to your Shelfie library.', 'add_book', 'book', 10),
    (8, 'Keeper Choice', 'Favorite a book you truly love.', 'favorite_book', 'book', 10),
    (9, 'Rare Find', 'Add one hard-to-find book manually.', 'manual_book', 'book', 15),
    (10, 'Copy Details', 'Update the format, condition, or edition details for one book.', 'update_book_details', 'book', 10),
    (11, 'Ink Magic', 'Mark one treasured copy as signed.', 'signed_book', 'copy', 15)
  ) choices(choice, title, description, event_type, unit, reward_xp)
  where choice = engagement_choice;

  if remaining_pages between 1 and 30 and (seed % 4) = 0 then
    third_title := 'Close the Cover';
    third_description := 'Finish the story already waiting near the end.';
    third_event := 'finish_book';
    third_unit := 'book';
    third_xp := 20;
  end if;

  insert into public.daily_quest_sets (user_id, quest_date, source, headline, completion_bonus_xp, context)
  values (p_user_id, p_local_date, 'smart_fallback', headline_text, 50,
    jsonb_build_object('minute_target', minute_target, 'page_target', page_target, 'current_user_book_id', current_user_book_id, 'uses_private_journal_text', false))
  on conflict (user_id, quest_date) do nothing returning id into created_set;

  if created_set is null then
    select id into created_set from public.daily_quest_sets where user_id = p_user_id and quest_date = p_local_date;
    return created_set;
  end if;

  -- Never hand an empty/new account reading goals it cannot log. The board
  -- gently introduces the actions that make reading logs possible first.
  if current_user_book_id is null then
    if library_count = 0 then
      insert into public.daily_quests (
        quest_set_id, user_id, quest_date, position, title, description, event_type,
        target_amount, unit, reward_xp, metadata
      ) values
      (created_set, p_user_id, p_local_date, 1, 'Begin Your Shelf', 'Add one book you would like to keep track of.', 'add_book', 1, 'book', 20, '{}'::jsonb),
      (created_set, p_user_id, p_local_date, 2, 'Save for Later', 'Place one interesting book on your wishlist.', 'wishlist_book', 1, 'book', 10, '{}'::jsonb),
      (created_set, p_user_id, p_local_date, 3, 'Open a Story', 'Mark one book as Currently Reading.', 'start_book', 1, 'book', 15, '{}'::jsonb);
    else
      insert into public.daily_quests (
        quest_set_id, user_id, quest_date, position, title, description, event_type,
        target_amount, unit, reward_xp, metadata
      ) values
      (created_set, p_user_id, p_local_date, 1, 'Open a Story', 'Choose one shelf book as your current read.', 'start_book', 1, 'book', 15, '{}'::jsonb),
      (created_set, p_user_id, p_local_date, 2, 'Shelf Opinion', 'Give one book an honest star rating.', 'rate_book', 1, 'rating', 10, '{}'::jsonb),
      (created_set, p_user_id, p_local_date, 3, 'Leave a Breadcrumb', 'Save one private thought, quote, prediction, or mood.', 'journal_entry', 1, 'entry', 15, '{}'::jsonb);
    end if;
    return created_set;
  end if;

  insert into public.daily_quests (
    quest_set_id, user_id, quest_date, position, title, description, event_type,
    target_amount, unit, reward_xp, metadata
  ) values
  (created_set, p_user_id, p_local_date, 1, reading_title,
    'Read for ' || minute_target || ' minutes. One focused sitting is plenty.',
    'minutes_read', minute_target, 'min', case when minute_target >= 20 then 20 else 15 end,
    jsonb_build_object('max_reasonable_target', 30)),
  (created_set, p_user_id, p_local_date, 2, page_title,
    case when remaining_pages between 1 and 30 and current_title is not null then 'You''re close — read the final ' || page_target || ' pages of ' || current_title || '.'
         when current_title is not null then 'Read ' || page_target || ' pages of ' || current_title || '.'
         else 'Read ' || page_target || ' pages of anything you''re enjoying.' end,
    'pages_read', page_target, case when page_target = 1 then 'page' else 'pages' end,
    case when page_target >= 20 then 20 else 15 end,
    jsonb_build_object('user_book_id', current_user_book_id, 'max_reasonable_target', 40)),
  (created_set, p_user_id, p_local_date, 3, third_title, third_description, third_event, 1, third_unit, third_xp, '{}'::jsonb);

  return created_set;
end;
$$;

revoke all on function public.shelfie_ensure_daily_quests_for_user(uuid, date) from public, anon, authenticated;

create or replace function public.process_user_book_engagement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  book_source text;
begin
  select external_source into book_source from public.books where id = new.book_id;

  if tg_op = 'INSERT' then
    perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'add_book', 1);
    if new.status = 'want_to_read' then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'wishlist_book', 1); end if;
    if new.status = 'currently_reading' then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'start_book', 1); end if;
    if new.status = 'read' then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'finish_book', 1); end if;
    if new.owned then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'own_book', 1); end if;
    if book_source = 'manual' then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'manual_book', 1); end if;
    if new.signed then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'signed_book', 1); end if;
  else
    if new.rating is not null and old.rating is distinct from new.rating then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'rate_book', 1); end if;
    if new.status = 'want_to_read' and old.status is distinct from new.status then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'wishlist_book', 1); end if;
    if new.status = 'currently_reading' and old.status is distinct from new.status then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'start_book', 1); end if;
    if new.status = 'read' and old.status is distinct from new.status then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'finish_book', 1); end if;
    if new.owned and not old.owned then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'own_book', 1); end if;
    if new.is_favorite and not old.is_favorite then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'favorite_book', 1); end if;
    if new.signed and not old.signed then perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'signed_book', 1); end if;
    if new.format is distinct from old.format or new.condition is distinct from old.condition
       or new.edition_note is distinct from old.edition_note or new.first_edition is distinct from old.first_edition
       or new.special_edition is distinct from old.special_edition then
      perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'update_book_details', 1);
    end if;
    if new.spine_design is distinct from old.spine_design or new.spine_color is distinct from old.spine_color
       or new.spine_accent is distinct from old.spine_accent or new.custom_spine_url is distinct from old.custom_spine_url then
      perform public.shelfie_apply_daily_quest_event(new.user_id, current_date, 'customize_book', 1);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_book_engagement_events on public.user_books;
create trigger user_book_engagement_events
after insert or update on public.user_books
for each row execute function public.process_user_book_engagement();

-- Rebuild private rollups from their source rows. This keeps streaks and totals
-- correct after backdated logs or a reader deleting an accidental session.
create or replace function public.shelfie_rebuild_reading_rollups(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_day date;
  current_run integer := 0;
  longest_run integer := 0;
begin
  delete from public.reading_activity_days where user_id = p_user_id;

  insert into public.reading_activity_days (user_id, activity_date, session_count, minutes_total, pages_total)
  select user_id, activity_date, count(*)::integer,
         coalesce(sum(minutes_read), 0)::integer,
         coalesce(sum(pages_read), 0)::integer
  from public.reading_sessions
  where user_id = p_user_id
  group by user_id, activity_date;

  select max(activity_date) into latest_day
  from public.reading_activity_days
  where user_id = p_user_id and activity_date <= current_date;

  with ordered as (
    select activity_date, activity_date - row_number() over (order by activity_date)::integer as grp
    from public.reading_activity_days where user_id = p_user_id and activity_date <= current_date
  ), runs as (
    select grp, min(activity_date) as first_day, max(activity_date) as last_day, count(*)::integer as run_length
    from ordered group by grp
  )
  select
    coalesce(max(run_length) filter (where last_day = latest_day), 0),
    coalesce(max(run_length), 0)
  into current_run, longest_run
  from runs;

  if latest_day is null or latest_day < current_date - 1 then current_run := 0; end if;

  insert into public.reader_progress (user_id, current_streak, longest_streak, last_reading_date)
  values (p_user_id, current_run, longest_run, latest_day)
  on conflict (user_id) do update set
    current_streak = excluded.current_streak,
    longest_streak = greatest(public.reader_progress.longest_streak, excluded.longest_streak),
    last_reading_date = excluded.last_reading_date,
    updated_at = now();
end;
$$;

revoke all on function public.shelfie_rebuild_reading_rollups(uuid) from public, anon, authenticated;

create or replace function public.process_reading_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.shelfie_rebuild_reading_rollups(new.user_id);

  if new.activity_date between current_date - 1 and current_date + 1 then
    perform public.shelfie_award_xp(new.user_id, 'daily_reading', 25, 'reading-day:' || new.activity_date::text, new.id::text);
    if coalesce(new.minutes_read, 0) >= 20 then
      perform public.shelfie_award_xp(new.user_id, 'focused_session', 10, 'focused-reading:' || new.activity_date::text, new.id::text);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.process_reading_session_quests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.activity_date between current_date - 1 and current_date + 1 then
    perform public.shelfie_apply_daily_quest_event(new.user_id, new.activity_date, 'reading_session', 1);
    perform public.shelfie_apply_daily_quest_event(new.user_id, new.activity_date, 'minutes_read', coalesce(new.minutes_read, 0));
    perform public.shelfie_apply_daily_quest_event(new.user_id, new.activity_date, 'pages_read', coalesce(new.pages_read, 0));
  end if;
  return new;
end;
$$;

create or replace function public.process_journal_entry_quests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.shelfie_apply_daily_quest_event(new.user_id, new.activity_date, 'journal_entry', 1);
  end if;
  if new.entry_type = 'review_draft' and length(trim(new.body)) >= 20
     and (tg_op = 'INSERT' or old.entry_type is distinct from 'review_draft' or length(trim(old.body)) < 20) then
    perform public.shelfie_award_xp(new.user_id, 'reviewed_book', 25, 'journal-review-book:' || new.user_book_id::text, new.id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists journal_entry_daily_quests on public.journal_entries;
create trigger journal_entry_daily_quests
after insert or update of entry_type, body on public.journal_entries
for each row execute function public.process_journal_entry_quests();

-- Atomic client-safe reading logger. It accepts only the signed-in reader's own
-- Currently Reading book and updates progress with the session in one transaction.
create or replace function public.log_my_reading_session(
  p_user_book_id uuid,
  p_minutes_read integer default 0,
  p_pages_read integer default 0,
  p_start_page integer default null,
  p_end_page integer default null,
  p_format text default 'print',
  p_mood text default null,
  p_note text default null,
  p_activity_date date default current_date
)
returns table (session_id uuid, current_page integer, pages_logged integer, activity_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_book_page integer;
  total_pages integer;
  calculated_end integer;
  calculated_pages integer;
  created_id uuid;
begin
  if uid is null then raise exception 'Sign in to log reading.'; end if;
  if p_activity_date < current_date - 30 or p_activity_date > current_date then raise exception 'Reading can be logged for today or the past 30 days.'; end if;
  if p_format not in ('print', 'ebook', 'audiobook') then raise exception 'Choose a valid reading format.'; end if;
  if coalesce(p_minutes_read, 0) < 0 or coalesce(p_pages_read, 0) < 0 then raise exception 'Reading totals cannot be negative.'; end if;
  if coalesce(p_minutes_read, 0) > 1440 then raise exception 'A single session cannot exceed 1,440 minutes.'; end if;
  if coalesce(p_pages_read, 0) > 2000 then raise exception 'A single session cannot exceed 2,000 pages.'; end if;
  if length(coalesce(p_mood, '')) > 40 then raise exception 'Keep the mood label under 40 characters.'; end if;
  if length(coalesce(p_note, '')) > 1000 then raise exception 'Keep the session note under 1,000 characters.'; end if;

  select ub.current_page, b.page_count into current_book_page, total_pages
  from public.user_books ub join public.books b on b.id = ub.book_id
  where ub.id = p_user_book_id and ub.user_id = uid and ub.status = 'currently_reading'
  for update of ub;
  if not found then raise exception 'Only a book marked Currently Reading can be logged.'; end if;

  current_book_page := coalesce(current_book_page, 0);
  if p_start_page is not null and p_start_page <> current_book_page then
    raise exception 'This book changed since the form opened. Refresh and try again.';
  end if;

  if p_end_page is not null then
    if p_end_page < current_book_page then raise exception 'The new page cannot be behind your saved progress.'; end if;
    calculated_end := case when total_pages is null then p_end_page else least(p_end_page, total_pages) end;
    calculated_pages := calculated_end - current_book_page;
  else
    calculated_end := case when total_pages is null then current_book_page + coalesce(p_pages_read, 0) else least(current_book_page + coalesce(p_pages_read, 0), total_pages) end;
    calculated_pages := calculated_end - current_book_page;
  end if;

  if calculated_pages > 2000 then raise exception 'A single session cannot exceed 2,000 pages.'; end if;

  if coalesce(p_minutes_read, 0) = 0 and calculated_pages = 0 then raise exception 'Add minutes, pages, or a new page number.'; end if;

  insert into public.reading_sessions (
    user_id, user_book_id, minutes_read, pages_read, start_page, end_page,
    format, mood, note, read_at, activity_date
  ) values (
    uid, p_user_book_id, coalesce(p_minutes_read, 0), calculated_pages, current_book_page,
    calculated_end, p_format, nullif(trim(coalesce(p_mood, '')), ''),
    nullif(trim(coalesce(p_note, '')), ''), now(), p_activity_date
  ) returning id into created_id;

  if calculated_end > current_book_page then
    update public.user_books set current_page = calculated_end, updated_at = now() where id = p_user_book_id and user_id = uid;
    insert into public.reading_logs (user_id, user_book_id, page, percent, minutes_read, logged_at, activity_date, source_session_id)
    values (uid, p_user_book_id, calculated_end,
      case when coalesce(total_pages, 0) > 0 then round((calculated_end::numeric / total_pages::numeric) * 100, 2) else null end,
      coalesce(p_minutes_read, 0), now(), p_activity_date, created_id);
  end if;

  return query select created_id, calculated_end, calculated_pages, p_activity_date;
end;
$$;

revoke all on function public.log_my_reading_session(uuid, integer, integer, integer, integer, text, text, text, date) from public, anon;
grant execute on function public.log_my_reading_session(uuid, integer, integer, integer, integer, text, text, text, date) to authenticated;

-- Delete mistakes through a narrow RPC so rollups are rebuilt and the book's
-- current page rewinds only when the removed session was its latest progress.
create or replace function public.delete_my_reading_session(p_session_id uuid)
returns table (deleted_ok boolean, book_id uuid, book_current_page integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  removed public.reading_sessions%rowtype;
  replacement_page integer;
begin
  if uid is null then raise exception 'Sign in to update reading history.'; end if;

  select * into removed
  from public.reading_sessions
  where id = p_session_id and user_id = uid
  for update;

  if not found then
    return query select false, null::uuid, null::integer;
    return;
  end if;

  delete from public.reading_sessions where id = removed.id and user_id = uid;

  if removed.user_book_id is not null and removed.end_page is not null then
    select coalesce(max(end_page), 0) into replacement_page
    from public.reading_sessions
    where user_id = uid and user_book_id = removed.user_book_id;

    update public.user_books
    set current_page = replacement_page, updated_at = now()
    where id = removed.user_book_id and user_id = uid and current_page = removed.end_page;
  end if;

  perform public.shelfie_rebuild_reading_rollups(uid);
  if removed.user_book_id is not null then
    select current_page into replacement_page
    from public.user_books
    where id = removed.user_book_id and user_id = uid;
  end if;
  return query select true, removed.user_book_id, replacement_page;
end;
$$;

revoke all on function public.delete_my_reading_session(uuid) from public, anon;
grant execute on function public.delete_my_reading_session(uuid) to authenticated;

-- One hundred compact definitions. Titles and descriptions are bundled with the
-- client for a polished offline-safe display; server criteria remain authoritative.
create table if not exists public.achievement_definitions (
  id text primary key,
  category text not null check (category in ('Reading', 'Consistency', 'Library', 'Journal', 'Curation', 'Personalization')),
  metric text not null,
  target_amount integer not null check (target_amount > 0),
  rarity text not null check (rarity in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary')),
  reward_xp integer not null check (reward_xp between 1 and 50),
  active boolean not null default true
);

alter table public.achievement_definitions enable row level security;
drop policy if exists "Signed-in users can read achievements" on public.achievement_definitions;
create policy "Signed-in users can read achievements" on public.achievement_definitions for select to authenticated using (true);

with groups(metric, category, targets) as (values
  ('reading_sessions', 'Reading', array[1,5,10,25,50,100]::integer[]),
  ('pages_read', 'Reading', array[10,100,500,1000,2500,5000,10000]),
  ('minutes_read', 'Reading', array[15,60,300,600,1200,3000]),
  ('books_read', 'Reading', array[1,3,5,10,25,50]),
  ('current_streak', 'Consistency', array[2,3,5,7,10,14,21,30,50,75,100]),
  ('reading_days', 'Consistency', array[5,15,50,100]),
  ('books_added', 'Library', array[1,5,10,25,50,100,250]),
  ('owned_books', 'Library', array[1,5,10,25,50,100]),
  ('wishlist_books', 'Library', array[1,5,10,25]),
  ('dnf_books', 'Library', array[1,3,5]),
  ('journal_entries', 'Journal', array[1,5,10,25,50,100,250]),
  ('rated_books', 'Journal', array[1,5,10,25,50]),
  ('reviews_written', 'Journal', array[1,5,10]),
  ('favorite_books', 'Curation', array[1,5,10,25]),
  ('manual_books', 'Curation', array[1,3,5,10]),
  ('signed_books', 'Curation', array[1,3,5]),
  ('special_editions', 'Curation', array[1,3]),
  ('genres_collected', 'Curation', array[3,5]),
  ('custom_spines', 'Personalization', array[1,5,10]),
  ('profile_photo', 'Personalization', array[1]),
  ('formats_collected', 'Personalization', array[2,4,6]),
  ('signed_proofs', 'Personalization', array[1,3]),
  ('first_editions', 'Personalization', array[1])
), expanded as (
  select metric, category, target, ordinal, cardinality(targets) as total
  from groups cross join lateral unnest(targets) with ordinality as milestones(target, ordinal)
), classified as (
  select *, case
    when ordinal = total and total >= 5 then 'Legendary'
    when ordinal::numeric / total >= .8 then 'Epic'
    when ordinal::numeric / total >= .55 then 'Rare'
    when ordinal::numeric / total >= .3 then 'Uncommon'
    else 'Common'
  end as rarity
  from expanded
)
insert into public.achievement_definitions (id, category, metric, target_amount, rarity, reward_xp)
select metric || '-' || target::text, category, metric, target, rarity,
  case rarity when 'Common' then 5 when 'Uncommon' then 10 when 'Rare' then 20 when 'Epic' then 35 else 50 end
from classified
on conflict (id) do update set
  category = excluded.category, metric = excluded.metric, target_amount = excluded.target_amount,
  rarity = excluded.rarity, reward_xp = excluded.reward_xp, active = true;

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievement_definitions(id) on delete cascade,
  progress_amount integer not null default 0 check (progress_amount >= 0),
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create index if not exists user_achievements_user_unlocked_idx on public.user_achievements (user_id, unlocked_at desc);
alter table public.user_achievements enable row level security;
drop policy if exists "Users can read their own achievements" on public.user_achievements;
create policy "Users can read their own achievements" on public.user_achievements for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.shelfie_evaluate_achievements(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  metrics jsonb;
  definition record;
  current_value integer;
  already_unlocked timestamptz;
begin
  if p_user_id is null then return; end if;

  select jsonb_build_object(
    'reading_sessions', (select count(*) from public.reading_sessions where user_id = p_user_id),
    'pages_read', (select coalesce(sum(pages_read),0) from public.reading_sessions where user_id = p_user_id),
    'minutes_read', (select coalesce(sum(minutes_read),0) from public.reading_sessions where user_id = p_user_id),
    'books_read', (select count(*) from public.user_books where user_id = p_user_id and status = 'read'),
    'current_streak', (select coalesce(current_streak,0) from public.reader_progress where user_id = p_user_id),
    'reading_days', (select count(*) from public.reading_activity_days where user_id = p_user_id),
    'books_added', (select count(*) from public.user_books where user_id = p_user_id),
    'owned_books', (select count(*) from public.user_books where user_id = p_user_id and owned),
    'wishlist_books', (select count(*) from public.user_books where user_id = p_user_id and status = 'want_to_read'),
    'dnf_books', (select count(*) from public.user_books where user_id = p_user_id and status = 'dnf'),
    'journal_entries', (select count(*) from public.journal_entries where user_id = p_user_id),
    'rated_books', (select count(*) from public.user_books where user_id = p_user_id and rating is not null),
    'reviews_written', (select count(*) from (
      select user_book_id from public.reviews
      where user_id = p_user_id and nullif(trim(coalesce(review_text,'')), '') is not null
      union
      select user_book_id from public.journal_entries
      where user_id = p_user_id and entry_type = 'review_draft' and length(trim(body)) >= 20
    ) written_reviews),
    'favorite_books', (select count(*) from public.user_books where user_id = p_user_id and is_favorite),
    'manual_books', (select count(*) from public.user_books ub join public.books b on b.id = ub.book_id where ub.user_id = p_user_id and b.external_source = 'manual'),
    'signed_books', (select count(*) from public.user_books where user_id = p_user_id and signed),
    'special_editions', (select count(*) from public.user_books where user_id = p_user_id and special_edition),
    'genres_collected', (select count(distinct genre) from public.user_books ub join public.books b on b.id = ub.book_id cross join lateral unnest(b.genres) genre where ub.user_id = p_user_id and nullif(trim(genre),'') is not null),
    'custom_spines', (select count(*) from public.user_books where user_id = p_user_id and (spine_design = 'custom_image' or custom_spine_url is not null)),
    'profile_photo', (select case when nullif(trim(coalesce(avatar_url,'')), '') is null then 0 else 1 end from public.profiles where id = p_user_id),
    'formats_collected', (select count(distinct format) from public.user_books where user_id = p_user_id and owned and format is not null),
    'signed_proofs', (select count(*) from public.user_books where user_id = p_user_id and signed_proof_verified_at is not null),
    'first_editions', (select count(*) from public.user_books where user_id = p_user_id and first_edition)
  ) into metrics;

  for definition in select * from public.achievement_definitions where active order by category, target_amount loop
    current_value := greatest(0, coalesce((metrics ->> definition.metric)::integer, 0));
    select unlocked_at into already_unlocked from public.user_achievements
    where user_id = p_user_id and achievement_id = definition.id;

    insert into public.user_achievements (user_id, achievement_id, progress_amount, unlocked_at, updated_at)
    values (p_user_id, definition.id, current_value,
      case when current_value >= definition.target_amount then now() else null end, now())
    on conflict (user_id, achievement_id) do update set
      progress_amount = greatest(public.user_achievements.progress_amount, excluded.progress_amount),
      unlocked_at = coalesce(public.user_achievements.unlocked_at, excluded.unlocked_at),
      updated_at = now();

    if already_unlocked is null and current_value >= definition.target_amount then
      perform public.shelfie_award_xp(p_user_id, 'achievement', definition.reward_xp,
        'achievement:' || definition.id, definition.id);
    end if;
  end loop;
end;
$$;

revoke all on function public.shelfie_evaluate_achievements(uuid) from public, anon, authenticated;

create or replace function public.refresh_my_achievements()
returns setof public.user_achievements
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view achievements.'; end if;
  perform public.shelfie_evaluate_achievements(auth.uid());
  return query select * from public.user_achievements where user_id = auth.uid() order by achievement_id;
end;
$$;

revoke all on function public.refresh_my_achievements() from public, anon;
grant execute on function public.refresh_my_achievements() to authenticated;

create or replace function public.process_achievement_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_user_id uuid;
begin
  if tg_table_name = 'profiles' then
    activity_user_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    activity_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  end if;
  perform public.shelfie_evaluate_achievements(activity_user_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists reading_session_achievements on public.reading_sessions;
drop trigger if exists zz_reading_session_achievements on public.reading_sessions;
create trigger zz_reading_session_achievements after insert on public.reading_sessions for each row execute function public.process_achievement_activity();
drop trigger if exists user_book_achievements on public.user_books;
create trigger user_book_achievements after insert or update on public.user_books for each row execute function public.process_achievement_activity();
drop trigger if exists journal_entry_achievements on public.journal_entries;
create trigger journal_entry_achievements after insert on public.journal_entries for each row execute function public.process_achievement_activity();
drop trigger if exists review_achievements on public.reviews;
create trigger review_achievements after insert or update on public.reviews for each row execute function public.process_achievement_activity();
drop trigger if exists profile_achievements on public.profiles;
create trigger profile_achievements after update of avatar_url on public.profiles for each row execute function public.process_achievement_activity();

-- Review XP is idempotent and now also works when an empty draft is later completed.
drop trigger if exists review_progression on public.reviews;
create trigger review_progression after insert or update of review_text on public.reviews for each row execute function public.award_review_xp();

-- PostgREST table privileges work together with the RLS policies above.
grant select on table public.level_definitions, public.reward_catalog, public.achievement_definitions to authenticated;
grant select on table public.reader_progress, public.xp_events, public.daily_quest_sets, public.daily_quests, public.user_achievements to authenticated;
grant select on table public.reading_sessions, public.reading_logs to authenticated;
grant select, insert, update, delete on table public.journal_entries, public.reviews to authenticated;

comment on table public.user_achievements is 'Private, server-verified achievement progress. Browser clients may read only their own rows.';
comment on function public.log_my_reading_session is 'Atomically logs reading and updates only the signed-in reader''s Currently Reading book.';
