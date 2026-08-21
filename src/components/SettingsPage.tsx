import { useState } from 'react'
import { Accessibility, BookOpen, CircleHelp, Crown, LayoutGrid, LockKeyhole, LogOut, MousePointer2, Palette, Settings2, Sparkles } from 'lucide-react'
import {
  isCustomizationUnlocked,
  shelfFinishes,
  shelfStyles,
  siteThemes,
  type ShelfFinishId,
  type ShelfStyleId,
  type SiteThemeId,
  type UnlockableCustomization,
} from '../data/customization'
import {
  loadShelfCountForStyle,
  loadShelfFinish,
  loadShelfFinishForStyle,
  loadShelfStyle,
  loadSiteTheme,
  saveShelfCountForStyle,
  saveShelfFinishForStyle,
  saveShelfStyle,
  saveSiteTheme,
} from '../lib/customizationRuntime'
import { useTestingProgression } from '../lib/testingAccess'

type BookDetailsDisplay = 'side' | 'card'

type SettingsPageProps = {
  largeText: boolean
  highContrast: boolean
  glowFocus: boolean
  detailsDisplay: BookDetailsDisplay
  shelfCount: number
  onLargeTextChange: (value: boolean) => void
  onHighContrastChange: (value: boolean) => void
  onGlowFocusChange: (value: boolean) => void
  onDetailsDisplayChange: (value: BookDetailsDisplay) => void
  onShelfCountChange: (value: number) => void
  onStartTour: () => void
  onSignOut?: () => void | Promise<void>
}

export function SettingsPage({
  largeText,
  highContrast,
  glowFocus,
  detailsDisplay,
  shelfCount,
  onLargeTextChange,
  onHighContrastChange,
  onGlowFocusChange,
  onDetailsDisplayChange,
  onShelfCountChange,
  onStartTour,
  onSignOut,
}: SettingsPageProps) {
  const [shelfStyle, setShelfStyle] = useState<ShelfStyleId>(loadShelfStyle)
  const [shelfFinish, setShelfFinish] = useState<ShelfFinishId>(loadShelfFinish)
  const [siteTheme, setSiteTheme] = useState<SiteThemeId>(loadSiteTheme)
  const { currentLevel, isMaxLevelTester } = useTestingProgression()

  function chooseShelfStyle(value: ShelfStyleId) {
    saveShelfCountForStyle(shelfStyle, shelfCount)
    saveShelfStyle(value)
    const nextFinish = loadShelfFinishForStyle(value)
    const nextCount = loadShelfCountForStyle(value, 3)
    setShelfStyle(value)
    setShelfFinish(nextFinish)
    onShelfCountChange(nextCount)
  }

  function chooseShelfFinish(value: ShelfFinishId) {
    setShelfFinish(value)
    saveShelfFinishForStyle(shelfStyle, value)
  }

  function changeShelfCount(value: number) {
    const next = Math.max(2, Math.min(6, value))
    saveShelfCountForStyle(shelfStyle, next)
    onShelfCountChange(next)
  }

  function chooseSiteTheme(value: SiteThemeId) {
    setSiteTheme(value)
    saveSiteTheme(value)
  }

  return (
    <div className="settings-page">
      <section className="settings-intro">
        <div className="settings-intro-icon"><Settings2 size={24} /></div>
        <div>
          <p className="eyebrow">MAKE SHELFIE YOURS</p>
          <h2>Settings</h2>
          <p>Everything that changes how Shelfie looks or behaves lives here, with a short explanation so nothing useful gets buried.</p>
        </div>
      </section>

      <section className="earned-customization-banner">
        <Crown size={22} />
        <div>
          <strong>{isMaxLevelTester ? 'Max-level tester mode.' : 'Earned, never purchased.'}</strong>
          <span>{isMaxLevelTester ? 'This test account is temporarily Level 100 so every level-gated Shelfie customization can be tested.' : 'Every Shelfie theme, shelf, finish, decoration, and visual reward is unlocked by reading, levels, streaks, or achievements. There is no paid shortcut.'}</span>
        </div>
      </section>

      <section className="settings-section" id="settings-layout">
        <div className="settings-section-heading">
          <LayoutGrid size={20} />
          <div><h3>Bookshelf layout</h3><p>Choose the structure of your library. Each shelf style remembers its own setup.</p></div>
        </div>
        <CustomizationGrid items={shelfStyles} value={shelfStyle} currentLevel={currentLevel} onChange={chooseShelfStyle} />
        <div className="shelf-count-setting">
          <div><strong>Number of shelves</strong><span>Saved with this shelf style, so Cube, Classic, Floating, and future styles can all be built differently.</span></div>
          <div className="shelf-count-controls" aria-label="Number of shelves">
            <button type="button" onClick={() => changeShelfCount(shelfCount - 1)} disabled={shelfCount <= 2} aria-label="Remove a shelf">−</button>
            <strong>{shelfCount}</strong>
            <button type="button" onClick={() => changeShelfCount(shelfCount + 1)} disabled={shelfCount >= 6} aria-label="Add a shelf">+</button>
          </div>
        </div>
        <div className="settings-tip"><LayoutGrid size={17} /><span>Each shelf style remembers its finish and shelf count. Inside that style, All, Reading, To Read, Read, and DNF can each have their own independently arranged showcase.</span></div>
      </section>

      <section className="settings-section" id="settings-finish">
        <div className="settings-section-heading">
          <Sparkles size={20} />
          <div><h3>Shelf material & finish</h3><p>This finish is saved to the current shelf style. Higher-level finishes become visual trophies for your reading progress.</p></div>
        </div>
        <CustomizationGrid items={shelfFinishes} value={shelfFinish} currentLevel={currentLevel} onChange={chooseShelfFinish} />
      </section>

      <section className="settings-section" id="settings-theme">
        <div className="settings-section-heading">
          <Palette size={20} />
          <div><h3>Shelfie color profile</h3><p>Re-theme the entire site — navigation, backgrounds, controls, highlights, and reading atmosphere.</p></div>
        </div>
        <CustomizationGrid items={siteThemes} value={siteTheme} currentLevel={currentLevel} onChange={chooseSiteTheme} />
        <div className="settings-tip"><LockKeyhole size={17} /><span>{isMaxLevelTester ? 'Tester override is active at Level 100. All current level-gated cards are unlocked so you can test the full progression catalog.' : `Your current demo level is ${currentLevel}. Locked cards show exactly when they become available. Real account XP will replace this preview level when progression is connected.`}</span></div>
      </section>

      <section className="settings-section" id="settings-accessibility">
        <div className="settings-section-heading">
          <Accessibility size={20} />
          <div><h3>Display & accessibility</h3><p>Make Shelfie easier and more comfortable to use. Accessibility options are never progression-locked.</p></div>
        </div>
        <SettingToggle label="Larger text" description="Increases text size throughout the library." value={largeText} onChange={onLargeTextChange} />
        <SettingToggle label="High contrast" description="Strengthens contrast between text, controls, and the background." value={highContrast} onChange={onHighContrastChange} />
        <SettingToggle label="Glow on focus" description="Adds a stronger glow when a book is selected, hovered, or keyboard-focused." value={glowFocus} onChange={onGlowFocusChange} />
      </section>

      <section className="settings-section" id="settings-book-details">
        <div className="settings-section-heading">
          <MousePointer2 size={20} />
          <div><h3>Book details</h3><p>Choose what happens when you click a book.</p></div>
        </div>
        <div className="settings-choice-grid" role="radiogroup" aria-label="Book details display">
          <button type="button" role="radio" aria-checked={detailsDisplay === 'side'} className={detailsDisplay === 'side' ? 'settings-choice active' : 'settings-choice'} onClick={() => onDetailsDisplayChange('side')}>
            <strong>Side panel</strong><span>Keeps book information visible beside the shelf.</span>
          </button>
          <button type="button" role="radio" aria-checked={detailsDisplay === 'card'} className={detailsDisplay === 'card' ? 'settings-choice active' : 'settings-choice'} onClick={() => onDetailsDisplayChange('card')}>
            <strong>Pop-up card</strong><span>Uses the full shelf width and opens book details in a larger card.</span>
          </button>
        </div>
        <div className="settings-tip"><BookOpen size={17} /><span>Cover, edition, cassette, e-reader, and other shelf appearance options are chosen from the individual book's details.</span></div>
      </section>

      <section className="settings-section" id="settings-help">
        <div className="settings-section-heading">
          <CircleHelp size={20} />
          <div><h3>Help & walkthrough</h3><p>Need a reminder where something lives? Replay the guided tour anytime.</p></div>
        </div>
        <button type="button" className="settings-action" onClick={onStartTour}><CircleHelp size={18} /> Run Shelfie walkthrough</button>
      </section>

      {onSignOut && (
        <section className="settings-section settings-account-section">
          <div className="settings-section-heading">
            <LogOut size={20} />
            <div><h3>Account</h3><p>Sign out of Shelfie on this device.</p></div>
          </div>
          <button type="button" className="settings-action settings-signout" onClick={() => void onSignOut()}><LogOut size={18} /> Sign out</button>
        </section>
      )}
    </div>
  )
}

function CustomizationGrid<T extends string>({
  items,
  value,
  currentLevel,
  onChange,
}: {
  items: UnlockableCustomization<T>[]
  value: T
  currentLevel: number
  onChange: (value: T) => void
}) {
  return (
    <div className="customization-grid">
      {items.map((item) => {
        const unlocked = isCustomizationUnlocked(item.unlockLevel, currentLevel)
        const active = value === item.id
        return (
          <button
            type="button"
            className={`customization-card ${active ? 'active' : ''} ${unlocked ? 'unlocked' : 'locked'}`}
            disabled={!unlocked}
            onClick={() => unlocked && onChange(item.id)}
            key={item.id}
            aria-pressed={active}
          >
            <span className="customization-preview" aria-hidden="true">
              {item.preview.map((color) => <i key={color} style={{ background: color }} />)}
            </span>
            <span className="customization-copy">
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </span>
            <span className={unlocked ? 'customization-unlock unlocked' : 'customization-unlock'}>
              {item.starter ? 'Starter' : unlocked ? 'Unlocked' : <><LockKeyhole size={12} /> Level {item.unlockLevel}</>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SettingToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="settings-toggle-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      <span className="settings-toggle-ui" aria-hidden="true" />
    </label>
  )
}
