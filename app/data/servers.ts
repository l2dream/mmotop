import type { GameId } from './games'

/**
 * One listed server.
 *
 * Every panel on the home page is derived from these fields; nothing carries
 * a panel name or a hand-placed date. A server moves from COMING SOON to
 * ALREADY STARTED on its opening day by itself.
 */
export interface Server {
  /** Unique, lowercase, URL-safe: the address of its future page. */
  id: string
  name: string
  game: GameId
  /** Must be one of the game's chronicles in games.ts. Jargon, never translated. */
  chronicle: string
  /** The single headline rate: 500 means x500. Decimals allowed (1.5). */
  rate: number
  url: string
  /** Opening date, "YYYY-MM-DD". */
  openDate: string
  /** When the server was added to MMOTOP, "YYYY-MM-DD". Drives NEW GAMES. */
  listedAt: string
  /** Votes this calendar month; they reset on the 1st. Drives TOP GAMES. */
  votes: number
}

/**
 * TEST DATA. LA2DREAM is the owner's server; every other name is invented, so
 * no real project is shown as listed here. The `.example` domain is reserved
 * and never resolves. Dates are fixed, so after spring 2027 COMING SOON will
 * run dry — by then this list is replaced by the real one.
 */
export const SERVERS: Server[] = [
  // Lineage II
  { id: 'la2dream', name: 'LA2DREAM', game: 'lineage2', chronicle: 'Interlude', rate: 500, url: 'https://la2dream.example', openDate: '2025-11-20', listedAt: '2025-11-01', votes: 2480 },
  { id: 'nordveil', name: 'NORDVEIL', game: 'lineage2', chronicle: 'High-Five', rate: 50, url: 'https://nordveil.example', openDate: '2026-10-05', listedAt: '2026-09-18', votes: 310 },
  { id: 'ironhale', name: 'IRONHALE', game: 'lineage2', chronicle: 'Interlude', rate: 1200, url: 'https://ironhale.example', openDate: '2026-09-01', listedAt: '2026-08-14', votes: 1940 },
  { id: 'emberline', name: 'EMBERLINE', game: 'lineage2', chronicle: 'Classic', rate: 1, url: 'https://emberline.example', openDate: '2024-12-23', listedAt: '2024-12-01', votes: 2150 },
  { id: 'starforge', name: 'STARFORGE', game: 'lineage2', chronicle: 'High-Five', rate: 100, url: 'https://starforge.example', openDate: '2026-10-18', listedAt: '2026-09-20', votes: 420 },
  { id: 'moonspire', name: 'MOONSPIRE', game: 'lineage2', chronicle: 'Essence', rate: 3, url: 'https://moonspire.example', openDate: '2026-06-30', listedAt: '2026-06-02', votes: 1320 },
  { id: 'grimhold', name: 'GRIMHOLD', game: 'lineage2', chronicle: 'Interlude', rate: 25, url: 'https://grimhold.example', openDate: '2026-11-02', listedAt: '2026-09-15', votes: 180 },
  { id: 'silvermarch', name: 'SILVERMARCH', game: 'lineage2', chronicle: 'Gracia Final', rate: 15, url: 'https://silvermarch.example', openDate: '2023-05-14', listedAt: '2023-04-20', votes: 760 },
  { id: 'duskreach', name: 'DUSKREACH', game: 'lineage2', chronicle: 'High-Five', rate: 500, url: 'https://duskreach.example', openDate: '2026-08-12', listedAt: '2026-07-25', votes: 1610 },
  { id: 'aetheris', name: 'AETHERIS', game: 'lineage2', chronicle: 'Interlude', rate: 7, url: 'https://aetheris.example', openDate: '2027-01-10', listedAt: '2026-09-12', votes: 95 },
  { id: 'valoria', name: 'VALORIA', game: 'lineage2', chronicle: 'Classic', rate: 1.5, url: 'https://valoria.example', openDate: '2026-04-17', listedAt: '2026-03-30', votes: 880 },

  // World of Warcraft
  { id: 'coldharbor', name: 'COLDHARBOR', game: 'wow', chronicle: 'WotLK 3.3.5a', rate: 5, url: 'https://coldharbor.example', openDate: '2021-03-08', listedAt: '2021-03-01', votes: 2950 },
  { id: 'hollowpeak', name: 'HOLLOWPEAK', game: 'wow', chronicle: 'Classic 1.12.1', rate: 1, url: 'https://hollowpeak.example', openDate: '2026-11-20', listedAt: '2026-09-08', votes: 540 },
  { id: 'runegate', name: 'RUNEGATE', game: 'wow', chronicle: 'Cataclysm 4.3.4', rate: 3, url: 'https://runegate.example', openDate: '2025-07-08', listedAt: '2025-06-20', votes: 1270 },
  { id: 'stormglen', name: 'STORMGLEN', game: 'wow', chronicle: 'MoP 5.4.8', rate: 10, url: 'https://stormglen.example', openDate: '2026-02-05', listedAt: '2026-01-18', votes: 990 },
  { id: 'wyrmfall', name: 'WYRMFALL', game: 'wow', chronicle: 'Legion 7.3.5', rate: 100, url: 'https://wyrmfall.example', openDate: '2026-12-01', listedAt: '2026-09-05', votes: 260 },

  // MuOnline
  { id: 'crimsonvale', name: 'CRIMSONVALE', game: 'mu', chronicle: 'Season 6', rate: 1000, url: 'https://crimsonvale.example', openDate: '2026-09-20', listedAt: '2026-09-22', votes: 690 },
  { id: 'ashenguard', name: 'ASHENGUARD', game: 'mu', chronicle: 'Season 17', rate: 50, url: 'https://ashenguard.example', openDate: '2026-12-15', listedAt: '2026-09-10', votes: 150 },
  { id: 'frostlane', name: 'FROSTLANE', game: 'mu', chronicle: '0.97d', rate: 25, url: 'https://frostlane.example', openDate: '2022-10-01', listedAt: '2022-09-15', votes: 1150 },
  { id: 'nightveil', name: 'NIGHTVEIL', game: 'mu', chronicle: 'Season 13', rate: 200, url: 'https://nightveil.example', openDate: '2026-07-22', listedAt: '2026-07-01', votes: 830 },

  // AION
  { id: 'skyhaven', name: 'SKYHAVEN', game: 'aion', chronicle: '4.8', rate: 10, url: 'https://skyhaven.example', openDate: '2025-03-15', listedAt: '2025-03-01', votes: 1480 },
  { id: 'elyria', name: 'ELYRIA', game: 'aion', chronicle: '5.8', rate: 5, url: 'https://elyria.example', openDate: '2026-12-28', listedAt: '2026-09-03', votes: 120 },
  { id: 'abyssgate', name: 'ABYSSGATE', game: 'aion', chronicle: '2.7', rate: 1, url: 'https://abyssgate.example', openDate: '2024-06-01', listedAt: '2024-05-10', votes: 640 },
  { id: 'wingsong', name: 'WINGSONG', game: 'aion', chronicle: '4.8', rate: 3, url: 'https://wingsong.example', openDate: '2026-09-10', listedAt: '2026-08-28', votes: 470 },

  // Perfect World
  { id: 'jadepeak', name: 'JADEPEAK', game: 'pw', chronicle: '1.3.6', rate: 100, url: 'https://jadepeak.example', openDate: '2023-11-11', listedAt: '2023-10-25', votes: 1050 },
  { id: 'skylotus', name: 'SKYLOTUS', game: 'pw', chronicle: '1.5.5', rate: 10, url: 'https://skylotus.example', openDate: '2027-01-24', listedAt: '2026-09-01', votes: 70 },
  { id: 'cloudrift', name: 'CLOUDRIFT', game: 'pw', chronicle: '1.4.6', rate: 50, url: 'https://cloudrift.example', openDate: '2026-05-05', listedAt: '2026-04-15', votes: 720 },

  // RF Online
  { id: 'novacore', name: 'NOVACORE', game: 'rf', chronicle: '2.2.3', rate: 75, url: 'https://novacore.example', openDate: '2025-09-09', listedAt: '2025-08-20', votes: 560 },
  { id: 'ironcradle', name: 'IRONCRADLE', game: 'rf', chronicle: 'Giga 4', rate: 20, url: 'https://ironcradle.example', openDate: '2027-02-07', listedAt: '2026-08-30', votes: 40 },
  { id: 'steelhaven', name: 'STEELHAVEN', game: 'rf', chronicle: '2.2.3', rate: 10, url: 'https://steelhaven.example', openDate: '2026-08-30', listedAt: '2026-08-10', votes: 390 },

  // Silkroad Online
  { id: 'jaderoad', name: 'JADEROAD', game: 'sro', chronicle: 'Cap 110', rate: 30, url: 'https://jaderoad.example', openDate: '2026-03-03', listedAt: '2026-02-12', votes: 610 },
  { id: 'silkwind', name: 'SILKWIND', game: 'sro', chronicle: 'Cap 90', rate: 10, url: 'https://silkwind.example', openDate: '2026-10-25', listedAt: '2026-09-27', votes: 60 },
  { id: 'dunegate', name: 'DUNEGATE', game: 'sro', chronicle: 'Cap 140', rate: 50, url: 'https://dunegate.example', openDate: '2024-02-20', listedAt: '2024-02-01', votes: 820 },

  // Metin2
  { id: 'redshrine', name: 'REDSHRINE', game: 'metin2', chronicle: 'Old School', rate: 1, url: 'https://redshrine.example', openDate: '2025-01-12', listedAt: '2024-12-20', votes: 1720 },
  { id: 'tigerfang', name: 'TIGERFANG', game: 'metin2', chronicle: 'Middle School', rate: 15, url: 'https://tigerfang.example', openDate: '2026-11-14', listedAt: '2026-09-14', votes: 230 },
  { id: 'mistpeak', name: 'MISTPEAK', game: 'metin2', chronicle: 'New School', rate: 100, url: 'https://mistpeak.example', openDate: '2026-09-25', listedAt: '2026-09-24', votes: 340 },

  // Rappelz
  { id: 'runebound', name: 'RUNEBOUND', game: 'rappelz', chronicle: 'Epic 7.4', rate: 20, url: 'https://runebound.example', openDate: '2025-05-30', listedAt: '2025-05-10', votes: 450 },
  { id: 'lumenfall', name: 'LUMENFALL', game: 'rappelz', chronicle: 'Epic 9.5', rate: 50, url: 'https://lumenfall.example', openDate: '2027-03-06', listedAt: '2026-08-25', votes: 30 },

  // Tibia
  { id: 'oldspire', name: 'OLDSPIRE', game: 'tibia', chronicle: '7.4', rate: 3, url: 'https://oldspire.example', openDate: '2022-01-15', listedAt: '2022-01-02', votes: 1380 },
  { id: 'thornwick', name: 'THORNWICK', game: 'tibia', chronicle: '8.60', rate: 5, url: 'https://thornwick.example', openDate: '2026-10-09', listedAt: '2026-09-16', votes: 200 },
  { id: 'brightmoor', name: 'BRIGHTMOOR', game: 'tibia', chronicle: '10.98', rate: 10, url: 'https://brightmoor.example', openDate: '2026-01-20', listedAt: '2026-01-05', votes: 930 }
]
