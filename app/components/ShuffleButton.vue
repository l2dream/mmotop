<script setup lang="ts">
/**
 * Draws ALL GAMES again, on the home panel and on its own page. `turns`
 * counts deliberate shuffles, so the half-turn answers a click and not every
 * page load and every language change.
 */
defineProps<{ turns: number }>()
defineEmits<{ shuffle: [] }>()
</script>

<template>
  <button
    class="shuffle-button"
    type="button"
    :aria-label="$t('panels.shuffle')"
    :style="{ transform: `rotate(${turns * 180}deg)` }"
    @click="$emit('shuffle')"
  >
    <svg class="shuffle-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M3 4l5 5" />
    </svg>
  </button>
</template>
