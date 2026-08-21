import { CSSProperties, DragEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import type { Book, ReadingStatus } from '../data/books'
import type { ShelfFinishId, ShelfStyleId } from '../data/customization'
import { customizationEvent, loadShelfFinish, loadShelfStyle } from '../lib/customizationRuntime'

export type ShelfFilter = 'All' | ReadingStatus

const filters: Array<{ value: ShelfFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Currently Reading', label: 'Reading' },
  { value: 'Want to Read', label: 'To Read' },
  { value: 'Read', label: 'Read' },
  { value: 'DNF', label: 'DNF' },
]

const cubeColumns = 3
const cubePlacementKey = 'shelfie-cube-placement-v1'

type CubePlacement = Record<string, number>

type BookSpineProps = {
  book: Book
  index: number
  selected: boolean
  glowFocus: boolean
  dragging: boolean
  dropTarget: boolean
  detailsDisplay: 'side' | 'card'
  onSelect: () => void
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void
  onDrop: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
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

function BookSpine({
  book,
  index,
  selected,
  glowFocus,
  dragging,
  dropTarget,
  detailsDisplay,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: BookSpineProps) {
  const dimensions = bookDimensions(book, index)
  const formatClass = (book.format ?? 'standard').toLowerCase().replaceAll(' ', '-')

  return (
    <button
      className={`book-spine book-format-${formatClass} ${selected ? 'selected' : ''} ${glowFocus ? 'glow-focus' : ''} ${dragging ? 'dragging' : ''} ${dropTarget ? 'drop-target' : ''}`}
      style={{
        '--book-color': book.color,
        '--book-accent': book.accent,
        '--book-height': `${dimensions.height}px`,
        '--book-width': `${dimensions.width}px`,
      } as CSSProperties}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      aria-label={`${book.title} by ${book.author}. ${book.format ?? 'Book'} format. Drag to rearrange.`}
      title={detailsDisplay === 'card' ? 'Click for book details · drag to rearrange' : 'Drag to rearrange'}
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
    <div className="bookcase-top-decor" title="Preview space for earned and placed decorations later" aria-label="Future top decoration area">
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
  const [draggedBookId, setDraggedBookId] = useState<string | null>(null)
  const [dragOverBookId, setDragOverBookId] = useState<string | null>(null)
  const [dragOverShelf, setDragOverShelf] = useState<number | null>(null)
  const [dragOverCube, setDragOverCube] = useState<string | null>(null)

  useEffect(() => {
    function refreshCustomization() {
      setShelfStyle(loadShelfStyle())
      setShelfFinish(loadShelfFinish())
    }
    window.addEventListener(customizationEvent, refreshCustomization)
    return () => window.removeEventListener(customizationEvent, refreshCustomization)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(cubePlacementKey, JSON.stringify(cubePlacement))
    } catch {
      // Cube placement can still work for the current session if browser storage is unavailable.
    }
  }, [cubePlacement])

  const visibleBooks = useMemo(
    () => filter === 'All' ? searchFiltered : searchFiltered.filter((book) => book.status === filter),
    [searchFiltered, filter],
  )

  const finished = books.filter((book) => book.status === 'Read').length
  const reading = books.filter((book) => book.status === 'Currently Reading').length

  function defaultCubeColumn(book: Book) {
    const peers = books.filter((candidate) => (candidate.shelfIndex ?? 0) === (book.shelfIndex ?? 0))
    const index = Math.max(0, peers.findIndex((candidate) => candidate.id === book.id))
    return Math.min(cubeColumns - 1, Math.floor(index / 2))
  }

  function cubeColumnFor(book: Book) {
    return cubePlacement[book.id] ?? defaultCubeColumn(book)
  }

  function clearDragState() {
    setDraggedBookId(null)
    setDragOverBookId(null)
    setDragOverShelf(null)
    setDragOverCube(null)
  }

  function startDrag(event: DragEvent<HTMLButtonElement>, book: Book) {
    setDraggedBookId(book.id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', book.id)
  }

  function getDraggedId(event: DragEvent<HTMLElement>) {
    return draggedBookId || event.dataTransfer.getData('text/plain')
  }

  function dropOnBook(event: DragEvent<HTMLButtonElement>, targetBook: Book, shelfIndex: number, cubeColumn?: number) {
    event.preventDefault()
    event.stopPropagation()
    const draggedId = getDraggedId(event)
    if (draggedId) {
      if (cubeColumn !== undefined) {
        setCubePlacement((current) => ({ ...current, [draggedId]: cubeColumn }))
      }
      onReorder(draggedId, targetBook.id, shelfIndex)
    }
    clearDragState()
  }

  function dropOnShelf(event: DragEvent<HTMLDivElement>, shelfIndex: number) {
    event.preventDefault()
    const draggedId = getDraggedId(event)
    if (draggedId) onReorder(draggedId, null, shelfIndex)
    clearDragState()
  }

  function dropOnCube(event: DragEvent<HTMLDivElement>, shelfIndex: number, cubeColumn: number) {
    event.preventDefault()
    const draggedId = getDraggedId(event)
    if (draggedId) {
      setCubePlacement((current) => ({ ...current, [draggedId]: cubeColumn }))
      onReorder(draggedId, null, shelfIndex)
    }
    clearDragState()
  }

  function renderBook(book: Book, index: number, shelfIndex: number, cubeColumn?: number) {
    return (
      <BookSpine
        key={book.id}
        book={book}
        index={index}
        selected={selectedBook?.id === book.id}
        glowFocus={glowFocus}
        dragging={draggedBookId === book.id}
        dropTarget={dragOverBookId === book.id && draggedBookId !== book.id}
        detailsDisplay={detailsDisplay}
        onDragStart={(event) => startDrag(event, book)}
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'move'
          setDragOverShelf(shelfIndex)
          setDragOverCube(cubeColumn === undefined ? null : `${shelfIndex}:${cubeColumn}`)
          setDragOverBookId(book.id)
        }}
        onDrop={(event) => dropOnBook(event, book, shelfIndex, cubeColumn)}
        onDragEnd={clearDragState}
        onSelect={() => onSelect(book.id)}
      />
    )
  }

  const bookcaseContent = shelfStyle === 'cube' ? (
    <div className="bookcase-frame cube-bookcase-frame">
      <div className="cube-grid" style={{ '--cube-rows': shelfCount } as CSSProperties}>
        {Array.from({ length: shelfCount }, (_, shelfIndex) =>
          Array.from({ length: cubeColumns }, (_, cubeColumn) => {
            const cellId = `${shelfIndex}:${cubeColumn}`
            const cellBooks = visibleBooks.filter(
              (book) => (book.shelfIndex ?? 0) === shelfIndex && cubeColumnFor(book) === cubeColumn,
            )
            const lastRow = shelfIndex === shelfCount - 1
            const lastColumn = cubeColumn === cubeColumns - 1

            return (
              <div
                className={`cube-cell ${lastRow ? 'cube-last-row' : ''} ${lastColumn ? 'cube-last-column' : ''} ${dragOverCube === cellId ? 'cube-drop-active' : ''}`}
                key={cellId}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setDragOverShelf(shelfIndex)
                  setDragOverCube(cellId)
                  setDragOverBookId(null)
                }}
                onDrop={(event) => dropOnCube(event, shelfIndex, cubeColumn)}
                aria-label={`Cubby row ${shelfIndex + 1}, column ${cubeColumn + 1}`}
              >
                <div className="cube-books">
                  {cellBooks.length === 0 && (
                    <span className="cube-empty">{filter === 'All' ? 'Drop here' : 'No matching books'}</span>
                  )}
                  {cellBooks.map((book, index) => renderBook(book, index, shelfIndex, cubeColumn))}
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
        const shelfBooks = visibleBooks.filter((book) => (book.shelfIndex ?? 0) === shelfIndex)
        return (
          <div className={`shelf-row ${dragOverShelf === shelfIndex ? 'drag-over-shelf' : ''}`} key={shelfIndex}>
            <div
              className={`books ${dragOverShelf === shelfIndex && !dragOverBookId ? 'shelf-drop-active' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setDragOverShelf(shelfIndex)
                setDragOverCube(null)
                setDragOverBookId(null)
              }}
              onDrop={(event) => dropOnShelf(event, shelfIndex)}
              aria-label={`Shelf ${shelfIndex + 1}`}
            >
              {shelfBooks.length === 0 && (
                <div className="empty-shelf">{filter === 'All' ? 'Drop a book here.' : 'No matching books on this shelf.'}</div>
              )}
              {shelfBooks.map((book, index) => renderBook(book, index, shelfIndex))}
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
              onClick={() => setFilter(option.value)}
              key={option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="library-arrange-note">Filter what you see. Drag books anywhere — shelf position is yours.</span>
      </div>

      <div className={`layout ${detailsDisplay === 'card' ? 'layout-full-shelf' : ''}`}>
        <section className={`bookcase freeform-bookcase shelf-style-${shelfStyle} shelf-finish-${shelfFinish}`} aria-label="Freeform virtual bookshelf">
          <DecorPreview shelfStyle={shelfStyle} />
          <div className="bookcase-stage">
            <div className="bookcase-side-decor side-decor-left" title="Future side decoration area" aria-hidden="true"><span>+</span></div>
            {bookcaseContent}
            <div className="bookcase-side-decor side-decor-right" title="Future side decoration area" aria-hidden="true"><span>+</span></div>
          </div>
        </section>
        {detailsDisplay === 'side' && sidePanel}
      </div>
    </>
  )
}
