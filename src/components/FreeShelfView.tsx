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
  const [draggedBookId, setDraggedBookId] = useState<string | null>(null)
  const [dragOverBookId, setDragOverBookId] = useState<string | null>(null)
  const [dragOverShelf, setDragOverShelf] = useState<number | null>(null)

  useEffect(() => {
    function refreshCustomization() {
      setShelfStyle(loadShelfStyle())
      setShelfFinish(loadShelfFinish())
    }
    window.addEventListener(customizationEvent, refreshCustomization)
    return () => window.removeEventListener(customizationEvent, refreshCustomization)
  }, [])

  const visibleBooks = useMemo(
    () => filter === 'All' ? searchFiltered : searchFiltered.filter((book) => book.status === filter),
    [searchFiltered, filter],
  )

  const finished = books.filter((book) => book.status === 'Read').length
  const reading = books.filter((book) => book.status === 'Currently Reading').length

  function clearDragState() {
    setDraggedBookId(null)
    setDragOverBookId(null)
    setDragOverShelf(null)
  }

  function startDrag(event: DragEvent<HTMLButtonElement>, book: Book) {
    setDraggedBookId(book.id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', book.id)
  }

  function getDraggedId(event: DragEvent<HTMLElement>) {
    return draggedBookId || event.dataTransfer.getData('text/plain')
  }

  function dropOnBook(event: DragEvent<HTMLButtonElement>, targetBook: Book, shelfIndex: number) {
    event.preventDefault()
    event.stopPropagation()
    const draggedId = getDraggedId(event)
    if (draggedId) onReorder(draggedId, targetBook.id, shelfIndex)
    clearDragState()
  }

  function dropOnShelf(event: DragEvent<HTMLDivElement>, shelfIndex: number) {
    event.preventDefault()
    const draggedId = getDraggedId(event)
    if (draggedId) onReorder(draggedId, null, shelfIndex)
    clearDragState()
  }

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
                      setDragOverBookId(null)
                    }}
                    onDrop={(event) => dropOnShelf(event, shelfIndex)}
                    aria-label={`Shelf ${shelfIndex + 1}`}
                  >
                    {shelfBooks.length === 0 && (
                      <div className="empty-shelf">{filter === 'All' ? 'Drop a book here.' : 'No matching books on this shelf.'}</div>
                    )}
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
                          setDragOverShelf(shelfIndex)
                          setDragOverBookId(book.id)
                        }}
                        onDrop={(event) => dropOnBook(event, book, shelfIndex)}
                        onDragEnd={clearDragState}
                        onClick={() => onSelect(book.id)}
                        aria-label={`${book.title} by ${book.author}. Drag to rearrange.`}
                        title={detailsDisplay === 'card' ? 'Click for book details · drag to rearrange' : 'Drag to rearrange'}
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
        {detailsDisplay === 'side' && sidePanel}
      </div>
    </>
  )
}
