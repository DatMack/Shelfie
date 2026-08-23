export type AchievementCategory = 'Reading' | 'Consistency' | 'Library' | 'Journal' | 'Curation' | 'Personalization'
export type AchievementRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary'

export type AchievementDefinition = {
  id: string
  title: string
  description: string
  category: AchievementCategory
  metric: string
  target: number
  rarity: AchievementRarity
  xp: number
  badgeIndex: number
  hidden?: boolean
}

type MilestoneGroup = {
  metric: string
  category: AchievementCategory
  targets: number[]
  titles: string[]
  describe: (target: number) => string
}

const groups: MilestoneGroup[] = [
  {
    metric: 'reading_sessions', category: 'Reading', targets: [1, 5, 10, 25, 50, 100],
    titles: ['First Check-In', 'Settling In', 'Chapter Habit', 'Story Regular', 'Reading Ritual', 'Session Centurion'],
    describe: (target) => `Log ${target} reading ${target === 1 ? 'session' : 'sessions'}.`,
  },
  {
    metric: 'pages_read', category: 'Reading', targets: [10, 100, 500, 1000, 2500, 5000, 10000],
    titles: ['Ten Pages Taller', 'Page Sprout', 'Paper Trail', 'Thousand-Page Journey', 'Ink Voyager', 'Keeper of Chapters', 'Ten Thousand Turns'],
    describe: (target) => `Log ${target.toLocaleString()} pages read.`,
  },
  {
    metric: 'minutes_read', category: 'Reading', targets: [15, 60, 300, 600, 1200, 3000],
    titles: ['Quiet Quarter Hour', 'Golden Hour', 'Five-Hour Flight', 'Ten Hours Elsewhere', 'A Day in Stories', 'Fifty-Hour Fellowship'],
    describe: (target) => `Spend ${target.toLocaleString()} minutes reading.`,
  },
  {
    metric: 'books_read', category: 'Reading', targets: [1, 3, 5, 10, 25, 50],
    titles: ['The End', 'Trilogy Energy', 'Five Fine Finishes', 'Double-Digit Reader', 'Story Devourer', 'Fifty Finales'],
    describe: (target) => `Mark ${target} ${target === 1 ? 'book' : 'books'} as read.`,
  },
  {
    metric: 'current_streak', category: 'Consistency', targets: [2, 3, 5, 7, 10, 14, 21, 30, 50, 75, 100],
    titles: ['Back Tomorrow', 'Three-Day Tale', 'Five-Day Flame', 'Week of Words', 'Tenacious Ten', 'Fortnight of Fiction', 'Three-Week Wanderer', 'Monthly Magic', 'Fifty-Day Fire', 'Seventy-Five Strong', 'Century Streak'],
    describe: (target) => `Reach a ${target}-day reading streak.`,
  },
  {
    metric: 'reading_days', category: 'Consistency', targets: [5, 15, 50, 100],
    titles: ['Five Cozy Days', 'Fifteen Bookish Days', 'Fifty Days Logged', 'A Hundred Reading Days'],
    describe: (target) => `Log reading on ${target} different days.`,
  },
  {
    metric: 'books_added', category: 'Library', targets: [1, 5, 10, 25, 50, 100, 250],
    titles: ['Shelf Starter', 'Little Library', 'Ten on the Shelf', 'Growing Stacks', 'Home Librarian', 'Hundred-Book Haven', 'Shelf Architect'],
    describe: (target) => `Add ${target} ${target === 1 ? 'book' : 'books'} to Shelfie.`,
  },
  {
    metric: 'owned_books', category: 'Library', targets: [1, 5, 10, 25, 50, 100],
    titles: ['Mine, All Mine', 'Five to Keep', 'Personal Stack', 'Collection Curator', 'Fifty Treasures', 'Hundred-Book Home'],
    describe: (target) => `Mark ${target} ${target === 1 ? 'book' : 'books'} as owned.`,
  },
  {
    metric: 'wishlist_books', category: 'Library', targets: [1, 5, 10, 25],
    titles: ['Maybe Next', 'Wishful Five', 'Future Shelf', 'Dream Library'],
    describe: (target) => `Place ${target} ${target === 1 ? 'book' : 'books'} on your wishlist.`,
  },
  {
    metric: 'dnf_books', category: 'Library', targets: [1, 3, 5],
    titles: ['Not for Me', 'Permission to Quit', 'Keeper of My Time'],
    describe: (target) => `Mark ${target} ${target === 1 ? 'book' : 'books'} DNF. Life is short.`,
  },
  {
    metric: 'journal_entries', category: 'Journal', targets: [1, 5, 10, 25, 50, 100, 250],
    titles: ['Margin Whisper', 'Five Breadcrumbs', 'Thought Collector', 'Ink Companion', 'Fifty Reflections', 'Private Chronicle', 'Archivist of Feelings'],
    describe: (target) => `Save ${target} journal ${target === 1 ? 'entry' : 'entries'}.`,
  },
  {
    metric: 'rated_books', category: 'Journal', targets: [1, 5, 10, 25, 50],
    titles: ['First Verdict', 'Star Gazer', 'Ten Takes', 'Taste Maker', 'Shelf Critic'],
    describe: (target) => `Rate ${target} ${target === 1 ? 'book' : 'books'}.`,
  },
  {
    metric: 'reviews_written', category: 'Journal', targets: [1, 5, 10],
    titles: ['Reviewer Debut', 'Five Full Thoughts', 'Review Regular'],
    describe: (target) => `Write ${target} thoughtful ${target === 1 ? 'review' : 'reviews'}.`,
  },
  {
    metric: 'favorite_books', category: 'Curation', targets: [1, 5, 10, 25],
    titles: ['Heart on the Shelf', 'Beloved Five', 'Top Ten Tales', 'Hall of Favorites'],
    describe: (target) => `Favorite ${target} ${target === 1 ? 'book' : 'books'}.`,
  },
  {
    metric: 'manual_books', category: 'Curation', targets: [1, 3, 5, 10],
    titles: ['Catalog Pioneer', 'Obscure Trio', 'Found Off-Grid', 'Rare-Find Librarian'],
    describe: (target) => `Add ${target} hard-to-find ${target === 1 ? 'book' : 'books'} manually.`,
  },
  {
    metric: 'signed_books', category: 'Curation', targets: [1, 3, 5],
    titles: ['A Little Ink Magic', 'Signed Trio', 'Autograph Collector'],
    describe: (target) => `Mark ${target} signed ${target === 1 ? 'copy' : 'copies'}.`,
  },
  {
    metric: 'special_editions', category: 'Curation', targets: [1, 3],
    titles: ['Something Special', 'Edition Enthusiast'],
    describe: (target) => `Catalog ${target} special ${target === 1 ? 'edition' : 'editions'}.`,
  },
  {
    metric: 'genres_collected', category: 'Curation', targets: [3, 5],
    titles: ['Genre Hopper', 'Wide-World Reader'],
    describe: (target) => `Collect books across ${target} genres.`,
  },
  {
    metric: 'custom_spines', category: 'Personalization', targets: [1, 5, 10],
    titles: ['Spine Stylist', 'Shelf Artist', 'Bespoke Bookcase'],
    describe: (target) => `Customize ${target} book ${target === 1 ? 'spine' : 'spines'}.`,
  },
  {
    metric: 'profile_photo', category: 'Personalization', targets: [1],
    titles: ['Face Behind the Shelf'],
    describe: () => 'Add a profile picture.',
  },
  {
    metric: 'formats_collected', category: 'Personalization', targets: [2, 4, 6],
    titles: ['Format Curious', 'Multi-Format Reader', 'Every Kind of Story'],
    describe: (target) => `Own books in ${target} different formats.`,
  },
  {
    metric: 'signed_proofs', category: 'Personalization', targets: [1, 3],
    titles: ['Proven Ink', 'Verified Collector'],
    describe: (target) => `Privately verify ${target} signed ${target === 1 ? 'copy' : 'copies'} with a photo.`,
  },
  {
    metric: 'first_editions', category: 'Personalization', targets: [1],
    titles: ['First of Its Name'],
    describe: () => 'Catalog a first edition.',
  },
]

function rarityFor(index: number, count: number): AchievementRarity {
  const progress = (index + 1) / count
  if (progress === 1 && count >= 5) return 'Legendary'
  if (progress >= 0.8) return 'Epic'
  if (progress >= 0.55) return 'Rare'
  if (progress >= 0.3) return 'Uncommon'
  return 'Common'
}

const xpByRarity: Record<AchievementRarity, number> = {
  Common: 5,
  Uncommon: 10,
  Rare: 20,
  Epic: 35,
  Legendary: 50,
}

export const achievements: AchievementDefinition[] = groups.flatMap((group) =>
  group.targets.map((target, index) => {
    const rarity = rarityFor(index, group.targets.length)
    return {
      id: `${group.metric}-${target}`,
      title: group.titles[index],
      description: group.describe(target),
      category: group.category,
      metric: group.metric,
      target,
      rarity,
      xp: xpByRarity[rarity],
      badgeIndex: 0,
    }
  }),
).map((achievement, badgeIndex) => ({ ...achievement, badgeIndex }))

if (achievements.length !== 100) throw new Error(`Shelfie needs exactly 100 achievements; found ${achievements.length}.`)

export const achievementCategories: Array<'All' | AchievementCategory> = ['All', 'Reading', 'Consistency', 'Library', 'Journal', 'Curation', 'Personalization']
