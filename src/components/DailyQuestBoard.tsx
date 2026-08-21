import { useMemo, useState } from 'react'
import { BookOpenCheck, ChevronDown, ChevronUp, Gift, NotebookPen, Sparkles, Timer } from 'lucide-react'
import { sampleBooks } from '../data/books'
import { buildDailyQuestSet, DailyQuestEvent } from '../data/dailyQuests'

function QuestIcon({ event }: { event: DailyQuestEvent }) {
  if (event === 'minutes_read') return <Timer size={17} />
  if (event === 'journal_entry') return <NotebookPen size={17} />
  return <BookOpenCheck size={17} />
}

export function DailyQuestBoard() {
  const [open, setOpen] = useState(false)
  const questSet = useMemo(() => buildDailyQuestSet(sampleBooks), [])

  return (
    <aside className={`daily-quest-board ${open ? 'open' : 'collapsed'}`} aria-label="Daily reading quests preview">
      <button className="daily-quest-toggle" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <div className="daily-quest-title">
          <span className="daily-quest-spark"><Sparkles size={17} /></span>
          <div>
            <small>DAILY QUESTS</small>
            <strong>Fresh every day</strong>
          </div>
        </div>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="daily-quest-body">
          <p className="daily-quest-headline">{questSet.headline}</p>

          <div className="daily-quest-list">
            {questSet.quests.map((quest) => (
              <article className="daily-quest" key={quest.id}>
                <div className="daily-quest-icon"><QuestIcon event={quest.event} /></div>
                <div className="daily-quest-copy">
                  <div className="daily-quest-name"><strong>{quest.title}</strong><span>+{quest.xp} XP</span></div>
                  <p>{quest.description}</p>
                  <div className="daily-quest-progress"><span style={{ width: '0%' }} /></div>
                  <small>0 / {quest.target} {quest.unit}</small>
                </div>
              </article>
            ))}
          </div>

          <div className="daily-quest-bonus">
            <Gift size={17} />
            <div><strong>Clear the board</strong><span>Complete all 3 for +{questSet.completionBonusXp} bonus XP</span></div>
          </div>

          <small className="daily-quest-note">Preview: once accounts go live, reading logs will update these automatically. AI personalization will use reading habits, not private journal text by default.</small>
        </div>
      )}
    </aside>
  )
}
