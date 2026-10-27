import type { Server } from '~/data/servers'
import type { SectionId } from '~/data/sections'

/**
 * The rules that order RECOMMENDED, the panel under a server's card, one
 * ladder per list the visitor came through. Each rule decides only among the
 * servers the rules before it left level; whatever is still level at the end
 * is decided by chance. Kept here as plain data so the owner can reorder,
 * add or drop rules per list — by hand now, from the admin later.
 *
 *   filters    passes the filters and search set in the header
 *   origin     is in the list the visitor came through (TOP, NEW and ALL
 *              GAMES hold every server, so there it narrows nothing)
 *   game       the same game
 *   date       the date that list goes by, earliest or latest first as the
 *              list itself orders (see REC_DATES); servers on the same day
 *              stay level. Only lists with a date can use it
 *   chronicle  the same game and chronicle
 *   rates      close rates: within three times either way, or both without one
 */
export const REC_RULE_IDS = ['filters', 'origin', 'game', 'date', 'chronicle', 'rates'] as const
export type RecRule = (typeof REC_RULE_IDS)[number]

/** `none` is a server page opened directly, through no list. */
export type RecSource = SectionId | 'none'

export const REC_RULES: Record<RecSource, RecRule[]> = {
  top: ['filters', 'origin', 'game', 'chronicle', 'rates'],
  soon: ['filters', 'origin', 'game', 'date', 'chronicle', 'rates'],
  started: ['filters', 'origin', 'game', 'date', 'chronicle', 'rates'],
  new: ['filters', 'origin', 'game', 'date', 'chronicle', 'rates'],
  all: ['filters', 'origin', 'game', 'chronicle', 'rates'],
  none: ['filters', 'game', 'chronicle', 'rates']
}

/**
 * The date each dated list goes by, as a number that is larger for the
 * servers the list puts first: COMING SOON the nearest opening, ALREADY
 * STARTED the latest opening, NEW the latest listing. Whole days, so servers
 * on the same day tie and the next rule decides between them.
 */
const day = (date: string) => Math.floor(Date.parse(date) / 86_400_000)
export const REC_DATES: Partial<Record<SectionId, (s: Server) => number>> = {
  soon: (s) => -day(s.openDate),
  started: (s) => day(s.openDate),
  new: (s) => day(s.listedAt)
}
