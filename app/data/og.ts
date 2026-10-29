import type { Server } from './servers'
import { landingAt, indexable } from './landing'
import { SERVERS } from './servers'

/**
 * Where a page's own link picture is, drawn at build time by modules/og.ts,
 * relative to the site's root — or undefined for a page that shows the
 * site's general og-image.jpg. The two must agree on which pages have one.
 */
export function ogImagePath(page: { server?: Server | null, game?: string, landing?: string }) {
  if (page.server) return `og/${page.server.game}/${page.server.id}.png`
  if (!page.game || !SERVERS.some((s) => s.game === page.game)) return undefined
  if (!page.landing) return `og/${page.game}.png`
  const l = landingAt(page.game, page.landing)
  return l && indexable(l) ? `og/${l.game}/${l.slug}.png` : undefined
}
