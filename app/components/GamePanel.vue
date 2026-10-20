<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/**
 * `to` is the panel's own section page. With it, the arrow in the head links
 * there; without it — on the section page itself — there is nowhere further
 * to go and the arrow is left out. The arrow is a second way to the same
 * place as the panel's View more, so it is skipped by Tab and by screen
 * readers, which get the one labelled link at the foot of the panel.
 */
defineProps<{
  title?: string
  to?: RouteLocationRaw
}>()
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <span class="panel-icon"><slot name="icon" /></span>
      <h2>{{ title }}</h2>
      <span class="panel-tools">
        <slot name="actions" />
        <NuxtLink v-if="to" class="panel-arrow" :to="to" tabindex="-1" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </span>
    </div>
    <div class="panel-body"><slot /></div>
  </section>
</template>
