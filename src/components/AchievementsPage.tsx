import { useEffect, useMemo, useState } from 'react'
import { Check, Filter, LockKeyhole, Search, Sparkles, Trophy } from 'lucide-react'
import { achievementCategories, achievements, type AchievementCategory } from '../data/achievements'
import { refreshMyAchievements, type AchievementProgress } from '../lib/engagementData'

function Badge({ index, locked }: { index: number; locked: boolean }) {
  const atlas = Math.floor(index / 25) + 1
  const cell = index % 25
  const column = cell % 5
  const row = Math.floor(cell / 5)
  return (
    <span
      className={`achievement-badge ${locked ? 'locked' : ''}`}
      style={{
        backgroundImage: `url(${import.meta.env.BASE_URL}achievements/achievement-atlas-${atlas}.webp)`,
        backgroundPosition: `${column * 25}% ${row * 25}%`,
      }}
      aria-hidden="true"
    >
      <Trophy size={24} />
    </span>
  )
}

export function AchievementsPage({ refreshToken = 0 }: { refreshToken?: number }) {
  const [progress, setProgress] = useState<AchievementProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState<'All' | AchievementCategory>('All')
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<'all' | 'earned' | 'locked'>('all')

  useEffect(() => {
    let active = true
    setLoading(true)
    refreshMyAchievements()
      .then((rows) => { if (active) setProgress(rows) })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Achievements could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshToken])

  const progressMap = useMemo(() => new Map(progress.map((item) => [item.achievementId, item])), [progress])
  const earned = progress.filter((item) => item.unlockedAt).length
  const xpEarned = achievements.reduce((sum, achievement) => sum + (progressMap.get(achievement.id)?.unlockedAt ? achievement.xp : 0), 0)
  const visible = achievements.filter((achievement) => {
    const item = progressMap.get(achievement.id)
    const unlocked = Boolean(item?.unlockedAt)
    const term = query.trim().toLowerCase()
    return (category === 'All' || achievement.category === category)
      && (show === 'all' || (show === 'earned' ? unlocked : !unlocked))
      && (!term || `${achievement.title} ${achievement.description}`.toLowerCase().includes(term))
  })

  return (
    <div className="engagement-page achievement-page">
      <section className="engagement-hero achievement-hero">
        <div>
          <p className="eyebrow">YOUR READING STORY</p>
          <h2>Achievements</h2>
          <p>Small moments count. Shelfie quietly notices the reading, collecting, and thoughtful details that make your library yours.</p>
        </div>
        <div className="achievement-summary" aria-label={`${earned} of 100 achievements earned`}>
          <span><strong>{earned}</strong><small>of 100 earned</small></span>
          <span><strong>{xpEarned}</strong><small>achievement XP</small></span>
          <div><i style={{ width: `${earned}%` }} /></div>
        </div>
      </section>

      <section className="achievement-toolbar">
        <label className="engagement-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an achievement..." /></label>
        <div className="segmented-control" aria-label="Achievement status">
          {(['all', 'earned', 'locked'] as const).map((option) => <button className={show === option ? 'active' : ''} type="button" onClick={() => setShow(option)} key={option}>{option === 'all' ? 'All' : option === 'earned' ? 'Earned' : 'In progress'}</button>)}
        </div>
      </section>

      <div className="achievement-categories" aria-label="Achievement categories">
        <Filter size={16} />
        {achievementCategories.map((item) => <button className={category === item ? 'active' : ''} type="button" onClick={() => setCategory(item)} key={item}>{item}</button>)}
      </div>

      {loading && <div className="engagement-empty"><Sparkles className="spin" /> Waking the achievement ledger…</div>}
      {error && <div className="engagement-empty">{error}</div>}
      {!loading && !error && (
        <div className="achievement-list">
          {visible.map((achievement) => {
            const item = progressMap.get(achievement.id)
            const current = Math.min(achievement.target, item?.progress ?? 0)
            const unlocked = Boolean(item?.unlockedAt)
            return (
              <article className={`achievement-row ${unlocked ? 'earned' : ''}`} key={achievement.id}>
                <Badge index={achievement.badgeIndex} locked={!unlocked} />
                <div className="achievement-copy">
                  <div><strong>{achievement.title}</strong><span className={`rarity ${achievement.rarity.toLowerCase()}`}>{achievement.rarity}</span></div>
                  <p>{achievement.description}</p>
                  <div className="achievement-progress"><i style={{ width: `${Math.min(100, (current / achievement.target) * 100)}%` }} /></div>
                  <small>{unlocked ? `Earned ${new Date(item!.unlockedAt!).toLocaleDateString()}` : `${current.toLocaleString()} / ${achievement.target.toLocaleString()}`}</small>
                </div>
                <span className="achievement-reward">{unlocked ? <Check size={16} /> : <LockKeyhole size={14} />} +{achievement.xp} XP</span>
              </article>
            )
          })}
          {visible.length === 0 && <div className="engagement-empty">Nothing matches those filters yet.</div>}
        </div>
      )}
    </div>
  )
}
