<script setup lang="ts">
import type { NuxtError } from '#app'
import { READY_LOCALES, DEFAULT_LOCALE, localeByCode } from '~/i18n/locales'
import { fontUrl } from '~/i18n/fonts'

/**
 * The site's own "not found" page. Nuxt's default was an unstyled English
 * page titled "… | Nuxt", shown for every mistyped address — /de/xyz included.
 *
 * Nuxt renders this in place of app.vue, so nothing app.vue sets up is here:
 * the language, the theme script and the font link are all repeated below.
 * The language comes from the path itself (/de/xyz is German); an address
 * with no known prefix is English.
 */
const props = defineProps<{ error: NuxtError }>()

const { t, setLocale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const prefix = route.path.split('/')[1] ?? ''
const code = READY_LOCALES.some((l) => l.code === prefix) ? prefix : DEFAULT_LOCALE
const loc = localeByCode(code)
await setLocale(code as Parameters<typeof setLocale>[0])

const base = useRuntimeConfig().app.baseURL
const notFound = computed(() => props.error?.statusCode === 404)

useHead({
  title: () => `${notFound.value ? t('notFound.title') : props.error?.statusCode} — MMOTOP`,
  htmlAttrs: { lang: code, dir: loc?.dir ?? 'ltr' },
  meta: [{ name: 'robots', content: 'noindex' }],
  link: [
    { rel: 'stylesheet' as const, href: fontUrl(base, 'Inter') },
    ...(loc?.font ? [{ rel: 'stylesheet' as const, href: fontUrl(base, loc.font) }] : [])
  ],
  script: [{
    key: 'theme-boot',
    tagPriority: 'critical',
    innerHTML: "try{if(localStorage.getItem('mmotop-theme')==='light')document.documentElement.classList.add('theme-light')}catch(e){}"
  }]
})

function goHome() {
  clearError({ redirect: localePath('/') })
}
</script>

<template>
  <div class="site-shell not-found">
    <div class="not-found-card">
      <a :href="localePath('/')" class="brand not-found-brand" @click.prevent="goHome">MMOTOP</a>
      <p class="not-found-code">{{ error?.statusCode ?? 404 }}</p>
      <h1 class="not-found-title">{{ notFound ? t('notFound.title') : error?.statusMessage }}</h1>
      <p v-if="notFound" class="not-found-text">{{ t('notFound.text') }}</p>
      <a :href="localePath('/')" class="not-found-home" @click.prevent="goHome">{{ t('notFound.home') }}</a>
    </div>
  </div>
</template>
