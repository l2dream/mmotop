<script setup lang="ts">
import { GAMES } from '~/data/games'
import { SERVERS } from '~/data/servers'
import { SECTIONS } from '~/data/sections'
import { LANDINGS } from '~/data/landing'

/**
 * The foot of every page: the games, the lists, and the chronicle and rate
 * pages with the most servers, each one link away from anywhere on the site
 * — for a visitor who has scrolled to the bottom, and for a crawler, which
 * otherwise reaches the landing pages only through the sitemap.
 *
 * Paths end in a slash, as the pages are published: without it GitHub Pages
 * answers with a redirect first.
 *
 * The year follows the same build-year-then-browser rule as the date labels,
 * so the prerendered page is already right.
 */
defineProps<{ year: number }>()

const localePath = useLocalePath()

const POPULAR = 8
const count = (game: string, test: (s: (typeof SERVERS)[number]) => boolean) =>
  SERVERS.filter((s) => s.game === game && test(s)).length
const popular = computed(() => LANDINGS
  .map((l) => ({
    l,
    n: l.chronicle ? count(l.game, (s) => s.chronicle === l.chronicle) : count(l.game, (s) => s.rate === l.rate)
  }))
  // Most servers first; among equals chronicles before rates, then the games
  // in their own order — a sort is stable, and LANDINGS is in that order.
  .sort((a, b) => b.n - a.n || Number(!!b.l.chronicle) - Number(!!a.l.chronicle))
  .slice(0, POPULAR)
  .map(({ l }) => ({
    to: localePath(`/${l.game}/${l.slug}/`),
    label: `${GAMES.find((g) => g.id === l.game)!.name} ${l.chronicle ?? `x${l.rate}`}`
  })))
</script>

<template>
  <footer class="site-footer">
    <nav class="footer-cols" :aria-label="$t('footer.label')">
      <div class="footer-col">
        <h2>{{ $t('footer.games') }}</h2>
        <ul>
          <li v-for="g in GAMES" :key="g.id"><NuxtLink :to="localePath(`/${g.id}/`)">{{ g.name }}</NuxtLink></li>
        </ul>
      </div>
      <div class="footer-col">
        <h2>{{ $t('footer.lists') }}</h2>
        <ul>
          <li v-for="id in SECTIONS" :key="id"><NuxtLink :to="localePath(`/${id}/`)">{{ $t(`footer.${id}`) }}</NuxtLink></li>
        </ul>
      </div>
      <div class="footer-col">
        <h2>{{ $t('footer.popular') }}</h2>
        <ul>
          <li v-for="p in popular" :key="p.to"><NuxtLink :to="p.to">{{ p.label }}</NuxtLink></li>
        </ul>
      </div>
    </nav>
    <div class="footer-base">
      <NuxtLink class="brand footer-logo" :to="localePath('/')" :aria-label="$t('nav.home')">MMOTOP</NuxtLink>
      <span class="site-footer-copy" dir="ltr">© {{ year }} MMOTOP</span>
    </div>
  </footer>
</template>
