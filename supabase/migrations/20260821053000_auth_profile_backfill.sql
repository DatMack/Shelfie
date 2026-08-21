-- Keep Shelfie account creation safe even if users sign up before the main app tables are installed.
-- The main schema creates public.profiles and the auth trigger first; this migration then backfills
-- any auth.users that already existed and makes duplicate requested usernames non-fatal.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  final_username text;
begin
  requested_username := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');

  if requested_username is null then
    final_username := 'reader_' || substr(new.id::text, 1, 8);
  elsif exists (
    select 1
    from public.profiles
    where lower(username) = lower(requested_username)
  ) then
    final_username := requested_username || '_' || substr(new.id::text, 1, 6);
  else
    final_username := requested_username;
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      requested_username,
      final_username
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Accounts created from the new welcome page before migrations are applied are not lost.
-- Give those users a guaranteed private profile when this migration is eventually run.
insert into public.profiles (id, username, display_name)
select
  users.id,
  'reader_' || substr(users.id::text, 1, 8),
  coalesce(
    nullif(users.raw_user_meta_data ->> 'display_name', ''),
    nullif(users.raw_user_meta_data ->> 'username', ''),
    'Reader'
  )
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null
on conflict (id) do nothing;
