import { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { Book, ReadingStatus } from '../data/books'
import { shelfStyles, type ShelfFinishId, type ShelfStyleId } from '../data/customization'
import { customizationEvent, loadShelfFinish, loadShelfStyle } from '../lib/customizationRuntime'

export type ShelfFilter = 'All' | ReadingStatus

type BookOrientation = 'upright' | 'horizontal'

type BookPlacement = {
  shelfIndex: number
  cubeColumn?: number
  x: number
  y: number
  angle: number
  orientation: BookOrientation
}

type PlacementMap = Record<string, BookPlacement>
type LayoutProfiles = Record<string, PlacementMap>
type PlacementPreview = BookPlacement & { bookId: string; valid: boolean }

const filters: Array<{ value: ShelfFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Currently Reading', label: 'Reading' },
  { value: 'Want to Read', label: 'To Read' },
  { value: 'Read', label: 'Read' },
  { value: 'DNF', label: 'DNF' },
]

const cubeColumns = 3
const layoutProfilesKey = 'shelfie-layout-profiles-v1'
const legacyFreePlacementKey = 'shelfie-free-placement-v1'
const snapDistance = 14

type BookSpineProps = {
  book: Book
  index: number
  selected: boolean
  glowFocus: boolean
  detailsDisplay: 'side' | 'card'
  organizeMode: boolean
  placement?: BookPlacement
  onSelect: () => void
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
}

function profileKey(style: ShelfStyleId, filter: ShelfFilter) {
  return `${style}::${filter}`
}

function normalizePlacementMap(value: unknown): PlacementMap {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, BookPlacement>).filter(([, placement]) => (
      placement
      && Number.isInteger(placement.shelfIndex)
      && placement.shelfIndex >= 0
      && (placement.cubeColumn === undefined || (Number.isInteger(placement.cubeColumn) && placement.cubeColumn >= 0 && placement.cubeColumn < cubeColumns))
      && typeof placement.x === 'number'
      && placement.x >= 0
      && placement.x <= 1
      && typeof placement.y === 'number'
      && placement.y >= 0
      && typeof placement.angle === 'number'
      && (placement.orientation === 'upright' || placement.orientation === 'horizontal')
    )),
  )
}

function loadLayoutProfiles(): LayoutProfiles {
  try {
    const saved = localStorage.getItem(layoutProfilesKey)
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, unknown>
      return Object.fromEntries(
        Object.entries(parsed)
          .map(([key, value]) => [key, normalizePlacementMap(value)] as const)
          .filter(([, value]) => Object.keys(value).length > 0),
      )
    }

    // Preserve the original Organize Mode layout as the Classic / All showcase.
    const legacy = localStorage.getItem(legacyFreePlacementKey)
    if (legacy) {
      const migrated = normalizePlacementMap(JSON.parse(legacy))
      if (Object.keys(migrated).length > 0) return { [profileKey('classic', 'All')]: migrated }
    }
  } catch {
    // A clean set of shelf profiles is a safe fallback if browser storage is unavailable.
  }
  return {}
}

function bookDimensions(book: Book, index: number) {
  const pageWidthBoost = Math.min(12, Math.floor((book.pages || 0) / 180) * 2)
  const smallVariation = (index % 3) * 3

  let height = 202 + smallVariation
  let width = 66 + Math.round(pageWidthBoost * 0.55)

  switch (book.format) {
    case 'Hardcover':
      height = 222 + smallVariation
      width = 78 + pageWidthBoost
      break
    case 'Paperback':
      height = 202 + smallVariation
      width = 64 + Math.round(pageWidthBoost * 0.65)
      break
    case 'Mass Market':
      height = 184 + smallVariation
      width = 55 + Math.round(pageWidthBoost * 0.45)
      break
    case 'Audiobook':
      height = 178 + smallVariation
      width = 70 + Math.round(pageWidthBoost * 0.45)
      break
    case 'Ebook':
      height = 194 + smallVariation
      width = 62 + Math.round(pageWidthBoost * 0.45)
      break
    case 'Other':
      height = 205 + smallVariation
      width = 68 + Math.round(pageWidthBoost * 0.6)
      break
    default:
      break
  }

  if (book.specialEdition) {
    height += 9
    width += 5
  }

  return { height, width }
}

function visualDimensions(book: Book, index: number, orientation: BookOrientation) {
  const base = bookDimensions(book, index)
  return orientation === 'horizontal'
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height }
}

function defaultPlacement(index: number, shelfIndex: number, cubeColumn?: number): BookPlacement {
  const x = cubeColumn === undefined
    ? Math.min(.88, .025 + index * .095)
    : Math.min(.72, .045 + index * .27)

  return { shelfIndex, cubeColumn, x, y: 0, angle: 0, orientation: 'upright' }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function horizontalOverlap(aLeft: number, aWidth: number, bLeft: number, bWidth: number) {
  return Math.min(aLeft + aWidth, bLeft + bWidth) - Math.max(aLeft, bLeft)
}

function BookSpine({
  book,
  index,
  selected,
  glowFocus,
  detailsDisplay,
  organizeMode,
  placement,
  onSelect,
  onPointerDown,
}: BookSpineProps) {
  const dimensions = bookDimensions(book, index)
  const formatClass = (book.format ?? 'standard').toLowerCase().replaceAll(' ', '-')
  const orientation = placement?.orientation ?? 'upright'

  return (
    <button
      className={`book-spine book-format-${formatClass} ${selected ? 'selected' : ''} ${glowFocus ? 'glow-focus' : ''} ${placement ? 'free-placed-book' : ''} ${organizeMode ? 'organize-book' : ''} ${orientation === 'horizontal' ? 'book-horizontal' : ''}`}
      style={{
        '--book-color': book.color,
        '--book-accent': book.accent,
        '--book-height': `${dimensions.height}px`,
        '--book-width': `${dimensions.width}px`,
        ...(placement ? {
          '--book-x': `${placement.x * 100}%`,
          '--book-y': `${placement.y}px`,
          '--book-rotation': `${placement.angle}deg`,
        } : {}),
      } as CSSProperties}
      data-shelf-book-id={book.id}
      draggable={false}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      aria-label={`${book.title} by ${book.author}. ${book.format ?? 'Book'} format.${organizeMode ? ' Organize mode active.' : ''}`}
      title={organizeMode ? 'Drag to place · click to select rotation controls' : detailsDisplay === 'card' ? 'Click for book details' : 'Click to select'}
    >
      {book.owned && <span className="owned-dot" title="Owned" />}
      <span className="spine-ornament">✦</span>
      <span className="spine-title">{book.title}</span>
      <span className="spine-author">{book.author}</span>
    </button>
  )
}

export function FreeShelfView({
  books,
  searchFiltered,
  shelfCount,
  selectedBook,
  glowFocus,
  detailsDisplay,
  onSelect,
  sidePanel,
}: {
  books: Book[]
  searchFiltered: Book[]
  shelfCount: number
  selectedBook?: Book
  glowFocus: boolean
  detailsDisplay: 'side' | 'card'
  onSelect: (id: string) => void
  onReorder: (draggedId: string, targetId: string | null, targetShelfIndex: number) => void
  sidePanel?: ReactNode
}) {
  const [filter, setFilter] = useState<ShelfFilter>('All')
  const [shelfStyle, setShelfStyle] = useState<ShelfStyleId>(loadShelfStyle)
  const [shelfFinish, setShelfFinish] = useState<ShelfFinishId>(loadShelfFinish)
  const [layoutProfiles, setLayoutProfiles] = useState<LayoutProfiles>(loadLayoutProfiles)
  const [organizeMode, setOrganizeMode] = useState(false)
  const [activeBookId, setActiveBookId] = useState<string | null>(null)
  const [draggingBookId, setDraggingBookId] = useState<string | null>(null)
  const [placementPreview, setPlacementPreview] = useState<PlacementPreview | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  const activeProfileKey = profileKey(shelfStyle, filter)
  const freePlacement = layoutProfiles[activeProfileKey] ?? {}
  const activeFilterLabel = filters.find((option) => option.value === filter)?.label ?? 'All'
  const activeStyleName = shelfStyles.find((style) => style.id === shelfStyle)?.name ?? shelfStyle

  useEffect(() => {
    function refreshCustomization() {
      setShelfStyle(loadShelfStyle())
      setShelfFinish(loadShelfFinish())
      setOrganizeMode(false)
      setActiveBookId(null)
      setDraggingBookId(null)
      setPlacementPreview(null)
    }
    window.addEventListener(customizationEvent, refreshCustomization)
    return () => window.removeEventListener(customizationEvent, refreshCustomization)
  }, [])

  useEffect(() => {
    try { localStorage.setItem(layoutProfilesKey, JSON.stringify(layoutProfiles)) } catch { /* Keep profiles in memory. */ }
  }, [layoutProfiles])

  const profileBooks = useMemo(
    () => filter === 'All' ? books : books.filter((book) => book.status === filter),
    [books, filter],
  )

  const visibleBooks = useMemo(
    () => filter === 'All' ? searchFiltered : searchFiltered.filter((book) => book.status === filter),
    [searchFiltered, filter],
  )

  const finished = books.filter((book) => book.status === 'Read').length
  const reading = books.filter((book) => book.status === 'Currently Reading').length
  const freeLayoutActive = organizeMode || Object.keys(freePlacement).length > 0
  const activeBook = profileBooks.find((book) => book.id === activeBookId)

  function updateActiveProfile(updater: (current: PlacementMap) => PlacementMap) {
    setLayoutProfiles((currentProfiles) => ({
      ...currentProfiles,
      [activeProfileKey]: updater(currentProfiles[activeProfileKey] ?? {}),
    }))
  }

  function baseShelfFor(book: Book) {
    const saved = freePlacement[book.id]
    if (saved) return saved.shelfIndex
    if (filter === 'All') return Math.min(book.shelfIndex ?? 0, shelfCount - 1)

    const index = Math.max(0, profileBooks.findIndex((candidate) => candidate.id === book.id))
    const perShelf = Math.max(1, Math.ceil(profileBooks.length / shelfCount))
    return Math.min(shelfCount - 1, Math.floor(index / perShelf))
  }

  function currentShelfFor(book: Book) {
    return freePlacement[book.id]?.shelfIndex ?? baseShelfFor(book)
  }

  function defaultCubeColumn(book: Book) {
    const shelfIndex = currentShelfFor(book)
    const peers = profileBooks.filter((candidate) => currentShelfFor(candidate) === shelfIndex)
    const index = Math.max(0, peers.findIndex((candidate) => candidate.id === book.id))
    return Math.min(cubeColumns - 1, Math.floor(index / 2))
  }

  function cubeColumnFor(book: Book) {
    return freePlacement[book.id]?.cubeColumn ?? defaultCubeColumn(book)
  }

  function placementFor(book: Book, index: number, shelfIndex: number, cubeColumn?: number) {
    return freePlacement[book.id] ?? defaultPlacement(index, shelfIndex, cubeColumn)
  }

  function initializeFreeLayout() {
    updateActiveProfile((current) => {
      const next = { ...current }
      const renderedBooks = new Map<string, HTMLElement>()
      document.querySelectorAll<HTMLElement>('[data-shelf-book-id]').forEach((element) => {
        const id = element.dataset.shelfBookId
        if (id) renderedBooks.set(id, element)
      })

      profileBooks.forEach((book) => {
        if (next[book.id]) return
        const element = renderedBooks.get(book.id)
        const zone = element?.closest<HTMLElement>('[data-shelf-zone="true"]')
        if (element && zone) {
          const zoneRect = zone.getBoundingClientRect()
          const bookRect = element.getBoundingClientRect()
          const shelfIndex = Number(zone.dataset.shelfIndex)
          const cubeColumn = zone.dataset.cubeColumn === undefined ? undefined : Number(zone.dataset.cubeColumn)
          next[book.id] = {
            shelfIndex: Number.isInteger(shelfIndex) ? shelfIndex : baseShelfFor(book),
            cubeColumn: Number.isInteger(cubeColumn) ? cubeColumn : undefined,
            x: zoneRect.width ? clamp((bookRect.left - zoneRect.left) / zoneRect.width, 0, 1) : 0,
            y: 0,
            angle: 0,
            orientation: 'upright',
          }
          return
        }

        const shelfIndex = baseShelfFor(book)
        const cubeColumn = shelfStyle === 'cube' ? defaultCubeColumn(book) : undefined
        const index = profileBooks.filter((candidate) => baseShelfFor(candidate) === shelfIndex).findIndex((candidate) => candidate.id === book.id)
        next[book.id] = defaultPlacement(Math.max(0, index), shelfIndex, cubeColumn)
      })

      return next
    })
    setOrganizeMode(true)
  }

  function finishOrganizing() {
    setOrganizeMode(false)
    setDraggingBookId(null)
    setPlacementPreview(null)
    setActiveBookId(null)
  }

  function resetCurrentProfile() {
    setLayoutProfiles((currentProfiles) => {
      const next = { ...currentProfiles }
      delete next[activeProfileKey]
      return next
    })
    setActiveBookId(null)
    setPlacementPreview(null)
    setDraggingBookId(null)
  }

  function changeFilter(nextFilter: ShelfFilter) {
    if (organizeMode) return
    setFilter(nextFilter)
    setActiveBookId(null)
    setPlacementPreview(null)
  }

  function getBookIndexInZone(book: Book, shelfIndex: number, cubeColumn?: number) {
    const peers = profileBooks.filter((candidate) => {
      if (currentShelfFor(candidate) !== shelfIndex) return false
      if (cubeColumn === undefined) return true
      return cubeColumnFor(candidate) === cubeColumn
    })
    return Math.max(0, peers.findIndex((candidate) => candidate.id === book.id))
  }

  function evaluatePreview(book: Book, zone: HTMLElement, clientX: number) {
    const shelfIndex = Number(zone.dataset.shelfIndex)
    if (!Number.isInteger(shelfIndex)) return null
    const cubeColumn = zone.dataset.cubeColumn === undefined ? undefined : Number(zone.dataset.cubeColumn)
    const rect = zone.getBoundingClientRect()
    const current = freePlacement[book.id] ?? defaultPlacement(0, currentShelfFor(book), shelfStyle === 'cube' ? cubeColumnFor(book) : undefined)
    const bookIndex = getBookIndexInZone(book, shelfIndex, cubeColumn)
    const dims = visualDimensions(book, bookIndex, current.orientation)
    const maxLeft = Math.max(0, rect.width - dims.width)
    let left = clamp(clientX - rect.left - dragOffset.current.x, 0, maxLeft)

    if (left < snapDistance) left = 0
    if (maxLeft - left < snapDistance) left = maxLeft

    const zoneBooks = profileBooks.filter((candidate) => {
      if (candidate.id === book.id) return false
      const placement = freePlacement[candidate.id]
      if (!placement || placement.shelfIndex !== shelfIndex) return false
      if (cubeColumn === undefined) return placement.cubeColumn === undefined
      return placement.cubeColumn === cubeColumn
    })

    for (const other of zoneBooks) {
      const otherPlacement = freePlacement[other.id]
      if (!otherPlacement) continue
      const otherIndex = getBookIndexInZone(other, shelfIndex, cubeColumn)
      const otherDims = visualDimensions(other, otherIndex, otherPlacement.orientation)
      const otherLeft = otherPlacement.x * rect.width
      const otherRight = otherLeft + otherDims.width

      if (Math.abs(left - otherRight) <= snapDistance) left = otherRight
      if (Math.abs((left + dims.width) - otherLeft) <= snapDistance) left = otherLeft - dims.width
    }

    left = clamp(left, 0, maxLeft)

    let supportY = 0
    for (const other of zoneBooks) {
      const otherPlacement = freePlacement[other.id]
      if (!otherPlacement || otherPlacement.orientation !== 'horizontal') continue
      const otherIndex = getBookIndexInZone(other, shelfIndex, cubeColumn)
      const otherDims = visualDimensions(other, otherIndex, otherPlacement.orientation)
      const otherLeft = otherPlacement.x * rect.width
      if (horizontalOverlap(left, dims.width, otherLeft, otherDims.width) > 8) {
        supportY = Math.max(supportY, otherPlacement.y + otherDims.height)
      }
    }

    let valid = supportY + dims.height <= rect.height - 8

    for (const other of zoneBooks) {
      const otherPlacement = freePlacement[other.id]
      if (!otherPlacement) continue
      const otherIndex = getBookIndexInZone(other, shelfIndex, cubeColumn)
      const otherDims = visualDimensions(other, otherIndex, otherPlacement.orientation)
      const otherLeft = otherPlacement.x * rect.width
      const overlapX = horizontalOverlap(left, dims.width, otherLeft, otherDims.width)
      if (overlapX <= 5) continue

      const candidateBottom = supportY
      const candidateTop = supportY + dims.height
      const otherBottom = otherPlacement.y
      const otherTop = otherPlacement.y + otherDims.height
      const overlapY = Math.min(candidateTop, otherTop) - Math.max(candidateBottom, otherBottom)
      if (overlapY > 5) valid = false
    }

    return {
      bookId: book.id,
      shelfIndex,
      cubeColumn,
      x: rect.width ? left / rect.width : 0,
      y: supportY,
      angle: current.angle,
      orientation: current.orientation,
      valid,
    } satisfies PlacementPreview
  }

  function beginBookDrag(event: ReactPointerEvent<HTMLButtonElement>, book: Book) {
    if (!organizeMode) return
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    dragOffset.current = {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(rect.bottom - event.clientY, 0, rect.height),
    }
    setActiveBookId(book.id)
    setDraggingBookId(book.id)
  }

  useEffect(() => {
    if (!organizeMode || !draggingBookId) return

    const book = profileBooks.find((candidate) => candidate.id === draggingBookId)
    if (!book) return

    function move(event: PointerEvent) {
      const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
      const zone = element?.closest<HTMLElement>('[data-shelf-zone="true"]')
      if (!zone) {
        setPlacementPreview(null)
        return
      }
      setPlacementPreview(evaluatePreview(book, zone, event.clientX))
    }

    function finish() {
      setPlacementPreview((preview) => {
        if (preview?.bookId === draggingBookId && preview.valid) {
          const { bookId, valid: _valid, ...placement } = preview
          updateActiveProfile((current) => ({ ...current, [bookId]: placement }))
        }
        return null
      })
      setDraggingBookId(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish, { once: true })
    window.addEventListener('pointercancel', finish, { once: true })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [organizeMode, draggingBookId, profileBooks, freePlacement, shelfStyle, activeProfileKey])

  function updateActiveBookPlacement(patch: Partial<BookPlacement>) {
    if (!activeBook) return
    const shelfIndex = currentShelfFor(activeBook)
    const cubeColumn = shelfStyle === 'cube' ? cubeColumnFor(activeBook) : undefined
    const index = getBookIndexInZone(activeBook, shelfIndex, cubeColumn)
    const current = placementFor(activeBook, index, shelfIndex, cubeColumn)
    updateActiveProfile((placements) => ({
      ...placements,
      [activeBook.id]: {
        ...current,
        ...patch,
        y: patch.orientation !== undefined ? 0 : (patch.y ?? current.y),
      },
    }))
  }

  function renderPreview(shelfIndex: number, cubeColumn?: number) {
    if (!placementPreview || placementPreview.shelfIndex !== shelfIndex || placementPreview.cubeColumn !== cubeColumn) return null
    const book = profileBooks.find((candidate) => candidate.id === placementPreview.bookId)
    if (!book) return null
    const index = getBookIndexInZone(book, shelfIndex, cubeColumn)
    const dimensions = bookDimensions(book, index)
    return (
      <div
        className={`placement-ghost ${placementPreview.valid ? 'valid' : 'invalid'} ${placementPreview.orientation === 'horizontal' ? 'horizontal' : ''}`}
        style={{
          '--ghost-x': `${placementPreview.x * 100}%`,
          '--ghost-y': `${placementPreview.y}px`,
          '--ghost-width': `${dimensions.width}px`,
          '--ghost-height': `${dimensions.height}px`,
          '--ghost-rotation': `${placementPreview.angle}deg`,
          '--ghost-color': book.color,
        } as CSSProperties}
        aria-hidden="true"
      />
    )
  }

  function renderBook(book: Book, index: number, shelfIndex: number, cubeColumn?: number) {
    const placement = freeLayoutActive ? placementFor(book, index, shelfIndex, cubeColumn) : undefined
    return (
      <BookSpine
        key={book.id}
        book={book}
        index={index}
        selected={organizeMode ? activeBookId === book.id : selectedBook?.id === book.id}
        glowFocus={glowFocus}
        detailsDisplay={detailsDisplay}
        organizeMode={organizeMode}
        placement={placement}
        onPointerDown={(event) => beginBookDrag(event, book)}
        onSelect={() => organizeMode ? setActiveBookId(book.id) : onSelect(book.id)}
      />
    )
  }

  const bookcaseContent = shelfStyle === 'cube' ? (
    <div className="bookcase-frame cube-bookcase-frame">
      <div className="cube-grid" style={{ '--cube-rows': shelfCount } as CSSProperties}>
        {Array.from({ length: shelfCount }, (_, shelfIndex) =>
          Array.from({ length: cubeColumns }, (_, cubeColumn) => {
            const cellBooks = visibleBooks.filter(
              (book) => currentShelfFor(book) === shelfIndex && cubeColumnFor(book) === cubeColumn,
            )
            const lastRow = shelfIndex === shelfCount - 1
            const lastColumn = cubeColumn === cubeColumns - 1

            return (
              <div
                className={`cube-cell ${lastRow ? 'cube-last-row' : ''} ${lastColumn ? 'cube-last-column' : ''} ${organizeMode ? 'organize-zone' : ''}`}
                key={`${shelfIndex}:${cubeColumn}`}
                data-shelf-zone="true"
                data-shelf-index={shelfIndex}
                data-cube-column={cubeColumn}
                aria-label={`Cubby row ${shelfIndex + 1}, column ${cubeColumn + 1}`}
              >
                <div className={`cube-books ${freeLayoutActive ? 'free-layout-zone' : ''}`}>
                  {cellBooks.length === 0 && !organizeMode && <span className="cube-empty">Empty cubby</span>}
                  {cellBooks.map((book, index) => renderBook(book, index, shelfIndex, cubeColumn))}
                  {renderPreview(shelfIndex, cubeColumn)}
                </div>
              </div>
            )
          }),
        )}
      </div>
    </div>
  ) : (
    <div className="bookcase-frame">
      {Array.from({ length: shelfCount }, (_, shelfIndex) => {
        const shelfBooks = visibleBooks.filter((book) => currentShelfFor(book) === shelfIndex)
        return (
          <div className={`shelf-row ${organizeMode ? 'organize-zone' : ''}`} key={shelfIndex}>
            <div
              className={`books ${freeLayoutActive ? 'free-layout-zone' : ''}`}
              data-shelf-zone="true"
              data-shelf-index={shelfIndex}
              aria-label={`Shelf ${shelfIndex + 1}`}
            >
              {shelfBooks.length === 0 && !organizeMode && <div className="empty-shelf">Empty shelf</div>}
              {shelfBooks.map((book, index) => renderBook(book, index, shelfIndex))}
              {renderPreview(shelfIndex)}
            </div>
            <div className="wood-shelf" />
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      <div className="library-summary">
        <span><strong>{books.length}</strong> books</span>
        <span><strong>{reading}</strong> reading</span>
        <span><strong>{finished}</strong> finished</span>
      </div>

      <div className="library-toolbar">
        <div className="library-filters" role="tablist" aria-label="Choose a saved reading shelf">
          {filters.map((option) => (
            <button
              type="button"
              role="tab"
              aria-selected={filter === option.value}
              className={filter === option.value ? 'library-filter active' : 'library-filter'}
              onClick={() => changeFilter(option.value)}
              disabled={organizeMode && option.value !== filter}
              key={option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="organize-actions">
          <span className="layout-profile-note"><strong>{activeStyleName}</strong><span>{activeFilterLabel} layout</span><small>saved separately</small></span>
          {!organizeMode ? (
            <button type="button" className="organize-button" onClick={initializeFreeLayout}>✥ Organize Shelf</button>
          ) : (
            <>
              <button type="button" className="organize-reset" onClick={resetCurrentProfile}>Reset this layout</button>
              <button type="button" className="organize-done" onClick={finishOrganizing}>✓ Done</button>
            </>
          )}
        </div>
      </div>

      {organizeMode && (
        <section className="organize-mode-bar" aria-label="Shelf organization controls">
          <div>
            <strong>Organizing {activeStyleName} · {activeFilterLabel}</strong>
            <span>This is its own saved showcase. Drag, lean, stack, and place books here without changing your other shelf styles or reading views.</span>
          </div>
          {activeBook ? (
            <div className="book-transform-controls" aria-label={`Position controls for ${activeBook.title}`}>
              <span>{activeBook.title}</span>
              <button type="button" onClick={() => updateActiveBookPlacement({ orientation: 'upright', angle: -12 })}>↙ Lean left</button>
              <button type="button" onClick={() => updateActiveBookPlacement({ orientation: 'upright', angle: 0 })}>↥ Upright</button>
              <button type="button" onClick={() => updateActiveBookPlacement({ orientation: 'upright', angle: 12 })}>Lean right ↘</button>
              <button type="button" onClick={() => updateActiveBookPlacement({ orientation: 'horizontal', angle: 0 })}>▰ Lay flat</button>
            </div>
          ) : (
            <span className="organize-hint">Select a book to rotate or lean it.</span>
          )}
        </section>
      )}

      <div className={`layout ${detailsDisplay === 'card' ? 'layout-full-shelf' : ''} ${organizeMode ? 'layout-organizing' : ''}`}>
        <section className={`bookcase freeform-bookcase shelf-style-${shelfStyle} shelf-finish-${shelfFinish} ${organizeMode ? 'bookcase-organizing' : ''}`} aria-label={`${activeStyleName}, ${activeFilterLabel} saved bookshelf`}>
          {shelfStyle !== 'floating' && <div className="bookcase-top-decor" aria-hidden="true" />}
          <div className="bookcase-stage">
            <div className="bookcase-side-decor side-decor-left" title="Reserved for future side decorations" aria-hidden="true"><span>+</span></div>
            {bookcaseContent}
            <div className="bookcase-side-decor side-decor-right" title="Reserved for future side decorations" aria-hidden="true"><span>+</span></div>
          </div>
        </section>
        {detailsDisplay === 'side' && !organizeMode && sidePanel}
      </div>
    </>
  )
}
