import { CSSProperties, DragEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  BarChart3,
  BookOpen,
  BookPlus,
  Check,
  ChevronRight,
  Compass,
  DollarSign,
  Heart,
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
import { ShelfAppearanceControl } from './components/ShelfAppearanceControl'
import { Book, BookFormat, ReadingStatus, sampleBooks } from './data/books'
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

type View = 'shelf' | 'collection' | 'discover'
type AddBookOptions = { status: ReadingStatus; owned: boolean; format: BookFormat }

function loadLibrary(): Book[] {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = JSON.parse(saved) as Book[]
      return parsed.map((book) => {
        const starter = sampleBooks.find((sample) => sample.id === book.id || sample.title === book.title)
        if (!starter) return book
        return {
          ...starter,
          ...book,
          owned: book.owned ?? starter.owned,
          format: book.format ?? starter.format,
          condition: book.condition ?? starter.condition,
          purchasePrice: book.purchasePrice ?? starter.purchasePrice,
          estimatedValue: book.estimatedValue ?? starter.estimatedValue,
          subjects: book.subjects ?? starter.subjects,
        }
      })
    }
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

function money(value?: number) {
  if (value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function App() {
  const [books, setBooks] = useState<Book[]>(loadLibrary)
  const [selectedBookId, setSelectedBookId] = useState(sampleBooks[2].id)
  const [view, setView] = useState<View>('shelf')
  const [largeText, setLargeText] = useState(false)
  const [glowFocus, setGlowFocus] = useState(true)
  const [highContrast, setHighContrast] = useState(false)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [discoverTerm, setDiscoverTerm] = useState('')
  const [discoverResults, setDiscoverResults] = useState<BookSearchResult[]>([])
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverError, setDiscoverError] = useState('')
  const [discoverSeed, setDiscoverSeed] = useState('')

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(books))
  }, [books])

  const selectedBook = books.find((book) => book.id === selectedBookId) ?? books[0]

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return books
    return books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(term))
  }, [books, query])

  const recommendationGenre = useMemo(() => {
    const counts = new Map<string, number>()
    books
      .filter((book) => book.status === 'Read' || (book.rating ?? 0) >= 4)
      .forEach((book) => {
        const weight = book.rating ?? 3
        counts.set(book.genre, (counts.get(book.genre) ?? 0) + weight)
      })
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Fantasy'
  }, [books])

  useEffect(() => {
    if (view !== 'discover' || discoverSeed === recommendationGenre || discoverTerm.trim()) return
    let cancelled = false
    setDiscoverLoading(true)
    setDiscoverError('')
    searchOpenLibrary(recommendationGenre)
      .then((results) => {
        if (cancelled) return
        setDiscoverResults(results.filter((result) => !isAlreadyInLibrary(result, books)))
        setDiscoverSeed(recommendationGenre)
      })
      .catch(() => {
        if (!cancelled) setDiscoverError('Recommendations are taking a break. Try a search instead.')
      })
      .finally(() => {
        if (!cancelled) setDiscoverLoading(false)
      })
    return () => { cancelled = true }
  }, [view, recommendationGenre, discoverSeed, discoverTerm, books])

  function updateBook(id: string, patch: Partial<Book>) {
    setBooks((current) => current.map((book) => (book.id === id ? { ...book, ...patch } : book)))
  }

  function reorderBook(draggedId: string, targetId: string | null, targetStatus: ReadingStatus) {
    setBooks((current) => {
      if (draggedId === targetId) return current
      const dragged = current.find((book) => book.id === draggedId)
      if (!dragged) return current

      const remaining = current.filter((book) => book.id !== draggedId)
      const movedBook = dragged.status === targetStatus ? dragged : { ...dragged, status: targetStatus }

      if (targetId) {
        const targetIndex = remaining.findIndex((book) => book.id === targetId)
        if (targetIndex >= 0) {
          remaining.splice(targetIndex, 0, movedBook)
          return remaining
        }
      }

      let insertIndex = remaining.length
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        if (remaining[index].status === targetStatus) {
          insertIndex = index + 1
          break
        }
      }
      remaining.splice(insertIndex, 0, movedBook)
      return remaining
    })
  }

  function addBook(result: BookSearchResult, options: AddBookOptions) {
    const duplicate = books.find(
      (book) => book.externalId === result.key || (book.isbn && result.isbn && book.isbn === result.isbn),
    )
    if (duplicate) {
      if (options.owned && !duplicate.owned) {
        updateBook(duplicate.id, { owned: true, format: options.format })
      }
      setSelectedBookId(duplicate.id)
      return
    }

    const colors = colorsFor(result.title)
    const newBook: Book = {
      id: crypto.randomUUID(),
      title: result.title,
      author: result.author,
      status: options.status,
      color: colors.color,
      accent: colors.accent,
      pages: result.pages || 0,
      genre: result.genre || 'Uncategorized',
      subjects: result.subjects,
      publisher: result.publisher,
      language: result.language,
      year: result.year || new Date().getFullYear(),
      coverUrl: result.coverUrl,
      isbn: result.isbn,
      externalId: result.key,
      source: 'openlibrary',
      owned: options.owned,
      ...(options.owned ? { format: options.format } : {}),
      ...(options.status === 'Currently Reading' ? { currentPage: 0 } : {}),
    }

    setBooks((current) => [...current, newBook])
    setSelectedBookId(newBook.id)
  }

  async function searchDiscover(event: FormEvent) {
    event.preventDefault()
    if (!discoverTerm.trim()) return
    setDiscoverLoading(true)
    setDiscoverError('')
    try {
      setDiscoverResults(await searchOpenLibrary(discoverTerm))
      setDiscoverSeed('')
    } catch (searchError) {
      setDiscoverError(searchError instanceof Error ? searchError.message : 'Could not search for books.')
    } finally {
      setDiscoverLoading(false)
    }
  }

  function openBook(id: string) {
    setSelectedBookId(id)
    setView('shelf')
  }

  const titles: Record<View, { eyebrow: string; title: string }> = {
    shelf: { eyebrow: 'MY LIBRARY', title: 'My Bookshelf' },
    collection: { eyebrow: 'OWNED BOOKS', title: 'My Collection' },
    discover: { eyebrow: 'FIND YOUR NEXT READ', title: 'Discover' },
  }

  return (
    <main className={`app ${largeText ? 'large-text' : ''} ${highContrast ? 'high-contrast' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><BookOpen size={28} /><span>Shelfie</span></div>
        <p className="tagline">Your stories. Your shelf.</p>

        <nav>
          <button className={view === 'shelf' ? 'nav-active' : ''} onClick={() => setView('shelf')}><Library size={18} /> My Bookshelf</button>
          <button className={view === 'collection' ? 'nav-active' : ''} onClick={() => setView('collection')}><Archive size={18} /> My Collection</button>
          <button className={view === 'discover' ? 'nav-active' : ''} onClick={() => setView('discover')}><Compass size={18} /> Discover</button>
          <button><Users size={18} /> Friends <span className="nav-soon">soon</span></button>
          <button><Trophy size={18} /> Trophy Case <span className="nav-soon">soon</span></button>
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
            <p className="eyebrow">{titles[view].eyebrow}</p>
            <h1>{titles[view].title}</h1>
          </div>
          <div className="header-actions">
            {view === 'shelf' && (
              <label className="search-box">
                <Search size={18} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your shelf..." />
              </label>
            )}
            <button className="primary" onClick={() => setAddOpen(true)}><BookPlus size={18} /> Add Book</button>
          </div>
        </header>

        {view === 'shelf' && (
          <ShelfView
            books={books}
            filtered={filtered}
            selectedBook={selectedBook}
            glowFocus={glowFocus}
            onSelect={setSelectedBookId}
            onUpdate={updateBook}
            onReorder={reorderBook}
          />
        )}

        {view === 'collection' && <CollectionView books={books} onOpen={openBook} onAdd={() => setAddOpen(true)} />}

        {view === 'discover' && (
          <DiscoverView
            books={books}
            genre={recommendationGenre}
            term={discoverTerm}
            results={discoverResults}
            loading={discoverLoading}
            error={discoverError}
            onTermChange={setDiscoverTerm}
            onSearch={searchDiscover}
            onAdd={(result) => addBook(result, { status: 'Want to Read', owned: false, format: 'Hardcover' })}
          />
        )}
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

function ShelfView({
  books,
  filtered,
  selectedBook,
  glowFocus,
  onSelect,
  onUpdate,
  onReorder,
}: {
  books: Book[]
  filtered: Book[]
  selectedBook?: Book
  glowFocus: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<Book>) => void
  onReorder: (draggedId: string, targetId: string | null, targetStatus: ReadingStatus) => void
}) {
  const [draggedBookId, setDraggedBookId] = useState<string | null>(null)
  const [dragOverBookId, setDragOverBookId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<ReadingStatus | null>(null)
  const ownedCount = books.filter((book) => book.owned).length
  const collectionValue = books.reduce((sum, book) => sum + (book.owned ? book.estimatedValue ?? 0 : 0), 0)

  function clearDragState() {
    setDraggedBookId(null)
    setDragOverBookId(null)
    setDragOverStatus(null)
  }

  function startDrag(event: DragEvent<HTMLButtonElement>, book: Book) {
    setDraggedBookId(book.id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', book.id)
  }

  function getDraggedId(event: DragEvent<HTMLElement>) {
    return draggedBookId || event.dataTransfer.getData('text/plain')
  }

  function dropOnBook(event: DragEvent<HTMLButtonElement>, targetBook: Book, status: ReadingStatus) {
    event.preventDefault()
    event.stopPropagation()
    const draggedId = getDraggedId(event)
    if (draggedId) onReorder(draggedId, targetBook.id, status)
    clearDragState()
  }

  function dropOnShelf(event: DragEvent<HTMLDivElement>, status: ReadingStatus) {
    event.preventDefault()
    const draggedId = getDraggedId(event)
    if (draggedId) onReorder(draggedId, null, status)
    clearDragState()
  }

  return (
    <>
      <div className="library-summary">
        <span><strong>{books.length}</strong> books on your shelf</span>
        <span><strong>{books.filter((book) => book.status === 'Read').length}</strong> finished</span>
        <span><strong>{books.filter((book) => book.status === 'Currently Reading').length}</strong> currently reading</span>
        <span><strong>{ownedCount}</strong> owned</span>
        {collectionValue > 0 && <span><strong>{money(collectionValue)}</strong> est. collection</span>}
      </div>

      <div className="shelf-drag-hint">Grab a book to rearrange it. Drop it on another shelf to change its reading status.</div>

      <div className="layout">
        <section className="bookcase" aria-label="Virtual bookshelf">
          <div className="bookcase-frame">
            {shelfOrder.map((status) => {
              const shelfBooks = filtered.filter((book) => book.status === status)
              return (
                <div className={`shelf-row ${dragOverStatus === status ? 'drag-over-shelf' : ''}`} key={status}>
                  <div className="shelf-label"><span>{status}</span><span>{shelfBooks.length}</span></div>
                  <div
                    className={`books ${dragOverStatus === status && !dragOverBookId ? 'shelf-drop-active' : ''}`}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDragOverStatus(status)
                      setDragOverBookId(null)
                    }}
                    onDrop={(event) => dropOnShelf(event, status)}
                  >
                    {shelfBooks.length === 0 && <div className="empty-shelf">Drop a book here.</div>}
                    {shelfBooks.map((book, index) => (
                      <button
                        className={`book-spine ${selectedBook?.id === book.id ? 'selected' : ''} ${glowFocus ? 'glow-focus' : ''} ${draggedBookId === book.id ? 'dragging' : ''} ${dragOverBookId === book.id && draggedBookId !== book.id ? 'drop-target' : ''}`}
                        style={{
                          '--book-color': book.color,
                          '--book-accent': book.accent,
                          '--book-height': `${188 + (index % 4) * 13}px`,
                          '--book-width': `${82 + ((index * 11) % 28)}px`,
                        } as CSSProperties}
                        key={book.id}
                        draggable
                        onDragStart={(event) => startDrag(event, book)}
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          event.dataTransfer.dropEffect = 'move'
                          setDragOverStatus(status)
                          setDragOverBookId(book.id)
                        }}
                        onDrop={(event) => dropOnBook(event, book, status)}
                        onDragEnd={clearDragState}
                        onClick={() => onSelect(book.id)}
                        aria-label={`${book.title} by ${book.author}. Drag to rearrange.`}
                        title="Drag to rearrange"
                      >
                        {book.owned && <span className="owned-dot" title="Owned" />}
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

        {selectedBook && <BookDetails book={selectedBook} onUpdate={onUpdate} />}
      </div>
    </>
  )
}

function BookDetails({ book, onUpdate }: { book: Book; onUpdate: (id: string, patch: Partial<Book>) => void }) {
  return (
    <aside className="details-panel">
      <div className="detail-header">
        {book.coverUrl ? (
          <img className="mini-cover cover-image" src={book.coverUrl} alt={`Cover of ${book.title}`} />
        ) : (
          <div className="mini-cover" style={{ background: `linear-gradient(160deg, ${book.color}, #16100b)` }}>
            <span>{book.title}</span>
          </div>
        )}
        <div>
          <div className="detail-badges">
            <p className="status-pill">{book.status}</p>
            {book.owned && <p className="owned-pill">Owned</p>}
          </div>
          <h2>{book.title}</h2>
          <p className="author">{book.author}</p>
          <div className="meta-row"><span>{book.genre}</span><span>{book.year}</span>{book.format && <span>{book.format}</span>}</div>
        </div>
      </div>

      <ShelfAppearanceControl book={book} onUpdate={onUpdate} />

      {book.status === 'Currently Reading' && book.pages > 0 && (
        <div className="detail-card">
          <div className="card-heading"><span>Reading progress</span><strong>{Math.round(((book.currentPage || 0) / book.pages) * 100)}%</strong></div>
          <div className="progress"><span style={{ width: `${((book.currentPage || 0) / book.pages) * 100}%` }} /></div>
          <p>{book.currentPage || 0} of {book.pages} pages</p>
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-card">
          <div className="card-heading"><span>My rating</span><Star size={18} /></div>
          <strong className="rating">{book.rating ?? '—'}</strong>
          <p>{book.rating ? 'A keeper.' : 'Not rated yet'}</p>
        </div>
        <div className="detail-card">
          <div className="card-heading"><span>Book length</span><Sparkles size={18} /></div>
          <strong>{book.pages || '—'}</strong>
          <p>{book.pages ? 'pages' : 'page count unavailable'}</p>
        </div>
      </div>

      <div className="detail-card ownership-card">
        <div className="card-heading"><span>My copy</span><Archive size={18} /></div>
        <button
          type="button"
          className={book.owned ? 'ownership-toggle owned' : 'ownership-toggle'}
          onClick={() => onUpdate(book.id, { owned: !book.owned, ...(book.owned ? {} : { format: book.format ?? 'Hardcover' }) })}
        >
          {book.owned ? <><Check size={17} /> In my collection</> : <><BookPlus size={17} /> Mark as owned</>}
        </button>
        {book.owned && (
          <div className="ownership-fields">
            <label>
              <span>Format</span>
              <select value={book.format ?? 'Hardcover'} onChange={(event) => onUpdate(book.id, { format: event.target.value as BookFormat })}>
                {bookFormats.map((format) => <option key={format}>{format}</option>)}
              </select>
            </label>
            <label>
              <span>Estimated value</span>
              <div className="money-input"><DollarSign size={15} /><input type="number" min="0" step="0.01" value={book.estimatedValue ?? ''} placeholder="0.00" onChange={(event) => onUpdate(book.id, { estimatedValue: event.target.value === '' ? undefined : Number(event.target.value) })} /></div>
            </label>
          </div>
        )}
      </div>

      <div className="detail-card journal-card">
        <div className="card-heading"><span>Journal</span><ChevronRight size={18} /></div>
        <p>{book.note ?? 'Add thoughts, favorite quotes, characters, predictions, moods, or a full review whenever you want.'}</p>
        <button className="secondary">Open book journal</button>
      </div>
    </aside>
  )
}

function CollectionView({ books, onOpen, onAdd }: { books: Book[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const owned = books.filter((book) => book.owned)
  const estimatedValue = owned.reduce((sum, book) => sum + (book.estimatedValue ?? 0), 0)
  const amountSpent = owned.reduce((sum, book) => sum + (book.purchasePrice ?? 0), 0)
  const unread = owned.filter((book) => book.status !== 'Read').length
  const collectible = owned.filter((book) => book.signed || book.firstEdition || book.specialEdition).length
  const valued = owned.filter((book) => (book.estimatedValue ?? 0) > 0)
  const mostValuable = [...valued].sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0))[0]

  return (
    <div className="collection-page">
      <section className="collection-hero">
        <div>
          <p className="eyebrow">YOUR HOME LIBRARY</p>
          <h2>A collection worth keeping track of.</h2>
          <p>Ownership, editions, condition and value live here without changing where a book sits in your reading journey.</p>
        </div>
        <div className="collection-value"><span>Estimated collection value</span><strong>{money(estimatedValue)}</strong><small>Approximate · user/API estimates later</small></div>
      </section>

      <section className="metric-grid">
        <Metric icon={<Archive />} label="Books owned" value={String(owned.length)} detail={`${unread} still waiting to be read`} />
        <Metric icon={<DollarSign />} label="Amount recorded spent" value={money(amountSpent)} detail="Only books with a purchase price" />
        <Metric icon={<Sparkles />} label="Collectible copies" value={String(collectible)} detail="Special, signed or first editions" />
        <Metric icon={<BarChart3 />} label="Most valuable" value={mostValuable ? money(mostValuable.estimatedValue) : '—'} detail={mostValuable?.title ?? 'Add estimates as you go'} />
      </section>

      <div className="section-heading">
        <div><p className="eyebrow">OWNED</p><h2>Your collection</h2></div>
        <span>{owned.length} books</span>
      </div>

      {owned.length === 0 ? (
        <div className="empty-collection"><Archive size={42} /><h3>No owned books marked yet</h3><p>Add a book or mark a book on your shelf as owned.</p><button className="primary" onClick={onAdd}><BookPlus size={18} /> Add a book</button></div>
      ) : (
        <div className="collection-grid">
          {owned.map((book) => (
            <button className="collection-book" key={book.id} onClick={() => onOpen(book.id)}>
              <div className="collection-cover" style={{ background: `linear-gradient(155deg, ${book.color}, #15100c)` }}>
                {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span>{book.title}</span>}
                {(book.specialEdition || book.signed || book.firstEdition) && <span className="collectible-mark">✦</span>}
              </div>
              <div className="collection-book-copy">
                <strong>{book.title}</strong>
                <span>{book.author}</span>
                <div className="collection-book-meta"><span>{book.format ?? 'Format not set'}</span><b>{money(book.estimatedValue)}</b></div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <article className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function DiscoverView({
  books,
  genre,
  term,
  results,
  loading,
  error,
  onTermChange,
  onSearch,
  onAdd,
}: {
  books: Book[]
  genre: string
  term: string
  results: BookSearchResult[]
  loading: boolean
  error: string
  onTermChange: (value: string) => void
  onSearch: (event: FormEvent) => void
  onAdd: (result: BookSearchResult) => void
}) {
  return (
    <div className="discover-page">
      <section className="discover-hero">
        <div>
          <p className="eyebrow">SMARTER AS YOUR SHELF GROWS</p>
          <h2>Find something that feels like you.</h2>
          <p>For now Shelfie uses your highly rated and finished genres as a simple recommendation signal. Later this can blend ratings, moods, authors, series, DNFs and recommendation feedback.</p>
        </div>
        <div className="taste-card"><Heart size={22} /><span>Current taste signal</span><strong>{genre}</strong><small>Based only on your local demo library</small></div>
      </section>

      <form className="discover-search" onSubmit={onSearch}>
        <label className="search-box"><Search size={20} /><input value={term} onChange={(event) => onTermChange(event.target.value)} placeholder="Browse by title, author, ISBN, genre..." /></label>
        <button className="primary" disabled={loading} type="submit">{loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />} Browse</button>
      </form>

      <div className="section-heading discover-heading">
        <div><p className="eyebrow">FOR YOU</p><h2>{term ? `Results for “${term}”` : `Because you enjoy ${genre}`}</h2></div>
        <span>Powered by Open Library</span>
      </div>

      {error && <div className="discover-message">{error}</div>}
      {loading && <div className="discover-message"><LoaderCircle className="spin" /> Finding books…</div>}
      {!loading && !error && (
        <div className="discover-grid">
          {results.slice(0, 12).map((result) => {
            const added = isAlreadyInLibrary(result, books)
            return (
              <article className="discover-book" key={result.key}>
                <div className="discover-cover">{result.coverUrl ? <img src={result.coverUrl} alt="" /> : <BookOpen size={34} />}</div>
                <div className="discover-copy">
                  <strong>{result.title}</strong>
                  <span>{result.author}</span>
                  <small>{[result.year, result.genre, result.pages ? `${result.pages} pages` : ''].filter(Boolean).join(' · ')}</small>
                </div>
                <button className={added ? 'added-button' : 'add-result-button'} disabled={added} onClick={() => onAdd(result)}>{added ? <><Check size={16} /> On shelf</> : <><BookPlus size={16} /> Want to Read</>}</button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

const bookFormats: BookFormat[] = ['Hardcover', 'Paperback', 'Mass Market', 'Ebook', 'Audiobook', 'Other']

function AddBookModal({
  books,
  onClose,
  onAdd,
}: {
  books: Book[]
  onClose: () => void
  onAdd: (book: BookSearchResult, options: AddBookOptions) => void
}) {
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<ReadingStatus>('Want to Read')
  const [owned, setOwned] = useState(false)
  const [format, setFormat] = useState<BookFormat>('Hardcover')
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
          <div><p className="eyebrow">BUILD YOUR SHELF</p><h2>Add a Book</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <form className="book-search-form" onSubmit={submit}>
          <label className="search-box modal-search"><Search size={20} /><input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search title, author, or ISBN..." /></label>
          <button className="primary" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />} Search</button>
        </form>

        <div className="add-options-row">
          <div className="status-picker" aria-label="Shelf to add books to">
            {shelfOrder.map((option) => (
              <button className={status === option ? 'status-option active' : 'status-option'} onClick={() => setStatus(option)} key={option} type="button">{option}</button>
            ))}
          </div>
          <label className="owned-check"><input type="checkbox" checked={owned} onChange={(event) => setOwned(event.target.checked)} /><span><Archive size={16} /> I own this book</span></label>
          {owned && <select className="format-select" value={format} onChange={(event) => setFormat(event.target.value as BookFormat)}>{bookFormats.map((option) => <option key={option}>{option}</option>)}</select>}
        </div>

        {error && <div className="search-message error-message">{error}</div>}
        {!loading && !error && results.length === 0 && (
          <div className="search-message"><BookOpen size={32} /><strong>Search millions of books</strong><span>Open Library fills in metadata now; Shelfie will keep the personal reading and ownership details separate.</span></div>
        )}

        <div className="search-results">
          {results.map((result) => {
            const alreadyAdded = isAlreadyInLibrary(result, books)
            return (
              <article className="search-result" key={result.key}>
                <div className="result-cover">{result.coverUrl ? <img src={result.coverUrl} alt="" /> : <BookOpen size={28} />}</div>
                <div className="result-copy"><strong>{result.title}</strong><span>{result.author}</span><small>{[result.year, result.pages ? `${result.pages} pages` : '', result.isbn ? `ISBN ${result.isbn}` : ''].filter(Boolean).join(' · ')}</small></div>
                <button className={alreadyAdded ? 'added-button' : 'add-result-button'} disabled={alreadyAdded} onClick={() => onAdd(result, { status, owned, format })} type="button">{alreadyAdded ? <><Check size={17} /> Added</> : <><BookPlus size={17} /> Add</>}</button>
              </article>
            )
          })}
        </div>

        <div className="manual-hint">Can't find a book? Manual entry, link import and barcode scanning are planned.</div>
      </section>
    </div>
  )
}

function isAlreadyInLibrary(result: BookSearchResult, books: Book[]) {
  return books.some((book) => book.externalId === result.key || (book.isbn && result.isbn && book.isbn === result.isbn))
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
