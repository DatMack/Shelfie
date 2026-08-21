-- Keep streaks aligned with the reader's local calendar day instead of server UTC.

alter table public.reading_sessions
  add column if not exists activity_date date not null default current_date;

create index if not exists reading_sessions_user_activity_date_idx
  on public.reading_sessions (user_id, activity_date desc);

create or replace function public.process_reading_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_day date := new.activity_date;
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
      select current_streak + 1 into next_streak
      from public.reader_progress where user_id = new.user_id;
    elsif previous_date = activity_day then
      select current_streak into next_streak
      from public.reader_progress where user_id = new.user_id;
    else
      next_streak := 1;
    end if;

    update public.reader_progress
    set current_streak = next_streak,
        longest_streak = greatest(longest_streak, next_streak),
        last_reading_date = greatest(coalesce(last_reading_date, activity_day), activity_day),
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
