<script setup lang="ts">
import type { Server } from '~/data/servers'

/**
 * Voting for a server, opened under its card: an optional in-game nickname
 * (for the reward, when the server gives one) and the button. In front of it,
 * ALTCHA, out of sight: the browser solves a small proof of work from the
 * `vote` function by itself while the box is open, a second or two, nothing
 * to click. Only when the function finds the vote suspicious (need_captcha)
 * does a Cloudflare Turnstile captcha appear, to be passed as well.
 * The `vote` function does the rest — one vote per IP per server every 12
 * hours, the reward postback — and its answer is shown here.
 *
 * The count on the page is the one the site was built with; a vote shows in
 * it after the next rebuild (within half an hour), so a vote just cast is
 * added here by hand meanwhile.
 */
const props = defineProps<{ server: Server }>()
const emit = defineEmits<{ voted: [] }>()

const { t, locale } = useI18n()

/** The same rule the function checks. */
const NICK = /^[\p{L}\p{N}_\-. ]{2,32}$/u

const nickname = ref('')
const token = ref<string | null>(null)
const busy = ref(false)
const done = ref(false)
const message = ref('')
const failed = ref(false)

/** The solved ALTCHA challenge, good for one vote. */
const altcha = ref<string | null>(null)
const checking = ref(true)
const widget = ref<(HTMLElement & { reset?: () => void, verify?: () => void }) | null>(null)
onMounted(async () => {
  try {
    await import('altcha')
  } catch {
    checking.value = false
    failed.value = true
    message.value = t('vote.altchaFailed')
  }
})
function onAltcha(event: Event) {
  const detail = (event as CustomEvent<{ state: string, payload?: string }>).detail
  checking.value = detail.state === 'verifying'
  altcha.value = detail.state === 'verified' ? detail.payload ?? null : null
  if (detail.state === 'error') {
    failed.value = true
    message.value = t('vote.altchaFailed')
  }
}
/** A challenge counts once: a fresh one after each attempt. */
function freshAltcha() {
  altcha.value = null
  checking.value = true
  widget.value?.reset?.()
  widget.value?.verify?.()
}

/** Turnstile, only once the function has asked for it. */
const needCaptcha = ref(false)
const captchaEl = ref<HTMLElement | null>(null)
let captcha: { reset: () => void, remove: () => void } | null = null
async function showCaptcha() {
  needCaptcha.value = true
  await nextTick()
  if (captcha) return captcha.reset()
  try {
    captcha = await mountTurnstile(captchaEl.value!, (value) => { token.value = value })
  } catch {
    failed.value = true
    message.value = t('vote.captchaLoad')
  }
}
onUnmounted(() => captcha?.remove())

/** "в 14:30" today, a full date and time otherwise, in the page's language. */
function when(iso: string) {
  const at = new Date(iso)
  const sameDay = at.toDateString() === new Date().toDateString()
  return new Intl.DateTimeFormat(locale.value, sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(at)
}

async function vote() {
  const nick = nickname.value.trim()
  if (nick && !NICK.test(nick)) {
    failed.value = true
    message.value = t('vote.badNickname')
    return
  }
  if (busy.value || (needCaptcha.value ? !token.value : !altcha.value)) return
  busy.value = true
  message.value = ''
  failed.value = false
  let answer: { ok?: boolean, error?: string, next_vote_at?: string, rewarded?: boolean } = {}
  try {
    const res = await fetch(`${FUNCTIONS_URL}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(needCaptcha.value
        ? { server_id: props.server.id, nickname: nick || undefined, captcha: token.value }
        : { server_id: props.server.id, nickname: nick || undefined, altcha: altcha.value })
    })
    answer = await res.json().catch(() => ({}))
  } catch {
    answer = { error: 'network' }
  }
  busy.value = false
  if (answer.ok) {
    done.value = true
    message.value = answer.rewarded ? t('vote.thanksRewarded') : t('vote.thanks')
    emit('voted')
    return
  }
  failed.value = true
  if (answer.error === 'need_captcha') {
    message.value = t('vote.needCaptcha')
    showCaptcha()
    return
  }
  message.value = answer.error === 'too_soon' && answer.next_vote_at
    ? t('vote.tooSoon', { time: when(answer.next_vote_at) })
    : answer.error === 'bad_nickname'
      ? t('vote.badNickname')
      : answer.error === 'captcha'
        ? t('vote.captchaFailed')
        : answer.error === 'altcha'
          ? t('vote.altchaFailed')
          : t('vote.failed')
  // A captcha answer and an ALTCHA solution count once, whatever the outcome.
  captcha?.reset()
  if (!needCaptcha.value) freshAltcha()
}
</script>

<template>
  <form class="vote-box" @submit.prevent="vote">
    <template v-if="!done">
      <!-- Only where a vote brings a reward: elsewhere the nickname goes nowhere. -->
      <label v-if="server.reward" class="account-field">
        <span>{{ $t('vote.nickname') }}</span>
        <input v-model="nickname" type="text" maxlength="32" autocomplete="off" autocapitalize="off" spellcheck="false">
        <small>{{ $t('vote.nicknameHint') }}</small>
      </label>
      <!-- Out of sight: solves its challenge by itself as the box opens. -->
      <altcha-widget
        ref="widget"
        class="vote-altcha"
        display="invisible"
        auto="onload"
        :challenge="`${FUNCTIONS_URL}/vote`"
        @statechange="onAltcha"
      />
      <div v-if="needCaptcha" ref="captchaEl" class="vote-captcha" />
      <button type="submit" class="account-button" :disabled="busy || (needCaptcha ? !token : !altcha)">{{ $t('vote.submit') }}</button>
      <small v-if="!needCaptcha && checking && !altcha" class="account-note vote-checking" role="status">{{ $t('vote.checking') }}</small>
    </template>
    <p v-if="message" class="vote-message" :class="{ 'vote-error': failed, 'vote-ok': done }" role="status">{{ message }}</p>
  </form>
</template>
