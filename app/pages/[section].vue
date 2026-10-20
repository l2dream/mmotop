<script setup lang="ts">
import { isSection } from '~/data/sections'

/**
 * /top, /soon, /started, /new, /all — one home panel's list in full. Any
 * other single-segment address is not a section and falls through to the
 * not-found page.
 */
definePageMeta({
  validate: (route) => isSection(route.params.section)
})

const route = useRoute()
const section = computed(() => (isSection(route.params.section) ? route.params.section : undefined))
</script>

<template>
  <Dashboard :section="section" />
</template>
