<script setup lang="ts">
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { GAMES, gameById, isChronicleAddress } from '~/data/games'

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
  chronicle: string
  rate: number | null
  url: string
  open_date: string
  description: string | null
  status: 'pending' | 'approved' | 'rejected' | 'hidden'
}

type Draft = Omit<OwnServer, 'status' | 'rate'> & { rate: string }

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
    .select('id, name, game, chronicle, rate, url, open_date, description, status')
    .eq('owner_id', session.value.user.id)
    .order('created_at')
  loadingServers.value = false
  if (failed) error.value = t('account.failed')
  else servers.value = data as OwnServer[]
}

function addServer() {
  error.value = ''
  editing.value = null
  draft.value = {
    id: '',
    name: '',
    game: GAMES[0]!.id,
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
  draft.value = { ...s, rate: s.rate == null ? '' : String(s.rate), description: s.description ?? '' }
}

function cancel() {
  draft.value = null
  editing.value = null
  error.value = ''
}

/** Chronicles the chosen game already has, offered as the field is typed in. */
const chronicles = computed(() => (draft.value ? gameById(draft.value.game)?.chronicles.map((c) => c.name) ?? [] : []))

async function save() {
  const d = draft.value
  if (!supabase.value || !session.value || !d || busy.value) return
  if (!editing.value && isChronicleAddress(d.game, d.id.trim().toLowerCase())) {
    error.value = t('account.idTaken')
    return
  }
  busy.value = true
  error.value = ''
  const fields = {
    name: d.name.trim(),
    game: d.game,
    chronicle: d.chronicle.trim(),
    rate: d.rate.trim() ? Number(d.rate) : null,
    url: d.url.trim(),
    open_date: d.open_date,
    description: d.description?.trim() || null
  }
  const { error: failed } = editing.value
    ? await supabase.value.from('servers').update(fields).eq('id', editing.value)
    : await supabase.value.from('servers').insert({ ...fields, id: d.id.trim().toLowerCase(), owner_id: session.value.user.id })
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
            <input v-model="draft.name" type="text" required minlength="2" maxlength="24">
          </label>
          <label class="account-field">
            <span>{{ $t('account.fields.id') }}</span>
            <input
              v-model="draft.id"
              type="text"
              required
              :disabled="!!editing"
              pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]"
              maxlength="32"
              autocapitalize="off"
              spellcheck="false"
              dir="ltr"
            >
            <small>{{ $t('account.fields.idHint', { example: `mmotop.com/${draft.game}/${draft.id || 'myserver'}/` }) }}</small>
          </label>
          <div class="account-pair">
            <label class="account-field">
              <span>{{ $t('account.fields.game') }}</span>
              <select v-model="draft.game" required>
                <option v-for="g in GAMES" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </label>
            <label class="account-field">
              <span>{{ $t('account.fields.chronicle') }}</span>
              <input v-model="draft.chronicle" type="text" required maxlength="40" list="account-chronicles">
              <datalist id="account-chronicles">
                <option v-for="c in chronicles" :key="c" :value="c" />
              </datalist>
            </label>
          </div>
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
                <span class="account-note">{{ gameById(s.game)?.name ?? s.game }} · {{ s.chronicle }}</span>
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
