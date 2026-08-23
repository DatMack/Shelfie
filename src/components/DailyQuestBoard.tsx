import { useEffect, useState } from 'react'
import { BookOpenCheck, Check, ChevronDown, ChevronUp, Gift, NotebookPen, Sparkles, Timer } from 'lucide-react'
import { loadMyDailyQuestSet, type StoredDailyQuest } from '../lib/dailyQuestData'

function QuestIcon({ event }: { event: StoredDailyQuest['event_type'] }) {
  if (event === 'minutes_read') return <Timer size={17} />
  if (event === 'journal_entry') return <NotebookPen size={17} />
  return <BookOpenCheck size={17} />
}

export function DailyQuestBoard({ refreshToken = 0, onOpenReadingLog }: { refreshToken?: number; onOpenReadingLog?: () => void }) {
  const [open, setOpen] = useState(false)
  const [quests, setQuests] = useState<StoredDailyQuest[]>([])
  const [headline, setHeadline] = useState('A small reading win is enough for today.')
  const [bonusXp, setBonusXp] = useState(25)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    loadMyDailyQuestSet()
      .then(({ set, quests: stored }) => {
        if (!active) return
        setQuests(stored)
        setHeadline(set?.headline ?? 'A small reading win is enough for today.')
        setBonusXp(set?.completion_bonus_xp ?? 25)
        setError('')
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Daily quests could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshToken])

  const completed = quests.filter((quest) => quest.completed_at).length

  return (
    <aside className={`daily-quest-board ${open ? 'open' : 'collapsed'}`} aria-label="Daily reading quests">
      <button className="daily-quest-toggle" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <div className="daily-quest-title">
          <span className="daily-quest-spark"><Sparkles size={17} /></span>
          <div>
            <small>DAILY QUESTS</small>
            <strong>{loading ? 'Gathering today’s quests…' : completed === 3 ? 'Board cleared' : `${completed} of 3 complete`}</strong>
          </div>
        </div>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="daily-quest-body">
          <p className="daily-quest-headline">{headline}</p>
          {error && <p className="profile-error">{error}</p>}

          <div className="daily-quest-list">
            {quests.map((quest) => {
              const progress = Math.min(quest.target_amount, quest.progress_amount)
              const percent = Math.min(100, (progress / quest.target_amount) * 100)
              return (
                <article className={`daily-quest ${quest.completed_at ? 'complete' : ''}`} key={quest.id}>
                  <div className="daily-quest-icon">{quest.completed_at ? <Check size={17} /> : <QuestIcon event={quest.event_type} />}</div>
                  <div className="daily-quest-copy">
                    <div className="daily-quest-name"><strong>{quest.title}</strong><span>+{quest.reward_xp} XP</span></div>
                    <p>{quest.description}</p>
                    <div className="daily-quest-progress"><span style={{ width: `${percent}%` }} /></div>
                    <small>{progress} / {quest.target_amount} {quest.unit}</small>
                  </div>
                </article>
              )
            })}
          </div>

          <div className={`daily-quest-bonus ${completed === 3 ? 'complete' : ''}`}>
            <Gift size={17} />
            <div><strong>Clear the board</strong><span>Complete all 3 for +{bonusXp} bonus XP</span></div>
          </div>

          {onOpenReadingLog && <button className="daily-log-button" type="button" onClick={onOpenReadingLog}><BookOpenCheck size={16} /> Log today’s reading</button>}
          <small className="daily-quest-note">Progress updates automatically from reading logs and Shelfie actions. Private journal text is never used to choose quests.</small>
        </div>
      )}
    </aside>
  )
}
