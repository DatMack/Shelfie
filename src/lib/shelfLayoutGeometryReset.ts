// One-time test cleanup: early v4 layouts were saved before the final pixel-coordinate geometry
// fixes landed. Keeping those coordinates makes the corrected organizer look broken because it is
// faithfully restoring bad positions. Remove them once, then let v4 rebuild cleanly.
const layoutKey = 'shelfie-layout-profiles-v4'
const resetMarker = 'shelfie-layout-pixel-geometry-reset-v1'

try {
  if (localStorage.getItem(resetMarker) !== 'done') {
    localStorage.removeItem(layoutKey)
    localStorage.setItem(resetMarker, 'done')
  }
} catch {
  // Shelfie still works if browser storage is unavailable.
}
