<script setup lang="ts">
import { isSection } from '~/data/sections'
import { gameById } from '~/data/games'

/**
 * One segment under the language: a section — /top, /soon, /started, /new,
 * /all, one home panel's list in full — or a game — /lineage2, /wow… — the
 * home page with that game chosen. Anything else is the not-found page.
 */
definePageMeta({
  validate: (route) => {
    const id = route.params.section
    return isSection(id) || (typeof id === 'string' && !!gameById(id))
  }
})

const route = useRoute()
const section = computed(() => (isSection(route.params.section) ? route.params.section : undefined))
const game = computed(() => (section.value ? undefined : String(route.params.section)))
</script>

<template>
  <Dashboard :section="section" :game="game" />
</template>
