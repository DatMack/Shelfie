-- Per-copy spine title controls. Row-level security on user_books continues to
-- keep every reader's appearance choices private to their own account.

alter table public.user_books
  add column if not exists spine_title_visible boolean not null default true,
  add column if not exists spine_title_font text not null default 'classic'
    check (spine_title_font in ('classic', 'modern', 'typewriter', 'storybook')),
  add column if not exists spine_title_color text
    check (spine_title_color is null or spine_title_color ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.process_spine_title_engagement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.spine_title_visible is distinct from old.spine_title_visible
     or new.spine_title_font is distinct from old.spine_title_font
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
after update of spine_title_visible, spine_title_font, spine_title_color on public.user_books
for each row execute function public.process_spine_title_engagement();
