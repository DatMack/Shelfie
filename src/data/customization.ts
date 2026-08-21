export type ShelfStyleId =
  | 'classic'
  | 'cube'
  | 'floating'
  | 'ladder'
  | 'arch'
  | 'builtin'
  | 'reading-nook'
  | 'grand-hall'
  | 'enchanted'
  | 'dragon-hoard'
  | 'eternal'

export type ShelfFinishId =
  | 'starter-wood'
  | 'walnut'
  | 'oak'
  | 'mahogany'
  | 'ebony'
  | 'marble'
  | 'brass'
  | 'gold'
  | 'silver'
  | 'glass'
  | 'mythic'

export type SiteThemeId =
  | 'cozy-amber'
  | 'midnight-ink'
  | 'forest-study'
  | 'rosewood'
  | 'moonlight'
  | 'royal-gold'
  | 'arcane-violet'
  | 'frosted-silver'
  | 'eternal'

export type UnlockableCustomization<T extends string> = {
  id: T
  name: string
  description: string
  unlockLevel: number
  starter?: boolean
  preview: [string, string, string]
}

export const shelfStyles: UnlockableCustomization<ShelfStyleId>[] = [
  { id: 'classic', name: 'Classic Library', description: 'Traditional framed shelves with a cozy home-library feel.', unlockLevel: 1, starter: true, preview: ['#5d351c', '#351d10', '#170d08'] },
  { id: 'cube', name: 'Cube Shelf', description: 'Modern cubbies that visually divide the shelf into display spaces.', unlockLevel: 1, starter: true, preview: ['#5b351f', '#23150e', '#c58a47'] },
  { id: 'floating', name: 'Floating Shelves', description: 'Open wall shelves with no outer bookcase frame.', unlockLevel: 1, starter: true, preview: ['#2a1a12', '#7b4a27', '#d1a064'] },
  { id: 'ladder', name: 'Ladder Shelf', description: 'A lighter, angled display inspired by leaning ladder bookcases.', unlockLevel: 10, preview: ['#6a472c', '#281a11', '#b88855'] },
  { id: 'arch', name: 'Arched Library', description: 'Rounded architectural framing for a softer built-in look.', unlockLevel: 15, preview: ['#754725', '#21130c', '#d2a05f'] },
  { id: 'builtin', name: 'Built-In Wall', description: 'A full-wall library with strong architectural framing.', unlockLevel: 20, preview: ['#d7c6a7', '#4d3a2c', '#f0dfbf'] },
  { id: 'reading-nook', name: 'Reading Nook', description: 'A cozy inset shelf style made to feel like a private reading corner.', unlockLevel: 25, preview: ['#38503c', '#1a211b', '#d5b77f'] },
  { id: 'grand-hall', name: 'Grand Hall', description: 'Tall, ornate library framing for serious collectors.', unlockLevel: 35, preview: ['#6d3b1d', '#1b0f09', '#d9a94c'] },
  { id: 'enchanted', name: 'Enchanted Library', description: 'Fantasy architecture with subtle magical detailing.', unlockLevel: 50, preview: ['#2d3158', '#161428', '#a68be8'] },
  { id: 'dragon-hoard', name: 'Dragon Hoard', description: 'Dark stone, treasure accents, and a fantasy vault feel.', unlockLevel: 75, preview: ['#4b251c', '#111014', '#d49b37'] },
  { id: 'eternal', name: 'Eternal Library', description: 'The final prestige shelf: ornate, luminous, and unmistakably earned.', unlockLevel: 100, preview: ['#20182e', '#09070d', '#f0d084'] },
]

export const shelfFinishes: UnlockableCustomization<ShelfFinishId>[] = [
  { id: 'starter-wood', name: 'Warm Wood', description: 'Shelfie’s original warm wood finish.', unlockLevel: 1, starter: true, preview: ['#5a351c', '#7a4c27', '#2b170d'] },
  { id: 'walnut', name: 'Walnut', description: 'Deep chocolate wood with a richer, quieter grain.', unlockLevel: 5, preview: ['#3f271b', '#69462f', '#1b110c'] },
  { id: 'oak', name: 'Oak', description: 'A lighter natural wood finish with golden undertones.', unlockLevel: 8, preview: ['#9a6e3d', '#c29257', '#50351d'] },
  { id: 'mahogany', name: 'Mahogany', description: 'Warm red-brown wood with a polished traditional look.', unlockLevel: 12, preview: ['#682d24', '#934a35', '#2d1512'] },
  { id: 'ebony', name: 'Ebony', description: 'Near-black wood for a dramatic collector display.', unlockLevel: 15, preview: ['#1c1b1a', '#35312d', '#080807'] },
  { id: 'marble', name: 'Marble', description: 'Stone-white shelves with subtle veining and warm edges.', unlockLevel: 20, preview: ['#ded6c8', '#aaa296', '#5f5851'] },
  { id: 'brass', name: 'Brass', description: 'Dark shelving with aged brass architectural accents.', unlockLevel: 25, preview: ['#30271d', '#8f6b31', '#c3a45e'] },
  { id: 'gold', name: 'Gilded Gold', description: 'A prestige finish with deep shadows and gold trim.', unlockLevel: 35, preview: ['#2a1b0b', '#a66e16', '#f0c968'] },
  { id: 'silver', name: 'Sterling Silver', description: 'Cool metallic framing with dark graphite shelves.', unlockLevel: 40, preview: ['#25292d', '#89939b', '#d5dde2'] },
  { id: 'glass', name: 'Glass Display', description: 'A sleek display-case treatment with translucent shelf edges.', unlockLevel: 50, preview: ['#182327', '#5d7b82', '#b8d8dc'] },
  { id: 'mythic', name: 'Mythic', description: 'An endgame finish with luminous fantasy-metal accents.', unlockLevel: 75, preview: ['#251e38', '#725ea5', '#dec974'] },
]

export const siteThemes: UnlockableCustomization<SiteThemeId>[] = [
  { id: 'cozy-amber', name: 'Cozy Amber', description: 'Shelfie’s warm brown and amber signature look.', unlockLevel: 1, starter: true, preview: ['#120d09', '#d79b46', '#f5dfbd'] },
  { id: 'midnight-ink', name: 'Midnight Ink', description: 'Deep navy surfaces with cool bookish blue highlights.', unlockLevel: 3, preview: ['#090e18', '#557ca9', '#dce9f4'] },
  { id: 'forest-study', name: 'Forest Study', description: 'Dark evergreen backgrounds with moss and parchment accents.', unlockLevel: 8, preview: ['#09120e', '#6f9b6e', '#e1dec0'] },
  { id: 'rosewood', name: 'Rosewood', description: 'Muted burgundy and warm cream for a romantic library mood.', unlockLevel: 12, preview: ['#160b0d', '#a45f66', '#f0d6cc'] },
  { id: 'moonlight', name: 'Moonlight', description: 'Cool charcoal, slate, and pale moonlit highlights.', unlockLevel: 20, preview: ['#0d1016', '#8d9db6', '#e5e9f1'] },
  { id: 'royal-gold', name: 'Royal Gold', description: 'Blackened brown with brighter gold prestige accents.', unlockLevel: 35, preview: ['#0d0905', '#d3a633', '#fff0b0'] },
  { id: 'arcane-violet', name: 'Arcane Violet', description: 'A fantasy profile with violet shadows and magical lavender accents.', unlockLevel: 50, preview: ['#100b19', '#8d67c5', '#eee1ff'] },
  { id: 'frosted-silver', name: 'Frosted Silver', description: 'A cool graphite theme with silver-blue controls and highlights.', unlockLevel: 75, preview: ['#0a0d10', '#94a8b9', '#edf5fa'] },
  { id: 'eternal', name: 'Eternal', description: 'The Level 100 color profile: deep cosmic tones with luminous gold.', unlockLevel: 100, preview: ['#09060e', '#b092df', '#f3d676'] },
]

export function isCustomizationUnlocked(unlockLevel: number, currentLevel: number) {
  return currentLevel >= unlockLevel
}
