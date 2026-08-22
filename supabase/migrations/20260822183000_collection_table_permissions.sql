-- RLS policies decide which rows a reader may access; table grants are still
-- required before PostgREST can perform the operation at all.
grant select, insert on table public.books to authenticated;
grant select, insert, update on table public.user_books to authenticated;
grant select on table public.book_market_values to authenticated;
grant select, update on table public.profiles to authenticated;
grant select on table public.reader_progress to authenticated;
grant select on table public.daily_quest_sets to authenticated;
grant select, insert, update, delete on table public.recommendation_feedback to authenticated;

comment on table public.user_books is
  'A reader collection. Authenticated access is constrained to the owner by row-level security policies.';
