<script setup lang="ts">
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A listed server's numbers in its owner's account: this month's votes, its
 * place in the ranking, and the votes of each of the last 30 days as bars
 * (server_vote_days). One series, so no legend: the heading names it. Each
 * bar says its day and count on hover and to screen readers.
 */
const props = defineProps<{ supabase: SupabaseClient, serverId: string, votes: number, rank: number | null }>()
const { locale } = useI18n()

const days = ref<{ day: string, votes: number }[]>([])
onMounted(async () => {
  const { data } = await props.supabase.rpc('server_vote_days', { p_server: props.serverId })
  days.value = (data ?? []) as { day: string, votes: number }[]
})

const W = 300
const H = 64
const most = computed(() => Math.max(1, ...days.value.map((d) => d.votes)))
const step = computed(() => W / Math.max(1, days.value.length))
const dayLabel = (day: string) => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
const hovered = ref<number | null>(null)
</script>

<template>
  <div class="server-stats">
    <p class="server-stats-line">
      <span>{{ $t('account.stats.month', { n: votes }) }}</span>
      <span v-if="rank" class="server-stats-rank">{{ $t('account.stats.rank', { n: rank }) }}</span>
    </p>
    <div v-if="days.length" class="server-stats-chart">
      <span class="account-note">{{ $t('account.stats.days') }}</span>
      <svg :viewBox="`0 0 ${W} ${H + 2}`" preserveAspectRatio="none" role="img" :aria-label="$t('account.stats.days')" @mouseleave="hovered = null">
        <line x1="0" :y1="H + 1" :x2="W" :y2="H + 1" class="server-stats-base" />
        <g v-for="(d, i) in days" :key="d.day" @mouseenter="hovered = i">
          <!-- The whole column answers the pointer, not only the bar. -->
          <rect :x="i * step" y="0" :width="step" :height="H" fill="transparent" />
          <rect
            v-if="d.votes"
            class="server-stats-bar"
            :class="{ 'is-hovered': hovered === i }"
            :x="i * step + 1"
            :y="H - (d.votes / most) * H"
            :width="Math.max(1, step - 2)"
            :height="(d.votes / most) * H"
            rx="2"
          />
          <title>{{ $t('account.stats.dayVotes', { date: dayLabel(d.day), n: d.votes }) }}</title>
        </g>
      </svg>
      <p class="server-stats-tip" aria-hidden="true">
        {{ hovered !== null && days[hovered] ? $t('account.stats.dayVotes', { date: dayLabel(days[hovered]!.day), n: days[hovered]!.votes }) : `${dayLabel(days[0]!.day)} — ${dayLabel(days[days.length - 1]!.day)}` }}
      </p>
      <!-- The same, as a list, for screen readers. -->
      <ul class="sr-only">
        <li v-for="d in days" :key="d.day">{{ $t('account.stats.dayVotes', { date: dayLabel(d.day), n: d.votes }) }}</li>
      </ul>
    </div>
  </div>
</template>
