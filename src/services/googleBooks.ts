import type { BookSearchResult } from './openLibrary'

type GoogleVolume = {
  id: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    description?: string
    publishedDate?: string
    publisher?: string
    pageCount?: number
    categories?: string[]
    language?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    industryIdentifiers?: { type: string; identifier: string }[]
    previewLink?: string
    infoLink?: string
  }
  saleInfo?: {
    saleability?: string
    retailPrice?: { amount?: number; currencyCode?: string }
    listPrice?: { amount?: number; currencyCode?: string }
    buyLink?: string
  }
}

type GoogleVolumesResponse = { items?: GoogleVolume[] }

function googleQuery(book: BookSearchResult) {
  if (book.isbn) return `isbn:${book.isbn.replace(/[^0-9X]/gi, '')}`
  return `intitle:${book.title}${book.author !== 'Unknown author' ? ` inauthor:${book.author.split(',')[0]}` : ''}`
}

export async function enrichWithGoogleBooks(book: BookSearchResult): Promise<BookSearchResult> {
  const params = new URLSearchParams({ q: googleQuery(book), maxResults: '5', projection: 'full', country: 'US' })
  const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
  if (apiKey) params.set('key', apiKey)

  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`)
  if (!response.ok) return book
  const data = await response.json() as GoogleVolumesResponse
  const volume = data.items?.[0]
  if (!volume) return book

  const info = volume.volumeInfo ?? {}
  const sale = volume.saleInfo ?? {}
  const price = sale.retailPrice ?? sale.listPrice
  const isbn = info.industryIdentifiers?.find((item) => item.type === 'ISBN_13')?.identifier
    ?? info.industryIdentifiers?.find((item) => item.type === 'ISBN_10')?.identifier

  return {
    ...book,
    title: info.title ?? book.title,
    subtitle: info.subtitle,
    author: info.authors?.join(', ') ?? book.author,
    description: info.description,
    publishedDate: info.publishedDate,
    year: Number(info.publishedDate?.slice(0, 4)) || book.year,
    publisher: info.publisher ?? book.publisher,
    pages: info.pageCount ?? book.pages,
    genre: info.categories?.[0] ?? book.genre,
    subjects: info.categories?.length ? info.categories : book.subjects,
    language: info.language ?? book.language,
    isbn: isbn ?? book.isbn,
    coverUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://') ?? book.coverUrl,
    googleVolumeId: volume.id,
    retailPrice: price?.amount,
    currencyCode: price?.currencyCode,
    buyLink: sale.buyLink,
    previewLink: info.previewLink,
    infoLink: info.infoLink,
    saleability: sale.saleability,
  }
}
