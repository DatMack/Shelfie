import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, CalendarDays, Check, Clock3, NotebookPen, Sparkles, Trash2 } from 'lucide-react'
import type { Book } from '../data/books'
import { deleteMyReadingSession, loadMyReadingSessions, logMyReading, type ReadingSession } from '../lib/engagementData'
import { getLocalActivityDate } from '../lib/dailyQuestData'

const moods = ['Cozy', 'Curious', 'Emotional', 'Excited', 'Focused', 'Sleepy']
const formats = ['Print', 'Ebook', 'Audiobook']

export function ReadingLogPage({ books, onProgressSaved, onActivity }: { books: Book[]; onProgressSaved: (id: string, page: number) => void; onActivity: () => void }) {
  const readingBooks = books.filter((book) => book.status === 'Currently Reading')
  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [selectedId, setSelectedId] = useState(readingBooks[0]?.id ?? '')
  const [minutes, setMinutes] = useState('')
  const [pages, setPages] = useState('')
  const [endPage, setEndPage] = useState('')
  const [format, setFormat] = useState('Print')
  const [mood, setMood] = useState('')
  const [note, setNote] = useState('')
  const [activityDate, setActivityDate] = useState(getLocalActivityDate())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const selected = readingBooks.find((book) => book.id === selectedId)
  const thirtyDaysAgo = useMemo(() => { const date = new Date(); date.setDate(date.getDate() - 30); return getLocalActivityDate(date) }, [])

  useEffect(() => {
    let active = true
    loadMyReadingSessions().then((rows) => active && setSessions(rows)).catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedId && readingBooks[0]) setSelectedId(readingBooks[0].id)
  }, [readingBooks, selectedId])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    const parsedEnd = endPage ? Number(endPage) : undefined
    const derivedPages = parsedEnd !== undefined ? Math.max(0, parsedEnd - (selected.currentPage ?? 0)) : Number(pages || 0)
    if (Number(minutes || 0) <= 0 && derivedPages <= 0) {
      setMessage('Add minutes, pages, or your new page number first.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const saved = await logMyReading({
        userBookId: selected.id,
        minutesRead: Number(minutes || 0),
        pagesRead: derivedPages,
        startPage: selected.currentPage,
        endPage: parsedEnd,
        format: format.toLowerCase(),
        mood,
        note,
        activityDate,
      })
      onProgressSaved(selected.id, saved.currentPage)
      const refreshed = await loadMyReadingSessions()
      setSessions(refreshed)
      setMinutes(''); setPages(''); setEndPage(''); setMood(''); setNote('')
      setMessage('Reading logged. Your quests and XP caught it automatically.')
      onActivity()
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : 'That reading session could not be saved.')
    } finally { setSaving(false) }
  }

  async function removeSession(id: string) {
    if (!window.confirm('Remove this reading session? Your saved reading totals will be recalculated.')) return
    try {
      const result = await deleteMyReadingSession(id)
      setSessions((current) => current.filter((session) => session.id !== id))
      if (result.userBookId && result.currentPage !== undefined) onProgressSaved(result.userBookId, result.currentPage)
      setMessage('Reading session removed and totals recalculated.')
      onActivity()
    } catch (removeError) {
      setMessage(removeError instanceof Error ? removeError.message : 'That entry could not be removed.')
    }
  }

  const totals = sessions.reduce((result, session) => ({ minutes: result.minutes + session.minutesRead, pages: result.pages + session.pagesRead }), { minutes: 0, pages: 0 })

  return (
    <div className="engagement-page reading-log-page">
      <section className="engagement-hero">
        <div><p className="eyebrow">A QUIET CHECK-IN</p><h2>Log your reading</h2><p>Choose a book you’re currently reading. Shelfie will update its progress and quietly handle today’s quests, streak, and XP.</p></div>
        <div className="reading-log-summary"><span><strong>{sessions.length}</strong><small>sessions</small></span><span><strong>{totals.pages.toLocaleString()}</strong><small>pages</small></span><span><strong>{Math.round(totals.minutes / 60 * 10) / 10}</strong><small>hours</small></span></div>
      </section>

      {readingBooks.length === 0 ? (
        <div className="engagement-empty large"><BookOpenCheck size={34} /><h3>No book is marked Currently Reading</h3><p>Open a book on your shelf and change its reading status before logging a session.</p></div>
      ) : (
        <section className="reading-log-layout">
          <form className="reading-log-form" onSubmit={submit}>
            <div className="form-section-title"><Sparkles size={18} /><div><strong>What did you read?</strong><small>Only books marked Currently Reading appear here.</small></div></div>
            <label className="field-full"><span>Book</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{readingBooks.map((book) => <option value={book.id} key={book.id}>{book.title}</option>)}</select></label>
            {selected && <div className="current-progress-note"><BookOpenCheck size={17} /><span>{selected.pages ? `Currently on page ${selected.currentPage ?? 0} of ${selected.pages}` : 'Page count unavailable—minutes still count.'}</span></div>}
            <div className="form-grid three">
              <label><span>Minutes</span><input type="number" min="0" max="1440" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="25" /></label>
              <label><span>Pages read</span><input type="number" min="0" max="2000" value={pages} onChange={(event) => setPages(event.target.value)} placeholder="18" /></label>
              <label><span>New page</span><input type="number" min={selected?.currentPage ?? 0} max={selected?.pages || undefined} value={endPage} onChange={(event) => setEndPage(event.target.value)} placeholder={String(selected?.currentPage ?? 0)} /></label>
            </div>
            <div className="form-grid three">
              <label><span>Date</span><input type="date" min={thirtyDaysAgo} max={getLocalActivityDate()} value={activityDate} onChange={(event) => setActivityDate(event.target.value)} /></label>
              <label><span>Format</span><select value={format} onChange={(event) => setFormat(event.target.value)}>{formats.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Mood (optional)</span><select value={mood} onChange={(event) => setMood(event.target.value)}><option value="">No mood</option>{moods.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <label className="field-full"><span>Session note (optional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="A quick memory from this reading session…" /></label>
            <button className="primary reading-log-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : <><Check size={17} /> Save reading session</>}</button>
            {message && <p className="calm-message" role="status">{message}</p>}
          </form>

          <div className="reading-history">
            <div className="section-heading compact"><div><p className="eyebrow">RECENT</p><h3>Reading history</h3></div></div>
            {sessions.length === 0 && <div className="engagement-empty">Your first session will appear here.</div>}
            {sessions.slice(0, 30).map((session) => (
              <article className="reading-session-row" key={session.id}>
                <div className="session-date"><CalendarDays size={16} /><span>{new Date(`${session.activityDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
                <div><strong>{session.title}</strong><p>{[session.pagesRead ? `${session.pagesRead} pages` : '', session.minutesRead ? `${session.minutesRead} min` : '', session.mood].filter(Boolean).join(' · ')}</p>{session.note && <small>{session.note}</small>}</div>
                <button type="button" onClick={() => void removeSession(session.id)} aria-label={`Remove reading log for ${session.title}`}><Trash2 size={15} /></button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
