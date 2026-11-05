<script setup lang="ts">
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Signing in, every way the account page offers, so it works on someone
 * else's computer too without opening one's mail there:
 *
 * - by email: the letter holds a link and a code; the code, read on one's
 *   phone, is typed in here (auth.verifyOtp);
 * - with Telegram (TelegramLogin), once the bot exists;
 * - with a QR code: this page asks the qr-login function for a request and
 *   shows it; the owner's phone, signed in, opens it and approves
 *   (AccountApprove), and this page, asking every two seconds, gets the
 *   session.
 *
 * "Someone else's computer" keeps the session for this tab only
 * (setTempSignIn), so the next person at the computer finds no one signed in.
 */
const props = defineProps<{ supabase: SupabaseClient }>()
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const email = ref('')
const sentTo = ref('')
const code = ref('')
const busy = ref(false)
const error = ref('')
const notMine = ref(false)
watch(notMine, (on) => setTempSignIn(on))

/** Back to this very page, in this language, with its trailing slash (and a QR approval being asked for). */
function returnAddress() {
  const approve = typeof route.query.approve === 'string' ? `?approve=${encodeURIComponent(route.query.approve)}` : ''
  return `${window.location.origin}${useRuntimeConfig().app.baseURL.replace(/\/$/, '')}${localePath('/account').replace(/\/?$/, '/')}${approve}`
}

async function sendLink() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  const address = email.value.trim()
  const { error: failed } = await props.supabase.auth.signInWithOtp({ email: address, options: { emailRedirectTo: returnAddress() } })
  busy.value = false
  if (failed) {
    error.value = failed.status === 429 ? t('account.tooMany') : t('account.failed')
    return
  }
  sentTo.value = address
  code.value = ''
}

async function useCode() {
  const token = code.value.replace(/\s+/g, '')
  if (busy.value || !token) return
  busy.value = true
  error.value = ''
  const { error: failed } = await props.supabase.auth.verifyOtp({ email: sentTo.value, token, type: 'email' })
  busy.value = false
  if (failed) error.value = t('account.signin.codeWrong')
}

/** A one-time token from a function (Telegram, the QR code) made into a session. */
async function useTokenHash(tokenHash: string) {
  const { error: failed } = await props.supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (failed) error.value = t('account.failed')
}

function telegramDone(answer: { token_hash?: string, error?: string }) {
  if (answer.token_hash) useTokenHash(answer.token_hash)
  else error.value = t('account.signin.telegramFailed')
}

/* ── The QR code ─────────────────────────────────────────────────────── */
const qr = ref<{ svg: string, code: string } | null>(null)
const qrExpired = ref(false)
let pollTimer: ReturnType<typeof setInterval> | undefined
let expireTimer: ReturnType<typeof setTimeout> | undefined

function stopQr() {
  clearInterval(pollTimer)
  clearTimeout(expireTimer)
}

async function qrLogin(body: Record<string, string>) {
  const res = await fetch(`${FUNCTIONS_URL}/qr-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res.json().catch(() => ({ error: 'failed' }))
}

async function startQr() {
  stopQr()
  error.value = ''
  qrExpired.value = false
  let started: { id?: string, secret?: string, code?: string }
  try {
    started = await qrLogin({ action: 'start' })
  } catch {
    started = {}
  }
  if (!started.id || !started.secret || !started.code) {
    error.value = t('account.failed')
    return
  }
  const { id, secret } = started
  const url = `${window.location.origin}${useRuntimeConfig().app.baseURL.replace(/\/$/, '')}${localePath('/account').replace(/\/?$/, '/')}?approve=${id}.${secret}`
  const { toString } = await import('qrcode')
  const svg = await toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#16182b', light: '#ffffff' } })
  qr.value = { svg, code: started.code }
  pollTimer = setInterval(async () => {
    let answer: { pending?: boolean, token_hash?: string, error?: string }
    try {
      answer = await qrLogin({ action: 'poll', id, secret })
    } catch {
      return
    }
    if (answer.pending) return
    stopQr()
    if (answer.token_hash) await useTokenHash(answer.token_hash)
    else qrExpired.value = true
  }, 2000)
  // The request is good for five minutes.
  expireTimer = setTimeout(() => {
    stopQr()
    qrExpired.value = true
  }, 5 * 60_000)
}

function closeQr() {
  stopQr()
  qr.value = null
  qrExpired.value = false
}
onUnmounted(stopQr)
</script>

<template>
  <div class="account-form account-signin">
    <p v-if="typeof route.query.approve === 'string'" class="account-notice">{{ $t('account.signin.approveSignIn') }}</p>

    <!-- The QR code, in place of everything else while it is up. -->
    <template v-if="qr">
      <p class="account-lead">{{ $t('account.signin.qrScan') }}</p>
      <div v-if="!qrExpired" class="account-qr" v-html="qr.svg" />
      <p v-if="!qrExpired" class="account-qr-code">{{ $t('account.signin.qrCode', { code: qr.code }) }}</p>
      <p v-else class="account-note">{{ $t('account.signin.qrExpired') }}</p>
      <div class="account-actions-row">
        <button v-if="qrExpired" type="button" class="account-button" @click="startQr">{{ $t('account.signin.qrNew') }}</button>
        <button type="button" class="account-link" @click="closeQr">{{ $t('account.cancel') }}</button>
      </div>
    </template>

    <template v-else>
      <!-- Email: the letter's code is typed in here. -->
      <template v-if="sentTo">
        <p class="account-lead">
          <i18n-t keypath="account.sent" scope="global">
            <template #email><bdi class="account-strong">{{ sentTo }}</bdi></template>
          </i18n-t>
        </p>
        <form class="account-form" @submit.prevent="useCode">
          <label class="account-field">
            <span>{{ $t('account.signin.code') }}</span>
            <input v-model="code" class="account-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="12" required dir="ltr">
            <small>{{ $t('account.signin.codeHint') }}</small>
          </label>
          <button type="submit" class="account-button" :disabled="busy">{{ $t('account.signin.codeSubmit') }}</button>
        </form>
        <button type="button" class="account-link" @click="sentTo = ''; error = ''">{{ $t('account.otherEmail') }}</button>
      </template>
      <form v-else class="account-form" @submit.prevent="sendLink">
        <p class="account-lead">{{ $t('account.intro') }}</p>
        <label class="account-field">
          <span>{{ $t('account.email') }}</span>
          <input v-model="email" type="email" autocomplete="email" inputmode="email" required>
        </label>
        <button type="submit" class="account-button" :disabled="busy">{{ $t('account.sendLink') }}</button>
      </form>

      <label class="account-check">
        <input v-model="notMine" type="checkbox">
        <span>{{ $t('account.signin.notMine') }}</span>
      </label>

      <p class="account-or"><span>{{ $t('account.signin.or') }}</span></p>
      <TelegramLogin v-if="TELEGRAM_BOT" @done="telegramDone" />
      <button type="button" class="account-button account-button-quiet" @click="startQr">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4" stroke-linecap="round" /></svg>
        {{ $t('account.signin.qr') }}
      </button>
    </template>

    <p v-if="error" class="account-error" role="alert">{{ error }}</p>
  </div>
</template>
