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
const shelfStylePreferencesKey = 'shelfie-shelf-style-preferences-v1'
const siteThemeKey = 'shelfie-site-theme-v1'
export const customizationEvent = 'shelfie-customization-changed'

type ShelfStylePreference = {
  finish?: ShelfFinishId
  shelfCount?: number
}

type ShelfStylePreferences = Partial<Record<ShelfStyleId, ShelfStylePreference>>

function readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const saved = localStorage.getItem(key) as T | null
    if (saved && allowed.includes(saved)) return saved
  } catch {
    // Browser storage can be unavailable in privacy modes. Use the starter choice.
  }
  return fallback
}

function loadStylePreferences(): ShelfStylePreferences {
  try {
    const saved = localStorage.getItem(shelfStylePreferencesKey)
    if (!saved) return {}
    return JSON.parse(saved) as ShelfStylePreferences
  } catch {
    return {}
  }
}

function saveStylePreferences(preferences: ShelfStylePreferences) {
  try { localStorage.setItem(shelfStylePreferencesKey, JSON.stringify(preferences)) } catch { /* Keep the in-memory choice. */ }
}

export function loadShelfStyle(): ShelfStyleId {
  return readChoice(shelfStyleKey, shelfStyles.map((item) => item.id), 'classic')
}

export function loadShelfFinishForStyle(style: ShelfStyleId): ShelfFinishId {
  const saved = loadStylePreferences()[style]?.finish
  if (saved && shelfFinishes.some((item) => item.id === saved)) return saved

  // Migrate the original global finish into whichever shelf style was active first.
  if (style === loadShelfStyle()) {
    return readChoice(shelfFinishKey, shelfFinishes.map((item) => item.id), 'starter-wood')
  }
  return 'starter-wood'
}

export function loadShelfFinish(): ShelfFinishId {
  return loadShelfFinishForStyle(loadShelfStyle())
}

export function loadShelfCountForStyle(style: ShelfStyleId, fallback = 3) {
  const count = loadStylePreferences()[style]?.shelfCount
  if (Number.isInteger(count) && (count as number) >= 2 && (count as number) <= 6) return count as number
  return fallback
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
  const finish = loadShelfFinishForStyle(value)
  try { localStorage.setItem(shelfFinishKey, finish) } catch { /* Keep the in-memory choice. */ }
  notifyCustomizationChange()
}

export function saveShelfFinishForStyle(style: ShelfStyleId, value: ShelfFinishId) {
  const preferences = loadStylePreferences()
  preferences[style] = { ...preferences[style], finish: value }
  saveStylePreferences(preferences)
  if (style === loadShelfStyle()) {
    try { localStorage.setItem(shelfFinishKey, value) } catch { /* Keep the in-memory choice. */ }
  }
  notifyCustomizationChange()
}

export function saveShelfFinish(value: ShelfFinishId) {
  saveShelfFinishForStyle(loadShelfStyle(), value)
}

export function saveShelfCountForStyle(style: ShelfStyleId, value: number) {
  const count = Math.max(2, Math.min(6, Math.round(value)))
  const preferences = loadStylePreferences()
  preferences[style] = { ...preferences[style], shelfCount: count }
  saveStylePreferences(preferences)
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
