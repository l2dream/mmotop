<script setup lang="ts">
import { READY_LOCALES, bcp47, type Locale } from '~/i18n/locales'
import { SUGGESTIONS, fontUrl } from '~/i18n/suggestions'

const { locale } = useI18n()
const switchLocalePath = useSwitchLocalePath()

/** The registry types codes as plain strings; the router wants its own union.
 *  Every registry code is a routed locale (READY_CODES is checked at build),
 *  so the narrowing here is safe rather than a way of silencing the checker. */
type RoutedLocale = Parameters<typeof switchLocalePath>[0]
const pathFor = (code: string) => switchLocalePath(code as RoutedLocale)

const stored = useStoredLocale()
const dismissed = useSuggestionDismissed()

/**
 * Null until the browser has spoken.
 *
 * The page is prerendered once and served to everyone, so the markup cannot
 * contain a guess about who is reading it. Starting empty keeps the first
 * client render identical to the file on disk, and the banner appears a beat
 * later, after hydration.
 */
const suggestion = ref<Locale | null>(null)

/**
 * Language tags a browser sends that are not the code we route under.
 *
 * Norwegian is the one that bit: NORSK lives at /no/ because that is what a
 * reader expects in the address bar, but no browser has ever sent "no" — a
 * Norwegian system sends nb-NO, nb, or nn. Neither the full tag nor its base
 * matched anything, so the banner silently never offered Norwegian to
 * Norwegians, which is the entire audience it exists for.
 *
 * Also handles the script subtags: someone reading Traditional Chinese should
 * not be handed Simplified, so zh-Hant is left unmatched until 繁體中文 exists
 * as its own locale.
 */
const ALIASES: Record<string, string> = {
  nb: 'no',
  nn: 'no',
  'zh-hans': 'zh',
  'zh-cn': 'zh',
  'zh-sg': 'zh',
  iw: 'he',   // the old ISO code for Hebrew, still sent by some systems
  in: 'id',   // and for Indonesian, so it does not fall through to anything
  ji: 'yi'
}

const UNMATCHABLE = ['zh-hant', 'zh-tw', 'zh-hk', 'zh-mo']

/** One preference tag to one of our locales. The full tag first, so pt-BR
 *  does not collapse into pt, then an alias, then the bare language. */
function resolve(preference: string): Locale | undefined {
  const wanted = preference.toLowerCase()
  const find = (code: string) => READY_LOCALES.find(l => l.code === code)

  if (UNMATCHABLE.some(tag => wanted.startsWith(tag))) return undefined

  return find(wanted)
    ?? find(ALIASES[wanted] ?? '')
    ?? find(ALIASES[wanted.split('-').slice(0, 2).join('-')] ?? '')
    ?? find(ALIASES[wanted.split('-')[0]!] ?? '')
    ?? find(wanted.split('-')[0]!)
}

/** "en-us" and "en" are the same language; "pt-br" and "pt" are the same
 *  language. Two locales that share this are regional siblings. */
function baseLanguage(code: string): string {
  return code.split('-')[0]!
}

/**
 * A stored choice outranks the browser: someone who picked Russian last week
 * meant it, while Accept-Language is only what their operating system was
 * installed with. An unrecognised stored value falls through to the browser
 * list rather than silencing the banner for a year.
 *
 * Nothing is offered to someone already reading their own language, including
 * a regional sibling of it. A browser sending en-US on the English page used
 * to be handed "This page is also available in English (US)" — a different
 * address for the same sentences, aimed at the largest slice of traffic there
 * is. Which regional flavour someone gets is a detail for the selector, not a
 * reason to interrupt them.
 */
function pick(): Locale | null {
  const current = baseLanguage(locale.value)
  const preferences = [
    ...(stored.value ? [stored.value] : []),
    // Not `?? [navigator.language]`: privacy-hardened browsers report an empty
    // array rather than nothing at all, and ?? would pass it straight through.
    ...(navigator.languages?.length ? navigator.languages : [navigator.language])
  ]
  for (const preference of preferences) {
    const found = resolve(preference)
    if (!found) continue
    if (baseLanguage(found.code) === current) return null
    return found
  }
  return null
}

onMounted(() => {
  if (dismissed.value) return
  const found = pick()
  if (found && SUGGESTIONS[found.code]) {
    suggestion.value = found
  }
})

const words = computed(() => (suggestion.value ? SUGGESTIONS[suggestion.value.code] : null))

/** Built here rather than inline in the template: the family name has to be
 *  quoted for CSS, and a quote inside a template attribute ends the attribute. */
const hintStyle = computed(() =>
  suggestion.value?.font ? { '--hint-font': `"${suggestion.value.font}"` } : undefined
)

/**
 * The banner writes in a language the page has not loaded a font for — a
 * Korean offer sits on an English page, and Inter has no Hangul. The face
 * comes down with the banner, which is also the face the visitor is one click
 * away from needing anyway.
 */
useHead(() => ({
  link: suggestion.value?.font
    ? [{ rel: 'stylesheet', href: fontUrl(suggestion.value.font), key: 'suggestion-font' }]
    : []
}))

function accept() {
  stored.value = suggestion.value!.code
  suggestion.value = null
}

function dismiss() {
  dismissed.value = 'off'
  suggestion.value = null
}
</script>

<template>
  <!-- lang and dir both, and lang is the one that was missing. The whole strip
       is written in a language the page is not in, and it carries role="status",
       so a screen reader will read it — in the page's voice unless told
       otherwise. That covers the dismiss button's label too, which inherits. -->
  <div
    v-if="suggestion && words"
    class="lang-hint"
    :lang="bcp47(suggestion.code)"
    :dir="suggestion.dir"
    :style="hintStyle"
    role="status"
  >
    <svg class="lang-hint-globe" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
    </svg>

    <span class="lang-hint-text">{{ words.prompt }}</span>

    <NuxtLink
      class="lang-hint-action"
      :to="pathFor(suggestion.code)"
      :hreflang="bcp47(suggestion.code)"
      @click="accept"
    >
      {{ words.action }}
    </NuxtLink>

    <button class="lang-hint-close" type="button" :aria-label="words.dismiss" @click="dismiss">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
</template>
