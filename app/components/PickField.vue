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

async function show() {
  query.value = ''
  place()
  open.value = true
  active.value = flat.value.findIndex((o) => o.value === props.modelValue)
  await nextTick()
  listEl.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  // On a phone the keyboard would cover half the sheet before anyone asked
  // for it; on a computer typing straight away is the point.
  if (!sheet.value) searchEl.value?.focus()
  else panelEl.value?.focus()
}

function hide(refocus = true) {
  open.value = false
  if (refocus) fieldEl.value?.focus()
}

function pick(o: PickOption) {
  emit('update:modelValue', o.value)
  hide()
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
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
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
        :style="sheet ? undefined : { top: pos.top + 'px', left: pos.left + 'px', width: pos.width + 'px', maxHeight: pos.maxHeight + 'px' }"
        @keydown="onKey"
      >
        <template v-if="sheet">
          <div class="pick-grab" aria-hidden="true" />
          <div class="pick-head">{{ title }}</div>
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
