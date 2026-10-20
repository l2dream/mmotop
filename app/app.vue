<script setup lang="ts">
import { READY_LOCALES, bcp47, localeByCode } from '~/i18n/locales'
import { fontUrl } from '~/i18n/fonts'

/**
 * Writes the per-page language tags: `lang` and `dir` on <html>, plus one
 * hreflang link per language and an x-default pointing at the bare path.
 *
 * These are reciprocal by construction — every language links to every other,
 * including itself — which is the part search engines check and the part that
 * is easy to get wrong by hand across twenty-six entries.
 */
const localeHead = useLocaleHead()
const { locale } = useI18n()

/**
 * The extra face this page's script needs, or nothing when Inter already
 * covers it — which is twenty of the twenty-six.
 *
 * It loads here, in the page's own head, rather than in the stylesheet, so
 * each prerendered page asks only for the font it will actually draw with. A
 * Russian visitor never fetches the Korean font; a Korean visitor fetches it
 * once and never sees Armenian or Arabic. The selector's own glyphs are a
 * separate, tiny thing, loaded by the selector itself when it is about to
 * be opened.
 */
const scriptFont = computed(() => localeByCode(locale.value)?.font ?? null)

const base = useRuntimeConfig().app.baseURL
const fontHref = computed(() => (scriptFont.value ? fontUrl(base, scriptFont.value) : null))

/**
 * Pages are directories on GitHub Pages — /mmotop/de is served from
 * /mmotop/de/index.html — so the address without a slash answers with a 301
 * to the one with it. The canonical, every hreflang alternate and og:url all
 * pointed at the redirecting form: each page named, as its own true address,
 * a URL that is not one. A trailing slash is added to absolute page URLs;
 * anything with a file extension or a query is left alone.
 */
function withSlash(url: string | undefined) {
  if (!url || !/^https?:\/\//.test(url)) return url
  const u = new URL(url)
  if (u.search || u.hash || /\.[a-z0-9]+$/i.test(u.pathname)) return url
  // The home page on a domain of its own comes as a bare "https://mmotop.com";
  // its path is "/" all the same, and toString() writes the slash out.
  if (!u.pathname.endsWith('/')) u.pathname += '/'
  return u.toString()
}

const pageLinks = computed(() =>
  (localeHead.value.link ?? []).map(link => ({ ...link, href: withSlash(link.href) as string })))
/**
 * og:locale:alternate as Open Graph wants it, language_TERRITORY. The i18n
 * module writes the bare language for most ("az", "de"), which consumers
 * drop; the registry already holds the proper form for og:locale itself.
 */
function ogLocaleFor(content: string) {
  const match = READY_LOCALES.find(l => l.code === content || bcp47(l.code).replace('-', '_') === content)
  return match?.ogLocale ?? content
}

const pageMeta = computed(() =>
  (localeHead.value.meta ?? []).map((meta) => {
    if (meta.property === 'og:url') return { ...meta, content: withSlash(String(meta.content)) as string }
    if (meta.property === 'og:locale:alternate') return { ...meta, content: ogLocaleFor(String(meta.content)) }
    return meta
  }))

/**
 * The picture shown when a link to any page is shared — in a chat, a forum,
 * a social feed. One image for every page and language: it carries the
 * wordmark and the games' names, which read the same in all of them. Open
 * Graph wants an absolute address.
 */
const siteUrl = useRuntimeConfig().public.siteUrl as string
const OG_IMAGE = `${siteUrl.replace(/\/$/, '')}${base}og-image.jpg`
useSeoMeta({
  ogImage: OG_IMAGE,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: 'image/jpeg',
  ogImageAlt: 'MMOTOP',
  twitterCard: 'summary_large_image',
  twitterImage: OG_IMAGE
})

/**
 * Inter, from the site itself (see modules/fonts.ts).
 *
 * A link in the head rather than an @import in main.css, which would make a
 * chain — the HTML names the stylesheet, the stylesheet names the font CSS,
 * that names the font file. As a link it is fetched alongside the stylesheet
 * instead of after it. It used to come from Google, with preconnects to both
 * of its hosts; same origin now, so there is no connection to open early and
 * no visitor's address goes to anyone but the host serving the page.
 */
const INTER = fontUrl(base, 'Inter')

/**
 * Puts the saved theme on <html> before the first paint.
 *
 * The page is prerendered once and served to everyone, so it ships in the
 * default dark theme. Restoring a light choice after hydration would flash the
 * whole page dark first; applying it from Vue state during hydration would
 * mismatch the prerendered markup. A few bytes of inline script in the head
 * run before anything is drawn and avoid both. Everything themed in the
 * stylesheet keys off this one class.
 *
 * localStorage rather than a cookie: nothing on a static host could read a
 * cookie server-side anyway, and this way the value is never sent with a
 * request. The key is namespaced because every project page under
 * l2dream.github.io shares the same origin, and so the same storage.
 */
useHead({
  script: [{
    key: 'theme-boot',
    tagPriority: 'critical',
    innerHTML: "try{if(localStorage.getItem('mmotop-theme')==='light')document.documentElement.classList.add('theme-light')}catch(e){}"
  }]
})

useHead(() => ({
  htmlAttrs: {
    ...localeHead.value.htmlAttrs,
    /**
     * Fed into the body font stack *after* Inter, never before. A CJK family
     * carries its own Latin letters, and put first it would quietly redraw
     * every Latin word on the page in them — the interface would change
     * typeface for a visitor who only changed language.
     *
     * Spread rather than set to undefined, which still renders style="".
     */
    ...(scriptFont.value ? { style: `--script-font: "${scriptFont.value}";` } : {})
  },
  link: [
    { rel: 'stylesheet' as const, href: INTER, key: 'font-inter' },
    ...pageLinks.value,
    ...(fontHref.value
      ? [{ rel: 'stylesheet' as const, href: fontHref.value, key: 'script-font' }]
      : [])
  ],
  meta: pageMeta.value
}))
</script>

<template>
  <NuxtPage />
</template>
