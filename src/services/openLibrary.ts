export type BookSearchResult = {
  key: string
  title: string
  author: string
  coverUrl?: string
  year?: number
  pages?: number
  isbn?: string
  genre?: string
  subjects?: string[]
  publisher?: string
  language?: string
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
}

type OpenLibraryResponse = {
  docs: OpenLibraryDoc[]
}

export async function searchOpenLibrary(term: string): Promise<BookSearchResult[]> {
  const query = term.trim()
  if (!query) return []

  const params = new URLSearchParams({
    q: query,
    limit: '18',
    fields: 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median,isbn,subject,publisher,language',
  })

  const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`)
  if (!response.ok) throw new Error('Book search is unavailable right now.')

  const data = (await response.json()) as OpenLibraryResponse

  return data.docs
    .filter((doc) => doc.title)
    .map((doc) => ({
      key: doc.key,
      title: doc.title,
      author: doc.author_name?.slice(0, 2).join(', ') || 'Unknown author',
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
      year: doc.first_publish_year,
      pages: doc.number_of_pages_median,
      isbn: doc.isbn?.[0],
      genre: doc.subject?.[0],
      subjects: doc.subject?.slice(0, 12),
      publisher: doc.publisher?.[0],
      language: doc.language?.[0],
    }))
}
