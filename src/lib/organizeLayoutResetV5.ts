const resetMarker = 'shelfie-organize-layout-reset-v5'

try {
  if (localStorage.getItem(resetMarker) !== 'done') {
    // Clear only obsolete organize-layout coordinates. Keep the user's real library,
    // account data, customization choices, progression, and other preferences intact.
    localStorage.removeItem('shelfie-layout-profiles-v4')
    localStorage.removeItem('shelfie-layout-profiles-v3')
    localStorage.removeItem('shelfie-layout-profiles-v2')
    localStorage.removeItem('shelfie-free-placement-v1')
    localStorage.setItem(resetMarker, 'done')
  }
} catch {
  // If storage is unavailable, Shelfie can still run with in-memory layout state.
}
