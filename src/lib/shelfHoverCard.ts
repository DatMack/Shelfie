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

  if (!bookElement.dataset.shelfBookId) return

  // Avoid the browser's slower native title popup competing with Shelfie's card.
  bookElement.removeAttribute('title')

  const tooltip = getTooltip()
  const title = tooltip.querySelector<HTMLElement>('.shelf-book-hover-title')
  const meta = tooltip.querySelector<HTMLElement>('.shelf-book-hover-meta')

  if (title) title.textContent = bookElement.dataset.bookTitle || 'Book'
  if (meta) {
    const author = bookElement.dataset.bookAuthor || 'Unknown author'
    const year = bookElement.dataset.bookYear || 'Year unknown'
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

document.addEventListener('focusin', (event) => {
  const target = event.target as HTMLElement | null
  const book = target?.closest<HTMLElement>('.book-spine[data-shelf-book-id]')
  if (!book) return
  const bounds = book.getBoundingClientRect()
  showTooltip(book, bounds.right, bounds.top + bounds.height / 2)
})

document.addEventListener('focusout', (event) => {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.book-spine[data-shelf-book-id]')) return
  hideTooltip()
})

document.addEventListener('pointerdown', hideTooltip)
window.addEventListener('blur', hideTooltip)
