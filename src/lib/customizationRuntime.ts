import {
  shelfFinishes,
  shelfStyles,
  siteThemes,
  type ShelfFinishId,
  type ShelfStyleId,
  type SiteThemeId,
} from '../data/customization'

const shelfStyleKey = 'shelfie-shelf-style-v1'
const shelfFinishKey = 'shelfie-shelf-finish-v1'
const siteThemeKey = 'shelfie-site-theme-v1'
export const customizationEvent = 'shelfie-customization-changed'

function readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const saved = localStorage.getItem(key) as T | null
    if (saved && allowed.includes(saved)) return saved
  } catch {
    // Browser storage can be unavailable in privacy modes. Use the starter choice.
  }
  return fallback
}

export function loadShelfStyle(): ShelfStyleId {
  return readChoice(shelfStyleKey, shelfStyles.map((item) => item.id), 'classic')
}

export function loadShelfFinish(): ShelfFinishId {
  return readChoice(shelfFinishKey, shelfFinishes.map((item) => item.id), 'starter-wood')
}

export function loadSiteTheme(): SiteThemeId {
  return readChoice(siteThemeKey, siteThemes.map((item) => item.id), 'cozy-amber')
}

export function applySiteTheme(theme: SiteThemeId) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.shelfieTheme = theme
}

export function saveShelfStyle(value: ShelfStyleId) {
  try { localStorage.setItem(shelfStyleKey, value) } catch { /* Keep the in-memory choice. */ }
  notifyCustomizationChange()
}

export function saveShelfFinish(value: ShelfFinishId) {
  try { localStorage.setItem(shelfFinishKey, value) } catch { /* Keep the in-memory choice. */ }
  notifyCustomizationChange()
}

export function saveSiteTheme(value: SiteThemeId) {
  try { localStorage.setItem(siteThemeKey, value) } catch { /* Keep the in-memory choice. */ }
  applySiteTheme(value)
  notifyCustomizationChange()
}

export function notifyCustomizationChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(customizationEvent))
}

if (typeof window !== 'undefined') applySiteTheme(loadSiteTheme())
