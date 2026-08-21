// One-time test cleanup after fixing the API cover CSS/Organize Mode positioning conflict.
// The old cover rule changed free-placed books back to position: relative, so manual test layouts
// could save coordinates while the browser was adding those coordinates on top of flex positions.
// Clear only organizer coordinates once; keep the real library, account, themes and progression.
const resetMarker = 'shelfie-layout-pixel-geometry-reset-v4'

try {
  if (localStorage.getItem(resetMarker) !== 'done') {
    localStorage.removeItem('shelfie-layout-profiles-v4')
    localStorage.removeItem('shelfie-layout-profiles-v3')
    localStorage.removeItem('shelfie-layout-profiles-v2')
    localStorage.removeItem('shelfie-free-placement-v1')
    localStorage.setItem(resetMarker, 'done')
  }
} catch {
  // Shelfie still works if browser storage is unavailable.
}
