import { useEffect, useRef, useState } from 'react'
import { BookOpenCheck, Camera, ChevronLeft, LogOut, Trophy, UserRound, X } from 'lucide-react'
import type { Book } from '../data/books'
import { loadMyProfile, type ShelfieProfile, uploadProfilePicture } from '../lib/shelfieData'
import { DailyQuestBoard } from './DailyQuestBoard'
import { ReaderProgressCard } from './ReaderProgressCard'

export function ProfileDrawer({
  open,
  userId,
  books,
  fallbackName,
  userEmail,
  fallbackAvatar,
  onToggle,
  onSignOut,
  onOpenReadingLog,
  onOpenAchievements,
  engagementRefreshToken = 0,
}: {
  open: boolean
  userId: string
  books: Book[]
  fallbackName?: string
  userEmail?: string
  fallbackAvatar?: string
  onToggle: () => void
  onSignOut?: () => void | Promise<void>
  onOpenReadingLog?: () => void
  onOpenAchievements?: () => void
  engagementRefreshToken?: number
}) {
  const [profile, setProfile] = useState<ShelfieProfile | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadMyProfile().then(setProfile).catch(() => setProfile(null))
  }, [])

  const name = profile?.displayName || profile?.username || fallbackName || userEmail?.split('@')[0] || 'Reader'
  const username = profile?.username ? `@${profile.username}` : userEmail ?? 'Shelfie reader'
  const avatar = profile?.avatarUrl || fallbackAvatar
  const read = books.filter((book) => book.status === 'Read').length
  const pages = books.filter((book) => book.status === 'Read').reduce((sum, book) => sum + (book.pages || 0), 0)

  async function uploadAvatar(file?: File) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const avatarUrl = await uploadProfilePicture(file)
      setProfile((current) => current ? { ...current, avatarUrl } : null)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload that picture.')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <>
      <button className="sidebar-profile-button" type="button" onClick={onToggle} aria-expanded={open}>
        <span className="sidebar-avatar">{avatar ? <img src={avatar} alt="" /> : name.slice(0, 2).toUpperCase()}</span>
        <span><strong>{name}</strong><small>{username}</small></span>
        <ChevronLeft className={open ? 'profile-chevron open' : 'profile-chevron'} size={18} />
      </button>

      <section className={open ? 'profile-drawer open' : 'profile-drawer'} aria-hidden={!open} aria-label="Reader profile">
        <div className="profile-drawer-head">
          <div><p className="eyebrow">READER PROFILE</p><h2>{name}</h2></div>
          <button className="icon-button" type="button" onClick={onToggle} aria-label="Close profile"><X /></button>
        </div>

        <div className="profile-identity">
          <div className="profile-avatar-large">{avatar ? <img src={avatar} alt={`${name}'s profile`} /> : <UserRound size={42} />}</div>
          <div><span>{username}</span><small>{profile?.bio ?? 'Building a life one chapter at a time.'}</small></div>
          <input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
          <button className="profile-photo-button" type="button" disabled={uploading} onClick={() => fileInput.current?.click()} aria-label={uploading ? 'Uploading profile picture' : 'Change profile picture'} title={uploading ? 'Uploading…' : 'Change photo'}><Camera size={17} /></button>
        </div>
        {error && <p className="profile-error">{error}</p>}

        <div className="profile-stats">
          <div><strong>{books.length}</strong><span>On shelf</span></div>
          <div><strong>{read}</strong><span>Read</span></div>
          <div><strong>{pages.toLocaleString()}</strong><span>Pages</span></div>
        </div>

        <ReaderProgressCard userId={userId} refreshToken={engagementRefreshToken} />
        <DailyQuestBoard refreshToken={engagementRefreshToken} onOpenReadingLog={onOpenReadingLog} />

        <div className="profile-quick-links">
          {onOpenReadingLog && <button type="button" onClick={onOpenReadingLog}><BookOpenCheck size={16} /> Reading log</button>}
          {onOpenAchievements && <button type="button" onClick={onOpenAchievements}><Trophy size={16} /> Achievements</button>}
        </div>

        {onSignOut && <button className="profile-signout" type="button" onClick={() => void onSignOut()}><LogOut size={17} /> Sign out</button>}
      </section>
    </>
  )
}
