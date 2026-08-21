// One-time test cleanup for the corrected physical-coordinate organizer.
// v4 layouts created before the centered drag-anchor fix can preserve the exact bad positions from
// testing, so bump the marker once more and rebuild only organizer coordinates from a clean state.
const resetMarker = 'shelfie-layout-pixel-geometry-reset-v3'

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
