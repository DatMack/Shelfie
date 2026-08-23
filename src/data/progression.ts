export type RewardType = 'title' | 'shelf_theme' | 'decoration' | 'effect' | 'profile_frame' | 'streak_save'

export type LevelDefinition = {
  level: number
  title: string
  xpRequired: number
  reward?: {
    name: string
    description: string
    type: RewardType
    rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary'
  }
}

const rewards = new Map<number, NonNullable<LevelDefinition['reward']>>([
  [2, { name: 'Golden Bookmark', description: 'A small gold bookmark accent for your profile.', type: 'decoration', rarity: 'Common' }],
  [3, { name: 'Warm Glow', description: 'Unlock a warmer book-focus glow.', type: 'effect', rarity: 'Common' }],
  [5, { name: 'Walnut Shelf', description: 'A richer walnut bookshelf finish.', type: 'shelf_theme', rarity: 'Rare' }],
  [6, { name: 'Streak Save', description: 'Protect one reading streak from a missed day.', type: 'streak_save', rarity: 'Rare' }],
  [7, { name: 'Cozy Candle', description: 'Place a glowing candle on your virtual shelf.', type: 'decoration', rarity: 'Rare' }],
  [8, { name: 'Oak Library', description: 'Unlock a bright oak shelf theme.', type: 'shelf_theme', rarity: 'Rare' }],
  [10, { name: 'Brass Bookends', description: 'Decorative brass bookends for your shelf.', type: 'decoration', rarity: 'Epic' }],
  [12, { name: 'Falling Leaves', description: 'A subtle seasonal reading effect.', type: 'effect', rarity: 'Rare' }],
  [15, { name: 'Enchanted Sparkles', description: 'Give favorite books a magical particle effect.', type: 'effect', rarity: 'Epic' }],
  [20, { name: 'Grand Library', description: 'Unlock an ornate grand-library shelf theme.', type: 'shelf_theme', rarity: 'Epic' }],
  [25, { name: 'Gilded Reader Frame', description: 'A gold profile frame that shows off your level.', type: 'profile_frame', rarity: 'Epic' }],
  [35, { name: 'Dragon Bookend', description: 'A tiny dragon guards the edge of your shelf.', type: 'decoration', rarity: 'Legendary' }],
  [50, { name: 'Master Library', description: 'A legendary library theme with animated details.', type: 'shelf_theme', rarity: 'Legendary' }],
  [75, { name: 'Mythic Aura', description: 'A rare profile and bookshelf aura.', type: 'effect', rarity: 'Legendary' }],
  [100, { name: 'Eternal Library', description: 'The highest-tier Shelfie library theme and title.', type: 'shelf_theme', rarity: 'Legendary' }],
])

function titleForLevel(level: number) {
  if (level >= 100) return 'Eternal Reader'
  if (level >= 90) return 'Legend of the Stacks'
  if (level >= 75) return 'Mythic Reader'
  if (level >= 60) return 'Grand Archivist'
  if (level >= 50) return 'Master Librarian'
  if (level >= 40) return 'Keeper of Legends'
  if (level >= 35) return 'Tome Warden'
  if (level >= 25) return 'Keeper of Stories'
  if (level >= 20) return 'Library Curator'
  if (level >= 15) return 'Story Collector'
  if (level >= 12) return 'Page Voyager'
  if (level >= 10) return 'Bibliophile'
  if (level >= 9) return 'Lore Keeper'
  if (level >= 8) return 'Plot Wanderer'
  if (level >= 7) return 'Shelf Builder'
  if (level >= 6) return 'Night Reader'
  if (level >= 5) return 'Bookworm'
  if (level >= 4) return 'Story Seeker'
  if (level >= 3) return 'Chapter Chaser'
  if (level >= 2) return 'Bookmark Collector'
  return 'Page Turner'
}

// Level N starts at the sum of 100 + 5 * (level - 1) for every prior level.
// The complete 1–100 journey is 34,155 XP: steady enough to feel rewarding without
// letting a week of enthusiastic clicking consume the entire progression system.
export const levelDefinitions: LevelDefinition[] = Array.from({ length: 100 }, (_, index) => {
  const level = index + 1
  const priorSteps = level - 1
  const xpRequired = priorSteps * 100 + (5 * priorSteps * (priorSteps - 1)) / 2
  return { level, title: titleForLevel(level), xpRequired, reward: rewards.get(level) }
})

export function getLevelForXp(xp: number) {
  return [...levelDefinitions].reverse().find((definition) => xp >= definition.xpRequired) ?? levelDefinitions[0]
}

export function getNextLevel(currentLevel: number) {
  return levelDefinitions.find((definition) => definition.level > currentLevel)
}

export function getProgressForXp(xp: number) {
  const current = getLevelForXp(xp)
  const next = getNextLevel(current.level)
  if (!next) return { current, next: undefined, percent: 100, xpIntoLevel: 0, xpForLevel: 0 }

  const span = next.xpRequired - current.xpRequired
  const into = Math.max(0, xp - current.xpRequired)
  return {
    current,
    next,
    percent: Math.min(100, (into / span) * 100),
    xpIntoLevel: into,
    xpForLevel: span,
  }
}
