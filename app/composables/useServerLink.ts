import type { Server } from '~/data/servers'
import type { SectionId } from '~/data/sections'
import { gameById } from '~/data/games'
import { landingAt } from '~/data/landing'

/**
 * Where a server's row or tile leads, shared by the two.
 *
 * The filters and search travel with the link, as they do to a section page,
 * so the server's page — and a reload of it — keeps them. On a game's own
 * page (/lineage2/) the game is in the path rather than the query, so it is
 * added here.
 *
 * `origin` is the list the link sits in. Opening the server records it, so
 * the server's page can show more from the same list; null records that it
 * came from no list in particular, and undefined records nothing.
 */
export function useServerLink(server: () => Server, origin: () => SectionId | null | undefined) {
  const localePath = useLocalePath()
  const route = useRoute()

  const query = computed(() => {
    const game = route.params.section
    // A chronicle's or a rate's page (/lineage2/interlude/) carries that
    // filter in the path as well.
    const landing = landingAt(game, route.params.id)
    if (landing) {
      return landing.chronicle
        ? { ...route.query, game: landing.game, version: landing.chronicle }
        : { ...route.query, game: landing.game, min: String(landing.rate), max: String(landing.rate) }
    }
    // A server's page sits under its game too (/lineage2/la2dream/); there
    // the segment names where the server lives, not a game the visitor chose.
    const onGamePage = typeof game === 'string' && !!gameById(game) && !route.params.id
    return onGamePage ? { ...route.query, game } : route.query
  })

  const to = computed(() => ({ path: localePath(`/${server().game}/${server().id}`), query: query.value }))

  const serverOrigin = useState<SectionId | null>('dash-origin', () => null)
  function remember() {
    const o = origin()
    if (o !== undefined) serverOrigin.value = o
  }

  return { to, remember }
}
