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

export const discoverCategories = [
  { id: 'for-you', label: 'For You' },
  { id: 'romantasy', label: 'Romantasy' },
  { id: 'spicy-romance', label: 'Spicy Romance' },
  { id: 'romance', label: 'Romance' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'thrillers', label: 'Thrillers' },
  { id: 'new-adult', label: 'New Adult' },
] as const

export type DiscoverCategoryId = typeof discoverCategories[number]['id']

const modernQueries: Record<Exclude<DiscoverCategoryId, 'for-you'>, string[]> = {
  romantasy: ['romantasy bestseller', 'fantasy romance'],
  'spicy-romance': ['dark romance bestseller', 'new adult romance'],
  romance: ['contemporary romance bestseller', 'romantic fiction'],
  fantasy: ['fantasy bestseller', 'epic fantasy'],
  thrillers: ['psychological thriller bestseller', 'mystery thriller'],
  'new-adult': ['new adult fiction', 'new adult romance'],
}

const lowQualityTitle = /\b(summary|study guide|workbook|notebook|reading journal|analysis|unofficial companion|lesson plans?)\b/i
const establishedPublisher = /penguin|random house|simon|schuster|harper|hachette|macmillan|bloomsbury|tor books|berkley|sourcebooks|entangled|avon|del rey|orbit|ballantine|gallery books|st\. martin/i

function usefulTasteGenre(value: string) {
  const cleaned = value.replace(/^series:/i, '').trim()
  return cleaned && cleaned.length <= 40 && !/^(uncategorized|unknown|fiction)$/i.test(cleaned) ? cleaned : ''
}

function discoveryScore(book: BookSearchResult, newestYear: number) {
  const year = book.year ?? newestYear - 5
  return (year - (newestYear - 5)) * 12
    + Number(Boolean(book.coverUrl)) * 30
    + Number(Boolean(book.largeCoverUrl)) * 5
    + Number(Boolean(book.description)) * 8
    + Number(Boolean(book.isbn)) * 8
    + Number((book.pages ?? 0) >= 120) * 4
    + Number(establishedPublisher.test(book.publisher ?? '')) * 10
}

export async function searchModernDiscoverFeed(category: DiscoverCategoryId, tasteGenre: string, refreshPage = 0) {
  const taste = usefulTasteGenre(tasteGenre)
  const queries = category === 'for-you'
    ? [taste ? `${taste} contemporary bestseller` : 'romantasy bestseller', 'romance fantasy bestseller']
    : modernQueries[category]
  const currentYear = new Date().getFullYear()
  const oldestYear = currentYear - 4
  const startIndex = (refreshPage % 2) * 20
  const orderBy = refreshPage % 2 === 0 ? 'relevance' : 'newest'
  const googleSettled = await Promise.allSettled(queries.map(async (query) => {
    try {
      return await searchGoogleBooks(query, {
        orderBy,
        startIndex,
        maxResults: 40,
        langRestrict: 'en',
        showPreorders: true,
      })
    } catch {
      // Some Google Books regions reject one or more optional discovery parameters.
      // Retry the same modern query using the known-good basic search shape.
      return searchGoogleBooks(query)
    }
  }))
  const groups = googleSettled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])

  if (groups.flat().length < 12) {
    const openLibrarySettled = await Promise.allSettled(queries.map((query) => searchOpenLibrary(query)))
    groups.push(...openLibrarySettled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []))
  }
  if (!groups.length) throw new Error('Fresh recommendations are taking a break. Try a search instead.')

  const usable = mergeBookResults(...groups).filter((book) => Boolean(book.coverUrl)
    && book.author !== 'Unknown author'
    && !lowQualityTitle.test(book.title))
  const recent = usable.filter((book) => {
    const year = book.year ?? 0
    return year >= oldestYear && year <= currentYear + 1
  })
  const slightlyWider = usable.filter((book) => {
    const year = book.year ?? 0
    return year >= currentYear - 7 && year <= currentYear + 1
  })
  const selected = recent.length >= 8 ? recent : mergeBookResults(recent, slightlyWider)

  return selected.sort((a, b) => discoveryScore(b, currentYear + 1) - discoveryScore(a, currentYear + 1))
}
