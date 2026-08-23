-- Per-book spine title sizing. The browser can only update rows allowed by the
-- existing user_books ownership policy, and the database constrains safe sizes.

alter table public.user_books
  add column if not exists spine_title_size integer not null default 12
    check (spine_title_size between 7 and 32);

create or replace function public.process_spine_title_engagement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.spine_title_visible is distinct from old.spine_title_visible
     or new.spine_title_font is distinct from old.spine_title_font
     or new.spine_title_size is distinct from old.spine_title_size
     or new.spine_title_color is distinct from old.spine_title_color then
    perform public.shelfie_apply_daily_quest_event(
      new.user_id,
      public.shelfie_local_date_for_user(new.user_id),
      'customize_book',
      1
    );
  end if;
  return new;
end;
$$;

revoke all on function public.process_spine_title_engagement() from public, anon, authenticated;

drop trigger if exists user_books_spine_title_engagement on public.user_books;
create trigger user_books_spine_title_engagement
after update of spine_title_visible, spine_title_font, spine_title_size, spine_title_color on public.user_books
for each row execute function public.process_spine_title_engagement();
