<script setup lang="ts">
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { GAMES, RATE_WORDS, chronicleBadge, gameById } from '~/data/games'
import { serverPath, versionSlug, type Server } from '~/data/servers'
import { SERVER_LANGUAGES } from '~/i18n/locales'
import { NETWORKS, MAX_LINKS, type ServerLink } from '~/data/networks'
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
  /** Two letters (SERVER_LANGUAGES), "multi", or "other" with its name in language_text. */
  language: string | null
  language_text: string | null
  /** Its Discord, and its other networks (Telegram, VK, YouTube…); https only. */
  links: ServerLink[]
  chronicle: string
  rate: number | null
  /** In place of a rate, when there is none: "PvP", "GvE"… */
  rate_text: string | null
  url: string
  open_date: string
  description: string | null
  /** The server's own logo (server-images), or none for the version's letters. */
  logo: string | null
  status: 'pending' | 'approved' | 'rejected' | 'hidden'
}

type Draft = Omit<OwnServer, 'status' | 'rate' | 'rate_text' | 'requested_game' | 'language' | 'language_text'> & { rate: string, rate_text: string, requested_game: string, language: string, language_text: string }

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
/** What became of the last save, shown over the list once the form closes. */
const notice = ref('')
/** A problem with the address, shown under it rather than at the foot of the form. */
const idError = ref('')

/** Admins also get the moderation queue (AdminQueue). */
const isAdmin = ref(false)

const servers = ref<OwnServer[]>([])
const loadingServers = ref(false)
/** The server being edited, a fresh one being added, or none. */
const draft = ref<Draft | null>(null)
const editing = ref<string | null>(null)
/** The server's page on the site, in this language: https://mmotop.com/ru/lineage2/interlude/la2dream/. */
function pageAddress(s: OwnServer) {
  return `https://mmotop.com${localePath(serverPath(s)).replace(/\/?$/, '/')}`
}

/**
 * The address (/lineage2/interlude/<id>/) is made from the name unless the owner
 * opened the field and wrote their own; a made one that is taken gets a
 * number on the end when saving, the owner's own is tried as it is.
 */
const customId = ref(false)
const idOpen = ref(false)
watch(() => draft.value?.name, (name) => {
  if (draft.value && !editing.value && !customId.value) draft.value.id = name?.trim() ? serverIdFrom(name) : ''
})

/** The page the address leads to, as the owner will share it. */
const draftAddress = computed(() => {
  const d = draft.value
  if (!d) return ''
  // decodeURI: the path comes back encoded, and "…" for what is not chosen yet would read %E2%80%A6.
  return `mmotop.com${decodeURI(localePath(`/${d.game === 'other' ? '…' : d.game}/${d.chronicle ? versionSlug(d.chronicle) : '…'}/${d.id || '…'}`)).replace(/\/?$/, '/')}`
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
    .select('id, name, game, requested_game, chronicle, rate, rate_text, url, open_date, description, language, language_text, links, logo, status')
    .eq('owner_id', session.value.user.id)
    .order('created_at')
  loadingServers.value = false
  if (failed) error.value = t('account.failed')
  else servers.value = data as OwnServer[]
}

function addServer() {
  error.value = ''
  notice.value = ''
  idError.value = ''
  reward.value = { enabled: false, url: '', secret: null, exists: false }
  editing.value = null
  ownChronicle.value = false
  noRate.value = false
  customId.value = false
  idOpen.value = false
  ownRateWord.value = false
  draft.value = {
    id: '',
    name: '',
    game: GAMES[0]!.id,
    requested_game: '',
    // "Not specified" by default, as the owner chose; a language is a pick away.
    language: '',
    language_text: '',
    links: [],
    chronicle: '',
    rate: '',
    rate_text: '',
    url: 'https://',
    open_date: new Date().toISOString().slice(0, 10),
    description: '',
    logo: null
  }
}

function editServer(s: OwnServer) {
  error.value = ''
  notice.value = ''
  idError.value = ''
  loadReward(s.id)
  editing.value = s.id
  draft.value = { ...s, rate: s.rate == null ? '' : String(s.rate), rate_text: s.rate_text ?? '', requested_game: s.requested_game ?? '', description: s.description ?? '', language: s.language ?? '', language_text: s.language_text ?? '', links: (s.links ?? []).map((l) => ({ ...l })) }
  noRate.value = s.rate == null
  ownRateWord.value = !!s.rate_text && !RATE_WORDS.includes(s.rate_text)
  ownChronicle.value = !chronicles.value.includes(s.chronicle)
  customId.value = false
  idOpen.value = false
}

/** A row's network chosen: one from the list, or "Other network…" with a name to write. */
function pickNetwork(link: ServerLink, value: string) {
  if (value === OWN) {
    link.kind = 'other'
    link.name = ''
  } else {
    link.kind = value
    delete link.name
  }
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

/**
 * "No rates": the number gives way to an optional word in its place, shown
 * where "x50" would be. Picked from a list like the game and the version,
 * with "Your own…" opening a field for one the list lacks.
 */
const noRate = ref(false)
const ownRateWord = ref(false)
const rateWordChoice = computed({
  get: () => (ownRateWord.value ? OWN : draft.value?.rate_text ?? ''),
  set: (value: string) => {
    ownRateWord.value = value === OWN
    draft.value!.rate_text = value === OWN ? '' : value
  }
})

/**
 * The rate as a number, or none. The field is type="number", and v-model
 * hands back a number from it (or '' when empty), not the string the draft's
 * type promises — calling .trim() on it threw, and took the form with it.
 */
function rateNumber(d: Draft) {
  const text = String(d.rate ?? '').trim()
  return text ? Number(text) : null
}

/**
 * What the server's page says of it whatever the owner writes — the made
 * text (useServerAbout), shown greyed in the empty description field as the
 * form is filled in. With no description of their own, this is all the page
 * has.
 */
const { aboutText } = useServerAbout()
const today = new Date().toISOString().slice(0, 10)
const aboutPreview = computed(() => {
  const d = draft.value
  // Only once there is something to say: no "… — a server on version …".
  if (!d || !serverName(d.name) || !d.chronicle.trim() || (d.game === 'other' && !d.requested_game.trim())) return ''
  const rate = !noRate.value && rateNumber(d) != null ? rateNumber(d)! : undefined
  return aboutText({
    id: d.id,
    name: serverName(d.name) || '…',
    // 'other' too: its name comes in through `game` below.
    game: d.game as Server['game'],
    chronicle: d.chronicle || '…',
    ...(rate ? { rate } : {}),
    ...(noRate.value && d.rate_text.trim() ? { rateText: d.rate_text.trim() } : {}),
    url: d.url,
    openDate: d.open_date || today,
    listedAt: today,
    votes: 0
  }, today, { game: d.game === 'other' ? d.requested_game || '…' : undefined, brief: true })
})

/** A different game has different versions: the choice starts again. */
function pickGame() {
  draft.value!.chronicle = ''
  ownChronicle.value = draft.value!.game === 'other'
}

/**
 * A picture for the description, kept with us: shrunk in the browser to at
 * most 1600px on its longer side and sent as WebP (a few-MB screenshot comes
 * out at a few hundred KB), or as it is for a GIF, which would lose its
 * animation. It goes into the owner's own folder of the server-images
 * bucket, and its address onto a line of its own in the description, where
 * RichDescription shows it as the picture.
 */
const IMAGE_BUCKET = 'server-images'
const MAX_IMAGE = 2 * 1024 * 1024
const imageInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const imageError = ref('')

async function shrink(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', quality))
    if (blob && blob.size <= MAX_IMAGE) return blob
  }
  throw new Error('too big')
}

async function addImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !supabase.value || !session.value || !draft.value) return
  imageError.value = ''
  uploading.value = true
  try {
    const blob = await shrink(file).catch(() => null)
    if (!blob || blob.size > MAX_IMAGE) {
      imageError.value = t('account.fields.imageTooBig')
      return
    }
    const ext = blob.type === 'image/gif' ? 'gif' : 'webp'
    const path = `${session.value.user.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error: failed } = await supabase.value.storage.from(IMAGE_BUCKET)
      .upload(path, blob, { contentType: blob.type || 'image/webp', cacheControl: '31536000', upsert: false })
    if (failed) {
      imageError.value = t('account.fields.imageFailed')
      return
    }
    const url = supabase.value.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
    const text = (draft.value.description ?? '').replace(/\s+$/, '')
    draft.value.description = text ? `${text}\n${url}\n` : `${url}\n`
  } finally {
    uploading.value = false
  }
}

async function save() {
  const d = draft.value
  if (!supabase.value || !session.value || !d || busy.value) return
  const id = d.id.trim().toLowerCase()
  idError.value = ''
  if (customId.value && !SERVER_ID_PATTERN.test(id)) {
    idError.value = t('account.fields.idHint')
    showIdField()
    return
  }
  busy.value = true
  error.value = ''
  const fields = {
    name: serverName(d.name).replace(/-+$/, ''),
    game: d.game,
    requested_game: d.game === 'other' ? d.requested_game.trim() : null,
    chronicle: d.chronicle.trim(),
    rate: noRate.value ? null : rateNumber(d),
    rate_text: noRate.value ? d.rate_text.trim() || null : null,
    url: d.url.trim(),
    language: d.language || null,
    language_text: d.language === 'other' ? d.language_text.trim() : null,
    // Rows left without an address are dropped rather than refused.
    links: d.links
      .map((l) => (l.name === undefined ? { kind: l.kind, url: l.url.trim() } : { kind: 'other', url: l.url.trim(), name: l.name.trim() }))
      .filter((l) => l.url),
    open_date: d.open_date,
    description: d.description?.trim() || null,
    logo: d.logo
  }
  /** Where the server is saved: its address after this save. */
  let savedId = editing.value && !customId.value ? editing.value : id
  let failed
  if (editing.value) {
    // A changed address too: the database moves the votes with it and keeps
    // the old one, which the site then sends on to the new (server_paths).
    ({ error: failed } = await supabase.value.from('servers').update(customId.value ? { ...fields, id } : fields).eq('id', editing.value))
  } else {
    // A made address that is taken moves on to la2dream-2, -3… by itself;
    // the owner's own is tried as is.
    for (let n = 1; n <= (customId.value ? 1 : 20); n++) {
      const candidate = n === 1 ? id : serverIdWithNumber(id, n)
      ;({ error: failed } = await supabase.value.from('servers').insert({ ...fields, id: candidate, owner_id: session.value.user.id }))
      savedId = candidate
      if (failed?.code !== '23505') break
    }
  }
  if (failed) {
    busy.value = false
    // 23505: the address is someone else's already — said under the address,
    // opened to be changed; 23514: a check in the table refused a value the
    // form let through.
    if (failed.code === '23505') {
      idOpen.value = true
      idError.value = t('account.idTaken')
      showIdField()
    } else {
      error.value = failed.code === '23514' ? t('account.invalid') : t('account.failed')
    }
    return
  }
  const wasNew = !editing.value
  const rewardSaved = await saveReward(savedId)
  busy.value = false
  cancel()
  await loadServers()
  // New, or changed after approval (servers_guard sends it back): on review.
  const status = servers.value.find((x) => x.id === savedId)?.status
  notice.value = wasNew || status === 'pending' ? t('account.savedReview') : t('account.savedDone')
  if (!rewardSaved) error.value = t('account.failed')
}

/**
 * The logo and the reward for a vote are for a server already on the site:
 * the form for adding one keeps to what moderation needs (the owner asked
 * for it as short as it can be).
 */
const approvedDraft = computed(() => !!editing.value && servers.value.find((x) => x.id === editing.value)?.status === 'approved')

/** The address field, brought into view with its problem under it. */
const idField = ref<HTMLInputElement | null>(null)
async function showIdField() {
  await nextTick()
  idField.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  idField.value?.focus({ preventScroll: true })
}

/**
 * The reward for a vote (server_postbacks): switched on, the vote function
 * sends the voter's nickname to the owner's address, signed with the secret
 * key. Read when a server is opened for editing, written after it is saved;
 * a server with none stays without a row.
 */
const reward = ref<{ enabled: boolean, url: string, secret: string | null, exists: boolean }>({ enabled: false, url: '', secret: null, exists: false })
const copied = ref(false)

async function loadReward(serverId: string) {
  reward.value = { enabled: false, url: '', secret: null, exists: false }
  const { data } = await supabase.value!.from('server_postbacks').select('url, secret, enabled').eq('server_id', serverId).maybeSingle()
  if (data && editing.value === serverId) reward.value = { enabled: data.enabled, url: data.url ?? '', secret: data.secret, exists: true }
}

/** A fresh key, made in the browser: 24 random bytes as hex, as the database makes them. */
function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  reward.value.secret = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  copied.value = false
}

async function copySecret() {
  if (!reward.value.secret) return
  await navigator.clipboard?.writeText(reward.value.secret).catch(() => {})
  copied.value = true
}

async function saveReward(serverId: string) {
  const r = reward.value
  if (!r.exists && !r.enabled && !r.url.trim()) return true
  const { error: failed } = await supabase.value!.from('server_postbacks').upsert({
    server_id: serverId,
    url: r.url.trim() || null,
    enabled: r.enabled && !!r.url.trim(),
    ...(r.secret ? { secret: r.secret } : {})
  }, { onConflict: 'server_id' })
  return !failed
}

/**
 * The server's logo: any picture, cut to a centred square and shrunk to
 * 256px, sent as WebP into the owner's folder of server-images like the
 * description's pictures. It stands where the version's letters would.
 */
const logoInput = ref<HTMLInputElement | null>(null)
const logoBusy = ref(false)
const logoError = ref('')

async function squareLogo(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const size = Math.min(256, side)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.9))
  if (!blob) throw new Error('no picture')
  return blob
}

async function addLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !supabase.value || !session.value || !draft.value) return
  logoError.value = ''
  logoBusy.value = true
  try {
    const blob = await squareLogo(file).catch(() => null)
    if (!blob) {
      logoError.value = t('account.fields.imageFailed')
      return
    }
    const path = `${session.value.user.id}/logo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.webp`
    const { error: failed } = await supabase.value.storage.from(IMAGE_BUCKET)
      .upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
    if (failed) {
      logoError.value = t('account.fields.imageFailed')
      return
    }
    draft.value.logo = supabase.value.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  } finally {
    logoBusy.value = false
  }
}

async function remove(s: OwnServer) {
  if (!supabase.value || !window.confirm(t('account.confirmDelete', { name: s.name }))) return
  const { error: failed } = await supabase.value.from('servers').delete().eq('id', s.id)
  if (failed) error.value = t('account.failed')
  else loadServers()
}
</script>

<template>
  <!-- While a server is being added or edited, the form is all there is:
       no panel title, no "Signed in as". Both come back with Save or Cancel. -->
  <GamePanel class="section-panel account-panel accent-violet" :title="draft ? undefined : $t('account.title')">
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
        <div v-if="!draft" class="account-who">
          <span class="account-note">{{ $t('account.signedInAs') }} <bdi class="account-strong">{{ session.user.email }}</bdi></span>
          <button type="button" class="account-link" @click="signOut">{{ $t('account.signOut') }}</button>
        </div>

        <!-- No visible heading (the owner asked for the form alone); its name is
             still there for screen readers. -->
        <form v-if="draft" class="account-form" :aria-label="editing ? $t('account.editServer') : $t('account.addServer')" @submit.prevent="save">
          <label class="account-field">
            <span>{{ $t('account.fields.name') }}</span>
            <input :value="draft.name" type="text" required minlength="2" maxlength="24" autocapitalize="characters" @input="typeName">
          </label>
          <!-- The page's address, made from the name, and Edit for one's own. -->
          <p v-if="!idOpen" class="account-note account-page-link">
            <bdi class="account-strong" dir="ltr">{{ draftAddress }}</bdi>
            <button type="button" class="account-link" @click="idOpen = true">{{ $t('account.edit') }}</button>
          </p>
          <label v-else class="account-field">
            <span>{{ $t('account.fields.id') }}</span>
            <input
              ref="idField"
              v-model="draft.id"
              type="text"
              required
              pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]"
              maxlength="32"
              autocapitalize="off"
              spellcheck="false"
              dir="ltr"
              :aria-invalid="!!idError"
              @input="customId = true; idError = ''"
            >
            <small v-if="idError" class="account-error" role="alert">{{ idError }}</small>
            <small v-else>{{ $t('account.fields.idHint') }}</small>
          </label>
          <!-- The logo, beside where it will stand: the square of the lists.
               Only once the server is approved: adding one stays short. -->
          <div v-if="approvedDraft" class="account-field">
            <span>{{ $t('account.fields.logo') }} <small class="account-optional">{{ $t('account.fields.optional') }}</small></span>
            <div class="account-logo-row">
              <span class="game-logo account-logo" :class="{ 'has-logo': !!draft.logo }">
                <img v-if="draft.logo" :src="draft.logo" alt="">
                <template v-else>{{ chronicleBadge(draft.game, draft.chronicle || '…') }}</template>
              </span>
              <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="addLogo">
              <button type="button" class="account-link" :disabled="logoBusy" @click="logoInput?.click()">
                {{ logoBusy ? $t('account.fields.uploading') : draft.logo ? $t('account.fields.changeLogo') : `+ ${$t('account.fields.addLogo')}` }}
              </button>
              <button v-if="draft.logo" type="button" class="account-link account-danger" @click="draft.logo = null">{{ $t('account.fields.removeLink') }}</button>
            </div>
            <small v-if="logoError" class="account-error" role="alert">{{ logoError }}</small>
          </div>
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
            <div class="account-field">
              <!-- The "No rates" box sits inside the field itself, at its end;
                   ticked, the number gives way to the list of words. -->
              <span>{{ noRate ? $t('account.fields.rateText') : $t('account.fields.rate') }}</span>
              <div class="account-rate-box" :class="{ 'has-select': noRate }">
                <input
                  v-if="!noRate"
                  v-model="draft.rate"
                  type="number"
                  min="0.01"
                  max="100000"
                  step="any"
                  inputmode="decimal"
                  :aria-label="$t('account.fields.rate')"
                  :placeholder="$t('account.fields.rateHint')"
                >
                <select v-else v-model="rateWordChoice" :aria-label="$t('account.fields.rateText')">
                  <option value="">{{ $t('account.fields.notSpecified') }}</option>
                  <option v-for="w in RATE_WORDS" :key="w" :value="w">{{ w }}</option>
                  <option :value="OWN">{{ $t('account.fields.rateOwn') }}</option>
                </select>
                <label class="account-check">
                  <input v-model="noRate" type="checkbox">
                  <span>{{ $t('filter.noRates') }}</span>
                </label>
              </div>
              <input
                v-if="noRate && ownRateWord"
                v-model="draft.rate_text"
                type="text"
                required
                maxlength="20"
                :aria-label="$t('account.fields.rateText')"
                :placeholder="$t('account.fields.rateTextHint')"
              >
            </div>
            <label class="account-field">
              <span>{{ $t('account.fields.openDate') }}</span>
              <input v-model="draft.open_date" type="date" required>
            </label>
          </div>
          <label class="account-field">
            <span>{{ $t('account.fields.language') }} <small class="account-optional">{{ $t('account.fields.optional') }}</small></span>
            <!-- Optional: "Not specified" stores no language. A new server
                 starts as international. -->
            <select v-model="draft.language">
              <option value="">{{ $t('account.fields.notSpecified') }}</option>
              <option value="intl">{{ $t('server.international') }}</option>
              <option v-for="l in SERVER_LANGUAGES" :key="l.code" :value="l.code" :lang="l.code">{{ l.name }}</option>
              <option value="multi">{{ $t('server.multilingual') }}</option>
              <option value="other">{{ $t('account.fields.otherLanguage') }}</option>
            </select>
          </label>
          <label v-if="draft.language === 'other'" class="account-field">
            <span>{{ $t('account.fields.languageName') }}</span>
            <input v-model="draft.language_text" type="text" required minlength="2" maxlength="30">
          </label>
          <label class="account-field">
            <span>{{ $t('account.fields.url') }}</span>
            <input v-model="draft.url" type="url" required pattern="https?://.+" dir="ltr">
          </label>
          <!-- Networks, as many rows as the owner adds: the network, its
               address, and a cross to take the row away. -->
          <div class="account-field">
            <span v-if="draft.links.length">{{ $t('account.fields.links') }} <small class="account-optional">{{ $t('account.fields.optional') }}</small></span>
            <div v-for="(link, i) in draft.links" :key="i" class="account-link-row">
              <!-- "Other network…" last: one the list lacks, named below. -->
              <select :value="link.name === undefined ? link.kind : OWN" :aria-label="$t('account.fields.network')" @change="pickNetwork(link, ($event.target as HTMLSelectElement).value)">
                <option v-for="n in NETWORKS" :key="n.kind" :value="n.kind">{{ n.name ?? $t(n.kind === 'forum' ? 'server.forum' : 'server.community') }}</option>
                <option :value="OWN">{{ $t('account.fields.ownNetwork') }}</option>
              </select>
              <input
                v-model="link.url"
                type="url"
                required
                pattern="https://.+"
                maxlength="200"
                dir="ltr"
                :aria-label="$t('account.fields.linkAddress')"
                :placeholder="NETWORKS.find((n) => n.kind === link.kind)?.placeholder"
              >
              <button type="button" class="account-link-remove" :aria-label="$t('account.fields.removeLink')" @click="draft.links.splice(i, 1)">
                <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <line x1="5" y1="5" x2="15" y2="15" />
                  <line x1="15" y1="5" x2="5" y2="15" />
                </svg>
              </button>
              <input
                v-if="link.name !== undefined"
                v-model="link.name"
                class="account-link-name"
                type="text"
                required
                maxlength="30"
                :placeholder="$t('account.fields.networkName')"
                :aria-label="$t('account.fields.networkName')"
              >
            </div>
            <button
              v-if="draft.links.length < MAX_LINKS"
              type="button"
              class="account-link account-add-link"
              @click="draft.links.push({ kind: NETWORKS[draft.links.length % NETWORKS.length]!.kind, url: '' })"
            >+ {{ $t('account.fields.addLink') }}</button>
          </div>
          <label class="account-field">
            <span>{{ $t('account.fields.description') }}</span>
            <!-- The made text sits in the field itself, greyed, until the
                 owner writes their own: what the page says either way. -->
            <textarea v-model="draft.description" rows="7" maxlength="2000" :placeholder="aboutPreview" />
          </label>
          <div class="account-image-row">
            <input ref="imageInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="addImage">
            <button type="button" class="account-link" :disabled="uploading" @click="imageInput?.click()">
              {{ uploading ? $t('account.fields.uploading') : `+ ${$t('account.fields.addImage')}` }}
            </button>
            <span v-if="imageError" class="account-error" role="alert">{{ imageError }}</span>
          </div>
          <!-- With a link in the description, how the page will show it: a
               YouTube player, a picture, a link. -->
          <div v-if="/https?:\/\//.test(draft.description ?? '')" class="account-field">
            <span>{{ $t('account.fields.preview') }}</span>
            <RichDescription class="account-description-preview" :text="draft.description ?? ''" />
          </div>
          <!-- The reward for a vote, folded: most owners set it up once, if at all. -->
          <details v-if="approvedDraft" class="account-reward" :open="reward.enabled || undefined">
            <summary>{{ $t('account.reward.title') }} <small class="account-optional">{{ $t('account.fields.optional') }}</small></summary>
            <p class="account-note">{{ $t('account.reward.hint') }}</p>
            <label class="account-check">
              <input v-model="reward.enabled" type="checkbox">
              <span>{{ $t('account.reward.on') }}</span>
            </label>
            <label class="account-field">
              <span>{{ $t('account.reward.url') }}</span>
              <input v-model="reward.url" type="url" :required="reward.enabled" pattern="https://.+" maxlength="300" dir="ltr" placeholder="https://…">
            </label>
            <div class="account-field">
              <span>{{ $t('account.reward.secret') }}</span>
              <template v-if="reward.secret">
                <div class="account-secret-row">
                  <input :value="reward.secret" type="text" readonly dir="ltr" :aria-label="$t('account.reward.secret')" @focus="($event.target as HTMLInputElement).select()">
                  <button type="button" class="account-link" @click="copySecret">{{ copied ? $t('account.reward.copied') : $t('account.reward.copy') }}</button>
                </div>
                <small>{{ $t('account.reward.secretHint') }}</small>
                <button type="button" class="account-link account-new-secret" @click="newSecret">{{ $t('account.reward.newSecret') }}</button>
              </template>
              <small v-else>{{ $t('account.reward.afterSave') }}</small>
            </div>
            <details class="account-reward-how">
              <summary>{{ $t('account.reward.how') }}</summary>
              <pre dir="ltr">POST {{ reward.url.trim() || 'https://…' }}
Content-Type: application/json
X-MMOTOP-Signature: hex(HMAC-SHA256(secret,
  "server_id:nickname:vote_id:voted_at"))

{"server_id": "{{ draft.id || '…' }}", "nickname": "Player",
 "vote_id": 123, "voted_at": "2026-11-05T12:00:00Z"}</pre>
            </details>
          </details>
          <p v-if="editing" class="account-note">{{ $t('account.recheck') }}</p>
          <p v-if="error" class="account-error" role="alert">{{ error }}</p>
          <div class="account-actions-row">
            <button type="submit" class="account-button" :disabled="busy">{{ $t('account.save') }}</button>
            <button type="button" class="account-link" @click="cancel">{{ $t('account.cancel') }}</button>
          </div>
        </form>

        <template v-else>
          <p v-if="notice" class="account-notice" role="status">{{ notice }}</p>
          <p v-if="loadingServers && !servers.length" class="account-note" role="status">{{ $t('account.loading') }}</p>
          <p v-else-if="!servers.length" class="account-lead">{{ $t('account.noServers') }}</p>
          <ul v-else class="account-servers">
            <li v-for="s in servers" :key="s.id" class="account-server">
              <div class="account-server-main">
                <span class="account-strong">{{ s.name }}</span>
                <span class="account-note">{{ gameById(s.game)?.name ?? s.requested_game ?? s.game }} · {{ s.chronicle }}</span>
              </div>
              <span class="account-status" :class="`status-${s.status}`">{{ $t(`account.status.${s.status}`) }}</span>
              <!-- Its page's address, to share; shown here rather than in
                   the form. A link once the server is on the site. -->
              <a v-if="s.status === 'approved' && s.game !== 'other'" class="account-address" :href="pageAddress(s)" target="_blank" rel="noopener" dir="ltr">{{ pageAddress(s).replace(/^https:\/\//, '') }}</a>
              <span v-else-if="s.game !== 'other'" class="account-address" dir="ltr">{{ pageAddress(s).replace(/^https:\/\//, '') }}</span>
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
