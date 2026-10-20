<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/**
 * The way back above a section or server page.
 *
 * Arrived from elsewhere on the site — the home page, a section, another
 * server — it says "Back" and goes back, so the visitor lands where they
 * were: the same list, the same filters, the same scroll position. Opened
 * directly, from a search engine or a shared link, there is nothing on the
 * site to go back to, so it says "Back to the home page" and goes there.
 *
 * The prerendered page cannot know which, so it starts as the home link and
 * changes on mount. A plain <a> rather than NuxtLink: RouterLink's own click
 * handler would navigate before this one could choose to go back instead.
 */
const props = defineProps<{ to: RouteLocationRaw }>()

const router = useRouter()
// With the trailing slash GitHub Pages serves the page at, like every
// NuxtLink (see experimental.defaults in nuxt.config.ts).
const href = computed(() => router.resolve(props.to).href.replace(/^([^?#]*?)\/?(?=[?#]|$)/, '$1/'))
const canGoBack = ref(false)
onMounted(() => {
  canGoBack.value = Boolean((window.history.state as { back?: unknown } | null)?.back)
})

function go(event: MouseEvent) {
  // A new tab or window was asked for: let the browser open the href.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  if (canGoBack.value) router.back()
  else router.push(props.to)
}
</script>

<template>
  <a class="section-back" :href="href" @click="go">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
    {{ canGoBack ? $t('nav.back') : $t('notFound.home') }}
  </a>
</template>
