<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/** The way from a home panel to its full list. `title` names the panel for
 *  screen readers, which would otherwise hear five identical "View more". */
defineProps<{
  to: RouteLocationRaw
  title: string
}>()
</script>

<template>
  <NuxtLink class="panel-footer" :to="to">
    {{ $t('panels.viewMore') }}<span class="sr-only">: {{ title }}</span>
    <span class="panel-footer-arrow">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </span>
  </NuxtLink>
</template>
