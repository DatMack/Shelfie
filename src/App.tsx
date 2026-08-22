import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  BarChart3,
  BookOpen,
  BookPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  DollarSign,
  ExternalLink,
  Heart,
  Library,
  LoaderCircle,
  Search,
  Settings2,
  ShoppingCart,
  Sparkles,
  Star,
  Trophy,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { FreeShelfView } from './components/FreeShelfView'
import { ProfileDrawer } from './components/ProfileDrawer'
import { SettingsPage } from './components/SettingsPage'
import { ShelfAppearanceControl } from './components/ShelfAppearanceControl'
import { WelcomeTour } from './components/WelcomeTour'
import { Book, BookFormat, ReadingStatus, sampleBooks } from './data/books'
import { nextBookFarewell } from './data/bookFarewells'
import { loadShelfCountForStyle, loadShelfStyle, saveShelfCountForStyle } from './lib/customizationRuntime'
import {
  addCatalogBookToMyShelf,
  bookPatchToDatabase,
  deleteMyBook,
  findOrCreateCatalogBook,
  loadTourCompleted,
  loadMyLibrary,
  markTourCompleted,
  mapLibraryRows,
  saveShelfOrder,
  updateMyBook,
} from './lib/shelfieData'
import { enrichWithGoogleBooks } from './services/googleBooks'
import { searchEverywhere } from './services/bookSearch'
import { BookSearchResult } from './services/openLibrary'

const readingStatuses: ReadingStatus[] = ['Currently Reading', 'Want to Read', 'Read', 'DNF']
const storageKey = 'shelfie-books-v1'
const detailsDisplayKey = 'shelfie-book-details-display-v1'
const shelfCountKey = 'shelfie-shelf-count-v1'
const tourKey = 'shelfie-walkthrough-seen-v1'
const largeTextKey = 'shelfie-large-text-v1'
const highContrastKey = 'shelfie-high-contrast-v1'
const glowFocusKey = 'shelfie-glow-focus-v1'
const palette = [
  ['#6b4327', '#e3b064'],
  ['#26384c', '#ddad66'],
  ['#35563d', '#f3c66c'],
  ['#6c342f', '#e6b96d'],
  ['#544c34', '#d3b86a'],
  ['#694027', '#f0bb6e'],
  ['#273f50', '#e5c88e'],
]

type View = 'shelf' | 'collection' | 'discover' | 'settings'
type AddBookOptions = { status: ReadingStatus; owned: boolean; format: BookFormat }
type BookDetailsDisplay = 'side' | 'card'

function defaultShelfForStatus(status: ReadingStatus) {
  if (status === 'Read') return 1
  if (status === 'Want to Read' || status === 'DNF') return 2
  return 0
}

function loadLibrary(): Book[] {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = JSON.parse(saved) as Book[]
      return parsed.map((book) => {
        const starter = sampleBooks.find((sample) => sample.id === book.id || sample.title === book.title)
        const merged = starter
          ? {
              ...starter,
              ...book,
              owned: book.owned ?? starter.owned,
              format: book.format ?? starter.format,
              condition: book.condition ?? starter.condition,
              purchasePrice: book.purchasePrice ?? starter.purchasePrice,
              estimatedValue: book.estimatedValue ?? starter.estimatedValue,
              subjects: book.subjects ?? starter.subjects,
            }
          : book

        return {
          ...merged,
          shelfIndex: Number.isInteger(merged.shelfIndex) ? merged.shelfIndex : defaultShelfForStatus(merged.status),
        }
      })
    }
  } catch {
    // A fresh sample library is a safe fallback if browser storage is unavailable.
  }
  return sampleBooks.map((book) => ({ ...book, shelfIndex: book.shelfIndex ?? defaultShelfForStatus(book.status) }))
}

function loadDetailsDisplay(): BookDetailsDisplay {
  try {
    return localStorage.getItem(detailsDisplayKey) === 'card' ? 'card' : 'side'
  } catch {
    return 'side'
  }
}

function loadShelfCount() {
  let fallback = 3
  try {
    const saved = Number(localStorage.getItem(shelfCountKey))
    if (Number.isInteger(saved) && saved >= 2 && saved <= 6) fallback = saved
  } catch {
    // Use the cozy three-shelf default.
  }
  return loadShelfCountForStyle(loadShelfStyle(), fallback)
}

function loadBoolean(key: string, fallback: boolean) {
  try {
    const saved = localStorage.getItem(key)
    if (saved === 'true') return true
    if (saved === 'false') return false
  } catch {
    // Use the supplied default.
  }
  return fallback
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

export function App({ userId, userEmail, fallbackName, fallbackAvatar, onSignOut }: { userId: string; userEmail?: string; fallbackName?: string; fallbackAvatar?: string; onSignOut?: () => void | Promise<void> }) {
  const [books, setBooks] = useState<Book[]>([])
  const [libraryReady, setLibraryReady] = useState(false)
  const [selectedBookId, setSelectedBookId] = useState(sampleBooks[2].id)
  const [detailsDisplay, setDetailsDisplay] = useState<BookDetailsDisplay>(loadDetailsDisplay)
  const [detailCardOpen, setDetailCardOpen] = useState(false)
  const [shelfCount, setShelfCount] = useState(loadShelfCount)
  const [tourOpen, setTourOpen] = useState(false)
  const [view, setView] = useState<View>('shelf')
  const [largeText, setLargeText] = useState(() => loadBoolean(largeTextKey, false))
  const [glowFocus, setGlowFocus] = useState(() => loadBoolean(glowFocusKey, true))
  const [highContrast, setHighContrast] = useState(() => loadBoolean(highContrastKey, false))
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [discoverTerm, setDiscoverTerm] = useState('')
  const [discoverResults, setDiscoverResults] = useState<BookSearchResult[]>([])
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverError, setDiscoverError] = useState('')
  const [discoverSeed, setDiscoverSeed] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const [removingBook, setRemovingBook] = useState<Book | null>(null)
  const [removalMessage, setRemovalMessage] = useState('')
  const [removalBusy, setRemovalBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    async function connectLibrary() {
      const remoteRows = await loadMyLibrary(userId)
      if (cancelled) return
      setBooks(mapLibraryRows(remoteRows))
      if (!cancelled) setLibraryReady(true)
    }
    connectLibrary().catch((error) => {
      console.error('Shelfie could not load the Supabase library.', error)
      if (!cancelled) setLibraryReady(true)
    })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    let cancelled = false
    loadTourCompleted(userId)
      .then((completed) => {
        if (!cancelled && !completed) setTourOpen(true)
      })
      .catch(() => {
        try {
          if (!cancelled && localStorage.getItem(`${tourKey}:${userId}`) !== 'done') setTourOpen(true)
        } catch {
          if (!cancelled) setTourOpen(true)
        }
      })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (libraryReady) localStorage.setItem(`${storageKey}:${userId}`, JSON.stringify(books))
  }, [books, libraryReady, userId])

  useEffect(() => {
    localStorage.setItem(detailsDisplayKey, detailsDisplay)
    if (detailsDisplay === 'side') setDetailCardOpen(false)
  }, [detailsDisplay])

  useEffect(() => {
    localStorage.setItem(shelfCountKey, String(shelfCount))
  }, [shelfCount])

  useEffect(() => {
    localStorage.setItem(largeTextKey, String(largeText))
    localStorage.setItem(highContrastKey, String(highContrast))
    localStorage.setItem(glowFocusKey, String(glowFocus))
  }, [largeText, highContrast, glowFocus])

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
    searchEverywhere(recommendationGenre, (results) => {
      if (!cancelled) {
        setDiscoverResults(results.filter((result) => !isAlreadyInLibrary(result, books)))
        setDiscoverLoading(false)
      }
    })
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
    const databasePatch = bookPatchToDatabase(patch)
    if (Object.keys(databasePatch).length > 0) {
      void updateMyBook(id, databasePatch).catch((error) => console.error('Could not save the book update.', error))
    }
  }

  function requestRemoveBook(book: Book) {
    setRemovalMessage(nextBookFarewell())
    setDetailCardOpen(false)
    setRemovingBook(book)
  }

  async function confirmRemoveBook() {
    if (!removingBook) return
    setRemovalBusy(true)
    try {
      await deleteMyBook(removingBook.id)
      setBooks((current) => current.filter((book) => book.id !== removingBook.id))
      setSelectedBookId((current) => current === removingBook.id ? '' : current)
      setRemovingBook(null)
      setNotice(`${removingBook.title} left the shelf. ${removalMessage}`)
    } catch (error) {
      console.error('Could not remove the book.', error)
      setNotice('That book clung to the shelf. It was not removed—please try again.')
    } finally {
      setRemovalBusy(false)
    }
  }

  function openSettingsSection(sectionId?: string) {
    setView('settings')
    if (sectionId) requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function selectShelfBook(id: string) {
    setSelectedBookId(id)
    if (detailsDisplay === 'card') setDetailCardOpen(true)
  }

  function reorderBook(draggedId: string, targetId: string | null, targetShelfIndex: number) {
    setBooks((current) => {
      if (draggedId === targetId) return current
      const dragged = current.find((book) => book.id === draggedId)
      if (!dragged) return current

      const remaining = current.filter((book) => book.id !== draggedId)
      const movedBook = { ...dragged, shelfIndex: targetShelfIndex }

      if (targetId) {
        const targetIndex = remaining.findIndex((book) => book.id === targetId)
        if (targetIndex >= 0) {
          remaining.splice(targetIndex, 0, movedBook)
          void persistShelfOrder(remaining)
          return remaining
        }
      }

      let insertIndex = remaining.length
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        if ((remaining[index].shelfIndex ?? 0) === targetShelfIndex) {
          insertIndex = index + 1
          break
        }
      }
      remaining.splice(insertIndex, 0, movedBook)
      void persistShelfOrder(remaining)
      return remaining
    })
  }

  async function persistShelfOrder(nextBooks: Book[]) {
    await saveShelfOrder(nextBooks.map((book, index) => ({
      userBookId: book.id,
      shelfIndex: book.shelfIndex ?? 0,
      shelfColumn: 0,
      shelfPosition: index,
    })))
  }

  function changeShelfCount(nextCount: number) {
    const clamped = Math.max(2, Math.min(6, nextCount))
    setShelfCount(clamped)
    saveShelfCountForStyle(loadShelfStyle(), clamped)
  }

  function closeTour() {
    try {
      localStorage.setItem(`${tourKey}:${userId}`, 'done')
    } catch {
      // The walkthrough can still close if browser storage is unavailable.
    }
    void markTourCompleted(userId).catch((error) => console.error('Could not save walkthrough completion.', error))
    setTourOpen(false)
  }

  async function addBook(result: BookSearchResult, options: AddBookOptions) {
    const duplicate = books.find(
      (book) => book.externalId === result.key || (book.isbn && result.isbn && book.isbn === result.isbn),
    )
    if (duplicate) {
      if (options.owned && !duplicate.owned) {
        updateBook(duplicate.id, { owned: true, format: options.format })
      }
      setSelectedBookId(duplicate.id)
      setNotice(options.owned ? `${duplicate.title} is now marked as owned.` : `${duplicate.title} is already in your library.`)
      return
    }

    const colors = colorsFor(result.title)
    const catalog = await findOrCreateCatalogBook(result)
    const userBook = await addCatalogBookToMyShelf({ userId, bookId: catalog.id, ...options })
    const newBook: Book = {
      id: userBook.id,
      title: result.title,
      author: result.author,
      status: options.status,
      shelfIndex: 0,
      color: colors.color,
      accent: colors.accent,
      pages: result.pages || 0,
      genre: result.genre || 'Uncategorized',
      subjects: result.subjects,
      publisher: result.publisher,
      description: result.description,
      language: result.language,
      year: result.year || new Date().getFullYear(),
      coverUrl: result.coverUrl,
      isbn: result.isbn,
      externalId: result.key,
      source: result.source ?? 'openlibrary',
      owned: options.owned,
      ...(options.owned ? { format: options.format } : {}),
      ...(options.status === 'Currently Reading' ? { currentPage: 0 } : {}),
    }

    setBooks((current) => [...current, newBook])
    setSelectedBookId(newBook.id)
    setNotice(`${newBook.title} was added to ${options.owned ? 'your collection' : 'Want to Read'}.`)
  }

  async function searchDiscover(event: FormEvent) {
    event.preventDefault()
    if (!discoverTerm.trim()) return
    setDiscoverLoading(true)
    setDiscoverError('')
    try {
      const results = await searchEverywhere(discoverTerm, (partial) => {
        setDiscoverResults(partial)
        setDiscoverLoading(false)
      })
      setDiscoverResults(results)
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
    if (detailsDisplay === 'card') setDetailCardOpen(true)
  }

  const titles: Record<View, { eyebrow: string; title: string }> = {
    shelf: { eyebrow: 'MY LIBRARY', title: 'My Bookshelf' },
    collection: { eyebrow: 'OWNED BOOKS', title: 'My Collection' },
    discover: { eyebrow: 'FIND YOUR NEXT READ', title: 'Discover' },
    settings: { eyebrow: 'SHELFIE', title: 'Settings' },
  }

  return (
    <main className={`app ${largeText ? 'large-text' : ''} ${highContrast ? 'high-contrast' : ''}`}>
      <aside className={profileOpen ? 'sidebar profile-open' : 'sidebar'}>
        <div className="brand"><BookOpen size={28} /><span>Shelfie</span></div>
        <p className="tagline">Your stories. Your shelf.</p>

        <nav>
          <button className={view === 'shelf' ? 'nav-active' : ''} onClick={() => setView('shelf')}><Library size={18} /> My Bookshelf</button>
          <button className={view === 'collection' ? 'nav-active' : ''} onClick={() => setView('collection')}><Archive size={18} /> My Collection</button>
          <button className={view === 'discover' ? 'nav-active' : ''} onClick={() => setView('discover')}><Compass size={18} /> Discover</button>
          <button><Users size={18} /> Friends <span className="nav-soon">soon</span></button>
          <button><Trophy size={18} /> Trophy Case <span className="nav-soon">soon</span></button>
          <button className={view === 'settings' ? 'nav-active settings-nav-button' : 'settings-nav-button'} onClick={() => { openSettingsSection(); setSettingsMenuOpen((current) => !current) }}><Settings2 size={18} /> Settings <ChevronDown className={settingsMenuOpen ? 'settings-menu-chevron open' : 'settings-menu-chevron'} size={15} /></button>
          <div className={settingsMenuOpen ? 'settings-section-menu open' : 'settings-section-menu'}>
            <button onClick={() => openSettingsSection('settings-layout')}>Bookshelf layout</button>
            <button onClick={() => openSettingsSection('settings-finish')}>Material & finish</button>
            <button onClick={() => openSettingsSection('settings-theme')}>Color profile</button>
            <button onClick={() => openSettingsSection('settings-accessibility')}>Accessibility</button>
            <button onClick={() => openSettingsSection('settings-book-details')}>Book details</button>
            <button onClick={() => openSettingsSection('settings-help')}>Help</button>
          </div>
        </nav>
        <ProfileDrawer open={profileOpen} books={books} fallbackName={fallbackName} userEmail={userEmail} fallbackAvatar={fallbackAvatar} onToggle={() => setProfileOpen((current) => !current)} onSignOut={onSignOut} />
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
            {view !== 'settings' && <button className="primary" onClick={() => setAddOpen(true)}><BookPlus size={18} /> Add Book</button>}
          </div>
        </header>

        {view === 'shelf' && (
          <FreeShelfView
            books={books}
            searchFiltered={filtered}
            shelfCount={shelfCount}
            selectedBook={selectedBook}
            glowFocus={glowFocus}
            detailsDisplay={detailsDisplay}
            onSelect={selectShelfBook}
            onReorder={reorderBook}
            sidePanel={selectedBook ? <BookDetails book={selectedBook} onUpdate={updateBook} onRemove={requestRemoveBook} /> : undefined}
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
            onPurchased={(result) => addBook(result, { status: 'Want to Read', owned: true, format: 'Hardcover' })}
          />
        )}

        {view === 'settings' && (
          <SettingsPage
            largeText={largeText}
            highContrast={highContrast}
            glowFocus={glowFocus}
            detailsDisplay={detailsDisplay}
            shelfCount={shelfCount}
            onLargeTextChange={setLargeText}
            onHighContrastChange={setHighContrast}
            onGlowFocusChange={setGlowFocus}
            onDetailsDisplayChange={setDetailsDisplay}
            onShelfCountChange={changeShelfCount}
            onStartTour={() => setTourOpen(true)}
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

      {detailsDisplay === 'card' && detailCardOpen && selectedBook && (
        <BookDetailsModal book={selectedBook} onUpdate={updateBook} onRemove={requestRemoveBook} onClose={() => setDetailCardOpen(false)} />
      )}

      {removingBook && <RemoveBookDialog book={removingBook} message={removalMessage} busy={removalBusy} onCancel={() => setRemovingBook(null)} onConfirm={() => void confirmRemoveBook()} />}

      {tourOpen && <WelcomeTour onClose={closeTour} />}
      {notice && <div className="app-notice" role="status"><Check size={18} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X size={16} /></button></div>}
    </main>
  )
}

function BookDetails({
  book,
  onUpdate,
  onRemove,
  variant = 'side',
}: {
  book: Book
  onUpdate: (id: string, patch: Partial<Book>) => void
  onRemove: (book: Book) => void
  variant?: BookDetailsDisplay
}) {
  return (
    <aside className={`details-panel ${variant === 'card' ? 'details-card-mode' : ''}`}>
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

      <div className="detail-card reading-status-card">
        <div className="card-heading"><span>Reading status</span><Library size={18} /></div>
        <label>
          <span>Show this book under</span>
          <select value={book.status} onChange={(event) => onUpdate(book.id, { status: event.target.value as ReadingStatus })}>
            {readingStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <p>Status controls which reading-view shelves include this book. Each saved shelf style and reading view keeps its own arrangement.</p>
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

      <div className="detail-card remove-book-card">
        <div><strong>Remove this book</strong><p>Deletes it from your shelf, collection, and saved layouts.</p></div>
        <button type="button" onClick={() => onRemove(book)}><Trash2 size={17} /> Part ways</button>
      </div>
    </aside>
  )
}

function BookDetailsModal({
  book,
  onUpdate,
  onRemove,
  onClose,
}: {
  book: Book
  onUpdate: (id: string, patch: Partial<Book>) => void
  onRemove: (book: Book) => void
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop book-detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="book-detail-modal" role="dialog" aria-modal="true" aria-label={`Details for ${book.title}`}>
        <div className="modal-header">
          <div><p className="eyebrow">BOOK DETAILS</p><h2>{book.title}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close book details"><X /></button>
        </div>
        <BookDetails book={book} onUpdate={onUpdate} onRemove={onRemove} variant="card" />
      </section>
    </div>
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
  onPurchased,
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
  onPurchased: (result: BookSearchResult) => void
}) {
  const [selected, setSelected] = useState<BookSearchResult | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [resultLimit, setResultLimit] = useState(12)

  async function openResult(result: BookSearchResult) {
    setSelected(result)
    setDetailLoading(true)
    try { setSelected(await enrichWithGoogleBooks(result)) } finally { setDetailLoading(false) }
  }

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
        <div className="discover-result-controls"><span>Searching Google Books + Open Library</span><label>Show <select value={resultLimit} onChange={(event) => setResultLimit(Number(event.target.value))}><option value={12}>12</option><option value={24}>24</option><option value={48}>48</option><option value={1000}>All</option></select></label></div>
      </div>

      {error && <div className="discover-message">{error}</div>}
      {loading && <div className="discover-message"><LoaderCircle className="spin" /> Finding books…</div>}
      {!loading && !error && (
        <div className="discover-grid">
          {results.slice(0, resultLimit).map((result) => {
            const added = isAlreadyInLibrary(result, books)
            return (
              <article className="discover-book" key={result.key} onClick={() => void openResult(result)}>
                <div className="discover-cover">{result.coverUrl ? <ResilientCover book={result} alt="" /> : <BookOpen size={34} />}</div>
                <div className="discover-copy">
                  <strong>{result.title}</strong>
                  <span>{result.author}</span>
                  <small>{[result.year, result.genre, result.pages ? `${result.pages} pages` : ''].filter(Boolean).join(' · ')}</small>
                </div>
                <button className={added ? 'added-button' : 'add-result-button'} disabled={added} onClick={(event) => { event.stopPropagation(); onAdd(result) }}>{added ? <><Check size={16} /> On shelf</> : <><BookPlus size={16} /> Want to Read</>}</button>
              </article>
            )
          })}
        </div>
      )}
      {selected && (
        <DiscoverBookDialog
          book={selected}
          loading={detailLoading}
          added={isAlreadyInLibrary(selected, books)}
          onClose={() => setSelected(null)}
          onWantToRead={() => onAdd(selected)}
          onPurchased={() => { onPurchased(selected); setSelected(null) }}
        />
      )}
    </div>
  )
}

function DiscoverBookDialog({ book, loading, added, onClose, onWantToRead, onPurchased }: { book: BookSearchResult; loading: boolean; added: boolean; onClose: () => void; onWantToRead: () => void; onPurchased: () => void }) {
  const currency = book.currencyCode ?? 'USD'
  const price = book.retailPrice === undefined ? undefined : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(book.retailPrice)
  return (
    <div className="modal-backdrop discover-detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="discover-detail-modal" role="dialog" aria-modal="true" aria-label={`Discover ${book.title}`}>
        <button className="icon-button discover-close" type="button" onClick={onClose} aria-label="Close"><X /></button>
        <div className="discover-detail-cover">{book.largeCoverUrl || book.coverUrl ? <ResilientCover book={book} large alt={`Cover of ${book.title}`} /> : <BookOpen size={48} />}</div>
        <div className="discover-detail-copy">
          <p className="eyebrow">BOOK DETAILS</p>
          <h2>{book.title}</h2>
          {book.subtitle && <h3>{book.subtitle}</h3>}
          <p className="author">{book.author}</p>
          {loading ? <p className="discover-detail-loading"><LoaderCircle className="spin" size={18} /> Checking editions and availability…</p> : (
            <>
              <div className="discover-detail-meta"><span>{book.publishedDate ?? book.year ?? 'Year unknown'}</span><span>{book.publisher ?? 'Publisher unknown'}</span><span>{book.pages ? `${book.pages} pages` : 'Length unknown'}</span>{book.isbn && <span>ISBN {book.isbn}</span>}</div>
              <p className="discover-description">{book.description ?? 'A full description was not available for this edition.'}</p>
              {book.subjects?.length ? <div className="discover-tags">{book.subjects.slice(0, 6).map((subject) => <span key={subject}>{subject}</span>)}</div> : null}
              <div className="discover-purchase-panel">
                <div><small>AVAILABLE GOOGLE BOOKS PRICE</small><strong>{price ?? (book.saleability === 'FREE' ? 'Free' : 'No listed price')}</strong><span>{book.buyLink ? 'Price and availability may change at checkout.' : 'No direct purchase link was returned for this edition.'}</span></div>
                {book.buyLink && <a className="buy-book-button" href={book.buyLink} target="_blank" rel="noreferrer"><ShoppingCart size={18} /> Buy book <ExternalLink size={14} /></a>}
              </div>
            </>
          )}
          <div className="discover-detail-actions">
            <button className={added ? 'added-button' : 'secondary'} disabled={added} onClick={onWantToRead}>{added ? <><Check size={16} /> Already on shelf</> : <><BookPlus size={16} /> Want to Read</>}</button>
            <button className="primary" onClick={onPurchased}><Archive size={17} /> I bought this</button>
          </div>
          <small className="purchase-disclosure">Shelfie cannot see retailer checkout activity yet. Use “I bought this” after checkout to add the book to your collection.</small>
        </div>
      </section>
    </div>
  )
}

function ResilientCover({ book, alt, large = false }: { book: BookSearchResult; alt: string; large?: boolean }) {
  const urls = [...new Set([large ? book.largeCoverUrl : book.coverUrl, book.coverUrl, book.largeCoverUrl, ...(book.alternateCoverUrls ?? [])].filter((url): url is string => Boolean(url)))]
  const [index, setIndex] = useState(0)
  if (!urls[index]) return <BookOpen size={large ? 48 : 34} />
  return <img src={urls[index]} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setIndex((current) => current + 1)} />
}

function RemoveBookDialog({ book, message, busy, onCancel, onConfirm }: { book: Book; message: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-backdrop remove-book-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="remove-book-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-book-title">
        <div className="parting-book" style={{ '--parting-color': book.color, '--parting-accent': book.accent } as React.CSSProperties}><span>{book.title}</span></div>
        <p className="eyebrow">A DIFFICULT GOODBYE</p>
        <h2 id="remove-book-title">Remove “{book.title}”?</h2>
        <p className="parting-message">{message}</p>
        <p className="remove-explanation">This removes it from your bookshelf, collection, and saved layouts. Your shelf can heal, eventually.</p>
        <div className="remove-dialog-actions"><button className="secondary" type="button" onClick={onCancel}>Keep the book</button><button className="confirm-remove" type="button" disabled={busy} onClick={onConfirm}>{busy ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />} Remove anyway</button></div>
      </section>
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
  onAdd: (book: BookSearchResult, options: AddBookOptions) => Promise<void>
}) {
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<ReadingStatus>('Want to Read')
  const [owned, setOwned] = useState(false)
  const [format, setFormat] = useState<BookFormat>('Hardcover')
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [addingKey, setAddingKey] = useState('')
  const [success, setSuccess] = useState('')

  async function addResult(result: BookSearchResult) {
    setAddingKey(result.key)
    setError('')
    setSuccess('')
    try {
      await onAdd(result, { status, owned, format })
      setSuccess(`${result.title} was added successfully.`)
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'That book could not be added. Please try again.')
    } finally {
      setAddingKey('')
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!term.trim()) return
    setLoading(true)
    setError('')
    try {
      const books = await searchEverywhere(term, (partial) => {
        setResults(partial)
        setLoading(false)
      })
      setResults(books)
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
          <div className="status-picker" aria-label="Reading status for new book">
            {readingStatuses.map((option) => (
              <button className={status === option ? 'status-option active' : 'status-option'} onClick={() => setStatus(option)} key={option} type="button">{option}</button>
            ))}
          </div>
          <label className="owned-check"><input type="checkbox" checked={owned} onChange={(event) => setOwned(event.target.checked)} /><span><Archive size={16} /> I own this book</span></label>
          {owned && <select className="format-select" value={format} onChange={(event) => setFormat(event.target.value as BookFormat)}>{bookFormats.map((option) => <option key={option}>{option}</option>)}</select>}
        </div>

        {error && <div className="search-message error-message">{error}</div>}
        {success && <div className="search-message add-success"><Check size={20} /><strong>Book added</strong><span>{success}</span></div>}
        {!loading && !error && results.length === 0 && (
          <div className="search-message"><BookOpen size={32} /><strong>Search millions of books</strong><span>Open Library fills in metadata now; Shelfie will keep the personal reading and ownership details separate.</span></div>
        )}

        <div className="search-results">
          {results.map((result) => {
            const alreadyAdded = isAlreadyInLibrary(result, books)
            return (
              <article className="search-result" key={result.key}>
                <div className="result-cover">{result.coverUrl ? <ResilientCover book={result} alt="" /> : <BookOpen size={28} />}</div>
                <div className="result-copy"><strong>{result.title}</strong><span>{result.author}</span><small>{[result.year, result.pages ? `${result.pages} pages` : '', result.isbn ? `ISBN ${result.isbn}` : ''].filter(Boolean).join(' · ')}</small></div>
                <button className={alreadyAdded ? 'added-button' : 'add-result-button'} disabled={alreadyAdded || Boolean(addingKey)} onClick={() => void addResult(result)} type="button">{alreadyAdded ? <><Check size={17} /> Added</> : addingKey === result.key ? <><LoaderCircle className="spin" size={17} /> Adding…</> : <><BookPlus size={17} /> Add</>}</button>
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
