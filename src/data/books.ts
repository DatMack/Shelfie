export type ReadingStatus = 'Currently Reading' | 'Read' | 'Want to Read' | 'DNF'
export type BookFormat = 'Hardcover' | 'Paperback' | 'Mass Market' | 'Ebook' | 'Audiobook' | 'Other'
export type BookCondition = 'New' | 'Like New' | 'Very Good' | 'Good' | 'Fair' | 'Poor'
export type MarketplaceStatus = 'Not Listed' | 'For Trade' | 'For Sale' | 'Free'
export type ShelfDisplayStyle =
  | 'Auto'
  | 'Spine'
  | 'Front Cover'
  | 'Cassette'
  | 'Cassette Case'
  | 'Audio Case'
  | 'E-reader'
  | 'Digital Tile'

export type Book = {
  id: string
  title: string
  author: string
  status: ReadingStatus
  color: string
  accent: string
  pages: number
  currentPage?: number
  rating?: number
  genre: string
  subjects?: string[]
  year: number
  description?: string
  publisher?: string
  language?: string
  series?: string
  seriesNumber?: number
  note?: string
  coverUrl?: string
  isbn?: string
  externalId?: string
  source?: 'sample' | 'openlibrary' | 'manual'

  // Physical location in the virtual bookcase is intentionally independent from reading status.
  shelfIndex?: number

  // Shelf appearance is a per-book override. Auto follows the book format.
  displayStyle?: ShelfDisplayStyle
  displayEditionId?: string
  displayCoverUrl?: string

  // Ownership is intentionally separate from reading status.
  owned?: boolean
  format?: BookFormat
  condition?: BookCondition
  purchasePrice?: number
  estimatedValue?: number
  valueLow?: number
  valueHigh?: number
  valueSource?: string
  valueCheckedAt?: string
  specialEdition?: boolean
  signed?: boolean
  firstEdition?: boolean
  gifted?: boolean
  purchaseDate?: string
  storageLocation?: string
  acquiredFrom?: string

  // Current-loan preview fields. Full loan history lives in book_loans in Supabase.
  loanedTo?: string
  loanedAt?: string
  loanDueDate?: string

  // Marketplace preview fields. Real listings/offers live in separate Supabase tables.
  marketplaceStatus?: MarketplaceStatus
  askingPrice?: number
  tradeWishlist?: string

  // Future recommendation / journal signals.
  favorite?: boolean
  moodTags?: string[]
  customTags?: string[]
  rereadCount?: number
}

export const sampleBooks: Book[] = [
  { id: '1', title: 'Fourth Wing', author: 'Rebecca Yarros', status: 'Currently Reading', shelfIndex: 0, color: '#6b4327', accent: '#e3b064', pages: 528, currentPage: 212, rating: 4, genre: 'Fantasy', subjects: ['Fantasy', 'Romance', 'Dragons'], year: 2023, source: 'sample', owned: true, format: 'Hardcover', condition: 'Very Good', purchasePrice: 19.99, estimatedValue: 18, storageLocation: 'Main bookshelf', favorite: true },
  { id: '2', title: 'The Priory of the Orange Tree', author: 'Samantha Shannon', status: 'Currently Reading', shelfIndex: 0, color: '#26384c', accent: '#ddad66', pages: 848, currentPage: 95, genre: 'Fantasy', subjects: ['Fantasy', 'Dragons', 'Epic Fantasy'], year: 2019, source: 'sample', owned: true, format: 'Paperback', condition: 'Good', purchasePrice: 16.99, estimatedValue: 11, storageLocation: 'Main bookshelf' },
  { id: '3', title: 'Iron Flame', author: 'Rebecca Yarros', status: 'Currently Reading', shelfIndex: 0, color: '#8a4d19', accent: '#ffc55f', pages: 640, currentPage: 320, rating: 4.5, genre: 'Fantasy', subjects: ['Fantasy', 'Romance', 'Dragons'], year: 2023, note: 'The tension in this one is wild. Loving the character development.', source: 'sample', owned: true, format: 'Hardcover', condition: 'Like New', purchasePrice: 21.99, estimatedValue: 20, specialEdition: true },
  { id: '4', title: 'The Night Circus', author: 'Erin Morgenstern', status: 'Currently Reading', shelfIndex: 0, color: '#22252a', accent: '#e7dbc4', pages: 516, currentPage: 180, genre: 'Fantasy', subjects: ['Fantasy', 'Magic', 'Romance'], year: 2011, source: 'sample', owned: false },
  { id: '5', title: 'The Seven Husbands of Evelyn Hugo', author: 'Read', status: 'Read', shelfIndex: 1, color: '#35563d', accent: '#f3c66c', pages: 400, rating: 5, genre: 'Historical Fiction', subjects: ['Historical Fiction', 'Romance'], year: 2017, source: 'sample', owned: true, format: 'Paperback', condition: 'Very Good', purchasePrice: 12.99, estimatedValue: 9, favorite: true },
  { id: '6', title: 'The Song of Achilles', author: 'Madeline Miller', status: 'Read', shelfIndex: 1, color: '#7b4a2f', accent: '#e3bd76', pages: 378, rating: 5, genre: 'Historical Fiction', subjects: ['Historical Fiction', 'Mythology', 'Romance'], year: 2011, source: 'sample', owned: true, format: 'Hardcover', condition: 'Like New', purchasePrice: 18.99, estimatedValue: 16, gifted: true, favorite: true },
  { id: '7', title: 'The Midnight Library', author: 'Matt Haig', status: 'Read', shelfIndex: 1, color: '#273f50', accent: '#e5c88e', pages: 304, rating: 4, genre: 'Fiction', subjects: ['Fiction', 'Contemporary'], year: 2020, source: 'sample', owned: false },
  { id: '8', title: 'Circe', author: 'Madeline Miller', status: 'Read', shelfIndex: 1, color: '#694027', accent: '#f0bb6e', pages: 393, rating: 4.5, genre: 'Fantasy', subjects: ['Fantasy', 'Mythology'], year: 2018, source: 'sample', owned: true, format: 'Hardcover', condition: 'Very Good', purchasePrice: 17.99, estimatedValue: 15, firstEdition: true },
  { id: '9', title: 'The Atlas Six', author: 'Olivie Blake', status: 'Want to Read', shelfIndex: 2, color: '#544c34', accent: '#d3b86a', pages: 384, genre: 'Fantasy', subjects: ['Fantasy', 'Dark Academia'], year: 2020, source: 'sample', owned: true, format: 'Paperback', condition: 'New', purchasePrice: 13.99, estimatedValue: 12 },
  { id: '10', title: 'A Court of Thorns and Roses', author: 'Sarah J. Maas', status: 'Want to Read', shelfIndex: 2, color: '#6c342f', accent: '#e6b96d', pages: 448, genre: 'Fantasy Romance', subjects: ['Fantasy', 'Romance', 'Fae'], year: 2015, source: 'sample', owned: true, format: 'Paperback', condition: 'Good', purchasePrice: 11.99, estimatedValue: 8 },
  { id: '11', title: 'The Poppy War', author: 'R.F. Kuang', status: 'Want to Read', shelfIndex: 2, color: '#d8c7a5', accent: '#38281e', pages: 544, genre: 'Fantasy', subjects: ['Fantasy', 'Historical Fantasy'], year: 2018, source: 'sample', owned: false },
  { id: '12', title: 'The Lion Women of Tehran', author: 'Marjan Kamali', status: 'Want to Read', shelfIndex: 2, color: '#a05a2e', accent: '#f1c77c', pages: 336, genre: 'Historical Fiction', subjects: ['Historical Fiction', 'Iran'], year: 2024, source: 'sample', owned: true, format: 'Hardcover', condition: 'Like New', purchasePrice: 20, estimatedValue: 17 },
]
