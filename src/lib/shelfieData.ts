import type { BookSearchResult } from '../services/openLibrary'
import type { Book, BookFormat, ReadingStatus } from '../data/books'
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

function statusFromDatabase(status: string): ReadingStatus {
  const map: Record<string, ReadingStatus> = {
    want_to_read: 'Want to Read',
    currently_reading: 'Currently Reading',
    read: 'Read',
    dnf: 'DNF',
  }
  return map[status] ?? 'Want to Read'
}

function formatFromDatabase(format?: string | null): BookFormat | undefined {
  const map: Record<string, BookFormat> = {
    hardcover: 'Hardcover',
    paperback: 'Paperback',
    mass_market: 'Mass Market',
    ebook: 'Ebook',
    audiobook: 'Audiobook',
    other: 'Other',
  }
  return format ? map[format] : undefined
}

function displayStyleFromDatabase(style?: string | null): Book['displayStyle'] {
  const map: Record<string, NonNullable<Book['displayStyle']>> = {
    auto: 'Auto',
    spine: 'Spine',
    front_cover: 'Front Cover',
    cassette: 'Cassette',
    cassette_case: 'Cassette Case',
    audio_case: 'Audio Case',
    e_reader: 'E-reader',
    digital_tile: 'Digital Tile',
  }
  return style ? map[style] : undefined
}

function colorsFor(seed: string) {
  const palette = [
    ['#6b4327', '#e3b064'], ['#26384c', '#ddad66'], ['#35563d', '#f3c66c'],
    ['#6c342f', '#e6b96d'], ['#544c34', '#d3b86a'], ['#694027', '#f0bb6e'],
  ]
  const total = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const [color, accent] = palette[total % palette.length]
  return { color, accent }
}

export function mapLibraryRows(rows: any[]): Book[] {
  return rows.map((row) => {
    const catalog = row.book ?? {}
    const colors = colorsFor(catalog.title ?? row.id)
    return {
      id: row.id,
      title: catalog.title ?? 'Untitled',
      author: Array.isArray(catalog.authors) && catalog.authors.length ? catalog.authors.join(', ') : 'Unknown author',
      status: statusFromDatabase(row.status),
      shelfIndex: row.shelf_index ?? 0,
      color: row.spine_color ?? colors.color,
      accent: row.spine_accent ?? colors.accent,
      pages: catalog.page_count ?? 0,
      currentPage: row.current_page ?? 0,
      rating: row.rating ?? undefined,
      genre: catalog.genres?.[0] ?? 'Uncategorized',
      subjects: catalog.subjects ?? [],
      year: catalog.publication_year ?? (Number(String(catalog.published_date ?? '').slice(0, 4)) || new Date().getFullYear()),
      description: catalog.description ?? undefined,
      publisher: catalog.publisher ?? undefined,
      language: catalog.language ?? undefined,
      series: catalog.series_name ?? undefined,
      seriesNumber: catalog.series_position ?? undefined,
      coverUrl: catalog.cover_url ?? undefined,
      isbn: catalog.isbn13 ?? catalog.isbn10 ?? undefined,
      externalId: catalog.external_id ?? undefined,
      source: catalog.external_source === 'openlibrary' || catalog.external_source === 'googlebooks'
        ? catalog.external_source
        : 'manual',
      owned: row.owned,
      format: formatFromDatabase(row.format),
      condition: row.condition ? row.condition.split('_').map((part: string) => part[0].toUpperCase() + part.slice(1)).join(' ') : undefined,
      purchasePrice: row.purchase_price ?? undefined,
      estimatedValue: row.manual_estimated_value ?? undefined,
      valueLow: row.manual_value_low ?? undefined,
      valueHigh: row.manual_value_high ?? undefined,
      specialEdition: row.special_edition,
      signed: row.signed,
      firstEdition: row.first_edition,
      gifted: row.gifted,
      purchaseDate: row.purchase_date ?? undefined,
      storageLocation: row.storage_location ?? undefined,
      acquiredFrom: row.acquired_from ?? undefined,
      favorite: row.is_favorite,
      moodTags: row.mood_tags ?? [],
      customTags: row.custom_tags ?? [],
      rereadCount: row.reread_count ?? 0,
      displayStyle: displayStyleFromDatabase(row.display_style),
      displayEditionId: row.display_edition_id ?? undefined,
      displayCoverUrl: row.display_cover_url ?? undefined,
      spineDesign: row.spine_design === 'custom_image' ? 'Custom Image' : 'Leather',
      customSpineUrl: row.custom_spine_url ?? undefined,
      customSpinePositionX: row.custom_spine_position_x ?? 50,
      customSpinePositionY: row.custom_spine_position_y ?? 50,
      customSpineZoom: row.custom_spine_zoom ?? 100,
    }
  })
}

export async function loadMyLibrary(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_books')
    .select('*, book:books(*, book_market_values(*))')
    .eq('user_id', userId)
    .order('shelf_index', { ascending: true })
    .order('shelf_column', { ascending: true })
    .order('shelf_position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function loadTourCompleted(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('profiles')
    .select('feature_preferences')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data.feature_preferences?.walkthrough_completed === true
}

export async function markTourCompleted(userId: string) {
  const client = requireSupabase()
  const { data: profile, error: readError } = await client
    .from('profiles')
    .select('feature_preferences')
    .eq('id', userId)
    .single()
  if (readError) throw readError
  const { error } = await client
    .from('profiles')
    .update({
      feature_preferences: {
        ...(profile.feature_preferences ?? {}),
        walkthrough_completed: true,
      },
    })
    .eq('id', userId)
  if (error) throw error
}

export async function findOrCreateCatalogBook(result: BookSearchResult) {
  const client = requireSupabase()
  const externalSource = result.source ?? 'openlibrary'

  const { data: existing, error: findError } = await client
    .from('books')
    .select('*')
    .eq('external_source', externalSource)
    .eq('external_id', result.key)
    .maybeSingle()

  if (findError) throw findError
  if (existing) return existing

  const compactIsbn = result.isbn?.replace(/[^0-9X]/gi, '')
  const { data, error } = await client
    .from('books')
    .insert({
      external_source: externalSource,
      external_id: result.key,
      work_key: result.key,
      isbn10: compactIsbn?.length === 10 ? compactIsbn : null,
      isbn13: compactIsbn?.length === 13 ? compactIsbn : null,
      title: result.title,
      subtitle: result.subtitle ?? null,
      authors: result.author === 'Unknown author' ? [] : result.author.split(',').map((author) => author.trim()),
      description: result.description ?? null,
      cover_url: result.coverUrl ?? null,
      publisher: result.publisher ?? null,
      published_date: result.publishedDate ?? null,
      publication_year: result.year ?? null,
      page_count: result.pages ?? null,
      genres: result.genre ? [result.genre] : [],
      subjects: result.subjects ?? [],
      language: result.language ?? null,
      metadata: {
        imported_from: externalSource,
        google_volume_id: result.googleVolumeId ?? null,
        google_books_info_link: result.infoLink ?? null,
        google_books_preview_link: result.previewLink ?? null,
        google_books_saleability: result.saleability ?? null,
        google_books_retail_price: result.retailPrice ?? null,
        google_books_currency: result.currencyCode ?? null,
      },
    })
    .select('*')
    .single()

  if (error) {
    // Another client may have inserted the same shared book between our read and insert.
    const { data: raced, error: racedError } = await client
      .from('books')
      .select('*')
      .eq('external_source', externalSource)
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
      shelf_index: 0,
      shelf_column: 0,
      shelf_position: 0,
      owned,
      format: owned ? formatToDatabase(format) : null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function importLocalBook(userId: string, book: Book) {
  const result: BookSearchResult = {
    key: book.externalId ?? `local:${book.id}`,
    title: book.title,
    author: book.author,
    coverUrl: book.coverUrl,
    year: book.year,
    pages: book.pages,
    isbn: book.isbn,
    genre: book.genre,
    subjects: book.subjects,
    publisher: book.publisher,
    language: book.language,
  }
  const catalog = await findOrCreateCatalogBook(result)
  const client = requireSupabase()
  const { data, error } = await client.from('user_books').upsert({
    user_id: userId,
    book_id: catalog.id,
    status: statusToDatabase(book.status),
    current_page: book.currentPage ?? 0,
    rating: book.rating ?? null,
    owned: book.owned ?? false,
    format: book.owned ? formatToDatabase(book.format) : null,
    shelf_index: book.shelfIndex ?? 0,
  }, { onConflict: 'user_id,book_id' }).select('*').single()
  if (error) throw error
  return data
}

export function bookPatchToDatabase(patch: Partial<Book>) {
  const output: Record<string, unknown> = {}
  if (patch.status !== undefined) output.status = statusToDatabase(patch.status)
  if (patch.currentPage !== undefined) output.current_page = patch.currentPage
  if (patch.rating !== undefined) output.rating = patch.rating
  if (patch.owned !== undefined) output.owned = patch.owned
  if (patch.format !== undefined) output.format = formatToDatabase(patch.format)
  if (patch.purchasePrice !== undefined) output.purchase_price = patch.purchasePrice
  if (patch.estimatedValue !== undefined) output.manual_estimated_value = patch.estimatedValue
  if (patch.favorite !== undefined) output.is_favorite = patch.favorite
  if (patch.customTags !== undefined) output.custom_tags = patch.customTags
  if (patch.moodTags !== undefined) output.mood_tags = patch.moodTags
  if (patch.rereadCount !== undefined) output.reread_count = patch.rereadCount
  if (patch.shelfIndex !== undefined) output.shelf_index = patch.shelfIndex
  if (patch.displayStyle !== undefined) {
    const styles: Record<string, string> = {
      Auto: 'auto', Spine: 'spine', 'Front Cover': 'front_cover', Cassette: 'cassette',
      'Cassette Case': 'cassette_case', 'Audio Case': 'audio_case', 'E-reader': 'e_reader', 'Digital Tile': 'digital_tile',
    }
    output.display_style = styles[patch.displayStyle]
  }
  if (patch.color !== undefined) output.spine_color = patch.color
  if (patch.accent !== undefined) output.spine_accent = patch.accent
  if (patch.spineDesign !== undefined) output.spine_design = patch.spineDesign === 'Custom Image' ? 'custom_image' : 'leather'
  if (patch.customSpineUrl !== undefined) output.custom_spine_url = patch.customSpineUrl
  if (patch.customSpinePositionX !== undefined) output.custom_spine_position_x = patch.customSpinePositionX
  if (patch.customSpinePositionY !== undefined) output.custom_spine_position_y = patch.customSpinePositionY
  if (patch.customSpineZoom !== undefined) output.custom_spine_zoom = patch.customSpineZoom
  return output
}

export async function uploadCustomSpine(userBookId: string, file: File) {
  const client = requireSupabase()
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError || !user) throw userError ?? new Error('Sign in to upload spine art.')

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${user.id}/${userBookId}/spine-${Date.now()}.${extension}`
  const { error } = await client.storage.from('book-spines').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: true,
  })
  if (error) throw error
  const { data } = client.storage.from('book-spines').getPublicUrl(path)
  return data.publicUrl
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

export async function deleteMyBook(userBookId: string) {
  const client = requireSupabase()
  const { error } = await client.from('user_books').delete().eq('id', userBookId)
  if (error) throw error
}

export type ShelfieProfile = {
  id: string
  username: string
  displayName?: string
  avatarUrl?: string
  bio?: string
}

export async function loadMyProfile(): Promise<ShelfieProfile> {
  const client = requireSupabase()
  const { data, error } = await client.from('profiles').select('id, username, display_name, avatar_url, bio').single()
  if (error) throw error
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name ?? undefined,
    avatarUrl: data.avatar_url ?? undefined,
    bio: data.bio ?? undefined,
  }
}

export async function uploadProfilePicture(file: File) {
  const client = requireSupabase()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw authError ?? new Error('Sign in to upload a profile picture.')
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${user.id}/avatar-${Date.now()}.${extension}`
  const { error } = await client.storage.from('profile-pictures').upload(path, file, {
    cacheControl: '3600', contentType: file.type || 'image/jpeg', upsert: true,
  })
  if (error) throw error
  const { data } = client.storage.from('profile-pictures').getPublicUrl(path)
  const { error: updateError } = await client.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
  if (updateError) throw updateError
  return data.publicUrl
}

export async function saveShelfOrder(
  items: Array<{ userBookId: string; shelfIndex: number; shelfColumn: number; shelfPosition: number }>,
) {
  const client = requireSupabase()
  const updates = await Promise.all(
    items.map((item) =>
      client
        .from('user_books')
        .update({
          shelf_index: item.shelfIndex,
          shelf_column: item.shelfColumn,
          shelf_position: item.shelfPosition,
        })
        .eq('id', item.userBookId),
    ),
  )

  const failed = updates.find((result) => result.error)
  if (failed?.error) throw failed.error
}

export async function saveShelfArrangement(
  items: Array<{
    userBookId: string
    shelfIndex: number
    shelfColumn: number
    shelfPosition: number
    shelfX: number
    shelfY: number
    shelfRotation: number
    shelfOrientation: 'upright' | 'horizontal'
  }>,
) {
  const client = requireSupabase()
  const updates = await Promise.all(
    items.map((item) =>
      client
        .from('user_books')
        .update({
          shelf_index: item.shelfIndex,
          shelf_column: item.shelfColumn,
          shelf_position: item.shelfPosition,
          shelf_x: item.shelfX,
          shelf_y: item.shelfY,
          shelf_rotation: item.shelfRotation,
          shelf_orientation: item.shelfOrientation,
        })
        .eq('id', item.userBookId),
    ),
  )

  const failed = updates.find((result) => result.error)
  if (failed?.error) throw failed.error
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
