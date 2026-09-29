<script setup lang="ts">
import { localeByCode } from '~/i18n/locales'
import { fontUrl } from '~/i18n/suggestions'

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

const fontHref = computed(() => (scriptFont.value ? fontUrl(scriptFont.value) : null))

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
  if (u.search || u.hash || /\.[a-z0-9]+$/i.test(u.pathname) || u.pathname.endsWith('/')) return url
  u.pathname += '/'
  return u.toString()
}

const pageLinks = computed(() =>
  (localeHead.value.link ?? []).map(link => ({ ...link, href: withSlash(link.href) as string })))
const pageMeta = computed(() =>
  (localeHead.value.meta ?? []).map(meta =>
    meta.property === 'og:url' ? { ...meta, content: withSlash(String(meta.content)) as string } : meta))

/**
 * Font requests, and the connections they need.
 *
 * Inter was an @import at the top of main.css, which made a chain: the HTML
 * names the stylesheet, the stylesheet names Google's CSS, Google's CSS names
 * the font file — three round trips in series before any text could be drawn
 * in it. As a link in the head it is fetched alongside the stylesheet
 * instead of after it. The preconnects open both Google hosts while the HTML
 * is still arriving; fonts.gstatic.com needs `crossorigin` because font files
 * are always fetched in CORS mode, and a connection opened without it would be
 * thrown away and made again.
 */
const INTER = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'

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
    { rel: 'preconnect' as const, href: 'https://fonts.googleapis.com', key: 'pc-fonts-css' },
    { rel: 'preconnect' as const, href: 'https://fonts.gstatic.com', crossorigin: '', key: 'pc-fonts-files' },
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
