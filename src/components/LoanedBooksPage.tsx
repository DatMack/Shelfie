import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BookOpen, CalendarDays, Check, Clock3, HandHelping, LoaderCircle, RotateCcw, UserRound } from 'lucide-react'
import type { Book } from '../data/books'
import { createBookLoan, localLoanDate, returnBookLoan, type BookLoan } from '../lib/loanData'

function displayDate(value?: string) {
  if (!value) return 'No due date'
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(loan: BookLoan) {
  return Boolean(!loan.returnedAt && loan.dueDate && loan.dueDate < localLoanDate())
}

export function BookLoanControl({ book, loan, onChanged }: { book: Book; loan?: BookLoan; onChanged: () => void | Promise<void> }) {
  const [formOpen, setFormOpen] = useState(false)
  const [borrowerName, setBorrowerName] = useState('')
  const [loanedAt, setLoanedAt] = useState(localLoanDate())
  const [dueDate, setDueDate] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (loan) setFormOpen(false)
  }, [loan?.id])

  async function saveLoan(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await createBookLoan({ userBookId: book.id, borrowerName, loanedAt, dueDate: dueDate || undefined, privateNote: privateNote || undefined })
      setBorrowerName('')
      setDueDate('')
      setPrivateNote('')
      await onChanged()
      setMessage('Loan saved. Shelfie will keep track of it here.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That loan could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function markReturned() {
    if (!loan) return
    setBusy(true)
    setMessage('')
    try {
      await returnBookLoan(loan.id)
      await onChanged()
      setMessage('Welcome home. This book is marked as returned.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The return could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="book-loan-control">
      <div className="book-loan-heading">
        <div><strong>Loan tracking</strong><small>Private to your account</small></div>
        <HandHelping size={18} />
      </div>
      {loan ? (
        <div className={isOverdue(loan) ? 'current-loan overdue' : 'current-loan'}>
          <div className="current-loan-copy">
            <span><UserRound size={15} /> Loaned to</span>
            <strong>{loan.borrowerName}</strong>
            <small>Out since {displayDate(loan.loanedAt)} · {loan.dueDate ? `Due ${displayDate(loan.dueDate)}` : 'No due date'}</small>
            {loan.privateNote && <p>{loan.privateNote}</p>}
          </div>
          <button type="button" disabled={busy} onClick={() => void markReturned()}>{busy ? <LoaderCircle className="spin" size={16} /> : <RotateCcw size={16} />} Mark returned</button>
        </div>
      ) : formOpen ? (
        <form className="loan-form" onSubmit={(event) => void saveLoan(event)}>
          <label><span>Who has it?</span><input autoFocus required maxLength={120} value={borrowerName} onChange={(event) => setBorrowerName(event.target.value)} placeholder="Name" /></label>
          <div className="loan-date-fields">
            <label><span>Loaned on</span><input required type="date" value={loanedAt} onChange={(event) => { setLoanedAt(event.target.value); if (dueDate && dueDate < event.target.value) setDueDate('') }} /></label>
            <label><span>Due back <small>optional</small></span><input type="date" min={loanedAt} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          </div>
          <label><span>Private note <small>optional</small></span><textarea maxLength={1000} rows={2} value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} placeholder="Anything you want to remember…" /></label>
          <div className="loan-form-actions"><button type="button" onClick={() => { setFormOpen(false); setMessage('') }}>Cancel</button><button className="loan-save" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Save loan</button></div>
        </form>
      ) : (
        <button className="start-loan-button" type="button" onClick={() => { setFormOpen(true); setMessage('') }}><HandHelping size={17} /> Loan this book</button>
      )}
      {message && <small className="loan-message" role="status">{message}</small>}
    </div>
  )
}

export function LoanedBooksPage({ books, loans, loading, error, onOpenBook, onChanged }: {
  books: Book[]
  loans: BookLoan[]
  loading: boolean
  error?: string
  onOpenBook: (bookId: string) => void
  onChanged: () => void | Promise<void>
}) {
  const [returningId, setReturningId] = useState('')
  const [message, setMessage] = useState('')
  const activeLoans = useMemo(() => loans.filter((loan) => !loan.returnedAt), [loans])
  const history = useMemo(() => loans.filter((loan) => loan.returnedAt).slice(0, 12), [loans])
  const overdueCount = activeLoans.filter(isOverdue).length

  async function markReturned(loan: BookLoan) {
    setReturningId(loan.id)
    setMessage('')
    try {
      await returnBookLoan(loan.id)
      await onChanged()
      setMessage('Book marked as returned.')
    } catch (returnError) {
      setMessage(returnError instanceof Error ? returnError.message : 'That return could not be saved.')
    } finally {
      setReturningId('')
    }
  }

  return (
    <div className="loans-page">
      <section className="loans-hero">
        <div><p className="eyebrow">YOUR BOOKS, OUT IN THE WORLD</p><h2>Know who borrowed what.</h2><p>Loan details stay private to your account. Mark a book returned and Shelfie keeps the history without cluttering your collection.</p></div>
        <div className="loans-summary"><span><HandHelping size={19} /> Currently loaned</span><strong>{loading ? '—' : activeLoans.length}</strong><small>{overdueCount ? `${overdueCount} past due` : activeLoans.length ? 'Everything is accounted for' : 'Every book is home'}</small></div>
      </section>

      {(error || message) && <div className="loan-page-message" role="status">{error || message}</div>}

      <div className="section-heading"><div><p className="eyebrow">OUT NOW</p><h2>Loaned books</h2></div></div>
      {loading ? (
        <div className="loans-empty"><LoaderCircle className="spin" size={28} /><p>Checking the shelves…</p></div>
      ) : activeLoans.length === 0 ? (
        <div className="loans-empty"><BookOpen size={36} /><h3>Everything is home</h3><p>Open any owned book and choose “Loan this book” when someone borrows it.</p></div>
      ) : (
        <div className="loan-list">
          {activeLoans.map((loan) => {
            const book = books.find((item) => item.id === loan.userBookId)
            if (!book) return null
            return (
              <article className={isOverdue(loan) ? 'loan-card overdue' : 'loan-card'} key={loan.id}>
                <button className="loan-book-cover" type="button" onClick={() => onOpenBook(book.id)} style={{ background: `linear-gradient(155deg,${book.color},#15100c)` }}>{book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span>{book.title}</span>}</button>
                <div className="loan-card-copy"><small>{isOverdue(loan) ? 'PAST DUE' : 'ON LOAN'}</small><h3>{book.title}</h3><p>{book.author}</p><strong><UserRound size={15} /> {loan.borrowerName}</strong><div className="loan-dates"><span><CalendarDays size={14} /> Loaned {displayDate(loan.loanedAt)}</span><span><Clock3 size={14} /> {loan.dueDate ? `Due ${displayDate(loan.dueDate)}` : 'No due date'}</span></div>{loan.privateNote && <blockquote>{loan.privateNote}</blockquote>}</div>
                <div className="loan-card-actions"><button type="button" onClick={() => onOpenBook(book.id)}>Open book</button><button className="return-loan-button" type="button" disabled={returningId === loan.id} onClick={() => void markReturned(loan)}>{returningId === loan.id ? <LoaderCircle className="spin" size={16} /> : <RotateCcw size={16} />} Mark returned</button></div>
              </article>
            )
          })}
        </div>
      )}

      {history.length > 0 && <section className="loan-history"><div className="section-heading"><div><p className="eyebrow">RECENTLY HOME</p><h2>Return history</h2></div></div><div>{history.map((loan) => { const book = books.find((item) => item.id === loan.userBookId); return book ? <button type="button" key={loan.id} onClick={() => onOpenBook(book.id)}><Check size={15} /><span><strong>{book.title}</strong><small>{loan.borrowerName} · returned {displayDate(loan.returnedAt)}</small></span></button> : null })}</div></section>}
    </div>
  )
}
