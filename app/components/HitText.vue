<script setup lang="ts">
/**
 * Text with the search's matches marked, so the eye finds why a row is in
 * the list: type "dream" and the "DREAM" in LA2DREAM lights up. The same
 * case-insensitive substring test as the search itself (matchesSearch in
 * Dashboard.vue). Where lowercasing changes a string's length (a dotted
 * capital I), positions would not line up, and the text is shown unmarked.
 */
const props = defineProps<{ text: string }>()
const { query } = useDashboardState()

const parts = computed<{ s: string, hit: boolean }[]>(() => {
  const q = query.value.trim().toLowerCase()
  const text = props.text
  const lower = text.toLowerCase()
  if (!q || lower.length !== text.length) return [{ s: text, hit: false }]
  const out: { s: string, hit: boolean }[] = []
  let from = 0
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, at + q.length)) {
    if (at > from) out.push({ s: text.slice(from, at), hit: false })
    out.push({ s: text.slice(at, at + q.length), hit: true })
    from = at + q.length
  }
  if (from < text.length) out.push({ s: text.slice(from), hit: false })
  return out
})
</script>

<template>
  <template v-for="(p, i) in parts" :key="i"><mark v-if="p.hit" class="search-hit">{{ p.s }}</mark><template v-else>{{ p.s }}</template></template>
</template>
