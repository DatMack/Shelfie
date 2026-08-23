import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  BarChart3,
  BookOpenCheck,
  BookOpen,
  BookPlus,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  DollarSign,
  ExternalLink,
  Heart,
  Library,
  LoaderCircle,
  NotebookPen,
  Search,
  Settings2,
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
import { AchievementsPage } from './components/AchievementsPage'
import { JournalPage } from './components/JournalPage'
import { ReadingLogPage } from './components/ReadingLogPage'
import { Book, BookFormat, ReadingStatus, sampleBooks } from './data/books'
import { nextBookFarewell } from './data/bookFarewells'
import { loadShelfCountForStyle, loadShelfStyle, saveShelfCountForStyle } from './lib/customizationRuntime'
import {
  addCatalogBookToMyShelf,
  bookPatchToDatabase,
  deleteMyBook,
  importLocalBook,
  loadTourCompleted,
  loadMyLibrary,
  markTourCompleted,
  mapLibraryRows,
  saveShelfOrder,
  uploadBookCover,
  uploadSignedBookProof,
  getSignedBookProofUrl,
  updateMyBook,
} from './lib/shelfieData'
import { enrichWithGoogleBooks } from './services/googleBooks'
import { discoverCategories, searchEverywhere, searchModernDiscoverFeed, type DiscoverCategoryId } from './services/bookSearch'
import { fetchLiveBookPrices, getBookBuyingOptions, type LiveBookPrice } from './services/bookBuyingOptions'
import { BookSearchResult, enrichWithOpenLibrary } from './services/openLibrary'

const readingStatuses: ReadingStatus[] = ['Currently Reading', 'Want to Read', 'Read']
const editableReadingStatuses: ReadingStatus[] = [...readingStatuses, 'DNF']

function readingStatusLabel(status: ReadingStatus) {
  return status === 'Want to Read' ? 'Wishlist' : status
}
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

type View = 'shelf' | 'collection' | 'discover' | 'reading-log' | 'journal' | 'achievements' | 'settings'
type AddBookOptions = {
  status: ReadingStatus
  owned: boolean
  format: BookFormat
  condition?: Book['condition']
  purchasePrice?: number
  estimatedValue?: number
  specialEdition?: boolean
  signed?: boolean
  firstEdition?: boolean
  gifted?: boolean
}
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

function loadCachedLibrary(userId: string): Book[] {
  try {
    const saved = localStorage.getItem(`${storageKey}:${userId}`)
    if (!saved) return []
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function libraryRestoreKey(userId: string) {
  return `shelfie-library-restore:${userId}`
}

function libraryRecoveryDoneKey(userId: string) {
  return `shelfie-library-recovery-v1:${userId}`
}

function needsLibraryRestore(userId: string) {
  try {
    return localStorage.getItem(libraryRestoreKey(userId)) === 'needed'
  } catch {
    return false
  }
}

function markLibraryRestore(userId: string, needed: boolean) {
  try {
    if (needed) localStorage.setItem(libraryRestoreKey(userId), 'needed')
    else localStorage.removeItem(libraryRestoreKey(userId))
  } catch {
    // The in-memory shelf remains usable if browser storage is unavailable.
  }
}

function libraryRecoveryDone(userId: string) {
  try {
    return localStorage.getItem(libraryRecoveryDoneKey(userId)) === 'done'
  } catch {
    return false
  }
}

function markLibraryRecoveryDone(userId: string) {
  try {
    localStorage.setItem(libraryRecoveryDoneKey(userId), 'done')
  } catch {
    // Recovery still succeeds even when the browser cannot persist this marker.
  }
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
  const [discoverCategory, setDiscoverCategory] = useState<DiscoverCategoryId>('for-you')
  const [discoverRefreshPage, setDiscoverRefreshPage] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const [removingBook, setRemovingBook] = useState<Book | null>(null)
  const [removalMessage, setRemovalMessage] = useState('')
  const [removalBusy, setRemovalBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [journalBookId, setJournalBookId] = useState<string | undefined>()
  const [engagementRefreshToken, setEngagementRefreshToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function connectLibrary() {
      const remoteRows = await loadMyLibrary(userId)
      if (cancelled) return

      const cached = loadCachedLibrary(userId)
      const restoreNeeded = needsLibraryRestore(userId)
      const firstRecoveryCheck = !libraryRecoveryDone(userId)
      if (cached.length > 0 && (restoreNeeded || (firstRecoveryCheck && remoteRows.length === 0))) {
        markLibraryRestore(userId, true)
        const restoreResults = await Promise.allSettled(
          cached.map((book) => importLocalBook(userId, book)),
        )
        const failedCount = restoreResults.filter((result) => result.status === 'rejected').length

        if (failedCount > 0) {
          setBooks(cached)
          setNotice(`Shelfie recovered your local shelf, but ${failedCount} ${failedCount === 1 ? 'book still needs' : 'books still need'} to sync. Refresh to retry safely.`)
          return
        }

        const restoredRows = await loadMyLibrary(userId)
        if (cancelled) return
        markLibraryRestore(userId, false)
        markLibraryRecoveryDone(userId)
        setBooks(mapLibraryRows(restoredRows))
        setNotice(`${restoredRows.length} ${restoredRows.length === 1 ? 'book was' : 'books were'} safely restored to your account.`)
        setLibraryReady(true)
        return
      }

      markLibraryRecoveryDone(userId)
      setBooks(mapLibraryRows(remoteRows))
      if (!cancelled) setLibraryReady(true)
    }
    connectLibrary().catch((error) => {
      console.error('Shelfie could not load the Supabase library.', error)
      if (!cancelled) {
        const cached = loadCachedLibrary(userId)
        setBooks(cached)
        setNotice(cached.length
          ? 'Supabase is taking a break, so Shelfie restored the last saved copy of your library.'
          : 'Shelfie could not load your library. Your saved books are still safe—please refresh and try again.')
        setLibraryReady(true)
      }
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
    if (view !== 'discover' || discoverTerm.trim()) return
    let cancelled = false
    setDiscoverLoading(true)
    setDiscoverError('')
    const timer = window.setTimeout(() => {
      searchModernDiscoverFeed(discoverCategory, recommendationGenre, discoverRefreshPage)
        .then((results) => {
          if (cancelled) return
          setDiscoverResults(results)
        })
        .catch(() => {
          if (!cancelled) setDiscoverError('Fresh recommendations are taking a break. Try a search instead.')
        })
        .finally(() => {
          if (!cancelled) setDiscoverLoading(false)
        })
    }, 240)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [view, recommendationGenre, discoverCategory, discoverRefreshPage, discoverTerm])

  function updateBook(id: string, patch: Partial<Book>) {
    const previous = books.find((book) => book.id === id)
    setBooks((current) => current.map((book) => (book.id === id ? { ...book, ...patch } : book)))
    const databasePatch = bookPatchToDatabase(patch)
    if (Object.keys(databasePatch).length > 0) {
      void updateMyBook(id, databasePatch)
        .then(() => {
          if (patch.rating !== undefined || patch.status !== undefined || patch.owned !== undefined || patch.favorite !== undefined || patch.spineDesign !== undefined || patch.customSpineUrl !== undefined || patch.showSpineTitle !== undefined || patch.spineTitleFont !== undefined || patch.spineTitleColor !== undefined) {
            setEngagementRefreshToken((current) => current + 1)
          }
        })
        .catch((error) => {
          console.error('Could not save the book update.', error)
          if (previous) {
            setBooks((current) => current.map((book) => {
              if (book.id !== id) return book
              const rollback: Partial<Book> = {}
              for (const key of Object.keys(patch) as Array<keyof Book>) {
                if (book[key] === patch[key]) (rollback as Record<string, unknown>)[key] = previous[key]
              }
              return { ...book, ...rollback }
            }))
          }
          setNotice('That change did not save, so Shelfie restored the previous value. Please try again.')
        })
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
    const enriched = result.source === 'manual' ? result : await enrichWithGoogleBooks(result)
    const duplicate = books.find(
      (book) => book.externalId === enriched.key || (book.isbn && enriched.isbn && book.isbn === enriched.isbn),
    )
    if (duplicate) {
      if (options.owned && !duplicate.owned) {
        updateBook(duplicate.id, { owned: true, format: options.format })
      }
      setSelectedBookId(duplicate.id)
      setNotice(options.owned ? `${duplicate.title} is now marked as owned.` : `${duplicate.title} is already in your library.`)
      return
    }

    const colors = colorsFor(enriched.title)
    const userBook = await addCatalogBookToMyShelf({ result: enriched, ...options })
    const ownershipPatch = bookPatchToDatabase({
      condition: options.condition,
      purchasePrice: options.purchasePrice,
      estimatedValue: options.estimatedValue,
      specialEdition: options.specialEdition,
      signed: options.signed,
      firstEdition: options.firstEdition,
      gifted: options.gifted,
    })
    if (Object.keys(ownershipPatch).length) await updateMyBook(userBook.id, ownershipPatch)
    const newBook: Book = {
      id: userBook.id,
      title: enriched.title,
      author: enriched.author,
      status: options.status,
      shelfIndex: 0,
      color: colors.color,
      accent: colors.accent,
      pages: enriched.pages || 0,
      genre: enriched.genre || 'Uncategorized',
      subjects: enriched.subjects,
      publisher: enriched.publisher,
      description: enriched.description,
      language: enriched.language,
      year: enriched.year || new Date().getFullYear(),
      coverUrl: enriched.coverUrl,
      isbn: enriched.isbn,
      externalId: enriched.key,
      source: enriched.source ?? 'openlibrary',
      owned: options.owned,
      ...(options.owned ? { format: options.format } : {}),
      condition: options.condition,
      purchasePrice: options.purchasePrice,
      estimatedValue: options.estimatedValue,
      specialEdition: options.specialEdition,
      signed: options.signed,
      firstEdition: options.firstEdition,
      gifted: options.gifted,
      ...(options.status === 'Currently Reading' ? { currentPage: 0 } : {}),
    }

    setBooks((current) => [...current, newBook])
    setSelectedBookId(newBook.id)
    setNotice(`${newBook.title} was added to ${options.owned ? 'your collection' : 'your wishlist'}.`)
    setEngagementRefreshToken((current) => current + 1)
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

  function openJournal(bookId?: string) {
    setJournalBookId(bookId)
    setView('journal')
    setDetailCardOpen(false)
    setProfileOpen(false)
  }

  function openReadingLog() {
    setView('reading-log')
    setProfileOpen(false)
  }

  function openAchievements() {
    setView('achievements')
    setProfileOpen(false)
  }

  function refreshEngagement() {
    setEngagementRefreshToken((current) => current + 1)
  }

  function updateLocalBookProgress(id: string, page: number) {
    setBooks((current) => current.map((book) => book.id === id ? { ...book, currentPage: page } : book))
  }

  const titles: Record<View, { eyebrow: string; title: string }> = {
    shelf: { eyebrow: 'MY LIBRARY', title: 'My Bookshelf' },
    collection: { eyebrow: 'OWNED BOOKS', title: 'My Collection' },
    discover: { eyebrow: 'FIND YOUR NEXT READ', title: 'Discover' },
    'reading-log': { eyebrow: 'READING ACTIVITY', title: 'Reading Log' },
    journal: { eyebrow: 'YOUR PRIVATE NOTES', title: 'Journal' },
    achievements: { eyebrow: 'MILESTONES', title: 'Achievements' },
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
          <button className={view === 'reading-log' ? 'nav-active' : ''} onClick={openReadingLog}><BookOpenCheck size={18} /> Log Reading</button>
          <button className={view === 'journal' ? 'nav-active' : ''} onClick={() => openJournal()}><NotebookPen size={18} /> Journal</button>
          <button><Users size={18} /> Friends <span className="nav-soon">soon</span></button>
          <button className={view === 'achievements' ? 'nav-active' : ''} onClick={openAchievements}><Trophy size={18} /> Achievements</button>
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
        <ProfileDrawer open={profileOpen} userId={userId} books={books} fallbackName={fallbackName} userEmail={userEmail} fallbackAvatar={fallbackAvatar} onToggle={() => setProfileOpen((current) => !current)} onSignOut={onSignOut} onOpenReadingLog={openReadingLog} onOpenAchievements={openAchievements} engagementRefreshToken={engagementRefreshToken} />
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
            {(view === 'shelf' || view === 'collection' || view === 'discover') && <button className="primary" onClick={() => setAddOpen(true)}><BookPlus size={18} /> Add Book</button>}
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
            sidePanel={selectedBook ? <BookDetails book={selectedBook} onUpdate={updateBook} onRemove={requestRemoveBook} onOpenJournal={openJournal} /> : undefined}
          />
        )}

        {view === 'collection' && <CollectionView books={books} onOpen={openBook} onAdd={() => setAddOpen(true)} />}

        {view === 'discover' && (
          <DiscoverView
            books={books}
            genre={recommendationGenre}
            category={discoverCategory}
            term={discoverTerm}
            results={discoverResults}
            loading={discoverLoading}
            error={discoverError}
            onTermChange={setDiscoverTerm}
            onCategoryChange={(category) => { setDiscoverCategory(category); setDiscoverTerm(''); setDiscoverRefreshPage(0) }}
            onRefresh={() => { setDiscoverTerm(''); setDiscoverRefreshPage((current) => current + 1) }}
            onSearch={searchDiscover}
            onAdd={(result) => addBook(result, { status: 'Want to Read', owned: false, format: 'Hardcover' })}
            onPurchased={(result) => addBook(result, { status: 'Want to Read', owned: true, format: 'Hardcover' })}
          />
        )}

        {view === 'reading-log' && <ReadingLogPage books={books} onProgressSaved={updateLocalBookProgress} onActivity={refreshEngagement} />}

        {view === 'journal' && <JournalPage books={books} initialBookId={journalBookId} onActivity={refreshEngagement} />}

        {view === 'achievements' && <AchievementsPage refreshToken={engagementRefreshToken} />}

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
        <BookDetailsModal book={selectedBook} onUpdate={updateBook} onRemove={requestRemoveBook} onOpenJournal={openJournal} onClose={() => setDetailCardOpen(false)} />
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
  onOpenJournal,
  variant = 'side',
}: {
  book: Book
  onUpdate: (id: string, patch: Partial<Book>) => void
  onRemove: (book: Book) => void
  onOpenJournal: (bookId?: string) => void
  variant?: BookDetailsDisplay
}) {
  const [proofBusy, setProofBusy] = useState(false)
  const [proofMessage, setProofMessage] = useState('')
  const [marketPrice, setMarketPrice] = useState<LiveBookPrice | null>(null)
  const [marketPriceLoading, setMarketPriceLoading] = useState(false)

  async function checkMarketPrice() {
    setMarketPriceLoading(true)
    try {
      const prices = await fetchLiveBookPrices({ key: book.externalId ?? book.id, title: book.title, author: book.author, isbn: book.isbn })
      const physical = prices.find((price) => price.id === 'ebay') ?? prices.find((price) => price.id === 'shopping') ?? null
      setMarketPrice(physical)
      if (physical?.averagePrice !== undefined && book.estimatedValue === undefined) onUpdate(book.id, { estimatedValue: physical.averagePrice })
    } catch {
      setMarketPrice(null)
    } finally {
      setMarketPriceLoading(false)
    }
  }

  useEffect(() => {
    if (!book.owned) { setMarketPrice(null); return }
    if (book.estimatedValue !== undefined) return
    void checkMarketPrice()
  }, [book.id, book.owned, book.isbn, book.title, book.estimatedValue])

  async function addSignatureProof(file: File | undefined) {
    if (!file) return
    setProofBusy(true)
    setProofMessage('')
    try {
      const result = await uploadSignedBookProof(book.id, file)
      onUpdate(book.id, { signed: true, signedProofPath: result.proofPath, signedProofUrl: result.proofUrl, signedProofVerifiedAt: new Date().toISOString() })
      setProofMessage(result.xpAwarded ? 'Signature proof saved · +25 XP' : 'Signature proof updated')
    } catch (error) {
      setProofMessage(error instanceof Error ? error.message : 'Could not upload signature proof.')
    } finally { setProofBusy(false) }
  }

  async function viewSignatureProof() {
    if (!book.signedProofPath) return
    try {
      const url = await getSignedBookProofUrl(book.signedProofPath)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setProofMessage(error instanceof Error ? error.message : 'Could not open signature proof.')
    }
  }

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
            <p className="status-pill">{readingStatusLabel(book.status)}</p>
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
            {editableReadingStatuses.map((status) => <option value={status} key={status}>{readingStatusLabel(status)}</option>)}
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
          <div className="rating-picker" role="radiogroup" aria-label={`Rate ${book.title}`}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <button type="button" role="radio" aria-checked={book.rating === rating} aria-label={`${rating} star${rating === 1 ? '' : 's'}`} onClick={() => onUpdate(book.id, { rating })} key={rating}>
                <Star size={21} fill={(book.rating ?? 0) >= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <p>{book.rating ? <>{book.rating} out of 5 · saved automatically <button className="rating-clear" type="button" onClick={() => onUpdate(book.id, { rating: null })}>Clear</button></> : 'Not rated yet'}</p>
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
          <><div className="market-value-summary">
            <div><span>Book price</span><strong>{marketPrice?.averagePrice !== undefined ? money(marketPrice.averagePrice) : marketPriceLoading ? 'Checking market…' : book.estimatedValue !== undefined ? money(book.estimatedValue) : 'No market price found'}</strong><small>{marketPrice?.listingCount ? `Average of ${marketPrice.listingCount} ${marketPrice.id === 'ebay' ? 'eBay' : 'Google Shopping'} listings${marketPrice.checkedAt ? ` · checked ${new Date(marketPrice.checkedAt).toLocaleDateString()}` : ''}` : book.estimatedValue !== undefined ? 'Saved to your collection; refresh only when you want a newer estimate' : 'You can add a value manually below'}</small></div>
            <div className="market-value-actions">{marketPrice?.url && <a href={marketPrice.url} target="_blank" rel="noreferrer">View lowest listing <ExternalLink size={13} /></a>}<button type="button" onClick={() => void checkMarketPrice()} disabled={marketPriceLoading}>{marketPriceLoading ? 'Checking…' : marketPrice ? 'Reload saved price' : 'Check market price'}</button></div>
          </div><div className="ownership-fields">
            <label>
              <span>Format</span>
              <select value={book.format ?? 'Hardcover'} onChange={(event) => onUpdate(book.id, { format: event.target.value as BookFormat })}>
                {bookFormats.map((format) => <option key={format}>{format}</option>)}
              </select>
            </label>
            <label>
              <span>Manual value override</span>
              <div className="money-input"><DollarSign size={15} /><input type="number" min="0" step="0.01" value={book.estimatedValue ?? ''} placeholder="0.00" onChange={(event) => onUpdate(book.id, { estimatedValue: event.target.value === '' ? undefined : Number(event.target.value) })} /></div>
            </label>
          </div>
          <div className="signed-copy-controls">
            <button type="button" className={book.signed ? 'signed-toggle active' : 'signed-toggle'} onClick={() => onUpdate(book.id, { signed: !book.signed })}>
              {book.signed ? <><Check size={16} /> Signed copy</> : <><Sparkles size={16} /> Mark as signed</>}
            </button>
            {book.signed && <label className="signature-proof-button"><Camera size={16} /> {proofBusy ? 'Uploading…' : book.signedProofPath ? 'Update proof photo' : 'Add proof photo · +25 XP'}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" disabled={proofBusy} onChange={(event) => void addSignatureProof(event.target.files?.[0])} /></label>}
            {book.signedProofPath && <button className="signature-proof-link" type="button" onClick={() => void viewSignatureProof()}>View private proof <ExternalLink size={13} /></button>}
            {proofMessage && <small className="signature-proof-message">{proofMessage}</small>}
          </div></>
        )}
      </div>

      <div className="detail-card journal-card">
        <div className="card-heading"><span>Journal</span><ChevronRight size={18} /></div>
        <p>{book.note ?? 'Add thoughts, favorite quotes, characters, predictions, moods, or a full review whenever you want.'}</p>
        <button className="secondary" type="button" onClick={() => onOpenJournal(book.id)}>Open book journal</button>
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
  onOpenJournal,
  onClose,
}: {
  book: Book
  onUpdate: (id: string, patch: Partial<Book>) => void
  onRemove: (book: Book) => void
  onOpenJournal: (bookId?: string) => void
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop book-detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="book-detail-modal" role="dialog" aria-modal="true" aria-label={`Details for ${book.title}`}>
        <div className="modal-header">
          <div><p className="eyebrow">BOOK DETAILS</p><h2>{book.title}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close book details"><X /></button>
        </div>
        <BookDetails book={book} onUpdate={onUpdate} onRemove={onRemove} onOpenJournal={onOpenJournal} variant="card" />
      </section>
    </div>
  )
}

function CollectionView({ books, onOpen, onAdd }: { books: Book[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const [collectionQuery, setCollectionQuery] = useState('')
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'unread' | 'read' | 'collectible'>('all')
  const [collectionSort, setCollectionSort] = useState<'title' | 'author' | 'value' | 'year'>('title')
  const owned = books.filter((book) => book.owned)
  const estimatedValue = owned.reduce((sum, book) => sum + (book.estimatedValue ?? 0), 0)
  const amountSpent = owned.reduce((sum, book) => sum + (book.purchasePrice ?? 0), 0)
  const unread = owned.filter((book) => book.status !== 'Read').length
  const readCount = owned.length - unread
  const totalPages = owned.reduce((sum, book) => sum + (book.pages || 0), 0)
  const collectible = owned.filter((book) => book.signed || book.firstEdition || book.specialEdition).length
  const valued = owned.filter((book) => (book.estimatedValue ?? 0) > 0)
  const priced = owned.filter((book) => book.purchasePrice !== undefined)
  const mostValuable = [...valued].sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0))[0]
  const rated = owned.filter((book) => book.rating != null)
  const averageRating = rated.length ? rated.reduce((sum, book) => sum + (book.rating ?? 0), 0) / rated.length : 0

  function countsFor(values: string[]) {
    const counts = new Map<string, number>()
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }

  const formats = countsFor(owned.map((book) => book.format ?? 'Not set'))
  const conditions = countsFor(owned.map((book) => book.condition ?? 'Not set'))
  const genres = countsFor(owned.map((book) => book.genre || 'Uncategorized'))
  const authors = countsFor(owned.map((book) => book.author || 'Unknown author'))
  const normalizedQuery = collectionQuery.trim().toLowerCase()
  const visibleBooks = owned
    .filter((book) => !normalizedQuery || `${book.title} ${book.author} ${book.genre} ${book.isbn ?? ''}`.toLowerCase().includes(normalizedQuery))
    .filter((book) => {
      if (collectionFilter === 'read') return book.status === 'Read'
      if (collectionFilter === 'unread') return book.status !== 'Read'
      if (collectionFilter === 'collectible') return Boolean(book.signed || book.firstEdition || book.specialEdition)
      return true
    })
    .sort((a, b) => {
      if (collectionSort === 'author') return a.author.localeCompare(b.author)
      if (collectionSort === 'value') return (b.estimatedValue ?? -1) - (a.estimatedValue ?? -1)
      if (collectionSort === 'year') return (b.year ?? 0) - (a.year ?? 0)
      return a.title.localeCompare(b.title)
    })

  return (
    <div className="collection-page">
      <section className="collection-hero">
        <div>
          <p className="eyebrow">YOUR HOME LIBRARY</p>
          <h2>A collection worth keeping track of.</h2>
          <p>Ownership, editions, condition and value live here without changing where a book sits in your reading journey.</p>
        </div>
        <div className="collection-value"><span>Estimated collection value</span><strong>{valued.length ? money(estimatedValue) : 'Not valued yet'}</strong><small>{valued.length} of {owned.length} books have an estimate</small></div>
      </section>

      <section className="metric-grid collection-metrics">
        <Metric icon={<Archive />} label="Books owned" value={String(owned.length)} detail={`${readCount} read · ${unread} unread`} />
        <Metric icon={<BookOpen />} label="Reading progress" value={owned.length ? `${Math.round((readCount / owned.length) * 100)}%` : '—'} detail={`${totalPages.toLocaleString()} pages collected`} />
        <Metric icon={<DollarSign />} label="Recorded spending" value={priced.length ? money(amountSpent) : 'Not recorded'} detail={`${priced.length} of ${owned.length} books priced`} />
        <Metric icon={<Sparkles />} label="Special copies" value={String(collectible)} detail={`${owned.filter((book) => book.signed).length} signed · ${owned.filter((book) => book.firstEdition).length} first editions`} />
        <Metric icon={<Star />} label="Average rating" value={rated.length ? averageRating.toFixed(1) : 'Not rated'} detail={`${rated.length} rated books`} />
        <Metric icon={<BarChart3 />} label="Most valuable" value={mostValuable ? money(mostValuable.estimatedValue) : 'Not valued'} detail={mostValuable?.title ?? 'Add estimates as you go'} />
      </section>

      {owned.length > 0 && (
        <section className="collection-insights" aria-label="Collection insights">
          <CollectionBreakdown title="Formats" items={formats} total={owned.length} />
          <CollectionBreakdown title="Conditions" items={conditions} total={owned.length} />
          <div className="collection-ranking"><p className="eyebrow">COLLECTION DNA</p><h3>What fills your shelves</h3><div className="ranking-list"><span><b>Top genre</b><strong>{genres[0]?.[0] ?? 'Not set'}</strong><small>{genres[0]?.[1] ?? 0} books</small></span><span><b>Most collected author</b><strong>{authors[0]?.[0] ?? 'Not set'}</strong><small>{authors[0]?.[1] ?? 0} books</small></span><span><b>Gifted to you</b><strong>{owned.filter((book) => book.gifted).length}</strong><small>books</small></span></div></div>
        </section>
      )}

      <div className="section-heading collection-heading">
        <div><p className="eyebrow">OWNED</p><h2>Your collection</h2></div>
        <button className="primary" type="button" onClick={onAdd}><BookPlus size={17} /> Add owned book</button>
      </div>

      {owned.length === 0 ? (
        <div className="empty-collection"><Archive size={42} /><h3>No owned books marked yet</h3><p>Add a book or mark a book on your shelf as owned.</p><button className="primary" onClick={onAdd}><BookPlus size={18} /> Add a book</button></div>
      ) : (
        <>
          <div className="collection-tools">
            <label className="search-box"><Search size={17} /><input value={collectionQuery} onChange={(event) => setCollectionQuery(event.target.value)} placeholder="Search this collection…" /></label>
            <div className="collection-filter" aria-label="Filter collection">{(['all', 'unread', 'read', 'collectible'] as const).map((filter) => <button className={collectionFilter === filter ? 'active' : ''} type="button" onClick={() => setCollectionFilter(filter)} key={filter}>{filter === 'all' ? 'All' : filter[0].toUpperCase() + filter.slice(1)}</button>)}</div>
            <label className="collection-sort">Sort <select value={collectionSort} onChange={(event) => setCollectionSort(event.target.value as typeof collectionSort)}><option value="title">Title</option><option value="author">Author</option><option value="value">Value</option><option value="year">Newest</option></select></label>
          </div>
          <div className="collection-result-count">Showing {visibleBooks.length} of {owned.length} owned books</div>
          <div className="collection-grid">
          {visibleBooks.map((book) => (
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
          {visibleBooks.length === 0 && <div className="collection-no-results">No books match those filters.</div>}
        </>
      )}
    </div>
  )
}

function CollectionBreakdown({ title, items, total }: { title: string; items: [string, number][]; total: number }) {
  return <div className="collection-breakdown"><p className="eyebrow">BREAKDOWN</p><h3>{title}</h3><div>{items.slice(0, 5).map(([label, count]) => <span key={label}><b>{label}</b><i><em style={{ width: `${(count / Math.max(total, 1)) * 100}%` }} /></i><small>{count}</small></span>)}</div></div>
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <article className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function DiscoverView({
  books,
  genre,
  category,
  term,
  results,
  loading,
  error,
  onTermChange,
  onCategoryChange,
  onRefresh,
  onSearch,
  onAdd,
  onPurchased,
}: {
  books: Book[]
  genre: string
  category: DiscoverCategoryId
  term: string
  results: BookSearchResult[]
  loading: boolean
  error: string
  onTermChange: (value: string) => void
  onCategoryChange: (value: DiscoverCategoryId) => void
  onRefresh: () => void
  onSearch: (event: FormEvent) => void
  onAdd: (result: BookSearchResult) => void
  onPurchased: (result: BookSearchResult) => void
}) {
  const [selected, setSelected] = useState<BookSearchResult | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [resultLimit, setResultLimit] = useState(12)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const selectorRef = useRef<HTMLDivElement>(null)
  const wheelLock = useRef(0)
  const categoryLabel = discoverCategories.find((item) => item.id === category)?.label ?? 'For You'
  const categoryIndex = Math.max(0, discoverCategories.findIndex((item) => item.id === category))
  const turnstileCategories = [-2, -1, 0, 1, 2].map((offset) => ({
    offset,
    item: discoverCategories[(categoryIndex + offset + discoverCategories.length) % discoverCategories.length],
  }))

  useEffect(() => {
    if (!selectorOpen) return
    function closeOutside(event: PointerEvent) {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) setSelectorOpen(false)
    }
    function closeWithKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectorOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeWithKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeWithKeyboard)
    }
  }, [selectorOpen])

  function rotateCategory(direction: -1 | 1) {
    const nextIndex = (categoryIndex + direction + discoverCategories.length) % discoverCategories.length
    onCategoryChange(discoverCategories[nextIndex].id)
  }

  function wheelCategory(event: React.WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaY) < 8) return
    event.preventDefault()
    const now = Date.now()
    if (now - wheelLock.current < 170) return
    wheelLock.current = now
    rotateCategory(event.deltaY > 0 ? 1 : -1)
  }

  async function openResult(result: BookSearchResult) {
    setSelected(result)
    setDetailLoading(true)
    try {
      const google = await enrichWithGoogleBooks(result)
      setSelected(await enrichWithOpenLibrary(google))
    } finally { setDetailLoading(false) }
  }

  return (
    <div className="discover-page">
      <section className="discover-hero">
        <div>
          <p className="eyebrow">FRESH PICKS FOR YOUR NEXT OBSESSION</p>
          <h2>Discover what readers are reaching for now.</h2>
          <p>Browse recent releases and contemporary favorites tuned toward your shelf. Search still reaches the wider catalogs when you need something older or wonderfully obscure.</p>
        </div>
        <div ref={selectorRef} className={`taste-card genre-dial-card ${selectorOpen ? 'open' : ''}`}>
          <div className="genre-dial-heading"><Heart size={22} /><span>Discovery shelf</span></div>
          <button className={`genre-dial-toggle ${selectorOpen ? 'open' : ''}`} type="button" aria-expanded={selectorOpen} aria-controls="genre-turnstile" onClick={() => setSelectorOpen((current) => !current)}>
            {selectorOpen ? <span>Choose a genre</span> : <strong>{categoryLabel}</strong>}
            <ChevronDown size={20} />
          </button>
          {selectorOpen ? (
            <div className="genre-turnstile-shell" id="genre-turnstile" onWheel={wheelCategory}>
              <button className="genre-step genre-step-up" type="button" onClick={() => rotateCategory(-1)} aria-label="Previous discovery shelf"><ChevronDown size={17} /></button>
              <div className="genre-turnstile" role="listbox" aria-label="Discovery shelves">
                {turnstileCategories.map(({ item, offset }) => (
                  <button
                    className={`genre-turnstile-option ${offset === 0 ? 'active' : `distance-${Math.abs(offset)}`}`}
                    type="button"
                    role="option"
                    aria-selected={offset === 0}
                    data-direction={offset < 0 ? 'above' : offset > 0 ? 'below' : 'center'}
                    onClick={() => onCategoryChange(item.id)}
                    key={`${item.id}:${offset}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button className="genre-step genre-step-down" type="button" onClick={() => rotateCategory(1)} aria-label="Next discovery shelf"><ChevronDown size={17} /></button>
              <label className="genre-scroll-rail">
                <span>Scroll through discovery shelves</span>
                <input type="range" min="0" max={discoverCategories.length - 1} step="1" value={categoryIndex} onChange={(event) => onCategoryChange(discoverCategories[Number(event.target.value)].id)} />
              </label>
            </div>
          ) : <small>Inspired by your {genre} shelf · Click to browse genres</small>}
        </div>
      </section>

      <form className="discover-search" onSubmit={onSearch}>
        <label className="search-box"><Search size={20} /><input value={term} onChange={(event) => onTermChange(event.target.value)} placeholder="Browse by title, author, ISBN, genre..." /></label>
        <button className="primary" disabled={loading} type="submit">{loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />} Browse</button>
      </form>

      <div className="section-heading discover-heading">
        <div><p className="eyebrow">{term ? 'SEARCH RESULTS' : 'NEW & NOTEWORTHY'}</p><h2>{term ? `Results for “${term}”` : categoryLabel}</h2></div>
        <div className="discover-result-controls">
          <span>{term ? 'Google Books + Open Library' : 'Recent Google Books editions'}</span>
          {!term && <button className="discover-refresh-button" type="button" disabled={loading} onClick={onRefresh}><Sparkles size={14} /> Fresh picks</button>}
          <label>Show <select value={resultLimit} onChange={(event) => setResultLimit(Number(event.target.value))}><option value={12}>12</option><option value={24}>24</option><option value={48}>48</option><option value={1000}>All</option></select></label>
        </div>
      </div>

      {error && <div className="discover-message">{error}</div>}
      {loading && <div className="discover-message"><LoaderCircle className="spin" /> Finding books…</div>}
      {!loading && !error && (
        <div className="discover-grid">
          {results.slice(0, resultLimit).map((result) => {
            const added = isAlreadyInLibrary(result, books)
            return (
              <article className="discover-book" key={result.key} onClick={() => void openResult(result)}>
                <div className="discover-cover">
                  {result.coverUrl ? <ResilientCover book={result} alt="" /> : <BookOpen size={34} />}
                  {result.year && <span className="discover-year">{result.year}</span>}
                </div>
                <div className="discover-copy">
                  <strong>{result.title}</strong>
                  <span>{result.author}</span>
                  <small>{[result.genre, result.pages ? `${result.pages} pages` : ''].filter(Boolean).join(' · ')}</small>
                </div>
                <button className={added ? 'added-button' : 'add-result-button'} disabled={added} onClick={(event) => { event.stopPropagation(); onAdd(result) }}>{added ? <><Check size={16} /> On shelf</> : <><BookPlus size={16} /> Wishlist</>}</button>
              </article>
            )
          })}
        </div>
      )}
      {!loading && !error && results.length === 0 && <div className="discover-message">No fresh matches landed this time. Try another shelf or search for something specific.</div>}
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
  const [livePrices, setLivePrices] = useState<LiveBookPrice[]>([])
  const [pricesLoading, setPricesLoading] = useState(true)
  useEffect(() => {
    let active = true
    setPricesLoading(true)
    fetchLiveBookPrices(book).then((prices) => active && setLivePrices(prices)).catch(() => active && setLivePrices([])).finally(() => active && setPricesLoading(false))
    return () => { active = false }
  }, [book.key, book.isbn, book.title])
  const buyingOptions = getBookBuyingOptions(book, livePrices)
  const pricedOptions = buyingOptions.filter((option) => option.livePrice && option.price !== undefined)
  const lowestPrice = pricedOptions.length ? Math.min(...pricedOptions.map((option) => option.price!)) : undefined
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
                <div className="purchase-panel-heading"><div><small>WHERE TO BUY</small><strong>Compare three places</strong></div><span>{pricesLoading ? 'Checking live prices…' : lowestPrice === undefined ? 'No confirmed price returned. Retailer searches are still available.' : 'Lowest confirmed price is highlighted.'}</span></div>
                <div className="purchase-options">
                  {buyingOptions.map((option) => {
                    const formattedPrice = option.price === undefined
                      ? 'Check price'
                      : new Intl.NumberFormat('en-US', { style: 'currency', currency: option.currencyCode ?? 'USD' }).format(option.price)
                    const bestConfirmed = option.livePrice && option.price === lowestPrice
                    return (
                      <a className={`purchase-option ${bestConfirmed ? 'best-confirmed' : ''}`} href={option.url} target="_blank" rel="noreferrer" key={option.id}>
                        <div><strong>{option.store}</strong><span>{option.detail}</span></div>
                        <div className="purchase-option-action">{(bestConfirmed || option.recommendation) && <small>{bestConfirmed ? 'BEST LISTED PRICE' : option.recommendation}</small>}<b>{formattedPrice}</b><ExternalLink size={14} /></div>
                      </a>
                    )
                  })}
                </div>
              </div>
            </>
          )}
          <div className="discover-detail-actions">
            <button className={added ? 'added-button' : 'secondary'} disabled={added} onClick={onWantToRead}>{added ? <><Check size={16} /> Already on shelf</> : <><BookPlus size={16} /> Wishlist</>}</button>
            <button className="primary" onClick={onPurchased}><Archive size={17} /> I bought this</button>
          </div>
          <small className="purchase-disclosure">Only prices marked as confirmed come from a retailer feed. Other buttons run an ISBN or title search. Shipping, condition, and availability may change. Use “I bought this” after checkout to add the book to your collection.</small>
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
  const [mode, setMode] = useState<'search' | 'manual'>('search')

  async function addResult(result: BookSearchResult) {
    setAddingKey(result.key)
    setError('')
    setSuccess('')
    try {
      await onAdd(result, { status, owned, format })
      setSuccess(`${result.title} was added successfully.`)
    } catch (addError) {
      const message = addError instanceof Error
        ? addError.message
        : typeof addError === 'object' && addError && 'message' in addError
          ? String(addError.message)
          : 'That book could not be added. Please try again.'
      setError(message)
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

        <div className="add-book-mode" role="tablist" aria-label="How to add a book">
          <button type="button" role="tab" aria-selected={mode === 'search'} className={mode === 'search' ? 'active' : ''} onClick={() => setMode('search')}><Search size={16} /> Search catalogs</button>
          <button type="button" role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}><BookPlus size={16} /> Add manually</button>
        </div>

        {mode === 'manual' ? <ManualBookForm onAdd={onAdd} /> : <>

        <form className="book-search-form" onSubmit={submit}>
          <label className="search-box modal-search"><Search size={20} /><input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search title, author, or ISBN..." /></label>
          <button className="primary" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />} Search</button>
        </form>

        <div className="add-options-row">
          <div className="status-picker" aria-label="Reading status for new book">
            {readingStatuses.map((option) => (
              <button className={status === option ? 'status-option active' : 'status-option'} onClick={() => setStatus(option)} key={option} type="button">{readingStatusLabel(option)}</button>
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

        <div className="manual-hint">Can't find it? Choose <button type="button" onClick={() => setMode('manual')}>Add manually</button> to create the full book record and upload a cover.</div>
        </>}
      </section>
    </div>
  )
}

function ManualBookForm({ onAdd }: { onAdd: (book: BookSearchResult, options: AddBookOptions) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [year, setYear] = useState('')
  const [pages, setPages] = useState('')
  const [genre, setGenre] = useState('')
  const [publisher, setPublisher] = useState('')
  const [description, setDescription] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [status, setStatus] = useState<ReadingStatus>('Want to Read')
  const [owned, setOwned] = useState(true)
  const [format, setFormat] = useState<BookFormat>('Paperback')
  const [condition, setCondition] = useState<Book['condition']>('Good')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [specialEdition, setSpecialEdition] = useState(false)
  const [signed, setSigned] = useState(false)
  const [firstEdition, setFirstEdition] = useState(false)
  const [gifted, setGifted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function saveManualBook(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || !author.trim()) return setError('Title and author are required.')
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const coverUrl = coverFile ? await uploadBookCover(coverFile) : undefined
      const manual: BookSearchResult = {
        key: `manual:${crypto.randomUUID()}`,
        source: 'manual',
        title: title.trim(), author: author.trim(), isbn: isbn.trim() || undefined,
        year: Number(year) || undefined, pages: Number(pages) || undefined,
        genre: genre.trim() || undefined, subjects: genre.trim() ? [genre.trim()] : undefined,
        publisher: publisher.trim() || undefined, description: description.trim() || undefined,
        coverUrl, largeCoverUrl: coverUrl,
      }
      await onAdd(manual, {
        status, owned, format, condition: owned ? condition : undefined,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
        specialEdition, signed, firstEdition, gifted,
      })
      setSuccess(`${manual.title} was added successfully.`)
      setTitle(''); setAuthor(''); setIsbn(''); setYear(''); setPages(''); setGenre(''); setPublisher(''); setDescription(''); setCoverFile(null); setPurchasePrice(''); setEstimatedValue('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : typeof saveError === 'object' && saveError && 'message' in saveError ? String(saveError.message) : 'Could not save this book.')
    } finally { setSaving(false) }
  }

  return <form className="manual-book-form" onSubmit={saveManualBook}>
    <div className="manual-book-grid">
      <label className="manual-cover-upload">
        <span>{coverFile ? <img src={URL.createObjectURL(coverFile)} alt="Cover preview" /> : <><Camera size={28} /><strong>Add cover</strong><small>Upload or take a photo</small></>}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} />
      </label>
      <div className="manual-primary-fields">
        <label>Title *<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label>Author *<input value={author} onChange={(event) => setAuthor(event.target.value)} required /></label>
        <label>ISBN<input value={isbn} onChange={(event) => setIsbn(event.target.value)} inputMode="numeric" /></label>
      </div>
    </div>
    <div className="manual-fields">
      <label>Year<input value={year} onChange={(event) => setYear(event.target.value)} type="number" min="0" max="2100" /></label>
      <label>Pages<input value={pages} onChange={(event) => setPages(event.target.value)} type="number" min="0" /></label>
      <label>Genre<input value={genre} onChange={(event) => setGenre(event.target.value)} /></label>
      <label>Publisher<input value={publisher} onChange={(event) => setPublisher(event.target.value)} /></label>
    </div>
    <label className="manual-description">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Back-cover description, notes, or your own summary…" /></label>
    <div className="manual-status-row"><select value={status} onChange={(event) => setStatus(event.target.value as ReadingStatus)}>{readingStatuses.map((item) => <option value={item} key={item}>{readingStatusLabel(item)}</option>)}</select><label className="owned-check"><input type="checkbox" checked={owned} onChange={(event) => setOwned(event.target.checked)} /><span><Archive size={16} /> I own this book</span></label></div>
    {owned && <div className="manual-fields ownership-manual"><label>Format<select value={format} onChange={(event) => setFormat(event.target.value as BookFormat)}>{bookFormats.map((item) => <option key={item}>{item}</option>)}</select></label><label>Condition<select value={condition} onChange={(event) => setCondition(event.target.value as Book['condition'])}>{['New','Like New','Very Good','Good','Fair','Poor'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Paid<input type="number" min="0" step="0.01" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} /></label><label>Est. value<input type="number" min="0" step="0.01" value={estimatedValue} onChange={(event) => setEstimatedValue(event.target.value)} /></label></div>}
    <div className="manual-flags"><label><input type="checkbox" checked={specialEdition} onChange={(event) => setSpecialEdition(event.target.checked)} /> Special edition</label><label><input type="checkbox" checked={signed} onChange={(event) => setSigned(event.target.checked)} /> Signed</label><label><input type="checkbox" checked={firstEdition} onChange={(event) => setFirstEdition(event.target.checked)} /> First edition</label><label><input type="checkbox" checked={gifted} onChange={(event) => setGifted(event.target.checked)} /> Gifted</label></div>
    {error && <div className="search-message error-message">{error}</div>}{success && <div className="search-message add-success"><Check size={18} /> {success}</div>}
    <button className="primary manual-save" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={17} /> Saving book…</> : <><BookPlus size={17} /> Add book</>}</button>
  </form>
}

function isAlreadyInLibrary(result: BookSearchResult, books: Book[]) {
  return books.some((book) => book.externalId === result.key || (book.isbn && result.isbn && book.isbn === result.isbn))
}
