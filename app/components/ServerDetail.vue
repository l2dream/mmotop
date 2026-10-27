<script setup lang="ts">
import { chronicleShort } from '~/data/games'
import type { Server } from '~/data/servers'
import { bcp47 } from '~/i18n/locales'
import type { SectionId } from '~/data/sections'
import { chronicleLanding, rateLanding } from '~/data/landing'

/**
 * One server's own page: what it is, when it opens, how it stands, and the
 * way to its site. Below it, recommendations — similar servers, the same
 * game first — so the page is never a dead end. View more loads the next
 * ones into the panel itself.
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
    /** The list the visitor came through, kept by the rows here. */
    origin: SectionId | null
    end: 'votes' | 'date' | 'chronicle'
    /** Whether there are more to load below these. */
    more: boolean
    /** Deliberate shuffles so far, for the button's half-turn. */
    turns: number
  }
}>()
defineEmits<{ shuffle: [], more: [] }>()

const { locale } = useI18n()
const { serverBadge, serverSubtitle, rateLabel, formatDayMonth } = useServerFormat()

const opened = computed(() => props.server.openDate <= props.today)

// The chronicle and the rate lead to their own pages — every server on
// /lineage2/interlude/ or /lineage2/x50/ — which is also how a crawler finds
// those pages.
const localePath = useLocalePath()
const chronicleLink = computed(() => {
  const l = chronicleLanding(props.server.game, props.server.chronicle)
  return l && localePath(`/${l.game}/${l.slug}/`)
})
const rateLink = computed(() => {
  const l = props.server.rate == null ? undefined : rateLanding(props.server.game, props.server.rate)
  return l && localePath(`/${l.game}/${l.slug}/`)
})

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
  if (OWN_DATE_FORMAT.has(locale.value)) return `${keep(formatDayMonth(iso))} ${iso.slice(0, 4)}`
  const tag = locale.value === 'en' ? 'en-GB' : bcp47(locale.value)
  const parts = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .formatToParts(new Date(`${iso}T00:00:00Z`))
  // A narrow card may break the date in one place only: between the day and
  // month and the year, so "12 January" stays together over "2025" rather
  // than "12" over "January 2025", and "20 ноября / 2025 г." never leaves
  // the "г." alone. Every other space is held. Where the year comes first
  // (2025년 1월 12일) the break is after it instead. Words that go with the
  // year go with it too: "12 de enero / de 2025", "2025 m. / sausio 12 d.".
  const year = parts.findIndex((p) => p.type === 'year')
  const before = year > 0
  const free = before ? year - 1 : year + 1
  return parts.map((p, i) => {
    if (i !== free) return keep(p.value)
    const at = before ? p.value.indexOf(' ') : p.value.lastIndexOf(' ')
    return at < 0 ? p.value : keep(p.value.slice(0, at)) + ' ' + keep(p.value.slice(at + 1))
  }).join('')
}

/** Spaces that do not break. */
const keep = (text: string) => text.replace(/ /g, '\u00a0')

/** The last two words held together, so a label that wraps in its narrow
 *  box reads "VOTES / THIS MONTH", not "VOTES THIS / MONTH". */
const keepTail = (text: string) => text.replace(/ (?=\S+$)/, '\u00a0')
/** As keepTail, and a short first word (the place: "2 vieta reitinge") kept
 *  with the next, so the number never stands alone either. */
const keepEnds = (text: string) => keepTail(text).replace(/^(\S{1,3}) /, '$1\u00a0')
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
        <dt>{{ keepTail($t('filter.version')) }}</dt>
        <dd :title="server.chronicle">
          <NuxtLink v-if="chronicleLink" class="server-fact-link" :to="chronicleLink">{{ chronicleShort(server.game, server.chronicle) }}</NuxtLink>
          <template v-else>{{ chronicleShort(server.game, server.chronicle) }}</template>
        </dd>
      </div>
      <div>
        <dt>{{ keepTail($t('filter.rate')) }}</dt>
        <dd>
          <NuxtLink v-if="rateLink" class="server-fact-link" :to="rateLink">{{ rateLabel(server) }}</NuxtLink>
          <template v-else>{{ rateLabel(server) || '—' }}</template>
        </dd>
      </div>
      <div>
        <dt>{{ keepTail($t('server.opens')) }}</dt>
        <dd>{{ fullDate(server.openDate) }}</dd>
      </div>
      <div>
        <dt>{{ keepTail($t('server.votes')) }}</dt>
        <dd>
          <span class="server-votes">{{ server.votes }}</span>
          <small>{{ keepEnds($t('server.rank', { rank })) }}</small>
        </dd>
      </div>
      <div>
        <dt>{{ keepTail($t('server.listed')) }}</dt>
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

  <GamePanel v-if="others.rows.length" class="server-others accent-violet" :title="$t('server.recommended')">
    <template #icon>
      <svg class="thumb-icon" viewBox="0 0 24 24" width="24" height="24">
        <defs>
          <linearGradient id="thumbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#E6D2FF" />
            <stop offset="50%" stop-color="#A66BFF" />
            <stop offset="100%" stop-color="#6D28D9" />
          </linearGradient>
        </defs>
        <path d="M2 10.5A1.5 1.5 0 0 1 3.5 9H6v12H3.5A1.5 1.5 0 0 1 2 19.5z" fill="url(#thumbGrad)" />
        <path d="M8 9.6 12.4 2.8a1.9 1.9 0 0 1 3.4 1.5L15 9h5.2a2.3 2.3 0 0 1 2.2 2.8l-1.9 7.9A2.4 2.4 0 0 1 18.2 21H8z" fill="url(#thumbGrad)" />
        <path
          d="M10.2 10.3 13.6 5"
          stroke="#F3E8FF"
          stroke-width="1.1"
          stroke-linecap="round"
          opacity="0.6"
        />
      </svg>
    </template>
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
    <PanelFooter v-if="others.more" :title="$t('server.recommended')" @click="$emit('more')" />
  </GamePanel>
</template>
