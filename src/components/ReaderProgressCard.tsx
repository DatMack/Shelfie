import { Flame, Gift, Sparkles } from 'lucide-react'
import { getProgressForXp } from '../data/progression'

const demoXp = 980
const demoStreak = 12

export function ReaderProgressCard() {
  const progress = getProgressForXp(demoXp)

  return (
    <aside className="reader-progress-card" aria-label="Reader level preview">
      <div className="reader-level-head">
        <div className="reader-level-badge">{progress.current.level}</div>
        <div>
          <span className="reader-level-label">READER LEVEL</span>
          <strong>{progress.current.title}</strong>
        </div>
        <Sparkles size={18} />
      </div>

      <div className="reader-xp-row">
        <span>{demoXp.toLocaleString()} XP</span>
        {progress.next && <span>Level {progress.next.level}</span>}
      </div>
      <div className="reader-xp-track" aria-label={`${Math.round(progress.percent)} percent to next level`}>
        <span style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="reader-progress-meta">
        <span><Flame size={15} /> {demoStreak} day streak</span>
        {progress.next?.reward && <span><Gift size={15} /> Next: {progress.next.reward.name}</span>}
      </div>

      <small className="reader-progress-note">Preview data until accounts and reading logs go live.</small>
    </aside>
  )
}
