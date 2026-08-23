import { Coins, Flame } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getProgressForXp } from '../data/progression'
import { loadReaderProgress, type ReaderProgress } from '../lib/shelfieData'

export function ReaderProgressCard({ userId, refreshToken = 0 }: { userId: string; refreshToken?: number }) {
  const [account, setAccount] = useState<ReaderProgress>({ totalXp: 0, level: 1, coins: 0, lifetimeCoins: 0, currentStreak: 0, longestStreak: 0 })

  useEffect(() => {
    let active = true
    loadReaderProgress(userId).then((value) => active && setAccount(value)).catch(() => undefined)
    return () => { active = false }
  }, [userId, refreshToken])

  const progress = getProgressForXp(account.totalXp)

  return (
    <aside className="reader-progress-card" aria-label="Reader progress">
      <div className="reader-level-head">
        <div className="reader-level-badge">{progress.current.level}</div>
        <div>
          <span className="reader-level-label">READER LEVEL</span>
          <strong>{progress.current.title}</strong>
        </div>
        {account.currentStreak > 0 && <span className="reader-streak"><Flame size={14} /> {account.currentStreak}</span>}
      </div>

      <div className="reader-xp-row">
        <span>{account.totalXp.toLocaleString()} XP</span>
        {progress.next ? <span>{progress.xpForLevel - progress.xpIntoLevel} to Level {progress.next.level}</span> : <span className="reader-coin-balance"><Coins size={12} /> {account.coins.toLocaleString()} coins</span>}
      </div>
      <div className="reader-xp-track" aria-label={`${Math.round(progress.percent)} percent to next level`}>
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      {!progress.next && <small className="reader-max-note">Future XP now becomes Shelf Coins.</small>}
    </aside>
  )
}
