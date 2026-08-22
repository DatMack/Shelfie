export type BookSearchResult = {
  key: string
  source?: 'googlebooks' | 'openlibrary' | 'manual'
  title: string
  author: string
  coverUrl?: string
  largeCoverUrl?: string
  coverId?: number
  year?: number
  pages?: number
  isbn?: string
  genre?: string
  subjects?: string[]
  publisher?: string
  language?: string
  editionKeys?: string[]
  description?: string
  subtitle?: string
  publishedDate?: string
  googleVolumeId?: string
  retailPrice?: number
  currencyCode?: string
  buyLink?: string
  previewLink?: string
  infoLink?: string
  saleability?: string
  isEbook?: boolean
  alternateCoverUrls?: string[]
}

type OpenLibraryDoc = {
  key: string
  title: string
  author_name?: string[]
  cover_i?: number
  first_publish_year?: number
  number_of_pages_median?: number
  isbn?: string[]
  subject?: string[]
  publisher?: string[]
  language?: string[]
  edition_key?: string[]
}

type OpenLibraryResponse = {
  docs: OpenLibraryDoc[]
}

type OpenLibraryDetail = {
  description?: string | { value?: string }
  works?: Array<{ key?: string }>
}

function descriptionText(value: OpenLibraryDetail['description']) {
  if (typeof value === 'string') return value.trim() || undefined
  return value?.value?.trim() || undefined
}

function coverUrl(coverId: number | undefined, isbn: string | undefined, size: 'M' | 'L') {
  if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg?default=false`
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-${size}.jpg?default=false`
  return undefined
}

export async function searchOpenLibrary(term: string): Promise<BookSearchResult[]> {
  const query = term.trim()
  if (!query) return []

  const params = new URLSearchParams({
    q: query,
    limit: '20',
    fields: 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median,isbn,subject,publisher,language,edition_key',
  })

  const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`)
  if (!response.ok) throw new Error('Book search is unavailable right now.')

  const data = (await response.json()) as OpenLibraryResponse

  return data.docs
    .filter((doc) => doc.title)
    .map((doc) => {
      const isbn = doc.isbn?.[0]
      return {
        key: doc.key,
        source: 'openlibrary' as const,
        title: doc.title,
        author: doc.author_name?.slice(0, 2).join(', ') || 'Unknown author',
        coverUrl: coverUrl(doc.cover_i, isbn, 'M'),
        largeCoverUrl: coverUrl(doc.cover_i, isbn, 'L'),
        coverId: doc.cover_i,
        year: doc.first_publish_year,
        pages: doc.number_of_pages_median,
        isbn,
        genre: doc.subject?.[0],
        subjects: doc.subject?.slice(0, 12),
        publisher: doc.publisher?.[0],
        language: doc.language?.[0],
        editionKeys: doc.edition_key?.slice(0, 20),
      }
    })
}

async function fetchOpenLibraryDetail(path: string | undefined) {
  if (!path) return undefined
  const normalized = path.endsWith('.json') ? path : `${path}.json`
  try {
    const response = await fetch(`https://openlibrary.org${normalized}`)
    if (!response.ok) return undefined
    return await response.json() as OpenLibraryDetail
  } catch {
    return undefined
  }
}

export async function enrichWithOpenLibrary(book: BookSearchResult): Promise<BookSearchResult> {
  if (book.description) return book

  const isbn = book.isbn?.replace(/[^0-9X]/gi, '')
  const paths = [
    book.key.startsWith('/works/') ? book.key : undefined,
    isbn ? `/isbn/${isbn}` : undefined,
    ...(book.editionKeys ?? []).slice(0, 4).map((key) => `/books/${key}`),
  ].filter((path): path is string => Boolean(path))

  const seen = new Set<string>()
  for (const path of paths) {
    if (seen.has(path)) continue
    seen.add(path)
    const detail = await fetchOpenLibraryDetail(path)
    const direct = descriptionText(detail?.description)
    if (direct) return { ...book, description: direct }

    for (const work of detail?.works ?? []) {
      if (!work.key || seen.has(work.key)) continue
      seen.add(work.key)
      const workDetail = await fetchOpenLibraryDetail(work.key)
      const workDescription = descriptionText(workDetail?.description)
      if (workDescription) return { ...book, description: workDescription }
    }
  }

  return book
}
