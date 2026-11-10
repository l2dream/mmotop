<script setup lang="ts">
import type { Server } from '~/data/servers'
import { versionHue } from '~/data/games'

/**
 * The square beside a server's name: its own logo when the owner uploaded
 * one, otherwise the version's letters ("IL") in the version's colour.
 */
const props = defineProps<{ server: Server }>()
const { serverBadge } = useServerFormat()
/** The version's own colour, for the badge's ring, letters and tint. */
const hue = computed(() => versionHue(props.server.game, props.server.chronicle))
</script>

<template>
  <span class="game-logo" :class="{ 'has-logo': !!props.server.logo }" :style="{ '--vh': hue }">
    <img v-if="props.server.logo" :src="props.server.logo" alt="" loading="lazy" decoding="async">
    <template v-else>{{ serverBadge(props.server) }}</template>
  </span>
</template>
