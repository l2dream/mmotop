<script setup lang="ts">
/**
 * Draws a random list again: ALL GAMES, on the home panel and its own page,
 * and the more-servers panel on a server's page. `turns` counts deliberate
 * shuffles, so the half-turn answers a click and not every page load and
 * every language change. The glyph makes a full turn inside its ring.
 */
defineProps<{ turns: number }>()
const emit = defineEmits<{ shuffle: [] }>()

/**
 * The rows glide to their new places rather than the list redrawing at
 * once: their positions are noted before the shuffle and, once the new
 * order is drawn, each row starts where it was and slides home (FLIP).
 * Rows are told apart by their link, so it works whatever the list keys
 * by; a row that was not there before fades in. Skipped for anyone who
 * asked for less motion.
 */
const button = ref<HTMLElement | null>(null)
const ROWS = '.game-row, .server-tile'
async function shuffle() {
  const panel = button.value?.closest('.panel')
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const before = new Map<string, DOMRect>()
  if (panel && !still) {
    for (const row of panel.querySelectorAll<HTMLElement>(ROWS)) {
      const key = row.getAttribute('href')
      if (key) before.set(key, row.getBoundingClientRect())
    }
  }
  emit('shuffle')
  if (!panel || still) return
  await nextTick()
  for (const row of panel.querySelectorAll<HTMLElement>(ROWS)) {
    const key = row.getAttribute('href')
    const was = key ? before.get(key) : undefined
    const now = row.getBoundingClientRect()
    if (was) {
      const dx = was.left - now.left
      const dy = was.top - now.top
      if (dx || dy) row.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2, .7, .2, 1)' })
    } else {
      row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' })
    }
  }
}
</script>

<template>
  <button
    class="shuffle-button"
    type="button"
    :aria-label="$t('panels.shuffle')"
    ref="button"
    @click="shuffle"
  >
    <!-- The glyph turns, not the button: the ring's glint stays at the upper left. -->
    <svg class="shuffle-icon" :style="{ transform: `rotate(${turns * 360}deg)` }" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M3 4l5 5" />
    </svg>
  </button>
</template>
