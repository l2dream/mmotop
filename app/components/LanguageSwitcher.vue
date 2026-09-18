<script setup lang="ts">
import { READY_LOCALES, SCRIPT_LABELS, SCRIPT_ORDER, matchesQuery, type Locale } from '~/i18n/locales'

const { locale, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const open = ref(false)
const query = ref('')
const wrap = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const pos = ref({ top: 0, right: 0 })

const current = computed<Locale>(
  () => READY_LOCALES.find(l => l.code === locale.value) ?? READY_LOCALES[0]!
)

/**
 * The groups, narrowed by whatever is typed. Empty groups drop out, so a
 * search for "kor" leaves one heading rather than seven, six of them bare.
 */
const groups = computed(() =>
  SCRIPT_ORDER
    .map(script => ({
      script,
      label: SCRIPT_LABELS[script],
      locales: READY_LOCALES.filter(l => l.script === script && matchesQuery(l, query.value))
    }))
    .filter(group => group.locales.length > 0)
)

const empty = computed(() => groups.value.length === 0)

/**
 * Remembers the choice so a later visit can offer it. Deliberately only
 * written on an actual click: a cookie set by merely looking at the page would
 * be a guess dressed up as a preference.
 */
const stored = useCookie<string>('mmotop_lang', {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/'
})

function choose(code: string) {
  stored.value = code
  open.value = false
  query.value = ''
}

// Sized so PORTUGUÊS (BRASIL), the longest name on the list, fits its column
// whole. Three columns of 192px is what it measured at.
const PANEL_WIDTH = 640

function position() {
  const rect = wrap.value?.getBoundingClientRect()
  if (!rect) return
  const width = Math.min(PANEL_WIDTH, window.innerWidth - 20)
  const right = Math.min(
    window.innerWidth - rect.right,
    window.innerWidth - width - 10
  )
  pos.value = { top: rect.bottom + 10, right: Math.max(10, right) }
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  position()
  await nextTick()
  // Twenty-six names is more than anyone wants to read through, so the caret
  // lands in the search field and typing narrows immediately.
  searchEl.value?.focus()
}

function onPointerDown(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as Node
  if (wrap.value?.contains(target) || panel.value?.contains(target)) return
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    open.value = false
    query.value = ''
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', position)
  window.removeEventListener('scroll', position, true)
})
</script>

<template>
  <div class="lang-wrap" ref="wrap">
    <button
      class="lang-button"
      type="button"
      :aria-label="t('nav.language')"
      aria-haspopup="true"
      :aria-expanded="open"
      @click="toggle"
    >
      <!-- A globe rather than a flag: a flag names a country, and the subject
           here is a language. The code beside it is the part people read. -->
      <svg class="lang-globe" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
      </svg>
      <span class="lang-code">{{ current.chip }}</span>
    </button>

    <div
      v-if="open"
      ref="panel"
      class="lang-panel"
      role="dialog"
      :aria-label="t('nav.language')"
      :style="{ top: pos.top + 'px', right: pos.right + 'px' }"
    >
      <div class="lang-search">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" stroke-linecap="round" />
        </svg>
        <input
          ref="searchEl"
          v-model="query"
          type="text"
          class="lang-search-input"
          :placeholder="t('language.search')"
          :aria-label="t('language.search')"
        />
      </div>

      <div v-if="empty" class="lang-empty">{{ t('language.nothing') }}</div>

      <div v-else class="lang-columns">
        <div v-for="group in groups" :key="group.script" class="lang-group">
          <div class="lang-group-title">{{ group.label }}</div>
          <NuxtLink
            v-for="item in group.locales"
            :key="item.code"
            class="lang-item"
            :class="{ active: item.code === locale }"
            :to="switchLocalePath(item.code)"
            :hreflang="item.code"
            @click="choose(item.code)"
          >
            <span class="lang-item-code">{{ item.chip }}</span>
            <!-- dir on the name itself, so العربية sits right inside a list
                 that is otherwise running left to right. -->
            <span class="lang-item-name" :dir="item.dir">{{ item.endonym }}</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
