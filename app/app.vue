<script setup lang="ts">
/**
 * Writes the per-page language tags: `lang` and `dir` on <html>, plus one
 * hreflang link per language and an x-default pointing at the bare path.
 *
 * These are reciprocal by construction — every language links to every other,
 * including itself — which is the part search engines check and the part that
 * is easy to get wrong by hand across twenty-six entries.
 */
const localeHead = useLocaleHead()

useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  link: localeHead.value.link,
  meta: localeHead.value.meta
}))
</script>

<template>
  <NuxtPage />
</template>
