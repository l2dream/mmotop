<script setup lang="ts">
import type { Server } from '~/data/servers'
import type { SectionId } from '~/data/sections'

/**
 * A home panel's servers as a strip of cards, for a panel the visitor has
 * switched to its carousel. It scrolls natively (a swipe on a phone, the
 * arrows or a trackpad on a desktop) and snaps to a card.
 *
 * It also moves on by itself, a card every few seconds, wrapping to the start
 * at the end. It holds still while the pointer is over it or focus is inside
 * it, stops for good once the visitor scrolls it themselves, never runs while
 * it is off screen or hidden, and not at all for someone who has asked their
 * system for reduced motion.
 *
 * Both the list and this strip are in the page; which one shows is decided by
 * a class on <html> (see useCarouselPanels), so a reload in carousel mode
 * draws the carousel from the first paint instead of swapping after it.
 */
const props = defineProps<{
  rows: { server: Server, rank?: number }[]
  end: 'votes' | 'date' | 'chronicle'
  origin: SectionId
  title: string
}>()

const track = ref<HTMLElement | null>(null)
const root = ref<HTMLElement | null>(null)
const overflows = ref(false)
// Which ends have more beyond them; each arrow shows only where it leads
// somewhere, so neither sits over a card at the start or the end.
const atStart = ref(true)
const atEnd = ref(false)

const AUTO_MS = 4500
let held = false
let stopped = false
let timer: ReturnType<typeof setInterval> | undefined
let observer: ResizeObserver | undefined
let inView = false
let io: IntersectionObserver | undefined

function measure() {
  const t = track.value
  overflows.value = !!t && t.scrollWidth > t.clientWidth + 2
  if (!t) return
  const pos = Math.abs(t.scrollLeft)
  atStart.value = pos <= 2
  atEnd.value = pos >= t.scrollWidth - t.clientWidth - 2
}

function step(dir: 1 | -1, smooth = true) {
  const t = track.value
  if (!t) return
  const card = t.querySelector('li')
  if (!card) return
  const gap = parseFloat(getComputedStyle(t).columnGap) || 0
  const by = card.getBoundingClientRect().width + gap
  const rtl = getComputedStyle(t).direction === 'rtl'
  const max = t.scrollWidth - t.clientWidth
  const pos = Math.abs(t.scrollLeft)
  const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto'
  if (dir > 0 && pos >= max - 2) t.scrollTo({ left: 0, behavior })
  else if (dir < 0 && pos <= 2) t.scrollTo({ left: rtl ? -max : max, behavior })
  else t.scrollBy({ left: dir * by * (rtl ? -1 : 1), behavior })
}

function hold(on: boolean) { held = on }
function stop() { stopped = true }

function nav(dir: 1 | -1) {
  stopped = true
  step(dir, !reducedMotion())
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function tick() {
  const t = track.value
  if (stopped || held || !inView || document.visibilityState !== 'visible') return
  // display: none while the panel shows its list instead.
  if (!t || !t.offsetParent || !overflows.value) return
  step(1)
}

onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  if (track.value) observer.observe(track.value)
  io = new IntersectionObserver(([e]) => { inView = !!e?.isIntersecting })
  if (root.value) io.observe(root.value)
  if (!reducedMotion()) timer = setInterval(tick, AUTO_MS)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  observer?.disconnect()
  io?.disconnect()
})
// New rows (a filter, a search) start from the first card again.
watch(() => props.rows.map((r) => r.server.id).join(), async () => {
  await nextTick()
  track.value?.scrollTo({ left: 0 })
  measure()
})
</script>

<template>
  <div
    ref="root"
    class="panel-carousel"
    :class="{ overflows, 'at-start': atStart, 'at-end': atEnd }"
    role="region"
    aria-roledescription="carousel"
    :aria-label="title"
    @pointerenter="hold(true)"
    @pointerleave="hold(false)"
    @focusin="hold(true)"
    @focusout="hold(false)"
  >
    <button type="button" class="carousel-nav is-prev" :aria-label="$t('panels.prev')" tabindex="-1" @click="nav(-1)">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
    <ul ref="track" class="carousel-track" @scroll.passive="measure" @wheel.passive="stop" @touchstart.passive="stop" @keydown="stop">
      <li v-for="row in rows" :key="row.server.id">
        <ServerTile :server="row.server" :rank="row.rank" :end="end" :origin="origin" />
      </li>
    </ul>
    <button type="button" class="carousel-nav is-next" :aria-label="$t('panels.next')" tabindex="-1" @click="nav(1)">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </div>
</template>
