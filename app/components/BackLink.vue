<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { isSection } from '~/data/sections'
import { SERVERS } from '~/data/servers'

/**
 * The way back above a section or server page, named after where it leads.
 *
 * Arrived from elsewhere on the site it goes back in history, so the
 * visitor lands where they were — the same list, the same filters, the same
 * scroll position — and says where that is: "‹ TOP GAMES", "‹ LA2DREAM",
 * "‹ Back to the home page". A bare "Back" left them guessing. Opened
 * directly, from a search engine or a shared link, there is nothing on the
 * site to go back to, so it leads to the home page and says so.
 *
 * The prerendered page cannot know which, so it starts as the home link and
 * changes on mount. A plain <a> rather than NuxtLink: RouterLink's own click
 * handler would navigate before this one could choose to go back instead.
 */
const props = defineProps<{ to: RouteLocationRaw }>()

const router = useRouter()
const { t } = useI18n()
// With the trailing slash GitHub Pages serves the page at, like every
// NuxtLink (see experimental.defaults in nuxt.config.ts).
const href = computed(() => router.resolve(props.to).href.replace(/^([^?#]*?)\/?(?=[?#]|$)/, '$1/'))

/** Where history would take the visitor, if it is a page of this site. */
const backTo = ref<string | null>(null)
onMounted(() => {
  const back = (window.history.state as { back?: unknown } | null)?.back
  backTo.value = typeof back === 'string' ? back : null
})

const label = computed(() => {
  if (!backTo.value) return t('notFound.home')
  const { params } = router.resolve(backTo.value)
  if (isSection(params.section)) return t(`panels.${params.section}`)
  const server = SERVERS.find((s) => s.id === params.id)
  return server ? server.name : t('notFound.home')
})

function go(event: MouseEvent) {
  // A new tab or window was asked for: let the browser open the href.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  if (backTo.value) router.back()
  else router.push(props.to)
}
</script>

<template>
  <a class="section-back" :href="href" @click="go">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
    <span class="section-back-label">{{ label }}</span>
  </a>
</template>
