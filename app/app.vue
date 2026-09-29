<script setup lang="ts">
import { localeByCode } from '~/i18n/locales'
import { fontUrl, pickerFontUrls } from '~/i18n/suggestions'

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
 * separate, tiny thing — see pickerHrefs below.
 */
const scriptFont = computed(() => localeByCode(locale.value)?.font ?? null)

const fontHref = computed(() => (scriptFont.value ? fontUrl(scriptFont.value) : null))

/**
 * The tiny subsets that let the language selector print twenty-six names in
 * seven scripts, whatever language this page is in — minus the one family
 * this page already loads in full, which would otherwise collide with it.
 */
const pickerHrefs = computed(() => pickerFontUrls(scriptFont.value))

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
    ...(localeHead.value.link ?? []),
    ...(fontHref.value
      ? [{ rel: 'stylesheet', href: fontHref.value, key: 'script-font' }]
      : []),
    ...pickerHrefs.value.map((href, i) => ({
      rel: 'stylesheet', href, key: `picker-font-${i}`
    }))
  ],
  meta: localeHead.value.meta
}))
</script>

<template>
  <NuxtPage />
</template>
