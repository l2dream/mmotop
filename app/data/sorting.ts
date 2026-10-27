import type { Server } from '~/data/servers'
import type { SectionId } from '~/data/sections'

/**
 * The orders a section page can show its list in. The first of each list is
 * the list's own order, the one the home panel shows; the others re-sort the
 * same servers. Pressing the order already chosen turns it around.
 *
 * In the address as ?sort=, the key alone for its usual direction and with a
 * leading "-" turned around (?sort=-rate). The list's own order in its usual
 * direction is the bare page, so plain links stay clean.
 */
export const SORT_KEYS = ['votes', 'date', 'added', 'rate', 'random'] as const
export type SortKey = (typeof SORT_KEYS)[number]

export const SECTION_SORTS: Record<SectionId, SortKey[]> = {
  top: ['votes', 'date', 'rate'],
  soon: ['date', 'votes', 'rate'],
  started: ['date', 'votes', 'rate'],
  new: ['added', 'date', 'votes', 'rate'],
  all: ['random', 'votes', 'date', 'rate']
}

export interface SortChoice { key: SortKey, reversed: boolean }

export function parseSort(section: SectionId, value: string): SortChoice {
  const reversed = value.startsWith('-')
  const key = (reversed ? value.slice(1) : value) as SortKey
  if (!SECTION_SORTS[section].includes(key) || key === 'random') return { key: SECTION_SORTS[section][0]!, reversed: false }
  return { key, reversed }
}

export function sortParam(section: SectionId, choice: SortChoice): string | undefined {
  if (choice.key === SECTION_SORTS[section][0] && !choice.reversed) return undefined
  return `${choice.reversed ? '-' : ''}${choice.key}`
}

/**
 * Whether a key's usual direction runs from small to large. Most votes, the
 * latest date and the latest listing come first; the lowest rate does, since
 * low rates are what most players look for; COMING SOON goes by the nearest
 * opening, as the list itself does.
 */
function ascending(section: SectionId, key: SortKey) {
  return key === 'rate' || (key === 'date' && section === 'soon')
}

/** Whether the chosen order runs from small to large, for its arrow. */
export function runsUp(section: SectionId, choice: SortChoice) {
  return ascending(section, choice.key) !== choice.reversed
}

/** The servers in the chosen order. Ties keep the list's own order, and
 *  servers without a rate go last whichever way the rates run. */
export function sortServers(list: Server[], section: SectionId, choice: SortChoice): Server[] {
  if (choice.key === 'random') return list
  const dir = runsUp(section, choice) ? 1 : -1
  const by: Record<Exclude<SortKey, 'random'>, (a: Server, b: Server) => number> = {
    votes: (a, b) => (a.votes - b.votes) * dir,
    date: (a, b) => a.openDate.localeCompare(b.openDate) * dir,
    added: (a, b) => a.listedAt.localeCompare(b.listedAt) * dir,
    rate: (a, b) => {
      if (a.rate == null || b.rate == null) return (a.rate == null ? 1 : 0) - (b.rate == null ? 1 : 0)
      return (a.rate - b.rate) * dir
    }
  }
  return [...list].sort(by[choice.key])
}
