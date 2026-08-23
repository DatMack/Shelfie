import { supabase } from './supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Shelfie is not connected to Supabase.')
  return supabase
}

export type AchievementProgress = {
  achievementId: string
  progress: number
  unlockedAt?: string
}

export async function refreshMyAchievements(): Promise<AchievementProgress[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('refresh_my_achievements')
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    achievementId: String(row.achievement_id),
    progress: Number(row.progress_amount ?? 0),
    unlockedAt: row.unlocked_at ? String(row.unlocked_at) : undefined,
  }))
}

export type ReadingSession = {
  id: string
  userBookId: string
  title: string
  author: string
  coverUrl?: string
  minutesRead: number
  pagesRead: number
  startPage?: number
  endPage?: number
  format: string
  mood?: string
  note?: string
  readAt: string
  activityDate: string
}

export type LogReadingInput = {
  userBookId: string
  minutesRead: number
  pagesRead: number
  startPage?: number
  endPage?: number
  format: string
  mood?: string
  note?: string
  activityDate: string
}

export type LogReadingResult = {
  sessionId: string
  currentPage: number
  pagesLogged: number
  activityDate: string
}

export async function logMyReading(input: LogReadingInput): Promise<LogReadingResult> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('log_my_reading_session', {
    p_user_book_id: input.userBookId,
    p_minutes_read: input.minutesRead || 0,
    p_pages_read: input.pagesRead || 0,
    p_start_page: input.startPage ?? null,
    p_end_page: input.endPage ?? null,
    p_format: input.format,
    p_mood: input.mood || null,
    p_note: input.note || null,
    p_activity_date: input.activityDate,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.session_id) throw new Error('Shelfie did not return the saved reading session.')
  return {
    sessionId: String(row.session_id),
    currentPage: Number(row.current_page ?? 0),
    pagesLogged: Number(row.pages_logged ?? 0),
    activityDate: String(row.activity_date),
  }
}

export async function loadMyReadingSessions(): Promise<ReadingSession[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('reading_sessions')
    .select('id,user_book_id,minutes_read,pages_read,start_page,end_page,format,mood,note,read_at,activity_date,user_book:user_books(book:books(title,authors,cover_url))')
    .order('read_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    userBookId: row.user_book_id,
    title: row.user_book?.book?.title ?? 'Untitled book',
    author: row.user_book?.book?.authors?.join(', ') || 'Unknown author',
    coverUrl: row.user_book?.book?.cover_url ?? undefined,
    minutesRead: row.minutes_read ?? 0,
    pagesRead: row.pages_read ?? 0,
    startPage: row.start_page ?? undefined,
    endPage: row.end_page ?? undefined,
    format: row.format ?? 'print',
    mood: row.mood ?? undefined,
    note: row.note ?? undefined,
    readAt: row.read_at,
    activityDate: row.activity_date,
  }))
}

export async function deleteMyReadingSession(id: string) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('delete_my_reading_session', { p_session_id: id })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.deleted_ok) throw new Error('That reading session was not found.')
  return {
    userBookId: row.book_id ? String(row.book_id) : undefined,
    currentPage: row.book_current_page === null || row.book_current_page === undefined ? undefined : Number(row.book_current_page),
  }
}

export type JournalEntryType = 'note' | 'quote' | 'character' | 'prediction' | 'reaction' | 'review_draft' | 'other'

export type JournalEntry = {
  id: string
  userBookId: string
  title: string
  author: string
  coverUrl?: string
  entryType: JournalEntryType
  body: string
  page?: number
  moodTags: string[]
  isSpoiler: boolean
  createdAt: string
  updatedAt: string
}

export type JournalEntryInput = {
  userBookId: string
  entryType: JournalEntryType
  body: string
  page?: number | null
  moodTags?: string[]
  isSpoiler?: boolean
}

function mapJournalEntry(row: any): JournalEntry {
  return {
    id: row.id,
    userBookId: row.user_book_id,
    title: row.user_book?.book?.title ?? 'Untitled book',
    author: row.user_book?.book?.authors?.join(', ') || 'Unknown author',
    coverUrl: row.user_book?.book?.cover_url ?? undefined,
    entryType: row.entry_type,
    body: row.body,
    page: row.page ?? undefined,
    moodTags: row.mood_tags ?? [],
    isSpoiler: Boolean(row.is_spoiler),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function loadMyJournalEntries(): Promise<JournalEntry[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('journal_entries')
    .select('id,user_book_id,entry_type,body,page,mood_tags,is_spoiler,created_at,updated_at,user_book:user_books(book:books(title,authors,cover_url))')
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []).map(mapJournalEntry)
}

export async function createMyJournalEntry(input: JournalEntryInput): Promise<JournalEntry> {
  const client = requireSupabase()
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError || !user) throw userError ?? new Error('Sign in to use your journal.')
  const { data, error } = await client
    .from('journal_entries')
    .insert({
      user_id: user.id,
      user_book_id: input.userBookId,
      entry_type: input.entryType,
      body: input.body.trim(),
    page: input.page ?? null,
      mood_tags: input.moodTags ?? [],
      is_spoiler: input.isSpoiler ?? false,
      visibility: 'private',
      activity_date: new Date().toLocaleDateString('en-CA'),
    })
    .select('id,user_book_id,entry_type,body,page,mood_tags,is_spoiler,created_at,updated_at,user_book:user_books(book:books(title,authors,cover_url))')
    .single()
  if (error) throw error
  return mapJournalEntry(data)
}

export async function updateMyJournalEntry(id: string, patch: Partial<JournalEntryInput>): Promise<JournalEntry> {
  const client = requireSupabase()
  const databasePatch: Record<string, unknown> = {}
  if (patch.entryType !== undefined) databasePatch.entry_type = patch.entryType
  if (patch.body !== undefined) databasePatch.body = patch.body.trim()
  if (patch.page !== undefined) databasePatch.page = patch.page
  if (patch.moodTags !== undefined) databasePatch.mood_tags = patch.moodTags
  if (patch.isSpoiler !== undefined) databasePatch.is_spoiler = patch.isSpoiler
  const { data, error } = await client
    .from('journal_entries')
    .update(databasePatch)
    .eq('id', id)
    .select('id,user_book_id,entry_type,body,page,mood_tags,is_spoiler,created_at,updated_at,user_book:user_books(book:books(title,authors,cover_url))')
    .single()
  if (error) throw error
  return mapJournalEntry(data)
}

export async function deleteMyJournalEntry(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('journal_entries').delete().eq('id', id)
  if (error) throw error
}

export async function loadMyReview(userBookId: string) {
  const client = requireSupabase()
  const { data, error } = await client.from('reviews').select('review_text').eq('user_book_id', userBookId).maybeSingle()
  if (error) throw error
  return data?.review_text ?? ''
}

export async function saveMyReview(userBookId: string, reviewText: string) {
  const client = requireSupabase()
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError || !user) throw userError ?? new Error('Sign in to save a review.')
  const { error } = await client.from('reviews').upsert({
    user_id: user.id,
    user_book_id: userBookId,
    review_text: reviewText.trim(),
    visibility: 'private',
  }, { onConflict: 'user_book_id' })
  if (error) throw error
}
