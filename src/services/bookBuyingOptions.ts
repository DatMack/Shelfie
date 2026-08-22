import type { BookSearchResult } from './openLibrary'

export type BookBuyingOption = {
  id: 'ebay' | 'thriftbooks' | 'google' | 'shopping'
  store: string
  detail: string
  price?: number
  currencyCode?: string
  url: string
  livePrice: boolean
  recommendation?: string
}

export type LiveBookPrice = {
  id: 'ebay' | 'google' | 'shopping'
  price: number
  shipping?: number
  averagePrice?: number
  listingCount?: number
  currencyCode: string
  condition?: string
  store?: string
  url: string
  livePrice: true
  checkedAt?: string
  expiresAt?: string
  cacheStatus?: 'hit' | 'refreshed' | 'stale'
}

function cleanIsbn(value: string | undefined) {
  return value?.replace(/[^0-9X]/gi, '')
}

function searchText(book: BookSearchResult) {
  const isbn = cleanIsbn(book.isbn)
  return isbn || [book.title, book.author === 'Unknown author' ? '' : book.author].filter(Boolean).join(' ')
}

export function getBookBuyingOptions(book: BookSearchResult, livePrices: LiveBookPrice[] = []): BookBuyingOption[] {
  const query = searchText(book)
  const encoded = encodeURIComponent(query)
  const ebay = livePrices.find((option) => option.id === 'ebay')
  const google = livePrices.find((option) => option.id === 'google')
  const shopping = livePrices.find((option) => option.id === 'shopping')
  const physicalRecommendation = book.isbn
    ? 'Best place to start for this edition'
    : 'Best place to start for used copies'

  return [
    {
      id: 'ebay',
      store: 'eBay',
      detail: ebay?.condition ? `${ebay.condition} · price includes listed shipping` : book.isbn ? 'Searches this exact ISBN' : 'Searches by title and author',
      price: ebay ? ebay.price + (ebay.shipping ?? 0) : undefined,
      currencyCode: ebay?.currencyCode,
      url: ebay?.url ?? `https://www.ebay.com/sch/i.html?_nkw=${encoded}&_sop=15`,
      livePrice: Boolean(ebay),
      recommendation: physicalRecommendation,
    },
    {
      id: 'thriftbooks',
      store: 'ThriftBooks',
      detail: 'Good option for affordable used copies',
      url: `https://www.thriftbooks.com/browse/?b.search=${encoded}`,
      livePrice: false,
    },
    shopping
      ? {
          id: 'shopping',
          store: shopping.store ?? 'Google Shopping',
          detail: shopping.condition ? `${shopping.condition} · physical copy found through Google Shopping` : 'Physical copy found through Google Shopping',
          price: shopping.price + (shopping.shipping ?? 0),
          currencyCode: shopping.currencyCode,
          url: shopping.url,
          livePrice: true,
          recommendation: 'Confirmed physical-book listing',
        }
      : {
          id: 'google',
          store: 'Google Books',
          detail: book.buyLink ? 'Listed ebook price' : 'Check ebook and preview availability',
          price: google?.price ?? book.retailPrice,
          currencyCode: google?.currencyCode ?? book.currencyCode,
          url: google?.url ?? book.buyLink ?? `https://www.google.com/search?tbm=bks&q=${encoded}`,
          livePrice: Boolean(google) || (book.retailPrice !== undefined && Boolean(book.buyLink)),
          recommendation: google || (book.retailPrice !== undefined && book.buyLink) ? 'Confirmed ebook price' : undefined,
        },
  ]
}

const priceCacheTtl = 14 * 24 * 60 * 60 * 1000

function priceCacheKey(book: BookSearchResult) {
  return `shelfie:book-prices:v1:${searchText(book).trim().toLowerCase()}`
}

function cachedPrices(book: BookSearchResult, allowExpired = false): LiveBookPrice[] | null {
  try {
    const raw = localStorage.getItem(priceCacheKey(book))
    if (!raw) return null
    const cached = JSON.parse(raw) as { expiresAt?: number; options?: LiveBookPrice[] }
    if (!Array.isArray(cached.options) || (!allowExpired && Number(cached.expiresAt) <= Date.now())) return null
    return cached.options
  } catch {
    return null
  }
}

function cachePrices(book: BookSearchResult, options: LiveBookPrice[]) {
  try {
    localStorage.setItem(priceCacheKey(book), JSON.stringify({ expiresAt: Date.now() + priceCacheTtl, options }))
  } catch {
    // Pricing still works when browser storage is unavailable.
  }
}

export async function fetchLiveBookPrices(book: BookSearchResult): Promise<LiveBookPrice[]> {
  const cached = cachedPrices(book)
  if (cached) return cached
  const { supabase } = await import('../lib/supabase')
  if (!supabase) return []
  const { data, error } = await supabase.functions.invoke('book-prices', { body: { isbn: book.isbn, title: book.title, author: book.author } })
  if (error) {
    const stale = cachedPrices(book, true)
    if (stale) return stale
    throw error
  }
  const options = Array.isArray(data?.options)
    ? data.options.map((option: LiveBookPrice) => ({
        ...option,
        checkedAt: data.checkedAt,
        expiresAt: data.expiresAt,
        cacheStatus: data.cacheStatus,
      }))
    : []
  cachePrices(book, options)
  return options
}
