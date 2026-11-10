<script setup lang="ts">
import { chronicleShort } from '~/data/games'
import { serverLanguageName } from '~/i18n/locales'
import { networkName, type ServerLink } from '~/data/networks'
import type { Server } from '~/data/servers'
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

const { t } = useI18n()
const { serverSubtitle, rateLabel } = useServerFormat()

const opened = computed(() => props.server.openDate <= props.today)

/** The vote box under the card, opened by the button (VoteBox). */
const voting = ref(false)
/** A vote cast just now, added to the count until the site is rebuilt. */
const justVoted = ref(0)
const votes = computed(() => props.server.votes + justVoted.value)

/** The language its players speak, in that language's own name. */
const languageName = computed(() => props.server.language === 'multi'
  ? t('server.multilingual')
  : props.server.language === 'intl'
    ? t('server.international')
    : props.server.language === 'other'
    ? props.server.languageText
    : serverLanguageName(props.server.language))

/** A network's name on its button: the brand's own, or the page's word for a forum or anything else. */
function linkLabel(link: ServerLink) {
  return networkName(link) ?? t(link.kind === 'forum' ? 'server.forum' : 'server.community')
}

/** The server in a few plain sentences (see useServerAbout). */
const { fullDate, aboutText } = useServerAbout()
const about = computed(() => aboutText(props.server, props.today, { rank: props.rank }))

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
      <ServerLogo class="server-logo" :server="server" />
      <div class="server-title">
        <h1>{{ server.name }}</h1>
        <!-- Where the server sits on the site, as its address reads:
             Lineage II › Interlude, each a link to its page. -->
        <p class="server-crumbs">
          <NuxtLink :to="localePath(`/${server.game}/`)">{{ serverSubtitle(server) }}</NuxtLink>
          <span aria-hidden="true"> › </span>
          <NuxtLink v-if="chronicleLink" :to="chronicleLink">{{ server.chronicle }}</NuxtLink>
          <span v-else>{{ server.chronicle }}</span>
        </p>
      </div>
      <span class="server-status" :class="opened ? 'is-started' : 'is-soon'">
        {{ $t(opened ? 'panels.started' : 'panels.soon') }}
      </span>
    </header>

    <p class="server-about">{{ about }}</p>
    <!-- The owner's own words, as written; YouTube links and pictures shown in place. -->
    <RichDescription v-if="server.description" class="server-description" :text="server.description" />

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
          <span class="server-votes">{{ votes }}</span>
          <small>{{ keepEnds($t('server.rank', { rank })) }}</small>
        </dd>
      </div>
      <div v-if="languageName">
        <dt>{{ keepTail($t('server.language')) }}</dt>
        <dd>{{ languageName }}</dd>
      </div>
      <div>
        <dt>{{ keepTail($t('server.listed')) }}</dt>
        <dd>{{ fullDate(server.listedAt) }}</dd>
      </div>
    </dl>

    <div class="server-actions">
      <button
        v-if="server.live"
        type="button"
        class="server-vote"
        :aria-expanded="voting"
        aria-controls="vote-box"
        @click="voting = !voting"
      >
        <svg class="vote-icon" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <path d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
        {{ $t('vote.open') }}
      </button>
      <a class="server-visit" :href="server.url" target="_blank" rel="noopener nofollow">
        {{ $t('server.visit') }}
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 4h6v6" />
          <path d="M20 4 10 14" />
          <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      </a>
      <!-- Its networks, when the owner gave them: Discord, Telegram… -->
      <a v-for="link in server.links ?? []" :key="link.url" class="server-community" :href="link.url" target="_blank" rel="noopener nofollow">
        <SocialIcon :kind="link.kind" />
        {{ linkLabel(link) }}
      </a>
    </div>
    <VoteBox v-if="voting" id="vote-box" :server="server" @voted="justVoted = 1" />
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
