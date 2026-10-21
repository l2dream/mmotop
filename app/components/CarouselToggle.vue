<script setup lang="ts">
/**
 * Switches a home panel between its list and a carousel of cards. A toggle
 * button: pressed means the panel is a carousel. Drawn as a disc like the
 * panel's arrow beside it, filled while pressed.
 */
defineProps<{ pressed: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    class="carousel-toggle"
    :class="{ pressed }"
    :aria-pressed="pressed"
    :aria-label="$t('panels.carousel')"
    :title="$t('panels.carousel')"
    @click="$emit('toggle')"
  >
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="6.5" y="5" width="11" height="14" rx="2" />
      <path d="M3 7.5v9" />
      <path d="M21 7.5v9" />
    </svg>
  </button>
</template>
