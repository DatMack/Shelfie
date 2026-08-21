export type ReadingStatus = 'Currently Reading' | 'Read' | 'Want to Read'

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
  year: number
  note?: string
  coverUrl?: string
  isbn?: string
  externalId?: string
  source?: 'sample' | 'openlibrary' | 'manual'
}

export const sampleBooks: Book[] = [
  { id: '1', title: 'Fourth Wing', author: 'Rebecca Yarros', status: 'Currently Reading', color: '#6b4327', accent: '#e3b064', pages: 528, currentPage: 212, rating: 4, genre: 'Fantasy', year: 2023, source: 'sample' },
  { id: '2', title: 'The Priory of the Orange Tree', author: 'Samantha Shannon', status: 'Currently Reading', color: '#26384c', accent: '#ddad66', pages: 848, currentPage: 95, genre: 'Fantasy', year: 2019, source: 'sample' },
  { id: '3', title: 'Iron Flame', author: 'Rebecca Yarros', status: 'Currently Reading', color: '#8a4d19', accent: '#ffc55f', pages: 640, currentPage: 320, rating: 4.5, genre: 'Fantasy', year: 2023, note: 'The tension in this one is wild. Loving the character development.', source: 'sample' },
  { id: '4', title: 'The Night Circus', author: 'Erin Morgenstern', status: 'Currently Reading', color: '#22252a', accent: '#e7dbc4', pages: 516, currentPage: 180, genre: 'Fantasy', year: 2011, source: 'sample' },
  { id: '5', title: 'The Seven Husbands of Evelyn Hugo', author: 'Taylor Jenkins Reid', status: 'Read', color: '#35563d', accent: '#f3c66c', pages: 400, rating: 5, genre: 'Historical Fiction', year: 2017, source: 'sample' },
  { id: '6', title: 'The Song of Achilles', author: 'Madeline Miller', status: 'Read', color: '#7b4a2f', accent: '#e3bd76', pages: 378, rating: 5, genre: 'Historical Fiction', year: 2011, source: 'sample' },
  { id: '7', title: 'The Midnight Library', author: 'Matt Haig', status: 'Read', color: '#273f50', accent: '#e5c88e', pages: 304, rating: 4, genre: 'Fiction', year: 2020, source: 'sample' },
  { id: '8', title: 'Circe', author: 'Madeline Miller', status: 'Read', color: '#694027', accent: '#f0bb6e', pages: 393, rating: 4.5, genre: 'Fantasy', year: 2018, source: 'sample' },
  { id: '9', title: 'The Atlas Six', author: 'Olivie Blake', status: 'Want to Read', color: '#544c34', accent: '#d3b86a', pages: 384, genre: 'Fantasy', year: 2020, source: 'sample' },
  { id: '10', title: 'A Court of Thorns and Roses', author: 'Sarah J. Maas', status: 'Want to Read', color: '#6c342f', accent: '#e6b96d', pages: 448, genre: 'Fantasy Romance', year: 2015, source: 'sample' },
  { id: '11', title: 'The Poppy War', author: 'R.F. Kuang', status: 'Want to Read', color: '#d8c7a5', accent: '#38281e', pages: 544, genre: 'Fantasy', year: 2018, source: 'sample' },
  { id: '12', title: 'The Lion Women of Tehran', author: 'Marjan Kamali', status: 'Want to Read', color: '#a05a2e', accent: '#f1c77c', pages: 336, genre: 'Historical Fiction', year: 2024, source: 'sample' },
]
