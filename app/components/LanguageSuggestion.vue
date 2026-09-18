<script setup lang="ts">
import { READY_LOCALES, type Locale } from '~/i18n/locales'
import { SUGGESTIONS, fontUrl } from '~/i18n/suggestions'

const { locale } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const stored = useCookie<string | undefined>('mmotop_lang', {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/'
})

/** Set once the banner is closed, and never unset. Asking a second time after
 *  someone has said no is not a suggestion, it is nagging. */
const dismissed = useCookie<string | undefined>('mmotop_lang_hint', {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/'
})

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
 * A stored choice outranks the browser: someone who picked Russian last week
 * meant it, while Accept-Language is only what their operating system was
 * installed with. Falls back to the browser list in preference order, trying
 * the full tag before the bare language so pt-BR does not collapse into pt.
 */
function pick(): Locale | null {
  const preferences = stored.value ? [stored.value] : [...(navigator.languages ?? [navigator.language])]
  for (const preference of preferences) {
    const wanted = preference.toLowerCase()
    const exact = READY_LOCALES.find(l => l.code === wanted)
    if (exact) return exact
    const base = wanted.split('-')[0]
    const loose = READY_LOCALES.find(l => l.code === base)
    if (loose) return loose
  }
  return null
}

onMounted(() => {
  if (dismissed.value) return
  const found = pick()
  // Nothing to offer someone who is already reading it.
  if (found && found.code !== locale.value && SUGGESTIONS[found.code]) {
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
  <!-- dir on the strip, so an Arabic offer reads correctly while the page
       around it is still running left to right. -->
  <div
    v-if="suggestion && words"
    class="lang-hint"
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
      :to="switchLocalePath(suggestion.code)"
      :hreflang="suggestion.code"
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
