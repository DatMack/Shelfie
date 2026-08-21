import type { BookSearchResult } from '../services/openLibrary'
import type { BookFormat, ReadingStatus } from '../data/books'
import { supabase } from './supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Shelfie is not connected to Supabase.')
  return supabase
}

function statusToDatabase(status: ReadingStatus) {
  const map: Record<ReadingStatus, string> = {
    'Want to Read': 'want_to_read',
    'Currently Reading': 'currently_reading',
    Read: 'read',
    DNF: 'dnf',
  }
  return map[status]
}

function formatToDatabase(format?: BookFormat) {
  if (!format) return null
  const map: Record<BookFormat, string> = {
    Hardcover: 'hardcover',
    Paperback: 'paperback',
    'Mass Market': 'mass_market',
    Ebook: 'ebook',
    Audiobook: 'audiobook',
    Other: 'other',
  }
  return map[format]
}

export async function loadMyLibrary(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_books')
    .select('*, book:books(*), market_values:book_id(book_market_values(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function findOrCreateCatalogBook(result: BookSearchResult) {
  const client = requireSupabase()

  const { data: existing, error: findError } = await client
    .from('books')
    .select('*')
    .eq('external_source', 'openlibrary')
    .eq('external_id', result.key)
    .maybeSingle()

  if (findError) throw findError
  if (existing) return existing

  const compactIsbn = result.isbn?.replace(/[^0-9X]/gi, '')
  const { data, error } = await client
    .from('books')
    .insert({
      external_source: 'openlibrary',
      external_id: result.key,
      work_key: result.key,
      isbn10: compactIsbn?.length === 10 ? compactIsbn : null,
      isbn13: compactIsbn?.length === 13 ? compactIsbn : null,
      title: result.title,
      authors: result.author === 'Unknown author' ? [] : result.author.split(',').map((author) => author.trim()),
      cover_url: result.coverUrl ?? null,
      publisher: result.publisher ?? null,
      publication_year: result.year ?? null,
      page_count: result.pages ?? null,
      genres: result.genre ? [result.genre] : [],
      subjects: result.subjects ?? [],
      language: result.language ?? null,
      metadata: { imported_from: 'openlibrary' },
    })
    .select('*')
    .single()

  if (error) {
    // Another client may have inserted the same shared book between our read and insert.
    const { data: raced, error: racedError } = await client
      .from('books')
      .select('*')
      .eq('external_source', 'openlibrary')
      .eq('external_id', result.key)
      .maybeSingle()
    if (racedError || !raced) throw error
    return raced
  }

  return data
}

export async function addCatalogBookToMyShelf({
  userId,
  bookId,
  status,
  owned,
  format,
}: {
  userId: string
  bookId: string
  status: ReadingStatus
  owned: boolean
  format?: BookFormat
}) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_books')
    .insert({
      user_id: userId,
      book_id: bookId,
      status: statusToDatabase(status),
      owned,
      format: owned ? formatToDatabase(format) : null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updateMyBook(userBookId: string, patch: Record<string, unknown>) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_books')
    .update(patch)
    .eq('id', userBookId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function recordRecommendationFeedback({
  userId,
  bookId,
  feedback,
  reason,
}: {
  userId: string
  bookId: string
  feedback: 'saved' | 'dismissed' | 'not_interested' | 'already_read'
  reason?: string
}) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('recommendation_feedback')
    .upsert({ user_id: userId, book_id: bookId, feedback, reason: reason ?? null }, { onConflict: 'user_id,book_id' })
    .select('*')
    .single()

  if (error) throw error
  return data
}
