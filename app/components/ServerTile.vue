<script setup lang="ts">
import { chronicleShort } from '~/data/games'
import type { Server } from '~/data/servers'
import type { SectionId } from '~/data/sections'

/**
 * One server as a card, for a panel shown as a carousel. The same facts as
 * its row in the list — badge, name, game, chronicle and rate — with what
 * ends the row (place and votes, or the opening date) moved to the card's
 * corners. A link to the server's page, like the row.
 */
const props = defineProps<{
  server: Server
  end: 'votes' | 'date' | 'chronicle'
  rank?: number
  origin?: SectionId | null
}>()

const { serverSubtitle, rateLabel, formatDayMonth, formatYear } = useServerFormat()
const { to, remember } = useServerLink(() => props.server, () => props.origin)
</script>

<template>
  <NuxtLink class="server-tile" :to="to" @click="remember">
    <span class="server-tile-top">
      <ServerLogo :server="server" />
      <span v-if="end === 'votes'" class="rank" :class="rank && rank <= 3 ? `rank-${rank}` : rank && rank >= 100 ? 'rank-long' : undefined">{{ rank }}</span>
      <span v-else-if="end === 'date'" class="server-tile-date">
        {{ formatDayMonth(server.openDate) }}<template v-if="formatYear(server.openDate)">&nbsp;{{ formatYear(server.openDate) }}</template>
      </span>
    </span>
    <strong class="server-tile-name"><HitText :text="server.name" /></strong>
    <small class="server-tile-game"><HitText :text="serverSubtitle(server)" /></small>
    <span class="server-tile-foot">
      <span class="server-tile-version" :title="server.chronicle">
        <HitText :text="chronicleShort(server.game, server.chronicle)" /><template v-if="rateLabel(server)"> · <HitText :text="rateLabel(server)" /></template>
      </span>
      <span v-if="end === 'votes'" class="server-tile-votes">
        <svg class="vote-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
        {{ server.votes }}
      </span>
    </span>
  </NuxtLink>
</template>
