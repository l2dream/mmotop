<script setup lang="ts">
import { DEFAULT_LOCALE, READY_LOCALES, bcp47, groupedLocales, localeByCode, matchesQuery, type Locale } from '~/i18n/locales'

const { locale, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()

/** The registry types codes as plain strings; the router wants its own union.
 *  Every registry code is a routed locale (READY_CODES is checked at build),
 *  so the narrowing here is safe rather than a way of silencing the checker. */
type RoutedLocale = Parameters<typeof switchLocalePath>[0]
const pathFor = (code: string) => switchLocalePath(code as RoutedLocale)

const open = ref(false)
const query = ref('')
const wrap = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const pos = ref<PopupPlacement>({ top: 0, left: 0, maxHeight: 460 })

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

/**
 * Survives the remount, which is the whole trick.
 *
 * Choosing a language is a client-side route change, and index.vue — this
 * component's parent — is destroyed and rebuilt by it. Focusing the trigger
 * inside choose() therefore focused an element that was about to be thrown
 * away, and the visitor still landed on <body>. The flag is set before
 * navigating and read by the new instance once it exists.
 */
const focusAfterSwitch = useState('lang-focus-after-switch', () => false)

function choose(code: string) {
  stored.value = code
  // Choosing the language already in use navigates nowhere, so no new
  // instance will mount to pick the flag up — and a flag left set would steal
  // focus on some unrelated remount later. Close in place instead.
  if (code === locale.value) return close()
  focusAfterSwitch.value = true
  close(false)
}

/**
 * Hangs from the button's trailing edge, mirrored in right-to-left pages — see
 * placePopup for the arithmetic shared with the page's other two popups.
 *
 * Guarded on `open`: this runs on every scroll event anywhere on the page, and
 * it used to measure the button each time even while the panel was closed.
 */
function position() {
  if (!open.value || !wrap.value) return
  const width = panel.value?.offsetWidth ?? 640
  pos.value = placePopup(wrap.value.getBoundingClientRect(), width, 'end', 10)
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
  /**
   * Cleared here as well as on compositionend, because closing mid-composition
   * removes the input before that event can fire. Left true, it stuck for the
   * rest of the session: every fruitless query was then treated as no query,
   * so typing nonsense listed all twenty-six languages and "No matches" became
   * unreachable.
   */
  composing.value = false
  if (returnFocus) trigger.value?.focus()
}

async function toggle() {
  if (open.value) return close()
  open.value = true
  // After the panel exists, so its real width is what gets measured.
  await nextTick()
  position()
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
  // Focus can sit outside the panel while it is open — clicking a group
  // heading or the padding blurs the field onto <body> without closing
  // anything. Both directions pull it back in rather than only shift+Tab.
  const outside = !panel.value.contains(active)
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault()
    first.focus()
  }
}

function onPointerDown(event: PointerEvent) {
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
  if (focusAfterSwitch.value) {
    focusAfterSwitch.value = false
    // Back on the control they used, rather than at the top of the document.
    trigger.value?.focus()
  }
  // pointerdown rather than mousedown: iOS Safari does not reliably fire mouse
  // events for taps on non-interactive areas, so tapping outside might never
  // have closed the panel on an iPhone.
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
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
      :style="{ top: pos.top + 'px', left: pos.left + 'px', maxHeight: Math.min(460, pos.maxHeight) + 'px' }"
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
          <div class="lang-group-title">{{ t(group.labelKey) }}</div>
          <NuxtLink
            v-for="item in group.locales"
            :key="item.code"
            class="lang-item"
            :class="{ active: item.code === locale }"
            :aria-current="item.code === locale ? 'true' : undefined"
            :to="pathFor(item.code)"
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
