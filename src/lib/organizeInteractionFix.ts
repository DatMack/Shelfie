const layoutProfilesKey = 'shelfie-layout-profiles-v4'

const filterLabels: Record<string, string> = {
  All: 'All',
  Reading: 'Currently Reading',
  'To Read': 'Want to Read',
  Read: 'Read',
  DNF: 'DNF',
}

function activeProfileKey() {
  const bookcase = document.querySelector<HTMLElement>('.freeform-bookcase')
  if (!bookcase) return null

  const styleClass = [...bookcase.classList].find((name) => name.startsWith('shelf-style-'))
  if (!styleClass) return null
  const style = styleClass.replace('shelf-style-', '')

  const activeFilter = document.querySelector<HTMLButtonElement>('.library-filter.active')
  const label = activeFilter?.textContent?.trim() || 'All'
  const filter = filterLabels[label] ?? 'All'
  return `${style}::${filter}`
}

function profileAlreadyExists(key: string | null) {
  if (!key) return false
  try {
    const raw = localStorage.getItem(layoutProfilesKey)
    if (!raw) return false
    const profiles = JSON.parse(raw) as Record<string, Record<string, unknown>>
    return Boolean(profiles[key] && Object.keys(profiles[key]).length > 0)
  } catch {
    return false
  }
}

function clickPackWhenReady(attempt = 0) {
  const pack = document.querySelector<HTMLButtonElement>('.organize-reset')
  if (pack) {
    pack.click()
    return
  }
  if (attempt < 12) requestAnimationFrame(() => clickPackWhenReady(attempt + 1))
}

// The first transition into Organize Mode used to expose fallback/default coordinates for a frame
// and could leave a fresh shelf looking spread out. For a brand-new style/category only, immediately
// run the component's canonical packing pass after Organize Mode mounts. Existing showcases are never
// touched, so a reader's hand-built layout remains exactly as saved.
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null
  const organizeButton = target?.closest<HTMLButtonElement>('.organize-button')
  if (!organizeButton) return

  const key = activeProfileKey()
  const hadSavedLayout = profileAlreadyExists(key)
  if (!hadSavedLayout) requestAnimationFrame(() => clickPackWhenReady())
}, true)

let replayingCenteredPointerDown = false

// React's organizer stores a pixel offset from the exact point where the book was grabbed. That
// offset is fine inside one shelf, but when the pointer crosses into another cubby/shelf the same
// screen-space offset can put the proposed left edge below zero; the clamp then makes the book
// appear to shoot to the destination's far-left wall. Replaying pointerdown from the book center
// gives every drag one stable physical anchor across every destination coordinate space.
document.addEventListener('pointerdown', (event) => {
  if (replayingCenteredPointerDown || !event.isTrusted) return

  const target = event.target as HTMLElement | null
  const book = target?.closest<HTMLButtonElement>('.bookcase-organizing .organize-book')
  if (!book) return

  const rect = book.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return

  event.preventDefault()
  event.stopImmediatePropagation()

  const centered = new PointerEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    width: event.width,
    height: event.height,
    pressure: event.pressure,
    tangentialPressure: event.tangentialPressure,
    tiltX: event.tiltX,
    tiltY: event.tiltY,
    twist: event.twist,
    button: event.button,
    buttons: event.buttons,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    screenX: event.screenX,
    screenY: event.screenY,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  })

  replayingCenteredPointerDown = true
  book.dispatchEvent(centered)
  replayingCenteredPointerDown = false
}, true)
