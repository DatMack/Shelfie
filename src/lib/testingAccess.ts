const maxLevelTesterFingerprint = '1d61d7a0'

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

export const MAX_LEVEL_TEST_XP = 100000
