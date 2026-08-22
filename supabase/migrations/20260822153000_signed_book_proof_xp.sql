alter table public.user_books
  add column if not exists signed_proof_path text,
  add column if not exists signed_proof_verified_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signed-book-proofs', 'signed-book-proofs', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Readers upload their own signed book proofs"
on storage.objects for insert to authenticated
with check (bucket_id = 'signed-book-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Readers view their own signed book proofs"
on storage.objects for select to authenticated
using (bucket_id = 'signed-book-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Readers update their own signed book proofs"
on storage.objects for update to authenticated
using (bucket_id = 'signed-book-proofs' and owner_id = (select auth.uid())::text)
with check (bucket_id = 'signed-book-proofs' and owner_id = (select auth.uid())::text);

create policy "Readers delete their own signed book proofs"
on storage.objects for delete to authenticated
using (bucket_id = 'signed-book-proofs' and owner_id = (select auth.uid())::text);

create or replace function public.claim_signed_book_proof(p_user_book_id uuid, p_proof_path text)
returns table (proof_path text, xp_awarded boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_proof text;
  award_xp boolean := false;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if nullif(trim(p_proof_path), '') is null then raise exception 'A proof photo is required.'; end if;
  if p_proof_path not like auth.uid()::text || '/%' then raise exception 'Invalid proof photo path.'; end if;

  select signed_proof_path into existing_proof
  from public.user_books
  where id = p_user_book_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Book not found.'; end if;
  award_xp := existing_proof is null;

  update public.user_books
  set signed = true,
      signed_proof_path = p_proof_path,
      signed_proof_verified_at = now(),
      updated_at = now()
  where id = p_user_book_id and user_id = auth.uid();

  if award_xp then
    perform public.shelfie_award_xp(auth.uid(), 'signed_book_proof', 25, 'signed-proof:' || p_user_book_id::text, p_user_book_id::text);
  end if;

  return query select p_proof_path, award_xp;
end;
$$;

revoke all on function public.claim_signed_book_proof(uuid, text) from public, anon;
grant execute on function public.claim_signed_book_proof(uuid, text) to authenticated;
