<script setup lang="ts">
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Votes, for a moderator: the servers whose votes were sent to Turnstile most
 * over the last day, and for a chosen server its votes hour by hour over the
 * last three days (admin_vote_hours) — counted, annulled, and from how many
 * networks. A period of votes that looks bought is annulled
 * (admin_annul_votes): it stops counting in the ranking; an annulment can be
 * undone. Russian only, like the rest of moderation.
 */
const props = defineProps<{ supabase: SupabaseClient }>()

interface Hour { hour: string, votes: number, annulled: number, nets: number }
interface Suspect { server_id: string, name: string, checks: number, reasons: Record<string, number> }
interface Annulment { id: number, from_at: string, to_at: string, votes: number, reason: string | null, created_at: string, by_name: string | null }

const REASON: Record<string, string> = {
  datacenter: 'дата-центр / VPN',
  subnet: 'одна подсеть',
  burst: 'наплыв голосов',
  spread: 'один адрес — много серверов',
  other: 'прочее'
}

const servers = ref<{ id: string, name: string }[]>([])
const suspects = ref<Suspect[]>([])
const serverId = ref('')
const hours = ref<Hour[]>([])
const annulments = ref<Annulment[]>([])
const loading = ref(false)

onMounted(async () => {
  const [{ data: list }, { data: sus }] = await Promise.all([
    props.supabase.from('servers').select('id, name').eq('status', 'approved').order('name'),
    props.supabase.rpc('admin_vote_suspects')
  ])
  servers.value = (list ?? []) as typeof servers.value
  suspects.value = (sus ?? []) as Suspect[]
})

async function load() {
  if (!serverId.value) {
    hours.value = []
    annulments.value = []
    return
  }
  loading.value = true
  const [{ data: h }, { data: a }] = await Promise.all([
    props.supabase.rpc('admin_vote_hours', { p_server: serverId.value, p_hours: 72 }),
    props.supabase.rpc('admin_vote_annulments', { p_server: serverId.value })
  ])
  loading.value = false
  hours.value = (h ?? []) as Hour[]
  annulments.value = (a ?? []) as Annulment[]
}
watch(serverId, () => {
  message.value = ''
  load()
})

// The chart: counted votes in violet, annulled ones grey on top.
const W = 600
const H = 90
const most = computed(() => Math.max(1, ...hours.value.map((h) => h.votes + h.annulled)))
const step = computed(() => W / Math.max(1, hours.value.length))
const hovered = ref<number | null>(null)
const fmt = (iso: string) => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const hourLine = (h: Hour) => `${fmt(h.hour)}: ${h.votes} голос., подсетей ${h.nets}${h.annulled ? `, аннулировано ${h.annulled}` : ''}`
const total = computed(() => hours.value.reduce((n, h) => n + h.votes, 0))

// The period to annul, in the moderator's local time; a bar click fills in its hour.
const fromAt = ref('')
const toAt = ref('')
const reason = ref('')
const busy = ref(false)
const message = ref('')
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
function pickHour(h: Hour) {
  const start = new Date(h.hour)
  fromAt.value = local(start)
  toAt.value = local(new Date(start.getTime() + 3600_000))
}

async function annul() {
  if (!fromAt.value || !toAt.value || busy.value) return
  const from = new Date(fromAt.value)
  const to = new Date(toAt.value)
  if (!(to > from)) {
    message.value = 'Конец периода должен быть позже начала.'
    return
  }
  const name = servers.value.find((s) => s.id === serverId.value)?.name ?? serverId.value
  if (!confirm(`Аннулировать голоса за «${name}» с ${fmt(from.toISOString())} по ${fmt(to.toISOString())}?`)) return
  busy.value = true
  const { data, error } = await props.supabase.rpc('admin_annul_votes', {
    p_server: serverId.value, p_from: from.toISOString(), p_to: to.toISOString(), p_reason: reason.value
  })
  busy.value = false
  message.value = error ? 'Не получилось.' : data ? `Аннулировано голосов: ${data}.` : 'За этот период голосов нет.'
  if (!error) {
    reason.value = ''
    await load()
  }
}

async function restore(a: Annulment) {
  if (!confirm(`Вернуть ${a.votes} голос.? Они снова будут считаться.`)) return
  const { error } = await props.supabase.rpc('admin_restore_votes', { p_annulment: a.id })
  message.value = error ? 'Не получилось.' : 'Голоса возвращены.'
  if (!error) await load()
}
</script>

<template>
  <section class="admin-queue admin-votes">
    <h3 class="account-heading">Голоса</h3>

    <div v-if="suspects.length" class="admin-votes-suspects">
      <p class="account-note">Чаще всего отправлялись на Turnstile за сутки:</p>
      <ul>
        <li v-for="s in suspects" :key="s.server_id">
          <button type="button" class="account-link" @click="serverId = s.server_id">{{ s.name }}</button>
          <span class="account-note">
            — {{ s.checks }} ({{ Object.entries(s.reasons).map(([k, n]) => `${REASON[k] ?? k}: ${n}`).join(', ') }})
          </span>
        </li>
      </ul>
    </div>
    <p v-else class="account-note">За сутки подозрительных голосов не было.</p>

    <label class="account-field">
      <span>Сервер</span>
      <select v-model="serverId">
        <option value="">— выберите —</option>
        <option v-for="s in servers" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
    </label>

    <template v-if="serverId">
      <p v-if="loading && !hours.length" class="account-note" role="status">Загрузка…</p>
      <div v-else-if="hours.length" class="server-stats-chart">
        <span class="account-note">По часам за 3 дня: {{ total }} голос. Нажмите на час, чтобы выбрать его для аннулирования.</span>
        <svg :viewBox="`0 0 ${W} ${H + 2}`" preserveAspectRatio="none" role="img" aria-label="Голоса по часам" @mouseleave="hovered = null">
          <line x1="0" :y1="H + 1" :x2="W" :y2="H + 1" class="server-stats-base" />
          <g v-for="(h, i) in hours" :key="h.hour" class="admin-votes-hour" @mouseenter="hovered = i" @click="pickHour(h)">
            <rect :x="i * step" y="0" :width="step" :height="H" fill="transparent" />
            <rect
              v-if="h.votes"
              class="server-stats-bar"
              :class="{ 'is-hovered': hovered === i }"
              :x="i * step + .5"
              :y="H - (h.votes / most) * H"
              :width="Math.max(1, step - 1)"
              :height="(h.votes / most) * H"
            />
            <rect
              v-if="h.annulled"
              class="admin-votes-annulled"
              :x="i * step + .5"
              :y="H - ((h.votes + h.annulled) / most) * H"
              :width="Math.max(1, step - 1)"
              :height="(h.annulled / most) * H"
            />
            <title>{{ hourLine(h) }}</title>
          </g>
        </svg>
        <p class="server-stats-tip" aria-hidden="true">
          {{ hovered !== null && hours[hovered] ? hourLine(hours[hovered]!) : `${fmt(hours[0]!.hour)} — ${fmt(hours[hours.length - 1]!.hour)}` }}
        </p>
      </div>

      <div class="admin-votes-annul">
        <label class="account-field">
          <span>С</span>
          <input v-model="fromAt" type="datetime-local">
        </label>
        <label class="account-field">
          <span>По</span>
          <input v-model="toAt" type="datetime-local">
        </label>
        <label class="account-field admin-votes-reason">
          <span>Причина <small class="account-optional">(необязательно)</small></span>
          <input v-model="reason" type="text" maxlength="500">
        </label>
        <button type="button" class="account-button" :disabled="busy || !fromAt || !toAt" @click="annul">Аннулировать голоса</button>
      </div>
      <p v-if="message" class="account-note" role="status">{{ message }}</p>

      <div v-if="annulments.length">
        <p class="account-note">Аннулировано раньше:</p>
        <ul class="admin-votes-list">
          <li v-for="a in annulments" :key="a.id">
            <span>{{ fmt(a.from_at) }} — {{ fmt(a.to_at) }}: <b>{{ a.votes }}</b><template v-if="a.reason"> · {{ a.reason }}</template><template v-if="a.by_name"> · {{ a.by_name }}</template></span>
            <button type="button" class="account-link" @click="restore(a)">Вернуть</button>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
