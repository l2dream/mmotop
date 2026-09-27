<script setup lang="ts">
import { DEFAULT_LOCALE, READY_LOCALES, bcp47, groupedLocales, localeByCode, matchesQuery, type Locale } from '~/i18n/locales'

const { locale, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const open = ref(false)
const query = ref('')
const wrap = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const pos = ref({ top: 0, right: 0 })

/**
 * Falls back to the default language, not to the first row of the list.
 *
 * READY_LOCALES is sorted by endonym, so AZƏRBAYCANCA is index zero — and any
 * state where the current locale is not in the registry used to show an AZ
 * chip to someone who is not reading Azerbaijani. Failing to the wrong thing
 * quietly is worse than failing to English.
 */
const current = computed<Locale>(
  () => localeByCode(locale.value) ?? localeByCode(DEFAULT_LOCALE) ?? READY_LOCALES[0]!
)

/**
 * The groups, narrowed by whatever is typed. Empty groups drop out, so a
 * search for "kor" leaves one heading rather than seven, six of them bare.
 */
/**
 * True while an input method is mid-word: Hangul assembling a syllable, or
 * pinyin and romaji still spelled out in Latin before they commit.
 */
const composing = ref(false)

/**
 * What the list actually filters on.
 *
 * During composition the field holds something provisional, and narrowing on
 * it cuts both ways. Korean builds up real text — ㅎ, 하, 한 — and each step is
 * worth filtering by. Pinyin and romaji do not: "zhongwen" matches nothing
 * until it becomes 中文, so filtering on it would flash "No matches" at
 * someone in the middle of typing their own language's name.
 *
 * So a composing query narrows the list when it finds something and is
 * ignored when it does not. Nothing provisional is ever allowed to empty the
 * list.
 */
const effectiveQuery = computed(() => {
  if (!composing.value) return query.value
  const hits = READY_LOCALES.some(l => matchesQuery(l, query.value))
  return hits ? query.value : ''
})

const groups = computed(() => groupedLocales(l => matchesQuery(l, effectiveQuery.value)))

const empty = computed(() => groups.value.length === 0)

const matchCount = computed(() => groups.value.reduce((n, g) => n + g.locales.length, 0))

/**
 * Remembers the choice so a later visit can offer it. Deliberately only
 * written on an actual click: a cookie set by merely looking at the page would
 * be a guess dressed up as a preference. See useLanguagePreference for what it
 * does and does not control.
 */
const stored = useStoredLocale()

function choose(code: string) {
  stored.value = code
  // No focus return here: the click navigates, and the new page decides.
  close(false)
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

/**
 * Closes, and puts focus back where it came from.
 *
 * Without the second half a keyboard user pressed Escape and landed nowhere:
 * focus was on a node that had just been removed, so the browser reset them to
 * the top of the document and they had to tab past the wordmark, the theme
 * button, the search field, the filter and the whole category bar to get back
 * to where they already were.
 */
function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  query.value = ''
  if (returnFocus) trigger.value?.focus()
}

async function toggle() {
  if (open.value) return close()
  open.value = true
  position()
  await nextTick()
  // Twenty-six names is more than anyone wants to read through, so the caret
  // lands in the search field and typing narrows immediately.
  searchEl.value?.focus()
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled])'

/**
 * Keeps Tab inside the panel while it is open.
 *
 * It claims role="dialog", and a dialog that lets Tab wander onto the LOGIN
 * button behind it is lying to whoever is listening. Wrapping in both
 * directions is the whole of it.
 */
function trapTab(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !panel.value) return
  const items = [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)]
  if (items.length === 0) return
  const first = items[0]!
  const last = items[items.length - 1]!
  const active = document.activeElement
  if (event.shiftKey && (active === first || !panel.value.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function onPointerDown(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as Node
  if (wrap.value?.contains(target) || panel.value?.contains(target)) return
  // Clicked elsewhere on purpose, so leave focus where the click put it.
  close(false)
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape') return close()
  trapTab(event)
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
      ref="trigger"
      class="lang-button"
      type="button"
      :aria-label="t('nav.language')"
      aria-haspopup="dialog"
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
      aria-modal="true"
      :aria-label="t('nav.language')"
      :style="{ top: pos.top + 'px', right: pos.right + 'px' }"
    >
      <div class="lang-search">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" stroke-linecap="round" />
        </svg>
        <!-- Bound by hand rather than with v-model, which is the whole fix.
             v-model installs a composition guard and drops every `input` event
             fired while an input method is composing, so a Korean visitor
             typing 한국 saw all twenty-six rows sit there until they committed.
             A plain @input listener receives those events. -->
        <input
          ref="searchEl"
          :value="query"
          type="text"
          class="lang-search-input"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          :placeholder="t('language.search')"
          :aria-label="t('language.search')"
          @input="query = ($event.target as HTMLInputElement).value"
          @compositionstart="composing = true"
          @compositionend="composing = false"
        />
      </div>

      <!-- Typing narrows the list silently otherwise: a screen reader user gets
           no signal that anything happened, including when everything vanished. -->
      <p class="sr-only" role="status" aria-live="polite">
        {{ empty ? t('language.nothing') : t('language.results', { count: matchCount }) }}
      </p>

      <div v-if="empty" class="lang-empty">{{ t('language.nothing') }}</div>

      <div v-else class="lang-columns">
        <div v-for="group in groups" :key="group.script" class="lang-group">
          <div class="lang-group-title">{{ group.label }}</div>
          <NuxtLink
            v-for="item in group.locales"
            :key="item.code"
            class="lang-item"
            :class="{ active: item.code === locale }"
            :aria-current="item.code === locale ? 'true' : undefined"
            :to="switchLocalePath(item.code)"
            :hreflang="bcp47(item.code)"
            @click="choose(item.code)"
          >
            <span class="lang-item-code">{{ item.chip }}</span>
            <!-- lang and dir on the name itself. dir so العربية sits right
                 inside a left-to-right list; lang so a screen reader says
                 日本語 in Japanese rather than spelling it out in English —
                 this list exists for people who cannot read the interface
                 around it, and without lang it is unusable by them. -->
            <span class="lang-item-name" :lang="bcp47(item.code)" :dir="item.dir">{{ item.endonym }}</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
