<script setup lang="ts">
import { OLD_PATHS } from '~/data/servers'
import { landingAt } from '~/data/landing'

/**
 * /<game>/<segment> — one of the game's chronicles or rates:
 * /lineage2/interlude/, /lineage2/x50/ (see data/landing.ts). Or the address
 * a server had before its version moved into it, /lineage2/la2dream/, which
 * sends the visitor on to /lineage2/interlude/la2dream/. Any other pair is
 * the not-found page.
 */
definePageMeta({
  validate: (route) => !!landingAt(route.params.section, route.params.id)
    || OLD_PATHS.has(`${route.params.section}/${route.params.id}`)
})

const route = useRoute()
const landing = computed(() => landingAt(route.params.section, route.params.id))
if (!landing.value) await useServerRedirect(OLD_PATHS.get(`${route.params.section}/${route.params.id}`)!)
</script>

<template>
  <Dashboard
    v-if="landing"
    :game="landing.game"
    :chronicle="landing.chronicle"
    :rate="landing.rate"
  />
  <div v-else />
</template>
