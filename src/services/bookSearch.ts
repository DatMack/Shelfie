import { searchGoogleBooks } from './googleBooks'
import { BookSearchResult, searchOpenLibrary } from './openLibrary'

function compact(value: string | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''
}

function identity(book: BookSearchResult) {
  const isbn = compact(book.isbn)
  if (isbn) return `isbn:${isbn}`
  return `book:${compact(book.title)}:${compact(book.author.split(',')[0])}`
}

function merge(primary: BookSearchResult, secondary: BookSearchResult): BookSearchResult {
  const covers = [primary.coverUrl, primary.largeCoverUrl, secondary.coverUrl, secondary.largeCoverUrl]
    .filter((url): url is string => Boolean(url))
  return {
    ...secondary,
    ...primary,
    description: primary.description ?? secondary.description,
    coverUrl: primary.coverUrl ?? secondary.coverUrl,
    largeCoverUrl: primary.largeCoverUrl ?? secondary.largeCoverUrl,
    subjects: [...new Set([...(primary.subjects ?? []), ...(secondary.subjects ?? [])])],
    alternateCoverUrls: [...new Set(covers)].filter((url) => url !== (primary.coverUrl ?? secondary.coverUrl)),
  }
}

export function mergeBookResults(...groups: BookSearchResult[][]) {
  const merged = new Map<string, BookSearchResult>()
  for (const group of groups) {
    for (const book of group) {
      const key = identity(book)
      const existing = merged.get(key)
      merged.set(key, existing ? merge(existing, book) : book)
    }
  }
  return [...merged.values()].sort((a, b) => Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl)))
}

export async function searchEverywhere(term: string, onResults?: (results: BookSearchResult[]) => void) {
  let google: BookSearchResult[] = []
  let openLibrary: BookSearchResult[] = []
  const googleTask = searchGoogleBooks(term).then((results) => {
    google = results
    onResults?.(mergeBookResults(google, openLibrary))
  })
  const openLibraryTask = searchOpenLibrary(term).then((results) => {
    openLibrary = results
    onResults?.(mergeBookResults(google, openLibrary))
  })
  const settled = await Promise.allSettled([googleTask, openLibraryTask])
  const results = mergeBookResults(google, openLibrary)
  if (!results.length && settled.every((result) => result.status === 'rejected')) {
    throw new Error('Every book catalog is taking a break right now. Please try again.')
  }
  return results
}
