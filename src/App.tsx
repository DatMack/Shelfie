import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  BookPlus,
  Check,
  ChevronRight,
  Library,
  LoaderCircle,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { Book, ReadingStatus, sampleBooks } from './data/books'
import { BookSearchResult, searchOpenLibrary } from './services/openLibrary'

const shelfOrder: ReadingStatus[] = ['Currently Reading', 'Read', 'Want to Read']
const storageKey = 'shelfie-books-v1'
const palette = [
  ['#6b4327', '#e3b064'],
  ['#26384c', '#ddad66'],
  ['#35563d', '#f3c66c'],
  ['#6c342f', '#e6b96d'],
  ['#544c34', '#d3b86a'],
  ['#694027', '#f0bb6e'],
  ['#273f50', '#e5c88e'],
]

function loadLibrary(): Book[] {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) return JSON.parse(saved) as Book[]
  } catch {
    // A fresh sample library is a safe fallback if browser storage is unavailable.
  }
  return sampleBooks
}

function colorsFor(seed: string) {
  const total = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const [color, accent] = palette[total % palette.length]
  return { color, accent }
}

export function App() {
  const [books, setBooks] = useState<Book[]>(loadLibrary)
  const [selectedBookId, setSelectedBookId] = useState(sampleBooks[2].id)
  const [largeText, setLargeText] = useState(false)
  const [glowFocus, setGlowFocus] = useState(true)
  const [highContrast, setHighContrast] = useState(false)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(books))
  }, [books])

  const selectedBook = books.find((book) => book.id === selectedBookId) ?? books[0]

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return books
    return books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(term))
  }, [books, query])

  function addBook(result: BookSearchResult, status: ReadingStatus) {
    const duplicate = books.find(
      (book) => book.externalId === result.key || (book.isbn && result.isbn && book.isbn === result.isbn),
    )
    if (duplicate) {
      setSelectedBookId(duplicate.id)
      return
    }

    const colors = colorsFor(result.title)
    const newBook: Book = {
      id: crypto.randomUUID(),
      title: result.title,
      author: result.author,
      status,
      color: colors.color,
      accent: colors.accent,
      pages: result.pages || 0,
      genre: result.genre || 'Uncategorized',
      year: result.year || new Date().getFullYear(),
      coverUrl: result.coverUrl,
      isbn: result.isbn,
      externalId: result.key,
      source: 'openlibrary',
      ...(status === 'Currently Reading' ? { currentPage: 0 } : {}),
    }

    setBooks((current) => [...current, newBook])
    setSelectedBookId(newBook.id)
  }

  return (
    <main className={`app ${largeText ? 'large-text' : ''} ${highContrast ? 'high-contrast' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><BookOpen size={28} /><span>Shelfie</span></div>
        <p className="tagline">Your stories. Your shelf.</p>

        <nav>
          <button className="nav-active"><Library size={18} /> My Bookshelf</button>
          <button><BookOpen size={18} /> Currently Reading</button>
          <button><Users size={18} /> Friends</button>
          <button><Trophy size={18} /> Trophy Case</button>
        </nav>

        <div className="settings-card">
          <div className="settings-title"><Settings2 size={17} /> Accessibility</div>
          <Toggle label="Larger text" value={largeText} onChange={setLargeText} />
          <Toggle label="High contrast" value={highContrast} onChange={setHighContrast} />
          <Toggle label="Glow on focus" value={glowFocus} onChange={setGlowFocus} />
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">MY LIBRARY</p>
            <h1>My Bookshelf</h1>
          </div>
          <div className="header-actions">
            <label className="search-box">
              <Search size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your shelf..." />
            </label>
            <button className="primary" onClick={() => setAddOpen(true)}><BookPlus size={18} /> Add Book</button>
          </div>
        </header>

        <div className="library-summary">
          <span><strong>{books.length}</strong> books in your collection</span>
          <span><strong>{books.filter((book) => book.status === 'Read').length}</strong> finished</span>
          <span><strong>{books.filter((book) => book.status === 'Currently Reading').length}</strong> currently reading</span>
        </div>

        <div className="layout">
          <section className="bookcase" aria-label="Virtual bookshelf">
            <div className="bookcase-frame">
              {shelfOrder.map((status) => {
                const shelfBooks = filtered.filter((book) => book.status === status)
                return (
                  <div className="shelf-row" key={status}>
                    <div className="shelf-label"><span>{status}</span><span>{shelfBooks.length}</span></div>
                    <div className="books">
                      {shelfBooks.length === 0 && <div className="empty-shelf">No books here yet.</div>}
                      {shelfBooks.map((book, index) => (
                        <button
                          className={`book-spine ${selectedBook?.id === book.id ? 'selected' : ''} ${glowFocus ? 'glow-focus' : ''}`}
                          style={{ '--book-color': book.color, '--book-accent': book.accent, '--book-height': `${172 + (index % 3) * 14}px` } as React.CSSProperties}
                          key={book.id}
                          onClick={() => setSelectedBookId(book.id)}
                          aria-label={`${book.title} by ${book.author}`}
                        >
                          <span className="spine-ornament">✦</span>
                          <span className="spine-title">{book.title}</span>
                          <span className="spine-author">{book.author}</span>
                        </button>
                      ))}
                    </div>
                    <div className="wood-shelf" />
                  </div>
                )
              })}
            </div>
          </section>

          {selectedBook && (
            <aside className="details-panel">
              <div className="detail-header">
                {selectedBook.coverUrl ? (
                  <img className="mini-cover cover-image" src={selectedBook.coverUrl} alt={`Cover of ${selectedBook.title}`} />
                ) : (
                  <div className="mini-cover" style={{ background: `linear-gradient(160deg, ${selectedBook.color}, #16100b)` }}>
                    <span>{selectedBook.title}</span>
                  </div>
                )}
                <div>
                  <p className="status-pill">{selectedBook.status}</p>
                  <h2>{selectedBook.title}</h2>
                  <p className="author">{selectedBook.author}</p>
                  <div className="meta-row"><span>{selectedBook.genre}</span><span>{selectedBook.year}</span></div>
                </div>
              </div>

              {selectedBook.status === 'Currently Reading' && selectedBook.pages > 0 && (
                <div className="detail-card">
                  <div className="card-heading"><span>Reading progress</span><strong>{Math.round(((selectedBook.currentPage || 0) / selectedBook.pages) * 100)}%</strong></div>
                  <div className="progress"><span style={{ width: `${((selectedBook.currentPage || 0) / selectedBook.pages) * 100}%` }} /></div>
                  <p>{selectedBook.currentPage || 0} of {selectedBook.pages} pages</p>
                </div>
              )}

              <div className="detail-grid">
                <div className="detail-card">
                  <div className="card-heading"><span>My rating</span><Star size={18} /></div>
                  <strong className="rating">{selectedBook.rating ?? '—'}</strong>
                  <p>{selectedBook.rating ? 'A keeper.' : 'Not rated yet'}</p>
                </div>
                <div className="detail-card">
                  <div className="card-heading"><span>Book length</span><Sparkles size={18} /></div>
                  <strong>{selectedBook.pages || '—'}</strong>
                  <p>{selectedBook.pages ? 'pages' : 'page count unavailable'}</p>
                </div>
              </div>

              <div className="detail-card journal-card">
                <div className="card-heading"><span>Journal</span><ChevronRight size={18} /></div>
                <p>{selectedBook.note ?? 'Add thoughts, favorite quotes, characters, predictions, moods, or a full review whenever you want.'}</p>
                <button className="secondary">Open book journal</button>
              </div>
            </aside>
          )}
        </div>
      </section>

      {addOpen && (
        <AddBookModal
          books={books}
          onClose={() => setAddOpen(false)}
          onAdd={addBook}
        />
      )}
    </main>
  )
}

function AddBookModal({
  books,
  onClose,
  onAdd,
}: {
  books: Book[]
  onClose: () => void
  onAdd: (book: BookSearchResult, status: ReadingStatus) => void
}) {
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<ReadingStatus>('Want to Read')
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!term.trim()) return
    setLoading(true)
    setError('')
    try {
      setResults(await searchOpenLibrary(term))
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Could not search for books.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="add-modal" role="dialog" aria-modal="true" aria-label="Add a book">
        <div className="modal-header">
          <div>
            <p className="eyebrow">BUILD YOUR SHELF</p>
            <h2>Add a Book</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <form className="book-search-form" onSubmit={submit}>
          <label className="search-box modal-search">
            <Search size={20} />
            <input
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search title, author, or ISBN..."
            />
          </label>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
            Search
          </button>
        </form>

        <div className="status-picker" aria-label="Shelf to add books to">
          {shelfOrder.map((option) => (
            <button
              className={status === option ? 'status-option active' : 'status-option'}
              onClick={() => setStatus(option)}
              key={option}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>

        {error && <div className="search-message error-message">{error}</div>}
        {!loading && !error && results.length === 0 && (
          <div className="search-message">
            <BookOpen size={32} />
            <strong>Search millions of books</strong>
            <span>Open Library will fill in the title, author, cover, ISBN, year, and other details when available.</span>
          </div>
        )}

        <div className="search-results">
          {results.map((result) => {
            const alreadyAdded = books.some(
              (book) => book.externalId === result.key || (book.isbn && result.isbn && book.isbn === result.isbn),
            )
            return (
              <article className="search-result" key={result.key}>
                <div className="result-cover">
                  {result.coverUrl ? <img src={result.coverUrl} alt="" /> : <BookOpen size={28} />}
                </div>
                <div className="result-copy">
                  <strong>{result.title}</strong>
                  <span>{result.author}</span>
                  <small>{[result.year, result.pages ? `${result.pages} pages` : '', result.isbn ? `ISBN ${result.isbn}` : ''].filter(Boolean).join(' · ')}</small>
                </div>
                <button
                  className={alreadyAdded ? 'added-button' : 'add-result-button'}
                  disabled={alreadyAdded}
                  onClick={() => onAdd(result, status)}
                  type="button"
                >
                  {alreadyAdded ? <><Check size={17} /> Added</> : <><BookPlus size={17} /> Add</>}
                </button>
              </article>
            )
          })}
        </div>

        <div className="manual-hint">Can't find a book? Manual entry and link import are coming next.</div>
      </section>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" />
    </label>
  )
}
