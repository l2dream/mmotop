<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/**
 * View more, under a panel. Given `to`, it leads to the panel's full list
 * and points onward; without it, it is a button that loads more into the
 * panel itself and points down. The arrow says which before it is pressed.
 * `title` names the panel for screen readers, which would otherwise hear
 * five identical "View more".
 */
defineProps<{
  to?: RouteLocationRaw
  title: string
}>()
defineEmits<{ click: [] }>()
</script>

<template>
  <NuxtLink v-if="to" class="panel-footer" :to="to">
    {{ $t('panels.viewMore') }}<span class="sr-only">: {{ title }}</span>
    <span class="panel-footer-arrow">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </span>
  </NuxtLink>
  <button v-else type="button" class="panel-footer" @click="$emit('click')">
    {{ $t('panels.viewMore') }}<span class="sr-only">: {{ title }}</span>
    <span class="panel-footer-arrow is-down">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 9l7 7 7-7" />
      </svg>
    </span>
  </button>
</template>
