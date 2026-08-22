import type { BookSearchResult } from './openLibrary'

export type BookBuyingOption = {
  id: 'ebay' | 'thriftbooks' | 'google'
  store: string
  detail: string
  price?: number
  currencyCode?: string
  url: string
  livePrice: boolean
  recommendation?: string
}

export type LiveBookPrice = {
  id: 'ebay' | 'google'
  price: number
  shipping?: number
  averagePrice?: number
  listingCount?: number
  currencyCode: string
  condition?: string
  url: string
  livePrice: true
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
    {
      id: 'google',
      store: 'Google Books',
      detail: book.buyLink ? 'Listed ebook price' : 'Check ebook and preview availability',
      price: google?.price ?? book.retailPrice,
      currencyCode: google?.currencyCode ?? book.currencyCode,
      url: google?.url ?? book.buyLink ?? `https://www.google.com/search?tbm=bks&q=${encoded}`,
      livePrice: Boolean(google) || (book.retailPrice !== undefined && Boolean(book.buyLink)),
      recommendation: google || (book.retailPrice !== undefined && book.buyLink) ? 'Confirmed retailer price' : undefined,
    },
  ]
}

export async function fetchLiveBookPrices(book: BookSearchResult): Promise<LiveBookPrice[]> {
  const { supabase } = await import('../lib/supabase')
  if (!supabase) return []
  const { data, error } = await supabase.functions.invoke('book-prices', { body: { isbn: book.isbn, title: book.title } })
  if (error) throw error
  return Array.isArray(data?.options) ? data.options : []
}
