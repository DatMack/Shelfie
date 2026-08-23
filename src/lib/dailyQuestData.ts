import { supabase } from './supabase'

export type StoredDailyQuest = {
  id: string
  quest_set_id: string
  user_id: string
  quest_date: string
  position: number
  title: string
  description: string
  event_type: 'minutes_read' | 'pages_read' | 'reading_session' | 'progress_log' | 'journal_entry' | 'rate_book' | 'add_book' | 'wishlist_book' | 'own_book' | 'customize_book' | 'favorite_book' | 'start_book' | 'finish_book' | 'manual_book' | 'update_book_details' | 'signed_book'
  target_amount: number
  unit: string
  reward_xp: number
  progress_amount: number
  completed_at: string | null
  metadata: Record<string, unknown>
}

export function getLocalActivityDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function ensureMyDailyQuests(date = new Date()) {
  if (!supabase) throw new Error('Shelfie is not connected to Supabase.')

  const { data, error } = await supabase.rpc('ensure_my_daily_quests', {
    p_local_date: getLocalActivityDate(date),
  })

  if (error) throw error
  return (data ?? []) as StoredDailyQuest[]
}

export async function loadMyDailyQuestSet(date = new Date()) {
  if (!supabase) throw new Error('Shelfie is not connected to Supabase.')

  const questDate = getLocalActivityDate(date)
  const quests = await ensureMyDailyQuests(date)
  const { data: set, error: setError } = await supabase
    .from('daily_quest_sets')
    .select('*')
    .eq('quest_date', questDate)
    .maybeSingle()

  if (setError) throw setError

  return { set, quests }
}
