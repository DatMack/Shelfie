import { Accessibility, BookOpen, CircleHelp, LayoutGrid, LogOut, MousePointer2, Settings2 } from 'lucide-react'

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

      <section className="settings-section">
        <div className="settings-section-heading">
          <Accessibility size={20} />
          <div><h3>Display & accessibility</h3><p>Make Shelfie easier and more comfortable to use.</p></div>
        </div>
        <SettingToggle label="Larger text" description="Increases text size throughout the library." value={largeText} onChange={onLargeTextChange} />
        <SettingToggle label="High contrast" description="Strengthens contrast between text, controls, and the background." value={highContrast} onChange={onHighContrastChange} />
        <SettingToggle label="Glow on focus" description="Adds a stronger glow when a book is selected, hovered, or keyboard-focused." value={glowFocus} onChange={onGlowFocusChange} />
      </section>

      <section className="settings-section">
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

      <section className="settings-section">
        <div className="settings-section-heading">
          <LayoutGrid size={20} />
          <div><h3>Bookshelf layout</h3><p>Your shelf position is separate from reading status. Put any book anywhere.</p></div>
        </div>
        <div className="shelf-count-setting">
          <div><strong>Number of shelves</strong><span>Choose how many physical shelf rows appear in your bookcase.</span></div>
          <div className="shelf-count-controls" aria-label="Number of shelves">
            <button type="button" onClick={() => onShelfCountChange(shelfCount - 1)} disabled={shelfCount <= 2} aria-label="Remove a shelf">−</button>
            <strong>{shelfCount}</strong>
            <button type="button" onClick={() => onShelfCountChange(shelfCount + 1)} disabled={shelfCount >= 6} aria-label="Add a shelf">+</button>
          </div>
        </div>
        <div className="settings-tip"><LayoutGrid size={17} /><span>Use the filter above your bookshelf for All, Currently Reading, Want to Read, Read, or DNF. Filtering never rearranges your shelf.</span></div>
      </section>

      <section className="settings-section">
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
