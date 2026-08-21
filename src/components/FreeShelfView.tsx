import { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { Book, ReadingStatus } from '../data/books'
import type { ShelfFinishId, ShelfStyleId } from '../data/customization'
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
type PlacementPreview = BookPlacement & { bookId: string; valid: boolean }

const filters: Array<{ value: ShelfFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Currently Reading', label: 'Reading' },
  { value: 'Want to Read', label: 'To Read' },
  { value: 'Read', label: 'Read' },
  { value: 'DNF', label: 'DNF' },
]

const cubeColumns = 3
const cubePlacementKey = 'shelfie-cube-placement-v1'
const freePlacementKey = 'shelfie-free-placement-v1'
const snapDistance = 14

type CubePlacement = Record<string, number>

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

function loadCubePlacement(): CubePlacement {
  try {
    const saved = localStorage.getItem(cubePlacementKey)
    if (!saved) return {}
    const parsed = JSON.parse(saved) as CubePlacement
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => Number.isInteger(value) && value >= 0 && value < cubeColumns),
    )
  } catch {
    return {}
  }
}

function loadFreePlacement(): PlacementMap {
  try {
    const saved = localStorage.getItem(freePlacementKey)
    if (!saved) return {}
    const parsed = JSON.parse(saved) as PlacementMap
    return Object.fromEntries(
      Object.entries(parsed).filter(([, placement]) => (
        placement
        && Number.isInteger(placement.shelfIndex)
        && placement.shelfIndex >= 0
        && typeof placement.x === 'number'
        && placement.x >= 0
        && placement.x <= 1
        && typeof placement.y === 'number'
        && placement.y >= 0
        && typeof placement.angle === 'number'
        && (placement.orientation === 'upright' || placement.orientation === 'horizontal')
      )),
    )
  } catch {
    return {}
  }
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
    ? Math.min(.86, .025 + index * .105)
    : Math.min(.7, .055 + index * .29)

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

function DecorPreview({ shelfStyle }: { shelfStyle: ShelfStyleId }) {
  if (shelfStyle === 'floating') return null

  return (
    <div className="bookcase-top-decor" title="Reserved for draggable earned decorations later" aria-label="Future top decoration area">
      <div className="decor-preview-stack" aria-hidden="true"><i /><i /><i /></div>
      <div className="decor-preview-mug" aria-hidden="true" />
      <div className="decor-preview-plant" aria-hidden="true"><i /><span /></div>
    </div>
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
  onReorder,
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
  const [cubePlacement, setCubePlacement] = useState<CubePlacement>(loadCubePlacement)
  const [freePlacement, setFreePlacement] = useState<PlacementMap>(loadFreePlacement)
  const [organizeMode, setOrganizeMode] = useState(false)
  const [activeBookId, setActiveBookId] = useState<string | null>(null)
  const [draggingBookId, setDraggingBookId] = useState<string | null>(null)
  const [placementPreview, setPlacementPreview] = useState<PlacementPreview | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    function refreshCustomization() {
      setShelfStyle(loadShelfStyle())
      setShelfFinish(loadShelfFinish())
    }
    window.addEventListener(customizationEvent, refreshCustomization)
    return () => window.removeEventListener(customizationEvent, refreshCustomization)
  }, [])

  useEffect(() => {
    try { localStorage.setItem(cubePlacementKey, JSON.stringify(cubePlacement)) } catch { /* Keep it in memory. */ }
  }, [cubePlacement])

  useEffect(() => {
    try { localStorage.setItem(freePlacementKey, JSON.stringify(freePlacement)) } catch { /* Keep it in memory. */ }
  }, [freePlacement])

  const visibleBooks = useMemo(
    () => filter === 'All' ? searchFiltered : searchFiltered.filter((book) => book.status === filter),
    [searchFiltered, filter],
  )

  const finished = books.filter((book) => book.status === 'Read').length
  const reading = books.filter((book) => book.status === 'Currently Reading').length
  const freeLayoutActive = organizeMode || Object.keys(freePlacement).length > 0
  const activeBook = books.find((book) => book.id === activeBookId)

  function currentShelfFor(book: Book) {
    return freePlacement[book.id]?.shelfIndex ?? book.shelfIndex ?? 0
  }

  function defaultCubeColumn(book: Book) {
    const shelfIndex = currentShelfFor(book)
    const peers = books.filter((candidate) => currentShelfFor(candidate) === shelfIndex)
    const index = Math.max(0, peers.findIndex((candidate) => candidate.id === book.id))
    return Math.min(cubeColumns - 1, Math.floor(index / 2))
  }

  function cubeColumnFor(book: Book) {
    return freePlacement[book.id]?.cubeColumn ?? cubePlacement[book.id] ?? defaultCubeColumn(book)
  }

  function placementFor(book: Book, index: number, shelfIndex: number, cubeColumn?: number) {
    const saved = freePlacement[book.id]
    if (saved) return saved
    return defaultPlacement(index, shelfIndex, cubeColumn)
  }

  function initializeFreeLayout() {
    setFilter('All')
    setFreePlacement((current) => {
      const next = { ...current }

      for (let shelfIndex = 0; shelfIndex < shelfCount; shelfIndex += 1) {
        if (shelfStyle === 'cube') {
          for (let cubeColumn = 0; cubeColumn < cubeColumns; cubeColumn += 1) {
            const cellBooks = books.filter((book) => currentShelfFor(book) === shelfIndex && cubeColumnFor(book) === cubeColumn)
            cellBooks.forEach((book, index) => {
              if (!next[book.id]) next[book.id] = defaultPlacement(index, shelfIndex, cubeColumn)
            })
          }
        } else {
          const shelfBooks = books.filter((book) => currentShelfFor(book) === shelfIndex)
          shelfBooks.forEach((book, index) => {
            if (!next[book.id]) next[book.id] = defaultPlacement(index, shelfIndex)
          })
        }
      }
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

  function resetFreeLayout() {
    setFreePlacement({})
    setActiveBookId(null)
    setPlacementPreview(null)
    try { localStorage.removeItem(freePlacementKey) } catch { /* Ignore browser storage failures. */ }
  }

  function getBookIndexInZone(book: Book, shelfIndex: number, cubeColumn?: number) {
    const peers = books.filter((candidate) => {
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

    const zoneBooks = books.filter((candidate) => {
      if (candidate.id === book.id) return false
      const placement = freePlacement[candidate.id]
      const candidateShelf = placement?.shelfIndex ?? candidate.shelfIndex ?? 0
      if (candidateShelf !== shelfIndex) return false
      if (cubeColumn === undefined) return true
      return (placement?.cubeColumn ?? cubeColumnFor(candidate)) === cubeColumn
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

    // Simple gravity: books fall to the shelf floor unless a horizontal stack is directly underneath them.
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

    // Prevent books from occupying the same physical volume. Lean angles are intentionally forgiving.
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

    const book = books.find((candidate) => candidate.id === draggingBookId)
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
          setFreePlacement((current) => ({ ...current, [bookId]: placement }))
          if (placement.cubeColumn !== undefined) {
            setCubePlacement((current) => ({ ...current, [bookId]: placement.cubeColumn as number }))
          }
          if (currentShelfFor(book) !== placement.shelfIndex) {
            onReorder(bookId, null, placement.shelfIndex)
          }
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
  }, [organizeMode, draggingBookId, books, freePlacement, shelfStyle])

  function updateActiveBookPlacement(patch: Partial<BookPlacement>) {
    if (!activeBook) return
    const shelfIndex = currentShelfFor(activeBook)
    const cubeColumn = shelfStyle === 'cube' ? cubeColumnFor(activeBook) : undefined
    const index = getBookIndexInZone(activeBook, shelfIndex, cubeColumn)
    const current = placementFor(activeBook, index, shelfIndex, cubeColumn)
    setFreePlacement((placements) => ({
      ...placements,
      [activeBook.id]: {
        ...current,
        ...patch,
        y: patch.orientation !== undefined || patch.angle !== undefined ? 0 : (patch.y ?? current.y),
      },
    }))
  }

  function renderPreview(shelfIndex: number, cubeColumn?: number) {
    if (!placementPreview || placementPreview.shelfIndex !== shelfIndex || placementPreview.cubeColumn !== cubeColumn) return null
    const book = books.find((candidate) => candidate.id === placementPreview.bookId)
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
        <div className="library-filters" role="tablist" aria-label="Filter bookshelf by reading status">
          {filters.map((option) => (
            <button
              type="button"
              role="tab"
              aria-selected={filter === option.value}
              className={filter === option.value ? 'library-filter active' : 'library-filter'}
              onClick={() => !organizeMode && setFilter(option.value)}
              disabled={organizeMode && option.value !== 'All'}
              key={option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="organize-actions">
          {!organizeMode ? (
            <button type="button" className="organize-button" onClick={initializeFreeLayout}>✥ Organize Shelf</button>
          ) : (
            <>
              <button type="button" className="organize-reset" onClick={resetFreeLayout}>Reset layout</button>
              <button type="button" className="organize-done" onClick={finishOrganizing}>✓ Done</button>
            </>
          )}
        </div>
      </div>

      {organizeMode && (
        <section className="organize-mode-bar" aria-label="Shelf organization controls">
          <div>
            <strong>Organize mode</strong>
            <span>Drag books freely. Shelfie snaps to edges and nearby books, and gravity keeps books on a shelf or supported stack.</span>
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
        <section className={`bookcase freeform-bookcase shelf-style-${shelfStyle} shelf-finish-${shelfFinish} ${organizeMode ? 'bookcase-organizing' : ''}`} aria-label="Freeform virtual bookshelf">
          <DecorPreview shelfStyle={shelfStyle} />
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
