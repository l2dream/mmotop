<script setup lang="ts">
import { DEFAULT_LOCALE, READY_LOCALES, bcp47, groupedLocales, localeByCode, localeName, type Locale } from '~/i18n/locales'
import { pickerFontUrls } from '~/i18n/fonts'

const { locale, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()
// Captured here: inside the timer below there is no component to ask.
const router = useRouter()

/** The registry types codes as plain strings; the router wants its own union.
 *  Every registry code is a routed locale (READY_CODES is checked at build),
 *  so the narrowing here is safe rather than a way of silencing the checker. */
type RoutedLocale = Parameters<typeof switchLocalePath>[0]
const pathFor = (code: string) => switchLocalePath(code as RoutedLocale)

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
 * The subset fonts that let the list print twenty-six names in seven scripts.
 *
 * They used to be stylesheet links in every page's head: six requests, each
 * render-blocking, on all twenty-six pages, for a panel that starts closed and
 * that most visitors never open. They are requested now on the first sign of
 * intent — the pointer arriving on the button, or keyboard focus reaching it —
 * which is usually a few hundred milliseconds before the click, enough for
 * the tiny files to arrive before the list is drawn.
 *
 * useState, so once wanted they stay wanted across a language switch rather
 * than being unlinked and fetched again. The family this page already loads
 * in full is left out, as before, so the two cannot collide.
 */
const base = useRuntimeConfig().app.baseURL
const pickerFontsWanted = useState('lang-picker-fonts', () => false)
const pageScriptFont = computed(() => localeByCode(locale.value)?.font ?? null)

function wantPickerFonts() {
  pickerFontsWanted.value = true
}

useHead(() => ({
  link: pickerFontsWanted.value
    ? pickerFontUrls(base, pageScriptFont.value).map((href, i) => ({
        rel: 'stylesheet' as const, href, key: `picker-font-${i}`
      }))
    : []
}))

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

/**
 * The same list as every other choice on the site (PickField): on a phone a
 * sheet from the bottom with a search line, the languages under their
 * scripts' names, the one in use violet with a tick; on a computer a panel
 * under the globe. It replaced a panel of its own in two or three columns.
 */
const groups = computed(() => groupedLocales().map((g) => ({
  label: t(g.labelKey),
  options: g.locales.map((l) => ({
    value: l.code,
    label: localeName(l),
    lang: bcp47(l.code),
    dir: l.dir,
    keywords: `${l.endonym} ${l.name} ${l.code} ${l.chip}`
  }))
})))

/**
 * Called once the list has closed (and, on a phone, taken its step back out
 * of the history), so the new language's address is the one left standing.
 */
function choose(code: string) {
  stored.value = code
  // Choosing the language already in use navigates nowhere, so no new
  // instance will mount to pick the flag up — and a flag left set would steal
  // focus on some unrelated remount later.
  if (code === locale.value) return
  focusAfterSwitch.value = true
  // A turn later: on a phone the list has just taken its step back out of
  // the history, and the router is still settling that step; a navigation
  // started inside it was dropped.
  setTimeout(() => router.push(pathFor(code)), 0)
}

onMounted(() => {
  if (focusAfterSwitch.value) {
    focusAfterSwitch.value = false
    // Back on the control they used, rather than at the top of the document.
    document.querySelector<HTMLElement>('.lang-button')?.focus()
  }
})
</script>

<template>
  <div class="lang-wrap">
    <PickField
      variant="bare"
      button-class="lang-button"
      :button-label="`${current.chip}, ${t('nav.language')}`"
      :model-value="locale"
      :title="t('nav.language')"
      :search-label="t('language.search')"
      :groups="groups"
      @intent="wantPickerFonts"
      @update:model-value="choose"
    >
      <!-- A globe rather than a flag: a flag names a country, and the subject
           here is a language. The code beside it is the part people read. -->
      <svg class="lang-globe" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
      </svg>
      <span class="lang-code">{{ current.chip }}</span>
    </PickField>
  </div>
</template>
