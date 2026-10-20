import type { Server } from '~/data/servers'

const DAY = 24 * 60 * 60 * 1000
const days = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY

/**
 * How alike two servers of the same game are, from 0 up to about 6, for the
 * recommendations under a server's card. What a player choosing a server
 * weighs, roughly in that order:
 *
 *   chronicle  the same one is worth most: Interlude players want Interlude
 *   rate       x5 and x7 are neighbours, x5 and x500 are different games;
 *              compared on a log scale, so x1000 vs x1200 counts as close too
 *   opening    servers starting around the same time — a fresh start or a
 *              settled one
 *   votes      a similar size of community, again on a log scale
 */
export function serverSimilarity(a: Server, b: Server): number {
  let score = 0
  if (a.chronicle === b.chronicle) score += 2.5

  if (a.rate != null && b.rate != null) {
    // 0 apart → 2, a hundredfold apart → 0
    score += 2 * Math.max(0, 1 - Math.abs(Math.log(a.rate / b.rate)) / Math.log(100))
  } else if (a.rate == null && b.rate == null) {
    score += 1
  }

  // Same day → 1, a year apart → 0
  score += Math.max(0, 1 - Math.abs(days(a.openDate) - days(b.openDate)) / 365)

  // Same → 0.5, tenfold apart → 0
  score += 0.5 * Math.max(0, 1 - Math.abs(Math.log((a.votes + 1) / (b.votes + 1))) / Math.log(10))

  return score
}

/**
 * Which step of the recommendations a server belongs to, relative to the one
 * being viewed: the order a player narrows by.
 *
 *   0  the same chronicle
 *   1  close rates — within three times either way (x500 and x1200, x5 and
 *      x10), or neither server advertising one
 *   2  everything else
 */
export function likenessStep(a: Server, b: Server): 0 | 1 | 2 {
  if (a.chronicle === b.chronicle && a.game === b.game) return 0
  if (a.rate == null && b.rate == null) return 1
  // A hair over log 3: x1 against x3 sits exactly on the line, and floating
  // point put log(1/3) a hair past it.
  if (a.rate != null && b.rate != null && Math.abs(Math.log(a.rate / b.rate)) <= Math.log(3) + 1e-9) return 1
  return 2
}
