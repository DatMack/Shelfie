import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BookOpen, Check, LoaderCircle, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { App } from '../App'
import { getSession, resendConfirmationEmail, signInWithEmail, signOut, signUpWithEmail } from '../lib/auth'
import { supabase } from '../lib/supabase'

type AuthMode = 'signin' | 'signup'

export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let active = true

    getSession()
      .then((currentSession) => {
        if (active) setSession(currentSession)
      })
      .catch(() => {
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setCheckingSession(false)
      })

    const authListener = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setCheckingSession(false)
      }
    })

    return () => {
      active = false
      authListener?.data.subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  if (checkingSession) {
    return (
      <main className="welcome-page welcome-loading">
        <div className="welcome-loading-brand"><BookOpen size={30} /><span>Shelfie</span></div>
        <LoaderCircle className="spin" size={24} />
      </main>
    )
  }

  if (!session) return <WelcomeScreen onAuthenticated={setSession} />

  return <App onSignOut={handleSignOut} />
}

function WelcomeScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
    setNeedsConfirmation(false)
    setPassword('')
    setConfirmPassword('')
  }

  async function resendConfirmation() {
    if (!email.trim()) {
      setError('Enter your email first.')
      return
    }
    setResending(true)
    setError('')
    setNotice('')
    try {
      await resendConfirmationEmail(email)
      setNotice('Confirmation email sent. Check your inbox and junk folder, then tap the link from Shelfie.')
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not resend the confirmation email.')
    } finally {
      setResending(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setNeedsConfirmation(false)

    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    if (mode === 'signup') {
      if (username.trim().length < 3) {
        setError('Choose a username with at least 3 characters.')
        return
      }
      if (password.length < 8) {
        setError('Use at least 8 characters for your password.')
        return
      }
      if (password !== confirmPassword) {
        setError('Those passwords do not match.')
        return
      }
    }

    setSubmitting(true)
    try {
      if (mode === 'signin') {
        const data = await signInWithEmail(email, password)
        if (!data.session) throw new Error('Shelfie could not start your session. Please try again.')
        onAuthenticated(data.session)
        return
      }

      const data = await signUpWithEmail({ email, password, username, displayName: username })
      if (data.session) {
        onAuthenticated(data.session)
      } else {
        setNotice('Account created. Check your email to confirm it, then come back and sign in.')
        setNeedsConfirmation(true)
        setMode('signin')
        setPassword('')
        setConfirmPassword('')
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Shelfie could not complete that request.'
      if (message.toLowerCase().includes('email not confirmed')) {
        setNeedsConfirmation(true)
        setError('Your Shelfie account is waiting for email confirmation.')
      } else {
        setError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="welcome-page">
      <section className="welcome-story" aria-label="About Shelfie">
        <div className="welcome-brand"><BookOpen size={32} /><span>Shelfie</span></div>
        <div className="welcome-copy">
          <p className="welcome-eyebrow">YOUR STORIES. YOUR SHELF.</p>
          <h1>Build a library that grows with every story.</h1>
          <p>Track what you read, collect the editions you love, build streaks, complete quests, unlock rewards, and turn your bookshelf into something that feels like yours.</p>
        </div>
        <div className="welcome-bookcase" aria-hidden="true">
          <div className="welcome-shelf-books">
            <span className="welcome-book b1">READ</span><span className="welcome-book b2">EXPLORE</span><span className="welcome-book b3">COLLECT</span><span className="welcome-book b4">LEVEL UP</span><span className="welcome-book b5">REPEAT</span>
          </div>
          <div className="welcome-wood-shelf" />
        </div>
        <div className="welcome-points">
          <span><Check size={16} /> Beautiful personal bookshelf</span>
          <span><Sparkles size={16} /> Quests, streaks & rewards</span>
          <span><LockKeyhole size={16} /> Private by default</span>
        </div>
      </section>

      <section className="welcome-auth-wrap">
        <div className="welcome-auth-card">
          <div className="auth-switch" role="tablist" aria-label="Account options">
            <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => changeMode('signin')}>Sign In</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => changeMode('signup')}>Create Account</button>
          </div>

          <div className="auth-heading">
            <p className="welcome-eyebrow">{mode === 'signin' ? 'WELCOME BACK' : 'START YOUR SHELF'}</p>
            <h2>{mode === 'signin' ? 'Pick up where you left off.' : 'Create your Shelfie account.'}</h2>
            <p>{mode === 'signin' ? 'Sign in to open your bookshelf.' : 'A username, email, and password are all you need to get started.'}</p>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === 'signup' && (
              <label><span>Username</span><input type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} placeholder="Your Shelfie name" disabled={submitting} /></label>
            )}
            <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" disabled={submitting} required /></label>
            <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} disabled={submitting} required /></label>
            {mode === 'signup' && (
              <label><span>Confirm password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Type it again" disabled={submitting} required /></label>
            )}

            {error && <div className="auth-message auth-error" role="alert">{error}</div>}
            {notice && <div className="auth-message auth-notice" role="status">{notice}</div>}
            {needsConfirmation && (
              <button className="auth-resend" type="button" onClick={() => void resendConfirmation()} disabled={resending}>
                {resending ? <LoaderCircle className="spin" size={17} /> : <Mail size={17} />}
                Resend confirmation email
              </button>
            )}

            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="spin" size={18} />}
              {mode === 'signin' ? 'Open My Shelf' : 'Create My Shelf'}
            </button>
          </form>
          <p className="auth-privacy">Shelfie only asks for the basics. Your private reading data stays yours.</p>
        </div>
      </section>
    </main>
  )
}
