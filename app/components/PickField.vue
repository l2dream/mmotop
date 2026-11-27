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
 * With `multiple` several lines can be chosen (a server's languages): the
 * value is their comma list, "en,ru"; a tap ticks or unticks a line and the
 * list stays open until Done. Lines named in `exclusive` ("International")
 * stand alone: choosing one clears the rest, and choosing any other clears it.
 *
 * Searching ignores case and accents ("cestina" finds "Čeština"), and a
 * group's name finds all of its lines ("lineage" lists every chronicle).
 */
export interface PickOption {
  value: string
  label: string
  lang?: string
  dir?: 'ltr' | 'rtl'
  /** Other words the search finds it by (a language's English name, its code). */
  keywords?: string
}
export interface PickGroup { label: string, options: PickOption[] }

const props = defineProps<{
  id?: string
  modelValue: string
  /** The sheet's heading, and the list's name for screen readers. */
  title: string
  /** The lines before any group, such as "All languages". */
  options?: PickOption[]
  groups?: PickGroup[]
  /** Shown, dimmed, while nothing in the list is chosen ("Choose…"). */
  placeholder?: string
  /** `form`: in the account's form, looking like its fields. `bare`: a
   *  button of its own (the language globe), drawn by the slot. */
  variant?: 'filter' | 'form' | 'bare'
  /** With `bare`: the button's class and its name for screen readers. */
  buttonClass?: string
  buttonLabel?: string
  /** The search line's placeholder, when "Search" says too little. */
  searchLabel?: string
  /** In a form: nothing chosen stops it being sent, as a select would. */
  required?: boolean
  /** Several lines may be chosen; the value is their comma list. */
  multiple?: boolean
  /** With `multiple`: lines that can only be chosen alone. */
  exclusive?: string[]
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** The pointer on the button or focus on it: about to be opened. */
  intent: []
}>()

const { t } = useI18n()
const autoId = useId()
const uid = computed(() => props.id ?? `pick-${autoId}`)
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
const chosenSet = computed(() => new Set(props.multiple ? props.modelValue.split(',').filter(Boolean) : [props.modelValue]))
const isChosen = (o: PickOption) => chosenSet.value.has(o.value)
const current = computed(() => {
  if (props.multiple) {
    const chosen = allOptions.value.filter(isChosen)
    return chosen.length ? { value: props.modelValue, label: chosen.map((o) => o.label).join(', '), lang: chosen.length === 1 ? chosen[0]!.lang : undefined } : undefined
  }
  return allOptions.value.find((o) => o.value === props.modelValue)
    ?? (props.placeholder === undefined ? allOptions.value[0] : undefined)
})

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** What the search leaves, in sections: the loose lines, then each group. */
const sections = computed(() => {
  const q = fold(query.value.trim())
  const hit = (o: PickOption) => !q || fold(o.label).includes(q) || (!!o.keywords && fold(o.keywords).includes(q))
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

const optionId = (i: number) => `${uid.value}-opt-${i}`
const indexOf = (o: PickOption) => flat.value.indexOf(o)

function place() {
  const r = fieldEl.value?.getBoundingClientRect()
  if (!r) return
  sheet.value = window.innerWidth <= 700
  if (sheet.value) return
  const room = window.innerHeight - r.bottom - 16
  const width = Math.max(r.width, props.variant === 'bare' ? 280 : 240)
  // Kept on the screen: a small button near the edge (the globe) would hang
  // its panel off it; then it ends at the button's far edge instead.
  const left = Math.max(10, r.left + width > window.innerWidth - 10 ? r.right - width : r.left)
  pos.value = { top: r.bottom + 6, left, width, maxHeight: Math.max(220, Math.min(420, room)) }
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
  active.value = flat.value.findIndex(isChosen)
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
  if (props.multiple) {
    const alone = props.exclusive ?? []
    let next: string[]
    if (isChosen(o)) next = [...chosenSet.value].filter((v) => v !== o.value)
    else if (alone.includes(o.value)) next = [o.value]
    else next = [...[...chosenSet.value].filter((v) => !alone.includes(v)), o.value]
    // In the list's order, not the order of the taps.
    const order = allOptions.value.map((x) => x.value)
    next.sort((a, b) => order.indexOf(a) - order.indexOf(b))
    emit('update:modelValue', next.join(','))
    return
  }
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
    :id="uid"
    ref="fieldEl"
    type="button"
    :class="variant === 'bare' ? buttonClass : ['pick-field', variant === 'form' ? 'pick-select' : 'filter-select']"
    aria-haspopup="listbox"
    :aria-expanded="open"
    :aria-label="variant === 'bare' ? buttonLabel : undefined"
    @click="open ? hide() : show()"
    @keydown="onFieldKey"
    @pointerenter="emit('intent')"
    @focus="emit('intent')"
  >
    <slot v-if="variant === 'bare'" />
    <template v-else>
      <span v-if="current" class="pick-field-text" :lang="current.lang">{{ current.label }}</span>
      <span v-else class="pick-field-text pick-placeholder">{{ placeholder }}</span>
    </template>
  </button>
  <!-- A select's "required", for a button: an input the form checks. -->
  <input
    v-if="required"
    class="pick-required"
    tabindex="-1"
    aria-hidden="true"
    :value="current ? modelValue : ''"
    required
    @invalid="fieldEl?.focus()"
  >
  <Teleport to="body">
    <div v-if="open" class="pick-layer" :class="{ 'is-sheet': sheet }">
      <!-- On click, not on pointerdown: closed at the touch, the dim was gone
           before the tap ended, and the tap went on to the field beneath it
           (Game opened its own list). -->
      <div class="pick-dim" @pointerdown.prevent @click="hide()" />
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
        <div v-if="sheet" class="pick-grab" aria-hidden="true" />
        <div v-if="sheet || multiple" class="pick-head">
          <span>{{ title }}</span>
          <!-- Several to choose: the list stays open, Done closes it. -->
          <button v-if="multiple" type="button" class="pick-done" @click="hide()">{{ t('filter.done') }}</button>
          <button v-else type="button" class="pick-close" :aria-label="t('filter.close')" @click="hide()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <label class="pick-search">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            ref="searchEl"
            :value="query"
            type="search"
            :placeholder="searchLabel ?? t('search.short')"
            :aria-label="searchLabel ?? t('search.short')"
            role="combobox"
            aria-autocomplete="list"
            :aria-controls="`${uid}-list`"
            aria-expanded="true"
            :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
            autocomplete="off"
            @input="query = ($event.target as HTMLInputElement).value"
            spellcheck="false"
          >
        </label>
        <div :id="`${uid}-list`" ref="listEl" class="pick-list" role="listbox" :aria-label="title" :aria-multiselectable="multiple || undefined">
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
              :class="{ 'is-chosen': isChosen(o), 'is-active': indexOf(o) === active }"
              :aria-selected="isChosen(o)"
              :lang="o.lang"
              @click="pick(o)"
            >
              <span :dir="o.dir">{{ o.label }}</span>
              <svg v-if="isChosen(o)" class="pick-tick" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </button>
          </template>
          <p v-if="!flat.length" class="pick-empty">{{ t('search.nothing', { query }) }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
