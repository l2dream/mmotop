<script setup lang="ts">
/**
 * Back to the top, for the long pages: a section page grows 25 rows at a
 * time, and on a phone the five home panels are one long column. It shows
 * once the page is scrolled a little way down, and takes the visitor
 * to the top smoothly unless they have asked for reduced motion. From the
 * keyboard, focus goes to the logo so the next Tab starts at the top too.
 */
const shown = ref(false)

/** How far down the page must be before the button appears. */
const SHOW_AFTER = 400

function onScroll() {
  shown.value = window.scrollY > SHOW_AFTER
}

function toTop(event: MouseEvent) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  if (event.detail === 0) document.querySelector<HTMLElement>('.brand')?.focus({ preventScroll: true })
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <button
    type="button"
    class="scroll-top"
    :class="{ shown }"
    :aria-label="$t('nav.toTop')"
    :title="$t('nav.toTop')"
    :tabindex="shown ? 0 : -1"
    :aria-hidden="!shown"
    @click="toTop"
  >
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 15l7-7 7 7" />
    </svg>
  </button>
</template>
