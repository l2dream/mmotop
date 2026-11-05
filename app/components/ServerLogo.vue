<script setup lang="ts">
import type { Server } from '~/data/servers'

/**
 * The square beside a server's name: its own logo when the owner uploaded
 * one, otherwise the version's letters ("IL").
 */
const props = defineProps<{ server: Server }>()
const { serverBadge } = useServerFormat()
</script>

<template>
  <span class="game-logo" :class="{ 'has-logo': !!props.server.logo }">
    <img v-if="props.server.logo" :src="props.server.logo" alt="" loading="lazy" decoding="async">
    <template v-else>{{ serverBadge(props.server) }}</template>
  </span>
</template>
