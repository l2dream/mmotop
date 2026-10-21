<script setup lang="ts">
import { SERVERS } from '~/data/servers'
import { landingAt } from '~/data/landing'

/**
 * /<game>/<segment> — one server's page, under its game: /lineage2/la2dream/;
 * or one of the game's chronicles or rates: /lineage2/interlude/,
 * /lineage2/x50/ (see data/landing.ts). Any other pair, including a real
 * server under the wrong game, is the not-found page.
 */
definePageMeta({
  validate: (route) => !!landingAt(route.params.section, route.params.id)
    || SERVERS.some((s) => s.id === route.params.id && s.game === route.params.section)
})

const route = useRoute()
const landing = computed(() => landingAt(route.params.section, route.params.id))
</script>

<template>
  <Dashboard
    v-if="landing"
    :game="landing.game"
    :chronicle="landing.chronicle"
    :rate="landing.rate"
  />
  <Dashboard v-else :server-id="String(route.params.id)" />
</template>
