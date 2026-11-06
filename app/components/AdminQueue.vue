<script setup lang="ts">
import type { SupabaseClient } from '@supabase/supabase-js'
import { GAMES, RATE_WORDS, gameById, type CatalogEntry } from '~/data/games'
import { SERVER_LANGUAGES, serverLanguageName } from '~/i18n/locales'
import { serverIdFrom } from '~/utils/serverId'
import { serverPath } from '~/data/servers'
import { NETWORKS } from '~/data/networks'

/**
 * Moderation, in the account page of an admin: the servers waiting for a
 * decision, or every server, with approve / reject / hide. The database lets
 * only an admin do this (the "servers: admin moderates" policy); this is just
 * the buttons. Approval stamps the listing date (servers_guard).
 *
 * Russian only for now: the one admin reads Russian, and the strings live
 * here rather than in twenty-six message files.
 */

type Status = 'pending' | 'approved' | 'rejected' | 'hidden'

interface QueueServer {
  id: string
  name: string
  game: string
  requested_game: string | null
  chronicle: string
  rate: number | null
  rate_text: string | null
  language: string | null
  language_text: string | null
  links: { kind: string, url: string, name?: string }[] | null
  url: string
  open_date: string
  description: string | null
  logo: string | null
  logo_pending: string | null
  reward: boolean
  moderation_note: string | null
  status: Status
  created_at: string
}

const props = defineProps<{ supabase: SupabaseClient }>()

const STATUS_LABEL: Record<Status, string> = {
  pending: 'На проверке',
  approved: 'Опубликован',
  rejected: 'Отклонён',
  hidden: 'Скрыт'
}

const showAll = ref(false)
const rows = ref<QueueServer[]>([])
const loading = ref(false)
const error = ref('')
const busyId = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  let query = props.supabase
    .from('servers')
    .select('id, name, game, requested_game, chronicle, rate, rate_text, language, language_text, links, url, open_date, description, logo, logo_pending, reward, moderation_note, status, created_at')
    .order('created_at', { ascending: false })
  // Waiting: a server to look at, or only the new logo of one already listed.
  if (!showAll.value) query = query.or('status.eq.pending,logo_pending.not.is.null')
  const { data, error: failed } = await query
  loading.value = false
  if (failed) error.value = 'Не удалось загрузить список.'
  else {
    rows.value = data as QueueServer[]
    for (const s of rows.value) {
      fixes[s.id] = {
        game: s.game === 'other' ? '' : s.game,
        gameName: s.requested_game ?? '',
        gameId: s.requested_game ? serverIdFrom(s.requested_game) : '',
        chronicle: s.chronicle,
        rateText: s.rate_text ?? '',
        langCode: '',
        langName: s.language_text ?? '',
        networks: (s.links ?? []).map((l) => ({ choice: '', name: l.name ?? '', key: l.name ? networkKey(l.name) : '' }))
      }
    }
  }
}

watch(showAll, load)
onMounted(() => {
  load()
  loadCatalog()
  loadChecks()
})

/**
 * Suspicious votes over the last day (admin_vote_checks): how many the vote
 * function sent to Turnstile, and how many came back with it passed. Rising
 * numbers mean someone is inflating votes; nought all along means the limits
 * leave ordinary players alone.
 */
const checks = ref<{ need_captcha: number, captcha_passed: number } | null>(null)
async function loadChecks() {
  const { data } = await props.supabase.rpc('admin_vote_checks')
  checks.value = data as typeof checks.value
}

/*
 * What an owner asked for that the site's lists do not have — a game, a
 * version, a word in place of rates, a language — the moderator names here
 * (or matches to one the site has), and "Apply" adds it to the catalog table
 * and moves the server onto it. The lists on the site pick the new entry up
 * with the next deploy (scripts/fetch-servers.mjs).
 *
 * The lists as the site was built, plus whatever was added since.
 */
const catalog = ref<CatalogEntry[]>([])
async function loadCatalog() {
  const { data } = await props.supabase.from('catalog').select('kind, game, key, name, badge')
  catalog.value = (data ?? []) as CatalogEntry[]
}
const added = (kind: CatalogEntry['kind']) => catalog.value.filter((e) => e.kind === kind)
const gameList = computed(() => [
  ...GAMES.map((g) => ({ id: g.id, name: g.name })),
  ...added('game').filter((e) => !gameById(e.key)).map((e) => ({ id: e.key, name: e.name }))
])
function versionsOf(game: string) {
  return [...new Set([
    ...(gameById(game)?.chronicles.map((c) => c.name) ?? []),
    ...added('chronicle').filter((e) => e.game === game).map((e) => e.key)
  ])]
}
const rateWords = computed(() => [...new Set([...RATE_WORDS, ...added('rate_word').map((e) => e.key)])])
const languages = computed(() => [
  ...SERVER_LANGUAGES,
  ...added('language').filter((e) => !SERVER_LANGUAGES.some((l) => l.code === e.key)).map((e) => ({ code: e.key, name: e.name }))
])

interface Fix {
  /** The game to move the server to; '' for a new one, named below. */
  game: string
  gameName: string
  gameId: string
  chronicle: string
  rateText: string
  langCode: string
  langName: string
  /** Per link, for an "Other network…" one: an existing network ('' for a new one, named below). */
  networks: { choice: string, name: string, key: string }[]
}

/** A new network's key, from its name: "Одноклассники" → "odnoklassniki". */
const networkKey = (name: string) => serverIdFrom(name).slice(0, 24).replace(/-+$/, '')
const networkList = computed(() => [
  ...NETWORKS.filter((n) => n.name).map((n) => ({ kind: n.kind, name: n.name! })),
  ...added('network').filter((e) => !NETWORKS.some((n) => n.kind === e.key)).map((e) => ({ kind: e.key, name: e.name }))
])
/** The links an owner named a network of their own for, with their index. */
const ownLinks = (s: QueueServer) => (s.links ?? []).map((l, i) => ({ ...l, i })).filter((l) => l.kind === 'other' && !!l.name)
const fixes = reactive<Record<string, Fix>>({})

const targetGame = (f: Fix) => f.game || f.gameId.trim()
const needsGame = (s: QueueServer) => s.game === 'other'
const needsVersion = (s: QueueServer) => s.game === 'other' || !versionsOf(s.game).includes(s.chronicle)
const needsRate = (s: QueueServer) => s.rate == null && !!s.rate_text && !rateWords.value.includes(s.rate_text)
const needsLanguage = (s: QueueServer) => s.language === 'other'
/** What the owner asked for that the lists lack, as "game Dekaron". */
function missing(s: QueueServer): [string, string][] {
  return [
    ...(needsGame(s) ? [['игра', s.requested_game ?? ''] as [string, string]] : []),
    ...(needsVersion(s) ? [['версия', s.chronicle] as [string, string]] : []),
    ...(needsRate(s) ? [['слово вместо рейтов', s.rate_text ?? ''] as [string, string]] : []),
    ...(needsLanguage(s) ? [['язык', s.language_text ?? ''] as [string, string]] : []),
    ...ownLinks(s).map((l) => ['сеть', l.name ?? ''] as [string, string])
  ]
}
const needsNetwork = (s: QueueServer) => ownLinks(s).length > 0
const needsFix = (s: QueueServer) => needsGame(s) || needsVersion(s) || needsRate(s) || needsLanguage(s) || needsNetwork(s)

async function apply(s: QueueServer) {
  const f = fixes[s.id]!
  const game = targetGame(f)
  const chronicle = f.chronicle.trim()
  const word = f.rateText.trim()
  const code = f.langCode.trim().toLowerCase()
  if (!game || !chronicle || (needsGame(s) && !f.game && !f.gameName.trim()) || (needsRate(s) && !word)
    || (needsLanguage(s) && (!/^[a-z]{2}$/.test(code) || (!languages.value.some((l) => l.code === code) && !f.langName.trim())))) {
    error.value = 'Заполните поля решения.'
    return
  }
  const entries: Omit<CatalogEntry, 'badge'>[] = []
  if (needsGame(s) && !f.game) entries.push({ kind: 'game', game: '', key: game, name: f.gameName.trim() })
  if (!versionsOf(game).includes(chronicle)) entries.push({ kind: 'chronicle', game, key: chronicle, name: chronicle })
  if (needsRate(s) && !rateWords.value.includes(word)) entries.push({ kind: 'rate_word', game: '', key: word, name: word })
  if (needsLanguage(s) && !languages.value.some((l) => l.code === code)) entries.push({ kind: 'language', game: '', key: code, name: f.langName.trim() })
  // Each named network becomes the link's kind: one the site has, or a new one.
  const links = (s.links ?? []).map((l) => ({ kind: l.kind, url: l.url, ...(l.name ? { name: l.name } : {}) }))
  for (const l of ownLinks(s)) {
    const n = f.networks[l.i]!
    const kind = n.choice || n.key.trim()
    if (!kind || (!n.choice && !n.name.trim())) {
      error.value = 'Заполните поля решения.'
      return
    }
    if (!n.choice && !networkList.value.some((x) => x.kind === kind)) entries.push({ kind: 'network', game: '', key: kind, name: n.name.trim() })
    links[l.i] = { kind, url: l.url }
  }

  busyId.value = s.id
  error.value = ''
  for (const e of entries) {
    const { error: failed } = await props.supabase.from('catalog').insert(e)
    // 23505: added already, by this or an earlier decision.
    if (failed && failed.code !== '23505') {
      busyId.value = null
      error.value = failed.code === '23514' && e.kind === 'game'
        ? `Адрес игры «${e.key}» не подходит: латиница, цифры и дефис, от 3 символов, не занятый сайтом (top, ru, account…).`
        : failed.code === '23514' && e.kind === 'network'
        ? `Код сети «${e.key}» не подходит: латиница, цифры и дефис.`
        : `Не удалось добавить «${e.name}».`
      return
    }
  }
  const { error: failed } = await props.supabase.from('servers').update({
    game,
    requested_game: null,
    chronicle,
    ...(needsRate(s) ? { rate_text: word } : {}),
    ...(needsLanguage(s) ? { language: code, language_text: null } : {}),
    ...(needsNetwork(s) ? { links } : {})
  }).eq('id', s.id)
  busyId.value = null
  if (failed) error.value = `Не удалось изменить ${s.name}.`
  await loadCatalog()
  load()
}

/**
 * Rejecting or hiding asks for a reason first (optional), which the owner
 * sees in their account and in the message they get (notify-owner).
 */
const asking = ref<{ id: string, status: Status } | null>(null)
const note = ref('')
function decide(row: QueueServer, status: Status) {
  if (status === 'approved') {
    setStatus(row, status)
    return
  }
  asking.value = { id: row.id, status }
  note.value = row.moderation_note ?? ''
}

async function setStatus(row: QueueServer, status: Status, reason?: string) {
  busyId.value = row.id
  error.value = ''
  const { error: failed } = await props.supabase.from('servers')
    .update(status === 'approved' ? { status } : { status, moderation_note: reason?.trim() || null }).eq('id', row.id)
  asking.value = null
  busyId.value = null
  if (failed) {
    error.value = failed.code === '23514' && row.game === 'other'
      ? `Сначала нужно добавить на сайт игру «${row.requested_game}».`
      : `Не удалось изменить ${row.name}.`
  }
  else load()
}

/** A listed server's new logo: into place, or dropped (the old one stays). */
async function decideLogo(row: QueueServer, accept: boolean) {
  busyId.value = row.id
  error.value = ''
  const { error: failed } = await props.supabase.from('servers')
    .update(accept ? { logo: row.logo_pending, logo_pending: null } : { logo_pending: null })
    .eq('id', row.id)
  busyId.value = null
  if (failed) error.value = `Не удалось изменить ${row.name}.`
  else load()
}

/**
 * A server's reward notifications (postback_log), opened from its row: to look
 * into "the reward never came". The address and secret key are not shown —
 * they stay the owner's.
 */
const openLog = ref<string | null>(null)
const logRows = ref<{ id: number, nickname: string, test: boolean, status: number, attempt: number, sent_at: string }[]>([])
const logLoading = ref(false)
async function toggleLog(row: QueueServer) {
  if (openLog.value === row.id) {
    openLog.value = null
    return
  }
  openLog.value = row.id
  logRows.value = []
  logLoading.value = true
  const { data } = await props.supabase.from('postback_log').select('id, nickname, test, status, attempt, sent_at')
    .eq('server_id', row.id).order('sent_at', { ascending: false }).limit(30)
  logLoading.value = false
  if (openLog.value === row.id) logRows.value = data ?? []
}
const logTime = (at: string) => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(at))

const ACTIONS: { status: Status, label: string }[] = [
  { status: 'approved', label: 'Одобрить' },
  { status: 'rejected', label: 'Отклонить' },
  { status: 'hidden', label: 'Скрыть' }
]
</script>

<template>
  <section class="admin-queue">
    <div class="account-who">
      <h3 class="account-heading">Модерация</h3>
      <button type="button" class="account-link" @click="showAll = !showAll">
        {{ showAll ? 'Только на проверке' : 'Показать все' }}
      </button>
    </div>

    <p v-if="checks" class="account-note">
      Подозрительных голосов за сутки: <b>{{ checks.need_captcha }}</b> (прошли Turnstile: <b>{{ checks.captcha_passed }}</b>)
    </p>
    <p v-if="loading && !rows.length" class="account-note" role="status">Загрузка…</p>
    <p v-else-if="!rows.length" class="account-note">{{ showAll ? 'Серверов пока нет.' : 'Ничего не ждёт проверки.' }}</p>
    <ul v-else class="account-servers">
      <li v-for="s in rows" :key="s.id" class="account-server">
        <div class="account-server-main">
          <span class="account-strong"><img v-if="s.logo" class="admin-logo" :src="s.logo" alt="" width="24" height="24">{{ s.name }}</span>
          <span class="account-note">
            {{ gameById(s.game)?.name ?? s.requested_game ?? s.game }} · {{ s.chronicle }}<template v-if="s.rate != null"> · x{{ s.rate }}</template><template v-else-if="s.rate_text"> · {{ s.rate_text }}</template> · {{ s.open_date }}
          </span>
          <a class="account-note admin-url" :href="s.url" target="_blank" rel="noopener nofollow" dir="ltr">{{ s.url }}</a>
          <a v-for="l in s.links ?? []" :key="l.url" class="account-note admin-url" :href="l.url" target="_blank" rel="noopener nofollow" dir="ltr">{{ l.kind }}: {{ l.url }}</a>
          <span v-if="s.language" class="account-note">Язык: {{ s.language === 'multi' ? 'несколько' : s.language === 'intl' ? 'интернациональный' : s.language === 'other' ? `${s.language_text} (свой)` : serverLanguageName(s.language) ?? s.language }}</span>
          <span v-if="s.game !== 'other'" class="account-note" dir="ltr">{{ serverPath(s) }}/</span>
          <span class="account-note">Награда за голос: {{ s.reward ? 'включена' : 'выключена' }}</span>
        </div>
        <span class="account-status" :class="`status-${s.status}`">{{ STATUS_LABEL[s.status] }}</span>
        <!-- Something the site's lists do not have: the moderator names it
             or picks one the site has, and Apply adds it and moves the server
             onto it. A new game has to be applied before approval. -->
        <div v-if="needsFix(s) && fixes[s.id]" class="admin-description admin-new-game admin-fix">
          <p class="admin-fix-title">
            Нет в списках сайта:
            <template v-for="(item, i) in missing(s)" :key="item[0]">{{ i ? ', ' : ' ' }}{{ item[0] }} <b>{{ item[1] }}</b></template>.
          </p>
          <template v-if="needsGame(s)">
            <label class="account-field">
              <span>Игра</span>
              <select v-model="fixes[s.id]!.game">
                <option value="">Новая игра</option>
                <option v-for="g in gameList" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </label>
            <template v-if="!fixes[s.id]!.game">
              <label class="account-field">
                <span>Название игры</span>
                <input v-model="fixes[s.id]!.gameName" type="text" maxlength="40" @input="fixes[s.id]!.gameId = serverIdFrom(fixes[s.id]!.gameName)">
              </label>
              <label class="account-field">
                <span>Адрес игры: mmotop.com/{{ fixes[s.id]!.gameId || '…' }}/</span>
                <input v-model="fixes[s.id]!.gameId" type="text" maxlength="24" dir="ltr" autocapitalize="off" spellcheck="false">
              </label>
            </template>
          </template>
          <label v-if="needsVersion(s)" class="account-field">
            <span>Версия (можно выбрать из списка или написать свою)</span>
            <input v-model="fixes[s.id]!.chronicle" type="text" maxlength="40" :list="`admin-versions-${s.id}`">
            <datalist :id="`admin-versions-${s.id}`">
              <option v-for="v in versionsOf(targetGame(fixes[s.id]!))" :key="v" :value="v" />
            </datalist>
          </label>
          <label v-if="needsRate(s)" class="account-field">
            <span>Слово вместо рейтов</span>
            <input v-model="fixes[s.id]!.rateText" type="text" maxlength="12" :list="`admin-words-${s.id}`">
            <datalist :id="`admin-words-${s.id}`">
              <option v-for="w in rateWords" :key="w" :value="w" />
            </datalist>
          </label>
          <template v-if="needsLanguage(s)">
            <label class="account-field">
              <span>Язык: код из двух букв (pt, it, ro…) или один из списка</span>
              <input v-model="fixes[s.id]!.langCode" type="text" maxlength="2" dir="ltr" autocapitalize="off" spellcheck="false" :list="`admin-langs-${s.id}`">
              <datalist :id="`admin-langs-${s.id}`">
                <option v-for="l in languages" :key="l.code" :value="l.code">{{ l.name }}</option>
              </datalist>
            </label>
            <label v-if="!languages.some((l) => l.code === fixes[s.id]!.langCode.trim().toLowerCase())" class="account-field">
              <span>Название языка, как его пишут сами (Português)</span>
              <input v-model="fixes[s.id]!.langName" type="text" maxlength="40">
            </label>
          </template>
          <template v-for="l in ownLinks(s)" :key="l.i">
            <label class="account-field">
              <span>Сеть «{{ l.name }}» ({{ l.url }})</span>
              <select v-model="fixes[s.id]!.networks[l.i]!.choice">
                <option value="">Новая сеть</option>
                <option v-for="n in networkList" :key="n.kind" :value="n.kind">{{ n.name }}</option>
              </select>
            </label>
            <template v-if="!fixes[s.id]!.networks[l.i]!.choice">
              <label class="account-field">
                <span>Название сети, как на кнопке</span>
                <input v-model="fixes[s.id]!.networks[l.i]!.name" type="text" maxlength="40" @input="fixes[s.id]!.networks[l.i]!.key = networkKey(fixes[s.id]!.networks[l.i]!.name)">
              </label>
              <label class="account-field">
                <span>Код сети (латиница)</span>
                <input v-model="fixes[s.id]!.networks[l.i]!.key" type="text" maxlength="24" dir="ltr" autocapitalize="off" spellcheck="false">
              </label>
            </template>
          </template>
          <div class="account-server-tools">
            <button type="button" class="account-button" :disabled="busyId === s.id" @click="apply(s)">Применить</button>
          </div>
          <p class="account-note">Новое появится в списках и фильтрах сайта после ближайшей сборки (до получаса).</p>
        </div>
        <div v-if="s.logo_pending" class="admin-description admin-new-game admin-fix">
          <p class="admin-fix-title">
            Новый логотип<template v-if="s.status === 'approved'"> (сервер остаётся на сайте со старым)</template>:
          </p>
          <div class="admin-logo-pair">
            <img v-if="s.logo" class="admin-logo-big is-old" :src="s.logo" alt="Старый">
            <span v-if="s.logo" aria-hidden="true">→</span>
            <img class="admin-logo-big" :src="s.logo_pending" alt="Новый">
          </div>
          <div class="account-server-tools">
            <button type="button" class="account-button" :disabled="busyId === s.id" @click="decideLogo(s, true)">Принять логотип</button>
            <button type="button" class="account-link account-danger" :disabled="busyId === s.id" @click="decideLogo(s, false)">Отклонить логотип</button>
          </div>
        </div>
        <p v-if="s.description" class="admin-description">{{ s.description }}</p>
        <!-- The reward notifications, opened on demand. -->
        <div v-if="openLog === s.id" class="admin-description admin-log">
          <p v-if="logLoading" class="account-note" role="status">Загрузка…</p>
          <p v-else-if="!logRows.length" class="account-note">Уведомлений о голосах не было.</p>
          <ul v-else class="account-postback-log">
            <li v-for="row in logRows" :key="row.id">
              <span class="account-note">{{ logTime(row.sent_at) }}</span>
              <bdi class="account-strong">{{ row.nickname }}</bdi>
              <span v-if="row.test" class="account-note">(проверка)</span>
              <span v-else-if="row.attempt > 1" class="account-note">(повтор {{ row.attempt - 1 }})</span>
              <span class="account-postback-status" :class="row.status >= 200 && row.status < 300 ? 'is-ok' : 'is-bad'">{{ row.status || 'нет ответа' }}</span>
            </li>
          </ul>
        </div>
        <div class="account-server-tools">
          <button type="button" class="account-link" @click="toggleLog(s)">{{ openLog === s.id ? 'Скрыть журнал' : 'Журнал наград' }}</button>
          <button
            v-for="a in ACTIONS.filter((a) => a.status !== s.status && !(a.status === 'approved' && s.game === 'other'))"
            :key="a.status"
            type="button"
            class="account-link"
            :class="{ 'account-danger': a.status !== 'approved' }"
            :disabled="busyId === s.id"
            @click="decide(s, a.status)"
          >
            {{ a.label }}
          </button>
        </div>
        <!-- The reason, before rejecting or hiding. -->
        <div v-if="asking?.id === s.id" class="admin-description admin-fix">
          <label class="account-field">
            <span>Причина (её увидит владелец; можно оставить пустой)</span>
            <textarea v-model="note" rows="3" maxlength="500" placeholder="Например: сайт сервера не открывается" />
          </label>
          <div class="account-server-tools">
            <button type="button" class="account-button" :disabled="busyId === s.id" @click="setStatus(s, asking.status, note)">
              {{ asking.status === 'rejected' ? 'Отклонить' : 'Скрыть' }}
            </button>
            <button type="button" class="account-link" @click="asking = null">Отмена</button>
          </div>
        </div>
        <p v-if="s.moderation_note && s.status !== 'approved'" class="account-note">Причина: {{ s.moderation_note }}</p>
      </li>
    </ul>
    <p v-if="error" class="account-error" role="alert">{{ error }}</p>
  </section>
</template>
