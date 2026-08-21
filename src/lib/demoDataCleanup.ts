const cleanupMarker = 'shelfie-live-library-cleanup-v1'

const demoStorageKeys = [
  'shelfie-books-v1',
  'shelfie-layout-profiles-v1',
  'shelfie-free-placement-v1',
  'shelfie-cube-placement-v1',
]

export function clearLegacyDemoDataOnce() {
  if (typeof window === 'undefined') return

  try {
    if (localStorage.getItem(cleanupMarker) === 'done') return

    demoStorageKeys.forEach((key) => localStorage.removeItem(key))

    // App currently reads this key. Seed an intentionally empty live library so
    // the old sample fallback cannot repopulate the shelf on first load.
    localStorage.setItem('shelfie-books-v1', '[]')
    localStorage.setItem(cleanupMarker, 'done')
  } catch {
    // If storage is unavailable, the app still remains usable for this session.
  }
}

clearLegacyDemoDataOnce()
