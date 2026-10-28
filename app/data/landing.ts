import { GAMES } from './games'
import { SERVERS } from './servers'

/**
 * Pages for what players search for: a game's chronicle (/lineage2/interlude/)
 * and a game's rate (/lineage2/x50/). Each is the game's home page with that
 * filter already set, rendered ahead of time, so a search engine has an
 * address to rank for "Lineage 2 Interlude servers" — the filters alone live
 * in the query and in the page's script, where it does not look.
 *
 * Only combinations some server has get a page, so none of them is empty.
 * They share /<game>/<segment>/ with the server pages, which is why a server's
 * id may not be one of its game's slugs; the build stops if one is (see
 * landingCollisions).
 */

/** "WotLK 3.3.5a" → "wotlk-3-3-5a". Hyphens only, no dots, so every host
 *  treats the segment as a directory. */
export function chronicleSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** 50 → "x50", 1.5 → "x1-5". */
export function rateSlug(rate: number) {
  return `x${String(rate).replace('.', '-')}`
}

export type Landing =
  | { game: string, slug: string, chronicle: string, rate?: undefined }
  | { game: string, slug: string, rate: number, chronicle?: undefined }

export const LANDINGS: Landing[] = GAMES.flatMap((g) => {
  const servers = SERVERS.filter((s) => s.game === g.id)
  const chronicles = g.chronicles
    .filter((c) => servers.some((s) => s.chronicle === c.name))
    .map((c): Landing => ({ game: g.id, slug: chronicleSlug(c.name), chronicle: c.name }))
  const rates = [...new Set(servers.flatMap((s) => (s.rate == null ? [] : [s.rate])))]
    .sort((a, b) => a - b)
    .map((rate): Landing => ({ game: g.id, slug: rateSlug(rate), rate }))
  return [...chronicles, ...rates]
})

/** How many servers a chronicle's or a rate's page lists. */
export function landingCount(l: Landing) {
  return SERVERS.filter((s) => s.game === l.game && (l.chronicle ? s.chronicle === l.chronicle : s.rate === l.rate)).length
}

/**
 * A page for one server only repeats that server's own page — the same row
 * in four panels and "no matching games" in the fifth — and search engines
 * filed such pages as soft 404s or left them unindexed. So a chronicle's or
 * a rate's page is offered to them (indexed, in the sitemap, in the footer)
 * only from this many servers up. It stays on the site, and linked from its
 * servers, for visitors; it is offered by itself once it has the servers.
 */
export const LANDING_MIN_SERVERS = 2
export const indexable = (l: Landing) => landingCount(l) >= LANDING_MIN_SERVERS

const BY_PATH = new Map(LANDINGS.map((l) => [`${l.game}/${l.slug}`, l]))

/** The landing page at /<game>/<slug>/, if there is one. */
export function landingAt(game: unknown, slug: unknown): Landing | undefined {
  return typeof game === 'string' && typeof slug === 'string' ? BY_PATH.get(`${game}/${slug}`) : undefined
}

export function chronicleLanding(game: string, chronicle: string) {
  return landingAt(game, chronicleSlug(chronicle))
}

export function rateLanding(game: string, rate: number) {
  return landingAt(game, rateSlug(rate))
}

/** Servers whose address would be taken by a landing page. */
export function landingCollisions() {
  return SERVERS.filter((s) => BY_PATH.has(`${s.game}/${s.id}`)).map((s) => `${s.game}/${s.id}`)
}
