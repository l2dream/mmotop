<script setup lang="ts">
import { SERVERS } from '~/data/servers'

/**
 * /server/<id> — where server pages lived before they moved under their
 * game. Kept so links already shared or indexed still land: it sends the
 * visitor on to /<game>/<id>/ with the query, and the prerendered file is a
 * redirect page for anything that reads the HTML without running it.
 */
definePageMeta({
  validate: (route) => SERVERS.some((s) => s.id === route.params.id)
})

const route = useRoute()
const localePath = useLocalePath()
const server = SERVERS.find((s) => s.id === route.params.id)!
// A string rather than a route object: the object form dropped the
// trailing slash the pages are served at.
const search = new URLSearchParams(route.query as Record<string, string>).toString()
await navigateTo(`${localePath(`/${server.game}/${server.id}`)}/${search ? `?${search}` : ''}`, { redirectCode: 301, replace: true })
</script>

<template>
  <div />
</template>
