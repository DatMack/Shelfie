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

export const levelDefinitions: LevelDefinition[] = [
  { level: 1, title: 'Page Turner', xpRequired: 0 },
  { level: 2, title: 'Bookmark Collector', xpRequired: 100, reward: { name: 'Golden Bookmark', description: 'A small gold bookmark accent for your profile.', type: 'decoration', rarity: 'Common' } },
  { level: 3, title: 'Chapter Chaser', xpRequired: 220, reward: { name: 'Warm Glow', description: 'Unlock a warmer book-focus glow.', type: 'effect', rarity: 'Common' } },
  { level: 4, title: 'Story Seeker', xpRequired: 360 },
  { level: 5, title: 'Bookworm', xpRequired: 520, reward: { name: 'Walnut Shelf', description: 'A richer walnut bookshelf finish.', type: 'shelf_theme', rarity: 'Rare' } },
  { level: 6, title: 'Night Reader', xpRequired: 700, reward: { name: 'Streak Save', description: 'Protect one reading streak from a missed day.', type: 'streak_save', rarity: 'Rare' } },
  { level: 7, title: 'Shelf Builder', xpRequired: 900, reward: { name: 'Cozy Candle', description: 'Place a glowing candle on your virtual shelf.', type: 'decoration', rarity: 'Rare' } },
  { level: 8, title: 'Plot Wanderer', xpRequired: 1125, reward: { name: 'Oak Library', description: 'Unlock a bright oak shelf theme.', type: 'shelf_theme', rarity: 'Rare' } },
  { level: 9, title: 'Lore Keeper', xpRequired: 1375 },
  { level: 10, title: 'Bibliophile', xpRequired: 1650, reward: { name: 'Brass Bookends', description: 'Decorative brass bookends for your shelf.', type: 'decoration', rarity: 'Epic' } },
  { level: 12, title: 'Page Voyager', xpRequired: 2300, reward: { name: 'Falling Leaves', description: 'A subtle seasonal reading effect.', type: 'effect', rarity: 'Rare' } },
  { level: 15, title: 'Story Collector', xpRequired: 3500, reward: { name: 'Enchanted Sparkles', description: 'Give favorite books a magical particle effect.', type: 'effect', rarity: 'Epic' } },
  { level: 20, title: 'Library Curator', xpRequired: 6000, reward: { name: 'Grand Library', description: 'Unlock an ornate grand-library shelf theme.', type: 'shelf_theme', rarity: 'Epic' } },
  { level: 25, title: 'Keeper of Stories', xpRequired: 9000, reward: { name: 'Gilded Reader Frame', description: 'A gold profile frame that shows off your level.', type: 'profile_frame', rarity: 'Epic' } },
  { level: 35, title: 'Tome Warden', xpRequired: 16000, reward: { name: 'Dragon Bookend', description: 'A tiny dragon guards the edge of your shelf.', type: 'decoration', rarity: 'Legendary' } },
  { level: 50, title: 'Master Librarian', xpRequired: 30000, reward: { name: 'Master Library', description: 'A legendary library theme with animated details.', type: 'shelf_theme', rarity: 'Legendary' } },
  { level: 75, title: 'Mythic Reader', xpRequired: 60000, reward: { name: 'Mythic Aura', description: 'A rare profile and bookshelf aura.', type: 'effect', rarity: 'Legendary' } },
  { level: 100, title: 'Eternal Reader', xpRequired: 100000, reward: { name: 'Eternal Library', description: 'The highest-tier Shelfie library theme and title.', type: 'shelf_theme', rarity: 'Legendary' } },
]

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
