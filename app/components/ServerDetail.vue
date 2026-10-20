<script setup lang="ts">
import { chronicleShort } from '~/data/games'
import type { Server } from '~/data/servers'
import { bcp47 } from '~/i18n/locales'
import type { RouteLocationRaw } from 'vue-router'
import type { SectionId } from '~/data/sections'

/**
 * One server's own page: what it is, when it opens, how it stands, and the
 * way to its site. Below it, more servers of the same game, so the page is
 * never a dead end.
 *
 * `today` comes from the dashboard, which moves it from the build date to
 * the visitor's own date on mount — the same date that splits COMING SOON
 * from ALREADY STARTED, so the status here always agrees with the lists.
 */
const props = defineProps<{
  server: Server
  rank: number
  today: string
  /** The panel under the card, worked out by the dashboard. */
  others: {
    rows: { server: Server, rank?: number }[]
    origin: SectionId | null
    title: string
    end: 'votes' | 'date' | 'chronicle'
    link?: RouteLocationRaw
    /** Deliberate shuffles so far, for the button's half-turn. */
    turns: number
  }
}>()
defineEmits<{ shuffle: [] }>()

const { locale } = useI18n()
const { serverBadge, serverSubtitle, rateLabel, formatDayMonth } = useServerFormat()

const opened = computed(() => props.server.openDate <= props.today)

/**
 * Languages whose dates Intl cannot be trusted with in the browser: Chrome
 * ships no Armenian date data at all and printed "November 20, 2025", and for
 * Azerbaijani it has no month names and printed "2025 M11 20". These use the
 * site's own day-and-month, as in the lists, with the year after it. A fixed
 * list rather than a check at run time, so the prerendered page — built in
 * Node, which does have the data — and the browser always agree.
 */
const OWN_DATE_FORMAT = new Set(['hy', 'az'])

/**
 * The full date, year included, in the reader's own form: "20 November 2025",
 * "November 20, 2025", "2025年11月20日". The lists use a short day-and-month
 * to stay narrow; here there is room to say it properly. Plain "en" would
 * format the American way, and the site's English is British.
 */
function fullDate(iso: string) {
  if (OWN_DATE_FORMAT.has(locale.value)) return `${formatDayMonth(iso)} ${iso.slice(0, 4)}`
  const tag = locale.value === 'en' ? 'en-GB' : bcp47(locale.value)
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`))
}
</script>

<template>
  <article class="panel server-card" :class="opened ? 'accent-amber' : 'accent-blue'">
    <header class="server-head">
      <span class="game-logo server-logo">{{ serverBadge(server) }}</span>
      <div class="server-title">
        <h1>{{ server.name }}</h1>
        <p>{{ serverSubtitle(server) }}</p>
      </div>
      <span class="server-status" :class="opened ? 'is-started' : 'is-soon'">
        {{ $t(opened ? 'panels.started' : 'panels.soon') }}
      </span>
    </header>

    <dl class="server-facts">
      <div>
        <dt>{{ $t('filter.version') }}</dt>
        <dd :title="server.chronicle">{{ chronicleShort(server.game, server.chronicle) }}</dd>
      </div>
      <div>
        <dt>{{ $t('filter.rate') }}</dt>
        <dd>{{ rateLabel(server) || '—' }}</dd>
      </div>
      <div>
        <dt>{{ $t('server.opens') }}</dt>
        <dd>{{ fullDate(server.openDate) }}</dd>
      </div>
      <div>
        <dt>{{ $t('server.votes') }}</dt>
        <dd>
          <span class="server-votes">{{ server.votes }}</span>
          <small>{{ $t('server.rank', { rank }) }}</small>
        </dd>
      </div>
      <div>
        <dt>{{ $t('server.listed') }}</dt>
        <dd>{{ fullDate(server.listedAt) }}</dd>
      </div>
    </dl>

    <div class="server-actions">
      <a class="server-visit" :href="server.url" target="_blank" rel="noopener nofollow">
        {{ $t('server.visit') }}
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 4h6v6" />
          <path d="M20 4 10 14" />
          <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      </a>
    </div>
  </article>

  <GamePanel v-if="others.rows.length" class="server-others accent-violet" :title="others.title">
    <template v-if="others.origin" #icon><PanelIcon :id="others.origin" /></template>
    <template #actions>
      <ShuffleButton :turns="others.turns" @shuffle="$emit('shuffle')" />
    </template>
    <ServerRow
      v-for="row in others.rows"
      :key="row.server.id"
      :server="row.server"
      :rank="row.rank"
      :end="others.end"
      :origin="others.origin"
    />
    <PanelFooter v-if="others.link" :to="others.link" :title="others.title" />
  </GamePanel>
</template>
