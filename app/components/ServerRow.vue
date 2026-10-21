<script setup lang="ts">
import { chronicleShort } from '~/data/games'
import type { Server } from '~/data/servers'
import type { SectionId } from '~/data/sections'
import { gameById } from '~/data/games'

/**
 * One server, as it appears in every list on the site.
 *
 * What closes the row depends on the list: TOP GAMES ends with the votes and
 * leads with the place, the date lists end with the opening date, and ALL
 * GAMES ends with the chronicle. The grid for each is in main.css under
 * .game-row.
 *
 * The whole row is a link to the server's page on MMOTOP, which carries the
 * details and the way out to the server's own site.
 */
const props = defineProps<{
  server: Server
  end: 'votes' | 'date' | 'chronicle'
  rank?: number
  /** The list this row sits in. Opening the server records it, so the
   *  server's page can show more from the same list; null records that the
   *  row came from no list in particular. */
  origin?: SectionId | null
}>()

const { serverBadge, serverSubtitle, rateLabel, formatDayMonth, formatYear } = useServerFormat()
const localePath = useLocalePath()
// The filters and search travel with the link, as they do to a section page,
// so the server's page — and a reload of it — keeps them. On a game's own
// page (/lineage2/) the game is in the path rather than the query, so it is
// added here.
const route = useRoute()
const linkQuery = computed(() => {
  const game = route.params.section
  // A server's page sits under its game too (/lineage2/la2dream/); there the
  // segment names where the server lives, not a game the visitor chose.
  const onGamePage = typeof game === 'string' && !!gameById(game) && !route.params.id
  return onGamePage ? { ...route.query, game } : route.query
})
const serverOrigin = useState<SectionId | null>('dash-origin', () => null)
function remember() {
  if (props.origin !== undefined) serverOrigin.value = props.origin
}

const rowClass = computed(() => ({
  'no-rank': props.end !== 'votes',
  compact: props.end === 'date',
  'chronicle-last': props.end === 'chronicle'
}))
</script>

<template>
  <NuxtLink class="game-row" :class="rowClass" :to="{ path: localePath(`/${server.game}/${server.id}`), query: linkQuery }" @click="remember">
    <span v-if="end === 'votes'" class="rank" :class="rank && rank <= 3 ? `rank-${rank}` : undefined">{{ rank }}</span>
    <span class="game-logo">{{ serverBadge(server) }}</span>
    <span class="game-name">
      <strong>{{ server.name }}</strong>
      <small>{{ serverSubtitle(server) }}</small>
    </span>
    <span class="version">
      <span class="version-name" :title="server.chronicle">{{ chronicleShort(server.game, server.chronicle) }}</span>
      <small class="version-rate">{{ rateLabel(server) }}</small>
    </span>
    <span v-if="end === 'votes'" class="rating">
      <span class="rating-value">
        <svg class="vote-icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
          <path
            d="M12 4 L20 12 H15.5 V19 H8.5 V12 H4 Z"
            fill="url(#voteGrad)"
          />
        </svg>
        {{ server.votes }}
      </span>
    </span>
    <span v-else-if="end === 'date'" class="date">
      <span class="date-day">{{ formatDayMonth(server.openDate) }}</span>
      <small v-if="formatYear(server.openDate)" class="date-year">{{ formatYear(server.openDate) }}</small>
    </span>
  </NuxtLink>
</template>
