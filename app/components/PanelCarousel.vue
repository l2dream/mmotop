<script setup lang="ts">
import type { Server } from '~/data/servers'
import type { SectionId } from '~/data/sections'

/**
 * A home panel's servers as a strip of cards, for a panel the visitor has
 * switched to its carousel. It scrolls natively (a swipe on a phone, the
 * arrows or a trackpad on a desktop) and snaps to a card.
 *
 * It also moves on by itself, a card every few seconds, wrapping to the start
 * at the end. It holds still while a mouse is over it or focus is inside it,
 * waits a while after the visitor moves it themselves (a swipe, the arrows,
 * a sideways scroll), never runs while it is off screen or hidden, and not at
 * all for someone who has asked their system for reduced motion.
 *
 * "Moves it themselves" means the strip actually scrolled sideways without
 * this code asking it to. Listening for wheel and touch instead stopped every
 * carousel the page was merely scrolled past: a mouse wheel or a finger moving
 * the page down over a strip counted as handling it, so only the one at the
 * bottom, never crossed on the way, kept turning.
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
/** How long the strip waits after the visitor last moved it. */
const RESUME_MS = 8000
let held = false
let lastUser = 0
let ours = false
let oursTimer: ReturnType<typeof setTimeout> | undefined
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
  // The scroll events this causes are ours, not the visitor's.
  ours = true
  clearTimeout(oursTimer)
  oursTimer = setTimeout(() => { ours = false }, smooth ? 900 : 100)
  if (dir > 0 && pos >= max - 2) t.scrollTo({ left: 0, behavior })
  else if (dir < 0 && pos <= 2) t.scrollTo({ left: rtl ? -max : max, behavior })
  else t.scrollBy({ left: dir * by * (rtl ? -1 : 1), behavior })
}

// A mouse resting on the strip holds it; a touch does not, since on a phone
// the finger lifts and nothing would ever let go.
function hold(on: boolean, event?: PointerEvent) {
  if (event && event.pointerType !== 'mouse') return
  held = on
}

function onScroll() {
  measure()
  if (!ours) lastUser = Date.now()
}

function nav(dir: 1 | -1) {
  lastUser = Date.now()
  step(dir, !reducedMotion())
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function tick() {
  const t = track.value
  if (held || !inView || document.visibilityState !== 'visible') return
  if (Date.now() - lastUser < RESUME_MS) return
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
  clearTimeout(oursTimer)
  observer?.disconnect()
  io?.disconnect()
})
// New rows (a filter, a search) start from the first card again.
watch(() => props.rows.map((r) => r.server.id).join(), async () => {
  await nextTick()
  ours = true
  clearTimeout(oursTimer)
  oursTimer = setTimeout(() => { ours = false }, 100)
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
    @pointerenter="hold(true, $event)"
    @pointerleave="hold(false, $event)"
    @focusin="hold(true)"
    @focusout="hold(false)"
  >
    <button type="button" class="carousel-nav is-prev" :aria-label="$t('panels.prev')" tabindex="-1" @click="nav(-1)">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
    <ul ref="track" class="carousel-track" @scroll.passive="onScroll">
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
