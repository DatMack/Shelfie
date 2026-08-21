-- Shelfie Daily Quests
-- Fresh, achievable quest sets that can later be personalized by an AI Edge Function.
-- Personal reading/journal content is NOT needed to generate the fallback quests.

create table if not exists public.daily_quest_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_date date not null,
  source text not null default 'smart_fallback'
    check (source in ('smart_fallback', 'ai')),
  headline text not null,
  completion_bonus_xp integer not null default 25
    check (completion_bonus_xp between 0 and 100),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, quest_date)
);

create index if not exists daily_quest_sets_user_date_idx
  on public.daily_quest_sets (user_id, quest_date desc);

alter table public.daily_quest_sets enable row level security;

create policy "Users can read their own daily quest sets"
on public.daily_quest_sets for select to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  quest_set_id uuid not null references public.daily_quest_sets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_date date not null,
  position integer not null check (position between 1 and 3),
  title text not null,
  description text not null,
  event_type text not null
    check (event_type in ('minutes_read', 'pages_read', 'reading_session', 'progress_log', 'journal_entry')),
  target_amount integer not null check (target_amount > 0),
  unit text not null,
  reward_xp integer not null check (reward_xp between 1 and 25),
  progress_amount integer not null default 0 check (progress_amount >= 0),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (quest_set_id, position)
);

create index if not exists daily_quests_user_date_idx
  on public.daily_quests (user_id, quest_date, position);

alter table public.daily_quests enable row level security;

create policy "Users can read their own daily quests"
on public.daily_quests for select to authenticated
using ((select auth.uid()) = user_id);

-- No client INSERT/UPDATE/DELETE policies are intentional.
-- Daily quests and their progress are server-owned so users cannot mint XP by editing requests.

-- Reading-log and journal actions need the reader's local date just like reading sessions do.
alter table public.reading_logs
  add column if not exists activity_date date not null default current_date;

alter table public.journal_entries
  add column if not exists activity_date date not null default current_date;

create or replace function public.shelfie_ensure_daily_quests_for_user(
  p_user_id uuid,
  p_local_date date
)
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
  engagement_choice integer;
  reading_title text;
  page_title text;
  headline_text text;
begin
  select id into existing_set
  from public.daily_quest_sets
  where user_id = p_user_id and quest_date = p_local_date;

  if existing_set is not null then
    return existing_set;
  end if;

  -- Keep fallback goals grounded in recent habits. New readers get a gentle 15-minute / 15-page baseline.
  select avg(nullif(minutes_read, 0)), avg(nullif(pages_read, 0))
  into avg_minutes, avg_pages
  from public.reading_sessions
  where user_id = p_user_id
    and activity_date >= p_local_date - 14
    and activity_date < p_local_date;

  minute_target := greatest(10, least(25, (round(coalesce(avg_minutes, 15) / 5.0) * 5)::integer));
  page_target := greatest(10, least(30, (round(coalesce(avg_pages, 15) / 5.0) * 5)::integer));

  select ub.id, b.title,
         case when b.page_count is null then null else greatest(b.page_count - ub.current_page, 0) end
  into current_user_book_id, current_title, remaining_pages
  from public.user_books ub
  join public.books b on b.id = ub.book_id
  where ub.user_id = p_user_id and ub.status = 'currently_reading'
  order by ub.updated_at desc
  limit 1;

  if remaining_pages between 1 and 30 then
    page_target := remaining_pages;
  end if;

  seed := abs(hashtext(p_user_id::text || ':' || p_local_date::text));
  engagement_choice := seed % 3;

  reading_title := case seed % 5
    when 0 then 'Cozy Focus'
    when 1 then 'Quiet Chapter'
    when 2 then 'Reading Reset'
    when 3 then 'Settle In'
    else 'Story Time'
  end;

  page_title := case
    when remaining_pages between 1 and 30 then 'Finish Line'
    when seed % 5 = 0 then 'Turn the Page'
    when seed % 5 = 1 then 'Page Pocket'
    when seed % 5 = 2 then 'One More Stack'
    when seed % 5 = 3 then 'Chapter Push'
    else 'Keep It Moving'
  end;

  headline_text := case
    when current_title is not null then 'Today''s quests pair nicely with ' || current_title || '.'
    else 'A small reading win is enough for today.'
  end;

  insert into public.daily_quest_sets (
    user_id, quest_date, source, headline, completion_bonus_xp, context
  ) values (
    p_user_id,
    p_local_date,
    'smart_fallback',
    headline_text,
    25,
    jsonb_build_object(
      'minute_target', minute_target,
      'page_target', page_target,
      'current_user_book_id', current_user_book_id,
      'uses_private_journal_text', false
    )
  )
  on conflict (user_id, quest_date) do nothing
  returning id into created_set;

  if created_set is null then
    select id into created_set
    from public.daily_quest_sets
    where user_id = p_user_id and quest_date = p_local_date;
    return created_set;
  end if;

  insert into public.daily_quests (
    quest_set_id, user_id, quest_date, position, title, description,
    event_type, target_amount, unit, reward_xp, metadata
  ) values
  (
    created_set,
    p_user_id,
    p_local_date,
    1,
    reading_title,
    'Read for ' || minute_target || ' minutes. One focused sitting is plenty.',
    'minutes_read',
    minute_target,
    'min',
    case when minute_target >= 20 then 20 else 15 end,
    jsonb_build_object('max_reasonable_target', 30)
  ),
  (
    created_set,
    p_user_id,
    p_local_date,
    2,
    page_title,
    case
      when remaining_pages between 1 and 30 and current_title is not null
        then 'You''re close — read the final ' || page_target || ' pages of ' || current_title || '.'
      when current_title is not null
        then 'Read ' || page_target || ' pages of ' || current_title || '.'
      else 'Read ' || page_target || ' pages of anything you''re enjoying.'
    end,
    'pages_read',
    page_target,
    case when page_target = 1 then 'page' else 'pages' end,
    case when page_target >= 20 then 20 else 15 end,
    jsonb_build_object('user_book_id', current_user_book_id, 'max_reasonable_target', 40)
  );

  if engagement_choice = 0 then
    insert into public.daily_quests (
      quest_set_id, user_id, quest_date, position, title, description,
      event_type, target_amount, unit, reward_xp
    ) values (
      created_set, p_user_id, p_local_date, 3,
      'Show Up', 'Log one reading session today. Tiny check-ins count.',
      'reading_session', 1, 'session', 10
    );
  elsif engagement_choice = 1 then
    insert into public.daily_quests (
      quest_set_id, user_id, quest_date, position, title, description,
      event_type, target_amount, unit, reward_xp
    ) values (
      created_set, p_user_id, p_local_date, 3,
      'Bookmark Check', 'Update your reading progress once after your session.',
      'progress_log', 1, 'update', 10
    );
  else
    insert into public.daily_quests (
      quest_set_id, user_id, quest_date, position, title, description,
      event_type, target_amount, unit, reward_xp
    ) values (
      created_set, p_user_id, p_local_date, 3,
      'Leave a Breadcrumb', 'Save one quick thought, quote, prediction, or mood from what you read.',
      'journal_entry', 1, 'entry', 15
    );
  end if;

  return created_set;
end;
$$;

revoke all on function public.shelfie_ensure_daily_quests_for_user(uuid, date) from public;
revoke all on function public.shelfie_ensure_daily_quests_for_user(uuid, date) from anon;
revoke all on function public.shelfie_ensure_daily_quests_for_user(uuid, date) from authenticated;

-- Client-safe entry point. The browser can ask only for its own quest set, and only near the current date
-- to allow for timezone differences around midnight.
create or replace function public.ensure_my_daily_quests(p_local_date date)
returns setof public.daily_quests
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if p_local_date < current_date - 1 or p_local_date > current_date + 1 then
    raise exception 'Quest date is outside the allowed window';
  end if;

  perform public.shelfie_ensure_daily_quests_for_user(uid, p_local_date);

  return query
  select q.*
  from public.daily_quests q
  where q.user_id = uid and q.quest_date = p_local_date
  order by q.position;
end;
$$;

revoke all on function public.ensure_my_daily_quests(date) from public;
revoke all on function public.ensure_my_daily_quests(date) from anon;
grant execute on function public.ensure_my_daily_quests(date) to authenticated;

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
as $$;
declare
  q record;
  new_progress integer;
  set_record record;
begin
  if p_amount <= 0 then return; end if;

  perform public.shelfie_ensure_daily_quests_for_user(p_user_id, p_activity_date);

  for q in
    select *
    from public.daily_quests
    where user_id = p_user_id
      and quest_date = p_activity_date
      and event_type = p_event_type
      and completed_at is null
    order by position
    for update
  loop
    new_progress := least(q.target_amount, q.progress_amount + p_amount);

    update public.daily_quests
    set progress_amount = new_progress,
        completed_at = case when new_progress >= q.target_amount then now() else completed_at end
    where id = q.id;

    if q.progress_amount < q.target_amount and new_progress >= q.target_amount then
      perform public.shelfie_award_xp(
        p_user_id,
        'daily_quest',
        q.reward_xp,
        'daily-quest:' || q.id::text,
        q.id::text
      );
    end if;
  end loop;

  for set_record in
    select s.id, s.completion_bonus_xp
    from public.daily_quest_sets s
    where s.user_id = p_user_id and s.quest_date = p_activity_date
      and not exists (
        select 1 from public.daily_quests q
        where q.quest_set_id = s.id and q.completed_at is null
      )
  loop
    if set_record.completion_bonus_xp > 0 then
      perform public.shelfie_award_xp(
        p_user_id,
        'daily_quest_board',
        set_record.completion_bonus_xp,
        'daily-quest-board:' || set_record.id::text,
        set_record.id::text
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.shelfie_apply_daily_quest_event(uuid, date, text, integer) from public;
revoke all on function public.shelfie_apply_daily_quest_event(uuid, date, text, integer) from anon;
revoke all on function public.shelfie_apply_daily_quest_event(uuid, date, text, integer) from authenticated;

-- Normal reading activity advances the appropriate quests automatically.
create or replace function public.process_reading_session_quests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$;
begin
  perform public.shelfie_apply_daily_quest_event(new.user_id, new.activity_date, 'reading_session', 1);
  perform public.shelfie_apply_daily_quest_event(new.user_id, new.activity_date, 'minutes_read', coalesce(new.minutes_read, 0));
  perform public.shelfie_apply_daily_quest_event(new.user_id, new.activity_date, 'pages_read', coalesce(new.pages_read, 0));
  return new;
end;
$$;

create trigger reading_session_daily_quests
after insert on public.reading_sessions
for each row execute function public.process_reading_session_quests();

create or replace function public.process_reading_log_quests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$;
begin
  perform public.shelfie_apply_daily_quest_event(new.user_id, new.activity_date, 'progress_log', 1);
  return new;
end;
$$;

create trigger reading_log_daily_quests
after insert on public.reading_logs
for each row execute function public.process_reading_log_quests();

create or replace function public.process_journal_entry_quests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$;
begin
  perform public.shelfie_apply_daily_quest_event(new.user_id, new.activity_date, 'journal_entry', 1);
  return new;
end;
$$;

create trigger journal_entry_daily_quests
after insert on public.journal_entries
for each row execute function public.process_journal_entry_quests();

-- AI integration contract (future Edge Function):
-- 1. Build a compact taste/activity summary without private journal text by default.
-- 2. Ask the model for exactly 3 quests using ONLY the approved event types above.
-- 3. Validate/clamp targets: <=30 minutes, <=40 pages, 1 session/update/entry, <=25 XP each.
-- 4. Insert the set with source='ai'. If AI fails or is disabled, ensure_my_daily_quests provides the fallback.
-- 5. Never let a browser directly mark quests complete or award XP.
