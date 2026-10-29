<script setup lang="ts">
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { GAMES, gameById, isChronicleAddress } from '~/data/games'
import { SERVER_ID_PATTERN, serverIdFrom, serverIdWithNumber } from '~/utils/serverId'

/**
 * The account page: signing in by email, then the owner's own servers —
 * add one, edit it, remove it. A new or edited server goes to moderation
 * first (the database sees to that, see supabase/migrations), so the list
 * shows each one's status.
 *
 * Everything here happens in the browser, after the page is up: the page
 * itself is prerendered like every other, and has no idea who is looking.
 */

interface OwnServer {
  id: string
  name: string
  game: string
  /** The name of a game the site does not list yet, when game is 'other'. */
  requested_game: string | null
  chronicle: string
  rate: number | null
  url: string
  open_date: string
  description: string | null
  status: 'pending' | 'approved' | 'rejected' | 'hidden'
}

type Draft = Omit<OwnServer, 'status' | 'rate' | 'requested_game'> & { rate: string, requested_game: string }

const { t } = useI18n()
const localePath = useLocalePath()

const supabase = shallowRef<SupabaseClient | null>(null)
const session = shallowRef<Session | null>(null)
/** Until the stored session has been read, nothing is drawn but a spinner. */
const ready = ref(false)

const email = ref('')
const sentTo = ref('')
const busy = ref(false)
const error = ref('')

/** Admins also get the moderation queue (AdminQueue). */
const isAdmin = ref(false)

const servers = ref<OwnServer[]>([])
const loadingServers = ref(false)
/** The server being edited, a fresh one being added, or none. */
const draft = ref<Draft | null>(null)
const editing = ref<string | null>(null)
/**
 * The address is made from the name unless the owner opened the field and
 * wrote their own; a made one that is taken gets a number on the end.
 */
const customId = ref(false)
const idOpen = ref(false)
watch(() => draft.value?.name, (name) => {
  if (draft.value && !editing.value && !customId.value) draft.value.id = name?.trim() ? serverIdFrom(name) : ''
})

let unsubscribe: (() => void) | undefined

onMounted(async () => {
  const client = await useSupabase()
  supabase.value = client
  const { data } = await client.auth.getSession()
  session.value = data.session
  ready.value = true
  const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
    session.value = next
  })
  unsubscribe = () => sub.subscription.unsubscribe()
})
onUnmounted(() => unsubscribe?.())

const signedIn = useSignedIn()
watch(() => session.value?.user.id, (id) => {
  signedIn.value = !!id
  servers.value = []
  draft.value = null
  isAdmin.value = false
  if (id) {
    loadServers()
    loadAdmin(id)
  }
})

async function loadAdmin(id: string) {
  const { data } = await supabase.value!.from('profiles').select('is_admin').eq('id', id).maybeSingle()
  isAdmin.value = !!data?.is_admin
}

/** Back to this very page, in this language, with its trailing slash. */
function returnAddress() {
  return `${window.location.origin}${useRuntimeConfig().app.baseURL.replace(/\/$/, '')}${localePath('/account').replace(/\/?$/, '/')}`
}

async function sendLink() {
  if (!supabase.value || busy.value) return
  busy.value = true
  error.value = ''
  const address = email.value.trim()
  const { error: failed } = await supabase.value.auth.signInWithOtp({
    email: address,
    options: { emailRedirectTo: returnAddress() }
  })
  busy.value = false
  if (failed) {
    error.value = failed.status === 429 ? t('account.tooMany') : t('account.failed')
    return
  }
  sentTo.value = address
}

async function signOut() {
  await supabase.value?.auth.signOut()
  sentTo.value = ''
}

async function loadServers() {
  if (!supabase.value || !session.value) return
  loadingServers.value = true
  const { data, error: failed } = await supabase.value
    .from('servers')
    .select('id, name, game, requested_game, chronicle, rate, url, open_date, description, status')
    .eq('owner_id', session.value.user.id)
    .order('created_at')
  loadingServers.value = false
  if (failed) error.value = t('account.failed')
  else servers.value = data as OwnServer[]
}

function addServer() {
  error.value = ''
  editing.value = null
  customId.value = false
  idOpen.value = false
  ownChronicle.value = false
  draft.value = {
    id: '',
    name: '',
    game: GAMES[0]!.id,
    requested_game: '',
    chronicle: '',
    rate: '',
    url: 'https://',
    open_date: new Date().toISOString().slice(0, 10),
    description: ''
  }
}

function editServer(s: OwnServer) {
  error.value = ''
  editing.value = s.id
  customId.value = false
  idOpen.value = false
  draft.value = { ...s, rate: s.rate == null ? '' : String(s.rate), requested_game: s.requested_game ?? '', description: s.description ?? '' }
  ownChronicle.value = !chronicles.value.includes(s.chronicle)
}

function cancel() {
  draft.value = null
  editing.value = null
  error.value = ''
}

/**
 * Server names are written in capitals across the site (LA2DREAM, NORDVEIL),
 * and follow the rules for a domain name in any language: letters of any
 * script, digits and single hyphens. Anything else simply does not go in as
 * it is typed or pasted, so "la2dream.su" comes out as LA2DREAMSU and
 * "Dream PvP" as DREAMPVP. The database checks the same (name_chars).
 */
function serverName(text: string) {
  return text
    .toUpperCase()
    .replace(/[^\p{L}\p{M}\p{N}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-/, '')
}

function typeName(event: Event) {
  const input = event.target as HTMLInputElement
  const caret = input.selectionStart ?? input.value.length
  const before = input.value
  const after = serverName(before)
  draft.value!.name = after
  if (after !== before) {
    input.value = after
    // The caret stays after what was typed before it, less what was dropped.
    const kept = serverName(before.slice(0, caret)).length
    input.setSelectionRange(kept, kept)
  }
}

/** Chronicles the chosen game already has, to pick from. */
const chronicles = computed(() => (draft.value ? gameById(draft.value.game)?.chronicles.map((c) => c.name) ?? [] : []))

/**
 * The version is picked from the game's list, like the game itself; "Another
 * version…" opens a field for one the list lacks. A game the site does not
 * list has no versions to pick, so it gets the field straight away.
 */
const OWN = '__own'
const ownChronicle = ref(false)
const chronicleChoice = computed({
  get: () => (ownChronicle.value ? OWN : draft.value?.chronicle ?? ''),
  set: (value: string) => {
    ownChronicle.value = value === OWN
    draft.value!.chronicle = value === OWN ? '' : value
  }
})

/** A different game has different versions: the choice starts again. */
function pickGame() {
  draft.value!.chronicle = ''
  ownChronicle.value = draft.value!.game === 'other'
}

async function save() {
  const d = draft.value
  if (!supabase.value || !session.value || !d || busy.value) return
  const id = d.id.trim().toLowerCase()
  if (!editing.value && customId.value && (!SERVER_ID_PATTERN.test(id) || isChronicleAddress(d.game, id))) {
    error.value = SERVER_ID_PATTERN.test(id) ? t('account.idTaken') : t('account.fields.idHint')
    return
  }
  busy.value = true
  error.value = ''
  const fields = {
    name: serverName(d.name).replace(/-+$/, ''),
    game: d.game,
    requested_game: d.game === 'other' ? d.requested_game.trim() : null,
    chronicle: d.chronicle.trim(),
    rate: d.rate.trim() ? Number(d.rate) : null,
    url: d.url.trim(),
    open_date: d.open_date,
    description: d.description?.trim() || null
  }
  let failed
  if (editing.value) {
    ({ error: failed } = await supabase.value.from('servers').update(fields).eq('id', editing.value))
  } else {
    // A made address that is taken, or is one of the game's chronicle pages,
    // moves on to la2dream-2, -3… by itself; the owner's own is tried as is.
    for (let n = 1; n <= (customId.value ? 1 : 20); n++) {
      const candidate = n === 1 ? id : serverIdWithNumber(id, n)
      if (isChronicleAddress(d.game, candidate)) continue
      ;({ error: failed } = await supabase.value.from('servers').insert({ ...fields, id: candidate, owner_id: session.value.user.id }))
      if (failed?.code !== '23505') break
    }
  }
  busy.value = false
  if (failed) {
    // 23505: the address is someone else's already; 23514: a check in the
    // table refused a value the form let through.
    error.value = failed.code === '23505' ? t('account.idTaken') : failed.code === '23514' ? t('account.invalid') : t('account.failed')
    return
  }
  cancel()
  loadServers()
}

async function remove(s: OwnServer) {
  if (!supabase.value || !window.confirm(t('account.confirmDelete', { name: s.name }))) return
  const { error: failed } = await supabase.value.from('servers').delete().eq('id', s.id)
  if (failed) error.value = t('account.failed')
  else loadServers()
}
</script>

<template>
  <GamePanel class="section-panel account-panel accent-violet" :title="$t('account.title')">
    <div class="account-body">
      <p v-if="!ready" class="account-note" role="status">{{ $t('account.loading') }}</p>

      <!-- Signed out: one field, and a link by email instead of a password. -->
      <template v-else-if="!session">
        <template v-if="sentTo">
          <p class="account-lead">
            <i18n-t keypath="account.sent" scope="global">
              <template #email><bdi class="account-strong">{{ sentTo }}</bdi></template>
            </i18n-t>
          </p>
          <p class="account-note">{{ $t('account.sentHint') }}</p>
          <button type="button" class="account-link" @click="sentTo = ''">{{ $t('account.otherEmail') }}</button>
        </template>
        <form v-else class="account-form" @submit.prevent="sendLink">
          <p class="account-lead">{{ $t('account.intro') }}</p>
          <label class="account-field">
            <span>{{ $t('account.email') }}</span>
            <input v-model="email" type="email" autocomplete="email" inputmode="email" required>
          </label>
          <button type="submit" class="account-button" :disabled="busy">{{ $t('account.sendLink') }}</button>
        </form>
      </template>

      <!-- Signed in: who, and their servers. -->
      <template v-else>
        <div class="account-who">
          <span class="account-note">{{ $t('account.signedInAs') }} <bdi class="account-strong">{{ session.user.email }}</bdi></span>
          <button type="button" class="account-link" @click="signOut">{{ $t('account.signOut') }}</button>
        </div>

        <form v-if="draft" class="account-form" @submit.prevent="save">
          <h3 class="account-heading">{{ editing ? $t('account.editServer') : $t('account.addServer') }}</h3>
          <label class="account-field">
            <span>{{ $t('account.fields.name') }}</span>
            <input :value="draft.name" type="text" required minlength="2" maxlength="24" autocapitalize="characters" @input="typeName">
          </label>
          <!-- The address, made from the name: shown, not asked for. -->
          <p v-if="!idOpen" class="account-note account-page-link">
            {{ $t('account.fields.page') }}
            <bdi class="account-strong" dir="ltr">mmotop.com/{{ draft.game === 'other' ? '…' : draft.game }}/{{ draft.id || '…' }}/</bdi>
            <button v-if="!editing" type="button" class="account-link" @click="idOpen = true">{{ $t('account.edit') }}</button>
          </p>
          <label v-else class="account-field">
            <span>{{ $t('account.fields.id') }}</span>
            <input
              v-model="draft.id"
              type="text"
              required
              pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]"
              maxlength="32"
              autocapitalize="off"
              spellcheck="false"
              dir="ltr"
              @input="customId = true"
            >
            <small>{{ $t('account.fields.idHint') }}</small>
          </label>
          <div class="account-pair">
            <label class="account-field">
              <span>{{ $t('account.fields.game') }}</span>
              <select v-model="draft.game" required @change="pickGame">
                <option v-for="g in GAMES" :key="g.id" :value="g.id">{{ g.name }}</option>
                <option value="other">{{ $t('account.fields.otherGame') }}</option>
              </select>
            </label>
            <label v-if="draft.game !== 'other'" class="account-field">
              <span>{{ $t('account.fields.chronicle') }}</span>
              <select v-model="chronicleChoice" required>
                <option value="" disabled>{{ $t('account.fields.choose') }}</option>
                <option v-for="c in chronicles" :key="c" :value="c">{{ c }}</option>
                <option :value="OWN">{{ $t('account.fields.otherChronicle') }}</option>
              </select>
            </label>
          </div>
          <label v-if="draft.game === 'other'" class="account-field">
            <span>{{ $t('account.fields.gameName') }}</span>
            <input v-model="draft.requested_game" type="text" required minlength="2" maxlength="40">
          </label>
          <label v-if="ownChronicle" class="account-field">
            <span>{{ draft.game === 'other' ? $t('account.fields.chronicle') : $t('account.fields.chronicleName') }}</span>
            <input v-model="draft.chronicle" type="text" required maxlength="40">
          </label>
          <div class="account-pair">
            <label class="account-field">
              <span>{{ $t('account.fields.rate') }}</span>
              <input v-model="draft.rate" type="number" min="0.01" max="100000" step="any" inputmode="decimal" :placeholder="$t('account.fields.rateHint')">
            </label>
            <label class="account-field">
              <span>{{ $t('account.fields.openDate') }}</span>
              <input v-model="draft.open_date" type="date" required>
            </label>
          </div>
          <label class="account-field">
            <span>{{ $t('account.fields.url') }}</span>
            <input v-model="draft.url" type="url" required pattern="https?://.+" dir="ltr">
          </label>
          <label class="account-field">
            <span>{{ $t('account.fields.description') }}</span>
            <textarea v-model="draft.description" rows="4" maxlength="2000" />
          </label>
          <p v-if="editing" class="account-note">{{ $t('account.recheck') }}</p>
          <p v-if="error" class="account-error" role="alert">{{ error }}</p>
          <div class="account-actions-row">
            <button type="submit" class="account-button" :disabled="busy">{{ $t('account.save') }}</button>
            <button type="button" class="account-link" @click="cancel">{{ $t('account.cancel') }}</button>
          </div>
        </form>

        <template v-else>
          <p v-if="loadingServers && !servers.length" class="account-note" role="status">{{ $t('account.loading') }}</p>
          <p v-else-if="!servers.length" class="account-lead">{{ $t('account.noServers') }}</p>
          <ul v-else class="account-servers">
            <li v-for="s in servers" :key="s.id" class="account-server">
              <div class="account-server-main">
                <span class="account-strong">{{ s.name }}</span>
                <span class="account-note">{{ gameById(s.game)?.name ?? s.requested_game ?? s.game }} · {{ s.chronicle }}</span>
              </div>
              <span class="account-status" :class="`status-${s.status}`">{{ $t(`account.status.${s.status}`) }}</span>
              <div class="account-server-tools">
                <button type="button" class="account-link" @click="editServer(s)">{{ $t('account.edit') }}</button>
                <button type="button" class="account-link account-danger" @click="remove(s)">{{ $t('account.delete') }}</button>
              </div>
            </li>
          </ul>
          <p v-if="error" class="account-error" role="alert">{{ error }}</p>
          <button type="button" class="account-button" @click="addServer">{{ $t('account.addServer') }}</button>
          <p class="account-note">{{ $t('account.moderation') }}</p>
          <AdminQueue v-if="isAdmin && supabase" :supabase="supabase" />
        </template>
      </template>

      <p v-if="error && !session" class="account-error" role="alert">{{ error }}</p>
    </div>
  </GamePanel>
</template>
