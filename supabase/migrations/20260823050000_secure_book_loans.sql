-- Finish the private loan tracker foundation. Table grants allow PostgREST to
-- reach the rows; row-level policies still restrict every operation to the owner.

grant select, insert, update, delete on table public.book_loans to authenticated;
revoke all on table public.book_loans from anon;

create unique index if not exists book_loans_one_open_per_book_idx
  on public.book_loans (user_book_id)
  where returned_at is null;

drop policy if exists "Owners can update their loans" on public.book_loans;
create policy "Owners can update their loans"
on public.book_loans for update to authenticated
using ((select auth.uid()) = owner_user_id)
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1
    from public.user_books ub
    where ub.id = user_book_id
      and ub.user_id = (select auth.uid())
      and ub.owned = true
  )
);

comment on table public.book_loans is
  'Private per-reader loan history. RLS prevents readers from seeing or changing another account loan.';
