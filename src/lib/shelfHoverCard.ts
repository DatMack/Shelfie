type HoverBook = {
  id: string
  title?: string
  author?: string
  year?: number
}

const libraryStorageKey = 'shelfie-books-v1'
const tooltipId = 'shelfie-book-hover-card'

function getTooltip() {
  let tooltip = document.getElementById(tooltipId)
  if (tooltip) return tooltip

  tooltip = document.createElement('div')
  tooltip.id = tooltipId
  tooltip.className = 'shelf-book-hover-card'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.setAttribute('aria-hidden', 'true')

  const title = document.createElement('strong')
  title.className = 'shelf-book-hover-title'
  const meta = document.createElement('span')
  meta.className = 'shelf-book-hover-meta'

  tooltip.append(title, meta)
  document.body.appendChild(tooltip)
  return tooltip
}

function loadBook(id: string): HoverBook | undefined {
  try {
    const raw = localStorage.getItem(libraryStorageKey)
    if (!raw) return undefined
    const books = JSON.parse(raw) as HoverBook[]
    return books.find((book) => book.id === id)
  } catch {
    return undefined
  }
}

function positionTooltip(tooltip: HTMLElement, clientX: number, clientY: number) {
  const maxWidth = 236
  const left = Math.min(window.innerWidth - maxWidth - 12, Math.max(12, clientX + 14))
  let top = clientY - 72
  if (top < 12) top = clientY + 18

  tooltip.style.left = `${left}px`
  tooltip.style.top = `${top}px`
}

function showTooltip(bookElement: HTMLElement, clientX: number, clientY: number) {
  if (bookElement.closest('.bookcase-organizing')) return

  const id = bookElement.dataset.shelfBookId
  if (!id) return

  // Avoid the browser's slower native title popup competing with Shelfie's card.
  bookElement.removeAttribute('title')

  const book = loadBook(id)
  if (!book) return

  const tooltip = getTooltip()
  const title = tooltip.querySelector<HTMLElement>('.shelf-book-hover-title')
  const meta = tooltip.querySelector<HTMLElement>('.shelf-book-hover-meta')

  if (title) title.textContent = book.title || 'Book'
  if (meta) {
    const author = book.author || 'Unknown author'
    const year = Number.isFinite(book.year) ? String(book.year) : 'Year unknown'
    meta.textContent = `${author} · ${year}`
  }

  positionTooltip(tooltip, clientX, clientY)
  tooltip.classList.add('visible')
  tooltip.setAttribute('aria-hidden', 'false')
}

function hideTooltip() {
  const tooltip = document.getElementById(tooltipId)
  if (!tooltip) return
  tooltip.classList.remove('visible')
  tooltip.setAttribute('aria-hidden', 'true')
}

document.addEventListener('pointerover', (event) => {
  const target = event.target as HTMLElement | null
  const book = target?.closest<HTMLElement>('.book-spine[data-shelf-book-id]')
  if (!book) return
  showTooltip(book, event.clientX, event.clientY)
})

document.addEventListener('pointermove', (event) => {
  const target = event.target as HTMLElement | null
  const book = target?.closest<HTMLElement>('.book-spine[data-shelf-book-id]')
  const tooltip = document.getElementById(tooltipId)
  if (!book || !tooltip?.classList.contains('visible')) return
  positionTooltip(tooltip, event.clientX, event.clientY)
})

document.addEventListener('pointerout', (event) => {
  const target = event.target as HTMLElement | null
  const book = target?.closest<HTMLElement>('.book-spine[data-shelf-book-id]')
  if (!book) return

  const related = event.relatedTarget as Node | null
  if (related && book.contains(related)) return
  hideTooltip()
})

document.addEventListener('pointerdown', hideTooltip)
window.addEventListener('blur', hideTooltip)
