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

const { serverBadge, serverSubtitle, rateLabel, formatDayMonth, formatYear } = useServerFormat()
const { to, remember } = useServerLink(() => props.server, () => props.origin)
</script>

<template>
  <NuxtLink class="server-tile" :to="to" @click="remember">
    <span class="server-tile-top">
      <span class="game-logo">{{ serverBadge(server) }}</span>
      <span v-if="end === 'votes'" class="rank" :class="rank && rank <= 3 ? `rank-${rank}` : undefined">{{ rank }}</span>
      <span v-else-if="end === 'date'" class="server-tile-date">
        {{ formatDayMonth(server.openDate) }}<template v-if="formatYear(server.openDate)"> {{ formatYear(server.openDate) }}</template>
      </span>
    </span>
    <strong class="server-tile-name"><HitText :text="server.name" /></strong>
    <small class="server-tile-game"><HitText :text="serverSubtitle(server)" /></small>
    <span class="server-tile-foot">
      <span class="server-tile-version" :title="server.chronicle">
        <HitText :text="chronicleShort(server.game, server.chronicle)" /><template v-if="rateLabel(server)"> · <HitText :text="rateLabel(server)" /></template>
      </span>
      <span v-if="end === 'votes'" class="server-tile-votes">
        <svg class="vote-icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
          <path d="M12 4 L20 12 H15.5 V19 H8.5 V12 H4 Z" fill="url(#voteGrad)" />
        </svg>
        {{ server.votes }}
      </span>
    </span>
  </NuxtLink>
</template>
