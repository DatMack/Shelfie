import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, ChevronDown, Edit3, LockKeyhole, NotebookPen, Search, Trash2, X } from 'lucide-react'
import type { Book } from '../data/books'
import { createMyJournalEntry, deleteMyJournalEntry, loadMyJournalEntries, updateMyJournalEntry, type JournalEntry, type JournalEntryType } from '../lib/engagementData'

const entryTypes: Array<{ id: JournalEntryType; label: string }> = [
  { id: 'note', label: 'Note' }, { id: 'quote', label: 'Quote' }, { id: 'character', label: 'Character' },
  { id: 'prediction', label: 'Prediction' }, { id: 'reaction', label: 'Reaction' }, { id: 'review_draft', label: 'Review draft' }, { id: 'other', label: 'Other' },
]

export function JournalPage({ books, initialBookId, onActivity }: { books: Book[]; initialBookId?: string; onActivity: () => void }) {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [composerOpen, setComposerOpen] = useState(Boolean(initialBookId))
  const [bookId, setBookId] = useState(initialBookId ?? books[0]?.id ?? '')
  const [entryType, setEntryType] = useState<JournalEntryType>('note')
  const [body, setBody] = useState('')
  const [page, setPage] = useState('')
  const [moods, setMoods] = useState('')
  const [spoiler, setSpoiler] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [bookFilter, setBookFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | JournalEntryType>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'book'>('newest')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    loadMyJournalEntries().then((rows) => active && setEntries(rows)).catch((error) => active && setMessage(error instanceof Error ? error.message : 'Your journal could not be loaded.'))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (initialBookId) { setBookId(initialBookId); setComposerOpen(true) }
  }, [initialBookId])

  function resetComposer() {
    setEditingId(null); setEntryType('note'); setBody(''); setPage(''); setMoods(''); setSpoiler(false); setMessage('')
  }

  function editEntry(entry: JournalEntry) {
    setEditingId(entry.id); setBookId(entry.userBookId); setEntryType(entry.entryType); setBody(entry.body); setPage(entry.page?.toString() ?? ''); setMoods(entry.moodTags.join(', ')); setSpoiler(entry.isSpoiler); setComposerOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!bookId || !body.trim()) { setMessage('Choose a book and write a thought first.'); return }
    setSaving(true); setMessage('')
    const input = { userBookId: bookId, entryType, body, page: page ? Number(page) : null, moodTags: moods.split(',').map((mood) => mood.trim()).filter(Boolean), isSpoiler: spoiler }
    try {
      if (editingId) {
        const saved = await updateMyJournalEntry(editingId, input)
        setEntries((current) => current.map((entry) => entry.id === saved.id ? saved : entry))
        setMessage('Journal entry updated.')
        onActivity()
      } else {
        const saved = await createMyJournalEntry(input)
        setEntries((current) => [saved, ...current])
        setMessage('Saved privately to your book journal.')
        onActivity()
      }
      setBody(''); setPage(''); setMoods(''); setSpoiler(false); setEditingId(null)
    } catch (saveError) { setMessage(saveError instanceof Error ? saveError.message : 'That entry could not be saved.') }
    finally { setSaving(false) }
  }

  async function removeEntry(id: string) {
    if (!window.confirm('Delete this private journal entry? This cannot be undone.')) return
    try { await deleteMyJournalEntry(id); setEntries((current) => current.filter((entry) => entry.id !== id)) }
    catch (removeError) { setMessage(removeError instanceof Error ? removeError.message : 'That entry could not be removed.') }
  }

  const visible = useMemo(() => entries.filter((entry) => {
    const term = query.trim().toLowerCase()
    return (bookFilter === 'all' || entry.userBookId === bookFilter)
      && (typeFilter === 'all' || entry.entryType === typeFilter)
      && (!term || `${entry.title} ${entry.body} ${entry.moodTags.join(' ')}`.toLowerCase().includes(term))
  }).sort((a, b) => {
    if (sortOrder === 'oldest') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    if (sortOrder === 'book') return a.title.localeCompare(b.title) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  }), [entries, query, bookFilter, typeFilter, sortOrder])

  return (
    <div className="engagement-page journal-page">
      <section className="engagement-hero journal-hero">
        <div><p className="eyebrow">PRIVATE BY DEFAULT</p><h2>Book journal</h2><p>Keep reactions, quotes, predictions, characters, and review drafts tied to the book that inspired them.</p></div>
        <button className="primary" type="button" onClick={() => { resetComposer(); setComposerOpen((open) => !open) }}>{composerOpen ? <><X size={17} /> Close writer</> : <><NotebookPen size={17} /> New entry</>}</button>
      </section>

      {composerOpen && (
        <form className="journal-composer" onSubmit={submit}>
          <div className="form-section-title"><LockKeyhole size={18} /><div><strong>{editingId ? 'Edit journal entry' : 'Write without an audience'}</strong><small>Entries stay visible only to this account.</small></div></div>
          <div className="form-grid two">
            <label><span>Book</span><select value={bookId} disabled={Boolean(editingId)} onChange={(event) => setBookId(event.target.value)}>{books.map((book) => <option value={book.id} key={book.id}>{book.title}</option>)}</select></label>
            <label><span>Entry type</span><select value={entryType} onChange={(event) => setEntryType(event.target.value as JournalEntryType)}>{entryTypes.map((type) => <option value={type.id} key={type.id}>{type.label}</option>)}</select></label>
          </div>
          <label className="field-full"><span>Your entry</span><textarea className="journal-body-input" required value={body} onChange={(event) => setBody(event.target.value)} maxLength={12000} placeholder="What do you want to remember?" /></label>
          <div className="form-grid two">
            <label><span>Page (optional)</span><input type="number" min="0" value={page} onChange={(event) => setPage(event.target.value)} /></label>
            <label><span>Moods (optional, comma separated)</span><input value={moods} onChange={(event) => setMoods(event.target.value)} placeholder="tense, hopeful, cozy" /></label>
          </div>
          <label className="spoiler-check"><input type="checkbox" checked={spoiler} onChange={(event) => setSpoiler(event.target.checked)} /><span>Hide this entry behind a spoiler warning</span></label>
          <div className="composer-actions"><button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : <><Check size={17} /> {editingId ? 'Update entry' : 'Save entry'}</>}</button>{editingId && <button className="secondary" type="button" onClick={resetComposer}>Cancel edit</button>}</div>
          {message && <p className="calm-message" role="status">{message}</p>}
        </form>
      )}

      <section className="journal-library">
        <div className="journal-toolbar">
          <label className="engagement-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your entries..." /></label>
          <label><BookOpen size={15} /><select value={bookFilter} onChange={(event) => setBookFilter(event.target.value)}><option value="all">All books</option>{books.map((book) => <option value={book.id} key={book.id}>{book.title}</option>)}</select><ChevronDown size={14} /></label>
          <label><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | JournalEntryType)}><option value="all">All entry types</option>{entryTypes.map((type) => <option value={type.id} key={type.id}>{type.label}</option>)}</select><ChevronDown size={14} /></label>
          <label><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}><option value="newest">Newest updated</option><option value="oldest">Oldest first</option><option value="book">Book title</option></select><ChevronDown size={14} /></label>
        </div>
        <div className="journal-entry-list">
          {visible.map((entry) => <JournalEntryCard entry={entry} onEdit={() => editEntry(entry)} onDelete={() => void removeEntry(entry.id)} key={entry.id} />)}
          {visible.length === 0 && <div className="engagement-empty"><NotebookPen size={28} /><p>Your matching journal entries will gather here.</p></div>}
        </div>
      </section>
    </div>
  )
}

function JournalEntryCard({ entry, onEdit, onDelete }: { entry: JournalEntry; onEdit: () => void; onDelete: () => void }) {
  const [revealed, setRevealed] = useState(!entry.isSpoiler)
  const wasEdited = Math.abs(new Date(entry.updatedAt).getTime() - new Date(entry.createdAt).getTime()) > 1000
  return (
    <article className="journal-entry-card">
      <div className="journal-entry-meta"><span>{entry.entryType.replace('_', ' ')}</span><time dateTime={wasEdited ? entry.updatedAt : entry.createdAt}>{wasEdited ? 'Edited ' : ''}{new Date(wasEdited ? entry.updatedAt : entry.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
      <h3>{entry.title}</h3>
      {entry.isSpoiler && !revealed ? <button className="spoiler-reveal" type="button" onClick={() => setRevealed(true)}><LockKeyhole size={15} /> Reveal spoiler</button> : <p className="journal-entry-body">{entry.body}</p>}
      <div className="journal-entry-foot"><span>{entry.page !== undefined ? `Page ${entry.page}` : ''}{entry.moodTags.length ? `${entry.page !== undefined ? ' · ' : ''}${entry.moodTags.join(' · ')}` : ''}</span><div><button type="button" onClick={onEdit}><Edit3 size={15} /> Edit</button><button type="button" onClick={onDelete}><Trash2 size={15} /> Delete</button></div></div>
    </article>
  )
}
