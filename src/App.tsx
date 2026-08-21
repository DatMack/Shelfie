import { useMemo, useState } from 'react'
import { BookOpen, ChevronRight, Library, Search, Settings2, Sparkles, Star, Trophy, Users } from 'lucide-react'
import { Book, ReadingStatus, sampleBooks } from './data/books'

const shelfOrder: ReadingStatus[] = ['Currently Reading', 'Read', 'Want to Read']

export function App() {
  const [selectedBook, setSelectedBook] = useState<Book>(sampleBooks[2])
  const [largeText, setLargeText] = useState(false)
  const [glowFocus, setGlowFocus] = useState(true)
  const [highContrast, setHighContrast] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return sampleBooks
    return sampleBooks.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(term))
  }, [query])

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
            <button className="primary">+ Add Book</button>
          </div>
        </header>

        <div className="layout">
          <section className="bookcase" aria-label="Virtual bookshelf">
            <div className="bookcase-frame">
              {shelfOrder.map((status) => {
                const shelfBooks = filtered.filter((book) => book.status === status)
                return (
                  <div className="shelf-row" key={status}>
                    <div className="shelf-label"><span>{status}</span><span>{shelfBooks.length}</span></div>
                    <div className="books">
                      {shelfBooks.map((book, index) => (
                        <button
                          className={`book-spine ${selectedBook.id === book.id ? 'selected' : ''} ${glowFocus ? 'glow-focus' : ''}`}
                          style={{ '--book-color': book.color, '--book-accent': book.accent, '--book-height': `${172 + (index % 3) * 14}px` } as React.CSSProperties}
                          key={book.id}
                          onClick={() => setSelectedBook(book)}
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

          <aside className="details-panel">
            <div className="detail-header">
              <div className="mini-cover" style={{ background: `linear-gradient(160deg, ${selectedBook.color}, #16100b)` }}>
                <span>{selectedBook.title}</span>
              </div>
              <div>
                <p className="status-pill">{selectedBook.status}</p>
                <h2>{selectedBook.title}</h2>
                <p className="author">{selectedBook.author}</p>
                <div className="meta-row"><span>{selectedBook.genre}</span><span>{selectedBook.year}</span></div>
              </div>
            </div>

            {selectedBook.currentPage !== undefined && (
              <div className="detail-card">
                <div className="card-heading"><span>Reading progress</span><strong>{Math.round((selectedBook.currentPage / selectedBook.pages) * 100)}%</strong></div>
                <div className="progress"><span style={{ width: `${(selectedBook.currentPage / selectedBook.pages) * 100}%` }} /></div>
                <p>{selectedBook.currentPage} of {selectedBook.pages} pages</p>
              </div>
            )}

            <div className="detail-grid">
              <div className="detail-card">
                <div className="card-heading"><span>My rating</span><Star size={18} /></div>
                <strong className="rating">{selectedBook.rating ?? '—'}</strong>
                <p>{selectedBook.rating ? 'A keeper.' : 'Not rated yet'}</p>
              </div>
              <div className="detail-card">
                <div className="card-heading"><span>Collection</span><Sparkles size={18} /></div>
                <strong>{selectedBook.pages}</strong>
                <p>pages</p>
              </div>
            </div>

            <div className="detail-card journal-card">
              <div className="card-heading"><span>Journal</span><ChevronRight size={18} /></div>
              <p>{selectedBook.note ?? 'Add thoughts, favorite quotes, characters, predictions, or a full review whenever you want.'}</p>
              <button className="secondary">Open book journal</button>
            </div>
          </aside>
        </div>
      </section>
    </main>
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
