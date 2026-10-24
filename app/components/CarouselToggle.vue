<script setup lang="ts">
/**
 * Switches a home panel between its list and a carousel of cards: a switch,
 * as in a phone's settings — the knob to the start for the list, to the end
 * for the carousel, the track filling with the panel's accent when on. The
 * knob carries the carousel's icon so the switch says what it turns on.
 */
defineProps<{ pressed: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    class="carousel-toggle"
    :class="{ pressed }"
    :aria-checked="pressed"
    :aria-label="$t('panels.carousel')"
    :title="$t('panels.carousel')"
    @click="$emit('toggle')"
  >
    <span class="carousel-toggle-knob">
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="6.5" y="5" width="11" height="14" rx="2" />
        <path d="M3 7.5v9" />
        <path d="M21 7.5v9" />
      </svg>
    </span>
  </button>
</template>
