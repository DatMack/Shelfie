import { useEffect, useState } from 'react'
import { getLevelForXp } from '../data/progression'
import { supabase } from './supabase'

const maxLevelTesterFingerprint = '1d61d7a0'
export const DEMO_READER_XP = 980
export const MAX_LEVEL_TEST_XP = 34155

function fingerprint(value: string) {
  let hash = 0x811c9dc5
  const normalized = value.trim().toLowerCase()

  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return hash.toString(16).padStart(8, '0')
}

export function isMaxLevelTester(email?: string | null) {
  if (!email) return false
  return fingerprint(email) === maxLevelTesterFingerprint
}

function progressionFor(email?: string | null) {
  const tester = isMaxLevelTester(email)
  const currentXp = tester ? MAX_LEVEL_TEST_XP : DEMO_READER_XP
  return {
    isMaxLevelTester: tester,
    currentXp,
    currentLevel: getLevelForXp(currentXp).level,
  }
}

export function useTestingProgression() {
  const [progression, setProgression] = useState(() => progressionFor(null))

  useEffect(() => {
    let active = true

    async function refreshTesterStatus() {
      if (!supabase) return

      try {
        const [{ data: sessionData }, { data: userData }] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser(),
        ])

        if (!active) return
        const email = userData.user?.email ?? sessionData.session?.user.email ?? null
        setProgression(progressionFor(email))
      } catch {
        if (active) setProgression(progressionFor(null))
      }
    }

    void refreshTesterStatus()

    const listener = supabase?.auth.onAuthStateChange((_event, session) => {
      if (active) setProgression(progressionFor(session?.user.email))
    })

    return () => {
      active = false
      listener?.data.subscription.unsubscribe()
    }
  }, [])

  return progression
}
