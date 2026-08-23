import { supabase } from './supabase'

export type BookLoan = {
  id: string
  ownerUserId: string
  userBookId: string
  borrowerName: string
  loanedAt: string
  dueDate?: string
  returnedAt?: string
  privateNote?: string
  createdAt: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Shelfie is not connected to Supabase.')
  return supabase
}

function mapLoan(row: any): BookLoan {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    userBookId: row.user_book_id,
    borrowerName: row.borrower_name?.trim() || 'Someone',
    loanedAt: row.loaned_at,
    dueDate: row.due_date ?? undefined,
    returnedAt: row.returned_at ?? undefined,
    privateNote: row.private_note ?? undefined,
    createdAt: row.created_at,
  }
}

export function localLoanDate(date = new Date()) {
  return date.toLocaleDateString('en-CA')
}

export async function loadBookLoans(userId: string): Promise<BookLoan[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('book_loans')
    .select('id, owner_user_id, user_book_id, borrower_name, loaned_at, due_date, returned_at, private_note, created_at')
    .eq('owner_user_id', userId)
    .order('loaned_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapLoan)
}

export async function createBookLoan({
  userBookId,
  borrowerName,
  loanedAt,
  dueDate,
  privateNote,
}: {
  userBookId: string
  borrowerName: string
  loanedAt: string
  dueDate?: string
  privateNote?: string
}): Promise<BookLoan> {
  const client = requireSupabase()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw authError ?? new Error('Sign in to record a loan.')
  const cleanBorrower = borrowerName.trim()
  if (!cleanBorrower) throw new Error('Add the name of the person borrowing this book.')

  const { data, error } = await client
    .from('book_loans')
    .insert({
      owner_user_id: user.id,
      user_book_id: userBookId,
      borrower_name: cleanBorrower.slice(0, 120),
      loaned_at: loanedAt,
      due_date: dueDate || null,
      private_note: privateNote?.trim().slice(0, 1000) || null,
    })
    .select('id, owner_user_id, user_book_id, borrower_name, loaned_at, due_date, returned_at, private_note, created_at')
    .single()
  if (error?.code === '23505') throw new Error('This book is already marked as loaned out.')
  if (error) throw error
  return mapLoan(data)
}

export async function returnBookLoan(loanId: string): Promise<BookLoan> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('book_loans')
    .update({ returned_at: localLoanDate() })
    .eq('id', loanId)
    .is('returned_at', null)
    .select('id, owner_user_id, user_book_id, borrower_name, loaned_at, due_date, returned_at, private_note, created_at')
    .single()
  if (error) throw error
  return mapLoan(data)
}
