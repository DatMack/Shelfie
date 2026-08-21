import type { Book } from './books'

export type DailyQuestEvent = 'minutes_read' | 'pages_read' | 'reading_session' | 'progress_log' | 'journal_entry'

export type DailyQuest = {
  id: string
  title: string
  description: string
  event: DailyQuestEvent
  target: number
  unit: string
  xp: number
}

export type DailyQuestSet = {
  dateKey: string
  source: 'smart-fallback' | 'ai'
  headline: string
  quests: DailyQuest[]
  completionBonusXp: number
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function hash(value: string) {
  let total = 2166136261
  for (const char of value) {
    total ^= char.charCodeAt(0)
    total = Math.imul(total, 16777619)
  }
  return Math.abs(total)
}

function pick<T>(items: T[], seed: number, offset = 0) {
  return items[(seed + offset) % items.length]
}

export function buildDailyQuestSet(books: Book[], date = new Date()): DailyQuestSet {
  const dateKey = localDateKey(date)
  const current = books.filter((book) => book.status === 'Currently Reading')
  const primary = current[0]
  const seed = hash(`${dateKey}:${books.length}:${primary?.title ?? 'reader'}`)

  const minuteTarget = pick([10, 15, 20, 25], seed)
  const normalPageTarget = pick([10, 15, 20, 25], seed, 3)
  const remaining = primary && primary.pages > 0 ? Math.max(0, primary.pages - (primary.currentPage ?? 0)) : 0
  const pageTarget = remaining > 0 && remaining <= 30 ? remaining : normalPageTarget

  const readingTitles = ['Cozy Focus', 'Quiet Chapter', 'Reading Reset', 'Settle In', 'Story Time']
  const pageTitles = remaining > 0 && remaining <= 30
    ? ['Finish Line']
    : ['Turn the Page', 'Page Pocket', 'One More Stack', 'Chapter Push', 'Keep It Moving']

  const engagement = pick<DailyQuest>([
    {
      id: `${dateKey}-session`,
      title: 'Show Up',
      description: 'Log one reading session today. Tiny check-ins count.',
      event: 'reading_session',
      target: 1,
      unit: 'session',
      xp: 10,
    },
    {
      id: `${dateKey}-progress`,
      title: 'Bookmark Check',
      description: 'Update your reading progress once after your session.',
      event: 'progress_log',
      target: 1,
      unit: 'update',
      xp: 10,
    },
    {
      id: `${dateKey}-journal`,
      title: 'Leave a Breadcrumb',
      description: 'Save one quick thought, quote, prediction, or mood from what you read.',
      event: 'journal_entry',
      target: 1,
      unit: 'entry',
      xp: 15,
    },
  ], seed, 7)

  return {
    dateKey,
    source: 'smart-fallback',
    headline: primary ? `Today's quests pair nicely with ${primary.title}.` : 'A small reading win is enough for today.',
    completionBonusXp: 25,
    quests: [
      {
        id: `${dateKey}-minutes`,
        title: pick(readingTitles, seed, 2),
        description: `Read for ${minuteTarget} minutes. One focused sitting is plenty.`,
        event: 'minutes_read',
        target: minuteTarget,
        unit: 'min',
        xp: minuteTarget >= 20 ? 20 : 15,
      },
      {
        id: `${dateKey}-pages`,
        title: pick(pageTitles, seed, 4),
        description: remaining > 0 && remaining <= 30
          ? `You're close — read the final ${pageTarget} pages of ${primary?.title}.`
          : `Read ${pageTarget} pages${primary ? ` of ${primary.title}` : ''}.`,
        event: 'pages_read',
        target: pageTarget,
        unit: pageTarget === 1 ? 'page' : 'pages',
        xp: pageTarget >= 20 ? 20 : 15,
      },
      engagement,
    ],
  }
}

// Future AI generation uses the same strict event types and target limits.
// The model can personalize wording and choose a quest mix, but Shelfie validates
// the returned JSON before saving it so the daily board always stays achievable.
export const aiQuestRules = {
  maxQuests: 3,
  maxMinutesTarget: 30,
  maxPagesTarget: 40,
  maxSingleQuestXp: 25,
  allowedEvents: ['minutes_read', 'pages_read', 'reading_session', 'progress_log', 'journal_entry'] as DailyQuestEvent[],
}
