import { BookOpen, ChevronLeft, ChevronRight, CircleHelp, LayoutGrid, Settings2, Sparkles, X } from 'lucide-react'
import { useState } from 'react'

const steps = [
  {
    icon: <BookOpen size={24} />,
    eyebrow: 'YOUR SHELF, YOUR WAY',
    title: 'Arrange it like a real bookshelf.',
    body: 'Use Organize Shelf when you want to move things. Drag books freely, squeeze them together, move them between shelves or cubbies, and use the placement preview to see where a book can safely land.',
  },
  {
    icon: <LayoutGrid size={24} />,
    eyebrow: 'LEAN, STACK & PLACE',
    title: 'Books do not have to stand perfectly straight.',
    body: 'Select a book in Organize Mode to lean it left or right, stand it upright, or lay it flat. Shelfie applies simple gravity and collision rules so books rest on the shelf or on a supported horizontal stack instead of floating.',
  },
  {
    icon: <LayoutGrid size={24} />,
    eyebrow: 'BUILD MORE THAN ONE SHOWCASE',
    title: 'Every shelf style and reading view remembers its own layout.',
    body: 'Classic, Cube, Floating, and future shelf styles are saved independently. All, Reading, TBR, Wishlist, and Read can each have their own arrangement. You can still mark the occasional unfinished book as DNF from its details.',
  },
  {
    icon: <BookOpen size={24} />,
    eyebrow: 'EVERY BOOK HAS A HOME BASE',
    title: 'Click a book for everything about it.',
    body: 'Outside Organize Mode, click a book to change reading status, track progress, mark ownership, choose how it looks on the shelf, and later pick the exact edition or cover you want displayed.',
  },
  {
    icon: <Sparkles size={24} />,
    eyebrow: 'READING POWERS THE GAME',
    title: 'XP and Daily Quests stay together.',
    body: 'Your reader level and streak live in the sidebar, with Daily Quests directly underneath. Once reading logs are live, normal reading activity will complete quests automatically.',
  },
  {
    icon: <Settings2 size={24} />,
    eyebrow: 'NOTHING SHOULD BE HIDDEN',
    title: 'Settings explains the controls.',
    body: 'This tour only opens automatically once. If you ever want to see it again, open Settings, expand Help & walkthrough, and choose Run Shelfie walkthrough.',
  },
]

export function WelcomeTour({ onClose }: { onClose: () => void }) {
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)

  function finish() {
    onClose()
  }

  if (!started) {
    return (
      <div className="tour-backdrop" role="presentation">
        <section className="tour-card tour-prompt" role="dialog" aria-modal="true" aria-labelledby="tour-title">
          <button className="tour-close" type="button" onClick={finish} aria-label="Skip walkthrough"><X size={20} /></button>
          <div className="tour-icon"><CircleHelp size={28} /></div>
          <p className="eyebrow">WELCOME TO SHELFIE</p>
          <h2 id="tour-title">Want a quick rundown?</h2>
          <p>Shelfie has a few different ways to organize, track, and customize books. This takes about a minute and shows where the important stuff lives.</p>
          <div className="tour-actions">
            <button className="tour-secondary" type="button" onClick={finish}>Not now</button>
            <button className="tour-primary" type="button" onClick={() => setStarted(true)}>Show me <ChevronRight size={18} /></button>
          </div>
        </section>
      </div>
    )
  }

  const current = steps[step]
  const last = step === steps.length - 1

  return (
    <div className="tour-backdrop" role="presentation">
      <section className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-step-title">
        <button className="tour-close" type="button" onClick={finish} aria-label="Close walkthrough"><X size={20} /></button>
        <div className="tour-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((_, index) => <span key={index} className={index <= step ? 'active' : ''} />)}
        </div>
        <div className="tour-icon">{current.icon}</div>
        <p className="eyebrow">{current.eyebrow}</p>
        <h2 id="tour-step-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="tour-step-count">{step + 1} of {steps.length}</div>
        <div className="tour-actions">
          <button className="tour-secondary" type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}><ChevronLeft size={18} /> Back</button>
          <button className="tour-primary" type="button" onClick={() => last ? finish() : setStep((value) => value + 1)}>{last ? 'Got it' : 'Next'} {!last && <ChevronRight size={18} />}</button>
        </div>
      </section>
    </div>
  )
}
