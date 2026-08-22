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

function cleanIsbn(value: string | undefined) {
  return value?.replace(/[^0-9X]/gi, '')
}

function searchText(book: BookSearchResult) {
  const isbn = cleanIsbn(book.isbn)
  return isbn || [book.title, book.author === 'Unknown author' ? '' : book.author].filter(Boolean).join(' ')
}

export function getBookBuyingOptions(book: BookSearchResult): BookBuyingOption[] {
  const query = searchText(book)
  const encoded = encodeURIComponent(query)
  const physicalRecommendation = book.isbn
    ? 'Best place to start for this edition'
    : 'Best place to start for used copies'

  return [
    {
      id: 'ebay',
      store: 'eBay',
      detail: book.isbn ? 'Searches this exact ISBN' : 'Searches by title and author',
      url: `https://www.ebay.com/sch/i.html?_nkw=${encoded}&_sop=15`,
      livePrice: false,
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
      price: book.retailPrice,
      currencyCode: book.currencyCode,
      url: book.buyLink ?? `https://www.google.com/search?tbm=bks&q=${encoded}`,
      livePrice: book.retailPrice !== undefined && Boolean(book.buyLink),
      recommendation: book.retailPrice !== undefined && book.buyLink ? 'Best confirmed price' : undefined,
    },
  ]
}
