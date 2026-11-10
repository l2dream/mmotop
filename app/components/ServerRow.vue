<script setup lang="ts">
import { chronicleShort } from '~/data/games'
import type { Server } from '~/data/servers'
import type { SectionId } from '~/data/sections'

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

const { serverSubtitle, rateLabel, formatDayMonth, formatYear } = useServerFormat()
const { to, remember } = useServerLink(() => props.server, () => props.origin)

const rowClass = computed(() => ({
  'no-rank': props.end !== 'votes',
  compact: props.end === 'date',
  'chronicle-last': props.end === 'chronicle'
}))
</script>

<template>
  <NuxtLink class="game-row" :class="rowClass" :to="to" @click="remember">
    <span v-if="end === 'votes'" class="rank" :class="rank && rank <= 3 ? `rank-${rank}` : rank && rank >= 100 ? 'rank-long' : undefined">{{ rank }}</span>
    <ServerLogo :server="server" />
    <span class="game-name">
      <strong><HitText :text="server.name" /></strong>
      <small><HitText :text="serverSubtitle(server)" /></small>
    </span>
    <span class="version">
      <span class="version-name" :title="server.chronicle"><HitText :text="chronicleShort(server.game, server.chronicle)" /></span>
      <small class="version-rate"><HitText :text="rateLabel(server)" /></small>
    </span>
    <span v-if="end === 'votes'" class="rating">
      <span class="rating-value">
        <svg class="vote-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
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
