<script setup lang="ts">
import { SERVERS } from '~/data/servers'

/** /server/<id> — one server's page. An unknown id is the not-found page. */
definePageMeta({
  validate: (route) => SERVERS.some((s) => s.id === route.params.id)
})

const route = useRoute()
</script>

<template>
  <Dashboard :server-id="String(route.params.id)" />
</template>
