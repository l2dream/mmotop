<script setup lang="ts">
import { SERVERS } from '~/data/servers'

/**
 * /server/<id> — where server pages lived before they moved under their
 * game. Kept so links already shared or indexed still land on the server's
 * page now, /<game>/<version>/<id>/.
 */
definePageMeta({
  validate: (route) => SERVERS.some((s) => s.id === route.params.id)
})

const route = useRoute()
await useServerRedirect(SERVERS.find((s) => s.id === route.params.id)!)
</script>

<template>
  <div />
</template>
