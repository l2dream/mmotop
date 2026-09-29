/**
 * The games MMOTOP lists servers for, in the order the category bar shows them.
 *
 * The category bar, the Game filter and the Version filter are all built from
 * this list, so a game exists in all three or in none. Chronicle names are
 * the players' own jargon and are never translated.
 */

export interface Chronicle {
  /** As players write it: "Interlude", "WotLK 3.3.5a", "Season 6". */
  name: string
  /** Up to three characters for the square badge beside the server name. */
  badge: string
  /**
   * What a server row shows when the full name does not fit its column (58px
   * on phones). The full name stays in the filter and the row's tooltip.
   */
  short?: string
}

export interface GameInfo {
  id: string
  /** The game's own name; a proper noun, not translated. */
  name: string
  genre: string
  chronicles: Chronicle[]
}

export const GAMES = [
  {
    id: 'wow', name: 'World of Warcraft', genre: 'MMORPG',
    chronicles: [
      { name: 'Classic 1.12.1', badge: 'CL', short: 'Classic' },
      { name: 'WotLK 3.3.5a', badge: 'WL', short: 'WotLK' },
      { name: 'Cataclysm 4.3.4', badge: 'CT', short: 'Cata' },
      { name: 'MoP 5.4.8', badge: 'MP', short: 'MoP' },
      { name: 'Legion 7.3.5', badge: 'LG', short: 'Legion' }
    ]
  },
  {
    id: 'lineage2', name: 'Lineage II', genre: 'MMORPG',
    chronicles: [
      { name: 'Interlude', badge: 'IL' },
      { name: 'Gracia Final', badge: 'GF', short: 'Gracia' },
      { name: 'High-Five', badge: 'HF' },
      { name: 'Classic', badge: 'CL' },
      { name: 'Essence', badge: 'ES' }
    ]
  },
  {
    id: 'mu', name: 'MuOnline', genre: 'MMORPG',
    chronicles: [
      { name: '0.97d', badge: '97' },
      { name: 'Season 6', badge: 'S6' },
      { name: 'Season 13', badge: 'S13' },
      { name: 'Season 17', badge: 'S17' }
    ]
  },
  {
    id: 'aion', name: 'AION', genre: 'MMORPG',
    chronicles: [
      { name: '2.7', badge: '2.7' },
      { name: '4.8', badge: '4.8' },
      { name: '5.8', badge: '5.8' }
    ]
  },
  {
    id: 'pw', name: 'Perfect World', genre: 'MMORPG',
    chronicles: [
      { name: '1.3.6', badge: '136' },
      { name: '1.4.6', badge: '146' },
      { name: '1.5.5', badge: '155' }
    ]
  },
  {
    id: 'rf', name: 'RF Online', genre: 'MMORPG',
    chronicles: [
      { name: '2.2.3', badge: '223' },
      { name: 'Giga 4', badge: 'G4' }
    ]
  },
  {
    id: 'sro', name: 'Silkroad Online', genre: 'MMORPG',
    chronicles: [
      { name: 'Cap 90', badge: '90' },
      { name: 'Cap 110', badge: '110' },
      { name: 'Cap 140', badge: '140' }
    ]
  },
  {
    id: 'metin2', name: 'Metin2', genre: 'MMORPG',
    chronicles: [
      { name: 'Old School', badge: 'OS', short: 'Oldschool' },
      { name: 'Middle School', badge: 'MS', short: 'Midschool' },
      { name: 'New School', badge: 'NS', short: 'Newschool' }
    ]
  },
  {
    id: 'rappelz', name: 'Rappelz', genre: 'MMORPG',
    chronicles: [
      { name: 'Epic 7.4', badge: 'E7' },
      { name: 'Epic 9.5', badge: 'E9' }
    ]
  },
  {
    id: 'tibia', name: 'Tibia', genre: 'MMORPG',
    chronicles: [
      { name: '7.4', badge: '7.4' },
      { name: '8.60', badge: '8.6' },
      { name: '10.98', badge: '10' }
    ]
  }
] as const satisfies readonly GameInfo[]

export type GameId = (typeof GAMES)[number]['id']

const BY_ID = new Map<string, GameInfo>(GAMES.map((g) => [g.id, g]))

export function gameById(id: string): GameInfo | undefined {
  return BY_ID.get(id)
}

/** The chronicle as a server row shows it. */
export function chronicleShort(gameId: string, chronicle: string): string {
  return gameById(gameId)?.chronicles.find((c) => c.name === chronicle)?.short ?? chronicle
}

/** The badge for a server's chronicle; the first letters of it if unlisted. */
export function chronicleBadge(gameId: string, chronicle: string): string {
  const found = gameById(gameId)?.chronicles.find((c) => c.name === chronicle)
  return found?.badge ?? chronicle.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase()
}
