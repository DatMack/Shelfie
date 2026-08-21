// One-time test cleanup for the corrected physical-coordinate organizer.
// Earlier v4 layouts could be written while the geometry engine was still changing, and an older
// reset marker may already exist in the browser. Bump the marker so every tester gets one genuinely
// clean layout after the final pixel-coordinate + shelf-width fixes.
const resetMarker = 'shelfie-layout-pixel-geometry-reset-v2'

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
