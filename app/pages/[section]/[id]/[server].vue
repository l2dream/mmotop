<script setup lang="ts">
import { OLD_PATHS, SERVERS, serverPath } from '~/data/servers'

/**
 * /<game>/<version>/<server> — one server's page: /lineage2/interlude/la2dream/.
 * An address the server had before its owner changed its version, game or
 * address sends the visitor on to the current one.
 */
const pathOf = (p: Record<string, unknown>) => `${p.section}/${p.id}/${p.server}`
definePageMeta({
  validate: (route) => {
    const path = `${route.params.section}/${route.params.id}/${route.params.server}`
    return SERVERS.some((s) => serverPath(s) === `/${path}`) || OLD_PATHS.has(path)
  }
})

const route = useRoute()
const server = SERVERS.find((s) => serverPath(s) === `/${pathOf(route.params)}`)
if (!server) await useServerRedirect(OLD_PATHS.get(pathOf(route.params))!)
</script>

<template>
  <Dashboard v-if="server" :server-id="server.id" />
  <div v-else />
</template>
