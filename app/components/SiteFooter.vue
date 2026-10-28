<script setup lang="ts">
import { GAMES } from '~/data/games'
import { LANDINGS, indexable, landingCount } from '~/data/landing'

/**
 * The foot of every page, kept to one quiet line: the chronicle and rate
 * pages with the most servers, then the copyright. The games and the lists
 * are already a click away in the header and the panels; these pages are
 * not, and a crawler would otherwise reach them only through the sitemap
 * and the server pages.
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
// Only pages search engines are offered (see indexable): the footer is
// there for them as much as for visitors.
const popular = computed(() => LANDINGS
  .filter(indexable)
  .map((l) => ({ l, n: landingCount(l) }))
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
    <nav class="footer-popular" :aria-label="$t('footer.popular')">
      <span class="footer-popular-label">{{ $t('footer.popular') }}:</span>
      <NuxtLink v-for="p in popular" :key="p.to" :to="p.to">{{ p.label }}</NuxtLink>
    </nav>
    <span class="site-footer-copy" dir="ltr">© {{ year }} MMOTOP</span>
  </footer>
</template>
