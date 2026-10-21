<script setup lang="ts">
import { SERVERS } from '~/data/servers'

/**
 * /<game>/<id> — one server's page, under its game: /lineage2/la2dream/. Any
 * other pair, including a real server under the wrong game, is the
 * not-found page.
 */
definePageMeta({
  validate: (route) => SERVERS.some((s) => s.id === route.params.id && s.game === route.params.section)
})

const route = useRoute()
</script>

<template>
  <Dashboard :server-id="String(route.params.id)" />
</template>
