<script setup lang="ts">
import type { SectionId } from '~/data/sections'

/**
 * Each list's icon, drawn once here and used both on its home panel and on
 * its own section page. Only one list is on screen per page in the section
 * view, and each gradient id belongs to one icon, so the ids never collide.
 */
defineProps<{ id: SectionId }>()
</script>

<template>
  <svg v-if="id === 'top'" class="trophy-icon" viewBox="0 0 24 24" width="24" height="24">
    <defs>
      <linearGradient id="trophyGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFF1C2" />
        <stop offset="35%" stop-color="#FFCB4D" />
        <stop offset="75%" stop-color="#F5A623" />
        <stop offset="100%" stop-color="#D6820A" />
      </linearGradient>
      <linearGradient id="trophyBase" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#C97A3D" />
        <stop offset="100%" stop-color="#7A431E" />
      </linearGradient>
    </defs>
    <path d="M5 2h14v6a7 7 0 0 1-14 0V2z" fill="url(#trophyGold)" />
    <path
      d="M5 3C2 3 1 5 1 7.5S2 12 5 11.6"
      fill="none"
      stroke="url(#trophyGold)"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M19 3C22 3 23 5 23 7.5S22 12 19 11.6"
      fill="none"
      stroke="url(#trophyGold)"
      stroke-width="2"
      stroke-linecap="round"
    />
    <rect x="10.5" y="13" width="3" height="4" fill="url(#trophyBase)" />
    <path d="M8 17 L16 17 L18.5 20 L5.5 20 Z" fill="url(#trophyBase)" />
    <path
      d="M7.5 3.2C6.6 5 6.8 7 8 8.3"
      stroke="#FFFDF3"
      stroke-width="1.1"
      stroke-linecap="round"
      fill="none"
      opacity="0.55"
    />
  </svg>
  <svg v-else-if="id === 'soon'" class="clock-icon" viewBox="0 0 24 24" width="24" height="24">
    <defs>
      <linearGradient id="clockFace" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#CDEBFF" />
        <stop offset="45%" stop-color="#5EC2FF" />
        <stop offset="100%" stop-color="#2F7FE0" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="9" fill="url(#clockFace)" />
    <path
      d="M12 6.5v5.5l4 2.3"
      stroke="#0B2A55"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
    <path
      d="M8.3 4.2C6 5.6 4.6 8 4.3 10.7"
      stroke="#EAF6FF"
      stroke-width="1"
      stroke-linecap="round"
      fill="none"
      opacity="0.55"
    />
  </svg>
  <svg v-else-if="id === 'started'" class="bolt-icon" viewBox="0 0 24 24" width="24" height="24">
    <defs>
      <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFF3B0" />
        <stop offset="45%" stop-color="#FFD23F" />
        <stop offset="100%" stop-color="#F5850B" />
      </linearGradient>
    </defs>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="url(#boltGrad)" />
  </svg>
  <svg v-else-if="id === 'new'" class="sparkle-icon" viewBox="0 0 24 24" width="24" height="24">
    <defs>
      <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFC2F0" />
        <stop offset="50%" stop-color="#D06BFF" />
        <stop offset="100%" stop-color="#7C3AED" />
      </linearGradient>
    </defs>
    <path
      d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
      fill="url(#sparkleGrad)"
    />
  </svg>
  <svg v-else-if="id === 'all'" class="grid-icon" viewBox="0 0 24 24" width="24" height="24">
    <defs>
      <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#8FF5D6" />
        <stop offset="50%" stop-color="#10B981" />
        <stop offset="100%" stop-color="#0891B2" />
      </linearGradient>
    </defs>
    <rect x="4" y="4" width="7" height="7" rx="1.8" fill="url(#gridGrad)" />
    <rect x="13" y="4" width="7" height="7" rx="1.8" fill="url(#gridGrad)" />
    <rect x="4" y="13" width="7" height="7" rx="1.8" fill="url(#gridGrad)" />
    <rect x="13" y="13" width="7" height="7" rx="1.8" fill="url(#gridGrad)" />
  </svg>
</template>
