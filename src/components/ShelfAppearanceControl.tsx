import { BookOpen, Headphones, Smartphone, Sparkles } from 'lucide-react'
import type { Book, BookFormat, ShelfDisplayStyle } from '../data/books'

const displayStyles: ShelfDisplayStyle[] = [
  'Auto',
  'Spine',
  'Front Cover',
  'Cassette',
  'Cassette Case',
  'Audio Case',
  'E-reader',
  'Digital Tile',
]

export function defaultDisplayStyle(format?: BookFormat): ShelfDisplayStyle {
  if (format === 'Audiobook') return 'Cassette'
  if (format === 'Ebook') return 'E-reader'
  return 'Spine'
}

function iconForStyle(style: ShelfDisplayStyle) {
  if (style === 'Cassette' || style === 'Cassette Case' || style === 'Audio Case') return <Headphones size={16} />
  if (style === 'E-reader' || style === 'Digital Tile') return <Smartphone size={16} />
  if (style === 'Auto') return <Sparkles size={16} />
  return <BookOpen size={16} />
}

export function ShelfAppearanceControl({
  book,
  onUpdate,
}: {
  book: Book
  onUpdate: (id: string, patch: Partial<Book>) => void
}) {
  const selected = book.displayStyle ?? 'Auto'
  const automatic = defaultDisplayStyle(book.format)
  const hasCover = Boolean(book.displayCoverUrl ?? book.coverUrl)

  return (
    <div className="detail-card shelf-appearance-card">
      <div className="card-heading">
        <span>Shelf appearance</span>
        <Sparkles size={18} />
      </div>

      <p className="appearance-help">
        Choose how this book looks on your shelf. Auto currently uses <strong>{automatic}</strong> for {book.format ?? 'this format'}.
      </p>

      <div className="appearance-options" role="radiogroup" aria-label="Shelf display style">
        {displayStyles.map((style) => (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={selected === style}
            className={selected === style ? 'appearance-option active' : 'appearance-option'}
            onClick={() => onUpdate(book.id, { displayStyle: style })}
          >
            {iconForStyle(style)}
            <span>{style}</span>
          </button>
        ))}
      </div>

      <small className="appearance-note">
        {hasCover
          ? 'Cover art is connected. Spine uses it as a wrapped texture; Front Cover displays the real cover face-out and uses more shelf space.'
          : 'No cover image was found for this result yet. Shelfie falls back to its generated spine design.'}
      </small>
    </div>
  )
}
