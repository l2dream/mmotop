<script setup lang="ts">
/**
 * A choice of one from a list, in the site's own look rather than the
 * phone's: Android drew its grey system list over the violet glass.
 *
 * The field looks like the selects it replaces. Pressed, it opens a list
 * with a search line on top: on a phone a sheet from the bottom of the
 * screen, on a computer a panel under the field. The chosen line is violet
 * with a tick, like the chosen game in the More menu.
 *
 * On a phone the sheet closes as apps' do: swiped down, by the phone's Back
 * button (which would otherwise leave the page), or by its ×.
 *
 * Searching ignores case and accents ("cestina" finds "Čeština"), and a
 * group's name finds all of its lines ("lineage" lists every chronicle).
 */
export interface PickOption { value: string, label: string, lang?: string }
export interface PickGroup { label: string, options: PickOption[] }

const props = defineProps<{
  id: string
  modelValue: string
  /** The sheet's heading, and the list's name for screen readers. */
  title: string
  /** The lines before any group, such as "All languages". */
  options?: PickOption[]
  groups?: PickGroup[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useI18n()
const open = ref(false)
const query = ref('')
const active = ref(-1)
const fieldEl = ref<HTMLButtonElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const sheet = ref(false)
const pos = ref({ top: 0, left: 0, width: 0, maxHeight: 360 })

const allOptions = computed(() => [...(props.options ?? []), ...(props.groups ?? []).flatMap((g) => g.options)])
const current = computed(() => allOptions.value.find((o) => o.value === props.modelValue) ?? allOptions.value[0])

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** What the search leaves, in sections: the loose lines, then each group. */
const sections = computed(() => {
  const q = fold(query.value.trim())
  const hit = (o: PickOption) => !q || fold(o.label).includes(q)
  const out: { label?: string, options: PickOption[] }[] = []
  const loose = (props.options ?? []).filter(hit)
  if (loose.length) out.push({ options: loose })
  for (const g of props.groups ?? []) {
    const options = q && fold(g.label).includes(q) ? g.options : g.options.filter(hit)
    if (options.length) out.push({ label: g.label, options })
  }
  return out
})
const flat = computed(() => sections.value.flatMap((s) => s.options))
watch(query, () => { active.value = flat.value.length ? 0 : -1 })

const optionId = (i: number) => `${props.id}-opt-${i}`
const indexOf = (o: PickOption) => flat.value.indexOf(o)

function place() {
  const r = fieldEl.value?.getBoundingClientRect()
  if (!r) return
  sheet.value = window.innerWidth <= 700
  if (sheet.value) return
  const room = window.innerHeight - r.bottom - 16
  pos.value = { top: r.bottom + 6, left: r.left, width: Math.max(r.width, 240), maxHeight: Math.max(220, Math.min(380, room)) }
}

/**
 * The phone's Back button. Opening the sheet adds a step to the history —
 * a copy of the router's own, so the router sees the same page when it is
 * taken back — and Back closes the sheet instead of leaving. Closed any
 * other way, the step is taken back first; a choice is only made once that
 * is done, or the step back would undo the address the choice writes.
 */
let historyStep = false
let pending: PickOption | null = null
function onPopState() {
  if (!historyStep) return
  historyStep = false
  close()
}

async function show() {
  query.value = ''
  place()
  open.value = true
  if (sheet.value) {
    window.history.pushState({ ...(window.history.state ?? {}), pickSheet: true }, '')
    historyStep = true
  }
  active.value = flat.value.findIndex((o) => o.value === props.modelValue)
  await nextTick()
  listEl.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  // On a phone the keyboard would cover half the sheet before anyone asked
  // for it; on a computer typing straight away is the point.
  if (!sheet.value) searchEl.value?.focus()
  else panelEl.value?.focus()
}

let refocusOnClose = true
function close() {
  open.value = false
  drag.value = 0
  if (pending) {
    emit('update:modelValue', pending.value)
    pending = null
  }
  if (refocusOnClose) fieldEl.value?.focus()
  refocusOnClose = true
}

function hide(refocus = true) {
  if (!open.value) return
  refocusOnClose = refocus
  if (historyStep) window.history.back()
  else close()
}

function pick(o: PickOption) {
  pending = o
  hide()
}

/**
 * Swiped down: the sheet follows the finger and goes once pulled a quarter
 * of its height or flicked; otherwise it springs back. From the list only
 * when the list is at its top, so pulling down there still scrolls it.
 */
const drag = ref(0)
const dragging = ref(false)
let startY = 0
let startT = 0
let tracking = false
function onTouchStart(event: TouchEvent) {
  if (!sheet.value || event.touches.length !== 1) return
  const target = event.target as Element
  if (target.closest('.pick-search')) return
  if (target.closest('.pick-list') && (listEl.value?.scrollTop ?? 0) > 0) return
  tracking = true
  startY = event.touches[0]!.clientY
  startT = event.timeStamp
}
function onTouchMove(event: TouchEvent) {
  if (!tracking) return
  const dy = event.touches[0]!.clientY - startY
  if (!dragging.value && dy <= 4) {
    // Upward first: a scroll of the list, not a swipe.
    if (dy < -4) tracking = false
    return
  }
  dragging.value = true
  event.preventDefault()
  drag.value = Math.max(0, dy)
}
function onTouchEnd(event: TouchEvent) {
  if (!tracking) return
  tracking = false
  if (!dragging.value) return
  dragging.value = false
  const h = panelEl.value?.offsetHeight ?? 400
  const fast = drag.value / Math.max(1, event.timeStamp - startT) > 0.6
  if (drag.value > h / 4 || (fast && drag.value > 30)) {
    // Carried the rest of the way down, then closed.
    drag.value = h
    setTimeout(() => hide(), 180)
  } else drag.value = 0
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    // Only this list closes, not the filter around it.
    event.stopPropagation()
    hide()
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const n = flat.value.length
    if (!n) return
    active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + n) % n
    nextTick(() => document.getElementById(optionId(active.value))?.scrollIntoView({ block: 'nearest' }))
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const o = flat.value[active.value]
    if (o) pick(o)
  } else if (event.key === 'Tab') {
    hide(false)
  }
}

function onFieldKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    show()
  }
}

const onResize = () => { if (open.value) place() }
onMounted(() => {
  window.addEventListener('resize', onResize)
  window.addEventListener('popstate', onPopState)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('popstate', onPopState)
  // Gone with the sheet still open (the filter closed around it): take its
  // step back out of the history.
  if (historyStep) {
    historyStep = false
    window.history.back()
  }
})

const panelStyle = computed(() => sheet.value
  ? (drag.value ? { transform: `translateY(${drag.value}px)`, transition: dragging.value ? 'none' : undefined } : undefined)
  : { top: pos.value.top + 'px', left: pos.value.left + 'px', width: pos.value.width + 'px', maxHeight: pos.value.maxHeight + 'px' })
</script>

<template>
  <button
    :id="id"
    ref="fieldEl"
    type="button"
    class="filter-select pick-field"
    aria-haspopup="listbox"
    :aria-expanded="open"
    @click="open ? hide() : show()"
    @keydown="onFieldKey"
  >
    <span class="pick-field-text" :lang="current?.lang">{{ current?.label }}</span>
  </button>
  <Teleport to="body">
    <div v-if="open" class="pick-layer" :class="{ 'is-sheet': sheet }">
      <div class="pick-dim" @pointerdown.prevent="hide()" />
      <div
        ref="panelEl"
        class="pick-panel"
        role="dialog"
        :aria-label="title"
        tabindex="-1"
        :class="{ 'is-dragging': dragging }"
        :style="panelStyle"
        @keydown="onKey"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      >
        <template v-if="sheet">
          <div class="pick-grab" aria-hidden="true" />
          <div class="pick-head">
            <span>{{ title }}</span>
            <button type="button" class="pick-close" :aria-label="t('filter.close')" @click="hide()">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </template>
        <label class="pick-search">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            ref="searchEl"
            v-model="query"
            type="search"
            :placeholder="t('search.short')"
            :aria-label="t('search.short')"
            role="combobox"
            aria-autocomplete="list"
            :aria-controls="`${id}-list`"
            aria-expanded="true"
            :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
            autocomplete="off"
            spellcheck="false"
          >
        </label>
        <div :id="`${id}-list`" ref="listEl" class="pick-list" role="listbox" :aria-label="title">
          <template v-for="(s, si) in sections" :key="si">
            <div v-if="s.label" class="pick-group" role="presentation">{{ s.label }}</div>
            <button
              v-for="o in s.options"
              :id="optionId(indexOf(o))"
              :key="o.value"
              type="button"
              tabindex="-1"
              role="option"
              class="pick-option"
              :class="{ 'is-chosen': o.value === modelValue, 'is-active': indexOf(o) === active }"
              :aria-selected="o.value === modelValue"
              :lang="o.lang"
              @click="pick(o)"
            >
              <span>{{ o.label }}</span>
              <svg v-if="o.value === modelValue" class="pick-tick" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </button>
          </template>
          <p v-if="!flat.length" class="pick-empty">{{ t('search.nothing', { query }) }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
