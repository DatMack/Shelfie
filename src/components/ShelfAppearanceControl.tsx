import { useRef, useState } from 'react'
import { BookOpen, Camera, Headphones, ImagePlus, Smartphone, Sparkles, Trash2 } from 'lucide-react'
import type { Book, BookFormat, ShelfDisplayStyle, SpineDesign, SpineTitleFont } from '../data/books'
import { uploadCustomSpine } from '../lib/shelfieData'

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

const spineTitleFonts: SpineTitleFont[] = ['Classic', 'Modern', 'Typewriter', 'Storybook']

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
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const spineDesign: SpineDesign = book.spineDesign ?? 'Leather'

  async function chooseSpineImage(file?: File) {
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadCustomSpine(book.id, file)
      onUpdate(book.id, {
        displayStyle: 'Spine',
        spineDesign: 'Custom Image',
        customSpineUrl: url,
        customSpinePositionX: 50,
        customSpinePositionY: 50,
        customSpineZoom: 100,
      })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not upload that image.')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

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
          ? 'Front Cover displays the edition cover face-out. Spine uses your leather or custom spine design.'
          : 'Use a leather spine or upload a picture of the real spine.'}
      </small>

      {(selected === 'Spine' || (selected === 'Auto' && automatic === 'Spine')) && (
        <div className="spine-editor">
          <div className="spine-editor-heading">
            <strong>Spine design</strong>
            <span>Customize this copy</span>
          </div>
          <div className="spine-design-options">
            {(['Leather', 'Custom Image'] as SpineDesign[]).map((design) => (
              <button
                type="button"
                key={design}
                className={spineDesign === design ? 'spine-design-button active' : 'spine-design-button'}
                onClick={() => onUpdate(book.id, { spineDesign: design })}
              >
                {design === 'Leather' ? <BookOpen size={16} /> : <Camera size={16} />}{design}
              </button>
            ))}
          </div>

          {spineDesign === 'Leather' ? (
            <div className="spine-color-fields">
              <label><span>Book color</span><input aria-label="Book color" type="color" value={book.color} onChange={(event) => onUpdate(book.id, { color: event.target.value })} /></label>
              <label><span>Details</span><input aria-label="Spine detail color" type="color" value={book.accent} onChange={(event) => onUpdate(book.id, { accent: event.target.value })} /></label>
            </div>
          ) : (
            <div className="custom-spine-controls">
              <input
                ref={fileInput}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                onChange={(event) => void chooseSpineImage(event.target.files?.[0])}
              />
              <button type="button" className="spine-upload-button" disabled={uploading} onClick={() => fileInput.current?.click()}>
                <ImagePlus size={17} /> {uploading ? 'Uploading…' : book.customSpineUrl ? 'Replace spine picture' : 'Add spine picture'}
              </button>
              {uploadError && <p className="spine-upload-error">{uploadError}</p>}
              {book.customSpineUrl && (
                <>
                  <div className="spine-crop-preview" style={{ '--preview-color': book.color } as React.CSSProperties}>
                    <img
                      src={book.customSpineUrl}
                      alt="Custom spine crop preview"
                      style={{
                        objectPosition: `${book.customSpinePositionX ?? 50}% ${book.customSpinePositionY ?? 50}%`,
                        transform: `scale(${(book.customSpineZoom ?? 100) / 100})`,
                        transformOrigin: `${book.customSpinePositionX ?? 50}% ${book.customSpinePositionY ?? 50}%`,
                      }}
                    />
                  </div>
                  <label className="spine-range"><span>Move left/right</span><input type="range" min="0" max="100" value={book.customSpinePositionX ?? 50} onChange={(event) => onUpdate(book.id, { customSpinePositionX: Number(event.target.value) })} /></label>
                  <label className="spine-range"><span>Move up/down</span><input type="range" min="0" max="100" value={book.customSpinePositionY ?? 50} onChange={(event) => onUpdate(book.id, { customSpinePositionY: Number(event.target.value) })} /></label>
                  <label className="spine-range"><span>Zoom</span><input type="range" min="100" max="300" value={book.customSpineZoom ?? 100} onChange={(event) => onUpdate(book.id, { customSpineZoom: Number(event.target.value) })} /></label>
                  <button type="button" className="spine-remove-button" onClick={() => onUpdate(book.id, { spineDesign: 'Leather', customSpineUrl: null })}><Trash2 size={15} /> Remove picture</button>
                </>
              )}
            </div>
          )}

          <div className="spine-title-settings">
            <label className="spine-title-toggle">
              <span>
                <strong>Show title on spine</strong>
                <small>Only changes this book</small>
              </span>
              <input
                type="checkbox"
                checked={book.showSpineTitle ?? true}
                onChange={(event) => onUpdate(book.id, { showSpineTitle: event.target.checked })}
              />
              <span className="toggle-ui" aria-hidden="true" />
            </label>

            {(book.showSpineTitle ?? true) && (
              <div className="spine-title-fields">
                <label>
                  <span>Title font</span>
                  <select
                    value={book.spineTitleFont ?? 'Classic'}
                    onChange={(event) => onUpdate(book.id, { spineTitleFont: event.target.value as SpineTitleFont })}
                  >
                    {spineTitleFonts.map((font) => <option key={font} value={font}>{font}</option>)}
                  </select>
                </label>
                <label>
                  <span>Title color</span>
                  <input
                    aria-label="Spine title color"
                    type="color"
                    value={book.spineTitleColor ?? book.accent}
                    onChange={(event) => onUpdate(book.id, { spineTitleColor: event.target.value })}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
