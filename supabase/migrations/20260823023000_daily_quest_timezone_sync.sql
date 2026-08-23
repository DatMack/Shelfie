-- Keep daily quests on the reader's local calendar day and reconcile progress
-- from authoritative reading data whenever the board is loaded.

alter table public.profiles
  add column if not exists timezone_name text not null default 'UTC';

create or replace function public.set_my_timezone(p_timezone text)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  uid uuid := auth.uid();
  cleaned text := trim(coalesce(p_timezone, ''));
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if cleaned = '' or not exists (select 1 from pg_timezone_names where name = cleaned) then
    raise exception 'Choose a valid timezone.';
  end if;

  update public.profiles set timezone_name = cleaned, updated_at = now() where id = uid;
  return cleaned;
end;
$$;

revoke all on function public.set_my_timezone(text) from public, anon;
grant execute on function public.set_my_timezone(text) to authenticated;

create or replace function public.shelfie_local_date_for_user(p_user_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone coalesce(
    (select p.timezone_name from public.profiles p where p.id = p_user_id),
    'UTC'
  ))::date;
$$;

revoke all on function public.shelfie_local_date_for_user(uuid) from public, anon, authenticated;

create or replace function public.shelfie_sync_daily_quest_progress(
  p_user_id uuid,
  p_activity_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_set_id uuid;
  onboarding_board boolean := false;
  q record;
  observed_progress integer := 0;
  new_progress integer;
  set_record record;
begin
  if p_activity_date < current_date - 1 or p_activity_date > current_date + 1 then return; end if;

  select id into active_set_id
  from public.daily_quest_sets
  where user_id = p_user_id and quest_date = p_activity_date;
  if active_set_id is null then return; end if;

  select coalesce(array_agg(event_type order by position), '{}'::text[])
         = array['add_book', 'wishlist_book', 'start_book']::text[]
  into onboarding_board
  from public.daily_quests
  where quest_set_id = active_set_id;

  for q in
    select * from public.daily_quests
    where quest_set_id = active_set_id
    order by position
    for update
  loop
    observed_progress := 0;

    case q.event_type
      when 'minutes_read' then
        select coalesce(sum(minutes_read), 0)::integer into observed_progress
        from public.reading_sessions
        where user_id = p_user_id and activity_date = p_activity_date;
      when 'pages_read' then
        select coalesce(sum(pages_read), 0)::integer into observed_progress
        from public.reading_sessions
        where user_id = p_user_id and activity_date = p_activity_date;
      when 'reading_session' then
        select count(*)::integer into observed_progress
        from public.reading_sessions
        where user_id = p_user_id and activity_date = p_activity_date;
      when 'progress_log' then
        select count(*)::integer into observed_progress
        from public.reading_logs
        where user_id = p_user_id and activity_date = p_activity_date;
      when 'journal_entry' then
        select count(*)::integer into observed_progress
        from public.journal_entries
        where user_id = p_user_id and activity_date = p_activity_date;
      when 'add_book' then
        if onboarding_board then
          select count(*)::integer into observed_progress
          from public.user_books where user_id = p_user_id;
        end if;
      when 'wishlist_book' then
        if onboarding_board then
          select count(*)::integer into observed_progress
          from public.user_books where user_id = p_user_id and status = 'want_to_read';
        end if;
      when 'start_book' then
        if onboarding_board then
          select count(*)::integer into observed_progress
          from public.user_books where user_id = p_user_id and status = 'currently_reading';
        end if;
      else
        observed_progress := 0;
    end case;

    new_progress := least(q.target_amount, greatest(q.progress_amount, observed_progress));
    if new_progress > q.progress_amount then
      update public.daily_quests
      set progress_amount = new_progress,
          completed_at = case when new_progress >= q.target_amount then coalesce(completed_at, now()) else completed_at end
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
    end if;
  end loop;

  for set_record in
    select s.id, s.completion_bonus_xp
    from public.daily_quest_sets s
    where s.id = active_set_id
      and not exists (
        select 1 from public.daily_quests dq
        where dq.quest_set_id = s.id and dq.completed_at is null
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

revoke all on function public.shelfie_sync_daily_quest_progress(uuid, date) from public, anon, authenticated;

create or replace function public.ensure_my_daily_quests(p_local_date date)
returns setof public.daily_quests
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_local_date < current_date - 1 or p_local_date > current_date + 1 then
    raise exception 'Quest date is outside the allowed window';
  end if;

  perform public.shelfie_ensure_daily_quests_for_user(uid, p_local_date);
  perform public.shelfie_sync_daily_quest_progress(uid, p_local_date);

  return query
  select q.*
  from public.daily_quests q
  where q.user_id = uid and q.quest_date = p_local_date
  order by q.position;
end;
$$;

revoke all on function public.ensure_my_daily_quests(date) from public, anon;
grant execute on function public.ensure_my_daily_quests(date) to authenticated;

create or replace function public.process_user_book_engagement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  book_source text;
  activity_day date;
begin
  select external_source into book_source from public.books where id = new.book_id;
  activity_day := public.shelfie_local_date_for_user(new.user_id);

  if tg_op = 'INSERT' then
    perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'add_book', 1);
    if new.status = 'want_to_read' then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'wishlist_book', 1); end if;
    if new.status = 'currently_reading' then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'start_book', 1); end if;
    if new.status = 'read' then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'finish_book', 1); end if;
    if new.owned then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'own_book', 1); end if;
    if book_source = 'manual' then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'manual_book', 1); end if;
    if new.signed then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'signed_book', 1); end if;
  else
    if new.rating is not null and old.rating is distinct from new.rating then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'rate_book', 1); end if;
    if new.status = 'want_to_read' and old.status is distinct from new.status then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'wishlist_book', 1); end if;
    if new.status = 'currently_reading' and old.status is distinct from new.status then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'start_book', 1); end if;
    if new.status = 'read' and old.status is distinct from new.status then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'finish_book', 1); end if;
    if new.owned and not old.owned then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'own_book', 1); end if;
    if new.is_favorite and not old.is_favorite then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'favorite_book', 1); end if;
    if new.signed and not old.signed then perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'signed_book', 1); end if;
    if new.format is distinct from old.format or new.condition is distinct from old.condition
       or new.edition_note is distinct from old.edition_note or new.first_edition is distinct from old.first_edition
       or new.special_edition is distinct from old.special_edition then
      perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'update_book_details', 1);
    end if;
    if new.spine_design is distinct from old.spine_design or new.spine_color is distinct from old.spine_color
       or new.spine_accent is distinct from old.spine_accent or new.custom_spine_url is distinct from old.custom_spine_url then
      perform public.shelfie_apply_daily_quest_event(new.user_id, activity_day, 'customize_book', 1);
    end if;
  end if;
  return new;
end;
$$;

-- Repair any boards around the deployment boundary immediately. This is safe
-- to repeat because quest and board XP awards use stable idempotency keys.
select public.shelfie_sync_daily_quest_progress(user_id, quest_date)
from public.daily_quest_sets
where quest_date between current_date - 1 and current_date + 1;
